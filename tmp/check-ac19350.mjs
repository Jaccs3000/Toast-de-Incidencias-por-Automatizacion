import duckdb from 'duckdb';

const { Database } = duckdb;
const db = new Database('data/jira-notifications.duckdb');
const conn = await db.connect();

const rows = await conn.all("SELECT id, source, root_issue_id, root_issue_key, estado_general, created, updated FROM JIRA_PROJECT_GROUPS WHERE root_issue_key = 'AC-19350' ORDER BY updated DESC LIMIT 20");
console.log('PROJECT_GROUPS');
console.log(JSON.stringify(rows, null, 2));

const issueRows = await conn.all("SELECT project_group_id, issue_id FROM JIRA_PROJECT_GROUP_ISSUES WHERE project_group_id IN (SELECT id FROM JIRA_PROJECT_GROUPS WHERE root_issue_key = 'AC-19350') ORDER BY issue_id LIMIT 20");
console.log('PROJECT_GROUP_ISSUES');
console.log(JSON.stringify(issueRows, null, 2));

await conn.close();
await db.close();
