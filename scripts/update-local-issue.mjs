import path from 'node:path';
import { createRequire } from 'node:module';

const duckdb = createRequire(import.meta.url)('duckdb');
const allowedFields = new Set([
  'project', 'issuetype', 'summary', 'description', 'status', 'reporter',
  'assignee', 'created', 'updated', 'parent', 'timeestimate', 'timespent', 'issuelinks',
]);

const [issueKey, field, ...valueParts] = process.argv.slice(2);
const value = valueParts.join(' ');

if (!issueKey || !allowedFields.has(field) || value === '') {
  console.error('Uso: node scripts/update-local-issue.mjs CLAVE CAMPO VALOR');
  console.error(`Campos permitidos: ${[...allowedFields].join(', ')}`);
  process.exit(1);
}

const numericFields = new Set(['timeestimate', 'timespent']);
const parsedValue = numericFields.has(field) ? Number(value) : value;

if (numericFields.has(field) && (!Number.isFinite(parsedValue) || parsedValue < 0)) {
  console.error(`${field} debe ser un numero mayor o igual que cero.`);
  process.exit(1);
}

const database = new duckdb.Database(path.join(process.cwd(), 'data', 'jira-notifications.duckdb'));
const connection = database.connect();

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    connection.all(sql, ...params, (error, rows) => error ? reject(error) : resolve(rows));
  });
}

function exec(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (params.length === 0) {
      connection.exec(sql, (error) => error ? reject(error) : resolve());
      return;
    }

    const statement = connection.prepare(sql);
    statement.run(...params, (error) => error ? reject(error) : resolve());
  });
}

try {
  const rows = await query('SELECT id, key FROM JIRA_ISSUES WHERE key = ?', [issueKey]);
  if (rows.length === 0) {
    throw new Error(`No existe ${issueKey} en la BD local.`);
  }

  await exec('BEGIN TRANSACTION');
  try {
    await exec(`UPDATE JIRA_ISSUES SET "${field}" = ? WHERE key = ?`, [parsedValue, issueKey]);
    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    throw error;
  }

  console.log(`Actualizada localmente ${issueKey}: ${field} = ${value}`);
} catch (error) {
  console.error(`No se pudo actualizar ${issueKey}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => connection.close(() => resolve()));
  await new Promise((resolve) => database.close(() => resolve()));
}
