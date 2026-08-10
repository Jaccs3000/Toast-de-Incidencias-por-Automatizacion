import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');
const projectRoot = process.cwd();
const databasePath = path.join(projectRoot, 'data', 'jira-notifications.duckdb');
const outputDirectory = path.join(projectRoot, 'exports');
const filterIssueKey = process.argv[2] ?? null;
const outputName = filterIssueKey
  ? `incidencias-projectgroup-${filterIssueKey}.csv`
  : 'incidencias-projectgroups.csv';
const outputPath = path.join(outputDirectory, outputName);

function query(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.all(sql, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatBogotaDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

await fs.mkdir(outputDirectory, { recursive: true });
const database = new duckdb.Database(databasePath, { access_mode: 'READ_ONLY' });
const connection = database.connect();

try {
  const rows = await query(connection, `
    SELECT
      i.id, i.key, i.project, i.issuetype, i.summary, i.status,
      i.reporter, i.assignee, i.created, i.updated, i.parent,
      i.timeestimate, i.timespent, i.issuelinks, i.description,
      string_agg(DISTINCT pgi.project_group_id, ' | ') AS project_groups
    FROM JIRA_ISSUES i
    LEFT JOIN JIRA_PROJECT_GROUP_ISSUES pgi ON pgi.issue_id = i.id
    ${filterIssueKey ? `WHERE EXISTS (
      SELECT 1
      FROM JIRA_PROJECT_GROUP_ISSUES selected_group
      JOIN JIRA_ISSUES selected_issue ON selected_issue.id = selected_group.issue_id
      WHERE selected_group.project_group_id IN (
        SELECT project_group_id
        FROM JIRA_PROJECT_GROUP_ISSUES
        WHERE issue_id = (SELECT id FROM JIRA_ISSUES WHERE key = '${filterIssueKey.replaceAll("'", "''")}')
      )
      AND selected_group.project_group_id = pgi.project_group_id
    )` : ''}
    GROUP BY i.id, i.key, i.project, i.issuetype, i.summary, i.status,
      i.reporter, i.assignee, i.created, i.updated, i.parent,
      i.timeestimate, i.timespent, i.issuelinks, i.description
    ORDER BY i.id
  `);

  const fields = [
    ['ID', 'id'],
    ['ProjectGroup', 'project_groups'],
    ['Proyecto', 'project'],
    ['Tipo', 'issuetype'],
    ['Resumen', 'summary'],
    ['Estado', 'status'],
    ['Reporter', 'reporter'],
    ['Responsable', 'assignee'],
    ['Creada', 'created'],
    ['Actualizada', 'updated'],
    ['Padre', 'parent'],
    ['Estimación', 'timeestimate'],
    ['Tiempo empleado', 'timespent'],
    ['Enlaces', 'issuelinks'],
    ['Descripción', 'description'],
  ];

  const formatDuration = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const totalMinutes = Math.floor(Number(value) / 60);
    if (!Number.isFinite(totalMinutes)) return '';
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const lines = [];
  lines.push(['Campo', ...rows.map((row) => row.key)].map(csvValue).join(','));
  for (const [label, property] of fields) {
    lines.push([label, ...rows.map((row) => {
      if (property === 'created' || property === 'updated') {
        return formatBogotaDate(row[property]);
      }
      if (property === 'timeestimate' || property === 'timespent') {
        return formatDuration(row[property]);
      }
      return row[property] ?? '';
    })].map(csvValue).join(','));
  }

  await fs.writeFile(outputPath, `${lines.join('\r\n')}\r\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, issues: rows.length, fields: fields.length }, null, 2));
} finally {
  await new Promise((resolve) => connection.close(() => resolve()));
  await new Promise((resolve) => database.close(() => resolve()));
}
