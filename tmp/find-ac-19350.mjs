import duckdb from 'duckdb';

const db = new duckdb.Database('data/jira-notifications.duckdb');
const conn = db.connect();

const queries = [
  "SELECT COUNT(*) AS total FROM JIRA_ISSUES WHERE upper(key) = upper('AC-19350')",
  "SELECT COUNT(*) AS total FROM JIRA_PROJECT_GROUPS WHERE upper(root_issue_key) = upper('AC-19350')",
  "SELECT key, project, issuetype, status, summary, id FROM JIRA_ISSUES WHERE upper(key) LIKE upper('AC-%') ORDER BY key LIMIT 20",
  "SELECT root_issue_key, id, estado_general FROM JIRA_PROJECT_GROUPS WHERE upper(root_issue_key) LIKE upper('AC-%') ORDER BY root_issue_key LIMIT 20"
];

for (const sql of queries) {
  const rows = await new Promise((resolve, reject) => {
    conn.all(sql, (error, result) => {
      if (error) reject(error);
      else resolve(result ?? []);
    });
  });
  console.log('\nSQL:', sql);
  console.log(rows.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]))));
}

conn.close();
db.close();
