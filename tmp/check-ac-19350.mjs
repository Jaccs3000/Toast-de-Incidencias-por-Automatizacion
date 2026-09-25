import duckdb from 'duckdb';

const db = new duckdb.Database('data/jira-notifications.duckdb');
const conn = db.connect();

const sql = `SELECT i.key, i.project, i.issuetype, i.status, i.summary, pg.estado_general, pg.root_issue_key
FROM JIRA_ISSUES i
LEFT JOIN JIRA_PROJECT_GROUP_ISSUES pgi ON pgi.issue_id = i.id
LEFT JOIN JIRA_PROJECT_GROUPS pg ON pg.id = pgi.project_group_id
WHERE upper(i.key)=upper('AC-19350')
LIMIT 20;`;

try {
  const rows = await conn.all(sql);
  console.log(JSON.stringify(rows, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  conn.close();
  db.close();
}
