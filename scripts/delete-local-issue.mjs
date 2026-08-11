import path from 'node:path';
import { createRequire } from 'node:module';

const duckdb = createRequire(import.meta.url)('duckdb');
const [issueKey, confirmation] = process.argv.slice(2);

if (!issueKey || confirmation !== '--confirm') {
  console.error('Uso: node scripts/delete-local-issue.mjs CLAVE --confirm');
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
  const issues = await query('SELECT id FROM JIRA_ISSUES WHERE key = ?', [issueKey]);
  if (issues.length === 0) {
    throw new Error(`No existe ${issueKey} en la BD local.`);
  }

  const issueId = issues[0].id;
  await exec('BEGIN TRANSACTION');
  try {
    await exec('DELETE FROM ALERTS WHERE issue_id = ? OR issue_id = ?', [issueId, issueKey]);
    await exec('DELETE FROM SYNC_CHANGES WHERE issue_id = ? OR issue_key = ?', [issueId, issueKey]);
    await exec('DELETE FROM JIRA_RELATIONSHIPS WHERE from_issue_id = ? OR to_issue_id = ?', [issueId, issueId]);
    await exec('DELETE FROM JIRA_PROJECT_GROUP_ISSUES WHERE issue_id = ?', [issueId]);
    await exec('DELETE FROM JIRA_ISSUES WHERE id = ?', [issueId]);
    await exec(`
      DELETE FROM JIRA_PROJECT_GROUPS
      WHERE NOT EXISTS (
        SELECT 1 FROM JIRA_PROJECT_GROUP_ISSUES pgi
        WHERE pgi.project_group_id = JIRA_PROJECT_GROUPS.id
      )
    `);
    await exec('COMMIT');
  } catch (error) {
    await exec('ROLLBACK').catch(() => {});
    throw error;
  }

  console.log(`Eliminada localmente ${issueKey}, junto con sus relaciones y membresias.`);
} catch (error) {
  console.error(`No se pudo eliminar ${issueKey}: ${error.message}`);
  process.exitCode = 1;
} finally {
  await new Promise((resolve) => connection.close(() => resolve()));
  await new Promise((resolve) => database.close(() => resolve()));
}
