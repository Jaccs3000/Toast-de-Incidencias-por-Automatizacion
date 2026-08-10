import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');
const projectRoot = process.cwd();
const databasePath = path.join(projectRoot, 'data', 'jira-notifications.duckdb');
const outputDirectory = path.join(projectRoot, 'exports');
const outputPath = path.join(outputDirectory, 'projectgroups-grafo.csv');

function query(connection, sql) {
  return new Promise((resolve, reject) => {
    connection.all(sql, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

await fs.mkdir(outputDirectory, { recursive: true });

const database = new duckdb.Database(databasePath, { access_mode: 'READ_ONLY' });
const connection = database.connect();

try {
  const rows = await query(connection, `
    SELECT
      pg.id AS project_group_id,
      pg.root_issue_key,
      pg.estado_general,
      i.issuetype,
      i.key AS issue_key
    FROM JIRA_PROJECT_GROUPS pg
    LEFT JOIN JIRA_PROJECT_GROUP_ISSUES pgi
      ON pgi.project_group_id = pg.id
    LEFT JOIN JIRA_ISSUES i
      ON i.id = pgi.issue_id
    ORDER BY pg.id, i.issuetype, i.key
  `);

  const issueTypes = [...new Set(rows.map((row) => row.issuetype).filter(Boolean))].sort();
  const groups = new Map();

  for (const row of rows) {
    const group = groups.get(row.project_group_id) ?? {
      project_group_id: row.project_group_id,
      root_issue_key: row.root_issue_key,
      estado_general: row.estado_general,
      types: new Map(),
    };

    if (row.issuetype && row.issue_key) {
      const keys = group.types.get(row.issuetype) ?? new Set();
      keys.add(row.issue_key);
      group.types.set(row.issuetype, keys);
    }

    groups.set(row.project_group_id, group);
  }

  const headers = ['project_group_id', 'root_issue_key', 'estado_general', ...issueTypes];
  const lines = [headers.map(csvValue).join(',')];

  for (const group of groups.values()) {
    const values = [group.project_group_id, group.root_issue_key, group.estado_general];
    for (const issueType of issueTypes) {
      values.push([...group.types.get(issueType) ?? []].join(' | '));
    }
    lines.push(values.map(csvValue).join(','));
  }

  await fs.writeFile(outputPath, `${lines.join('\r\n')}\r\n`, 'utf8');
  console.log(JSON.stringify({ outputPath, projectGroups: groups.size, issueTypes: issueTypes.length }, null, 2));
} finally {
  await new Promise((resolve) => connection.close(() => resolve()));
  await new Promise((resolve) => database.close(() => resolve()));
}
