import test from 'node:test';
import assert from 'node:assert/strict';
import { Persistence } from '../src/main/persistence/persistence.js';

test('persists JQL definitions and removes only alerts associated with a deleted JQL', async () => {
  const persistence = new Persistence(':memory:');
  await persistence.initialize();

  const definitions = await persistence.jqlDefinitions.ensureFromQueries([
    'project = ABC',
    'project = XYZ',
  ]);
  assert.equal(definitions.length, 2);

  const now = new Date().toISOString();
  await persistence.exec(`
    INSERT INTO ALERT_RULES (
      id, jql_id, alert_type, name, sql, toast_text, condition_config,
      retry_syncs, retry_minutes, is_active, created, updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    'rule-1', definitions[0].id, 'new_issue', 'Nueva', '', 'Nueva',
    JSON.stringify({ event: 'new_issue', conditions: [] }), 0, 0, 1, now, now,
  ]);
  await persistence.exec(`
    INSERT INTO ALERTS (
      id, identity_key, rule_id, issue_id, project_group_id, is_read, created, updated
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, ['alert-1', 'identity-1', 'rule-1', '100', 'group-1', 0, now, now]);

  const storedRules = await persistence.alerts.listRules();
  assert.equal(Number(storedRules[0].auto_complete), 0);
  await persistence.exec('UPDATE ALERT_RULES SET auto_complete = 1 WHERE id = ?', ['rule-1']);
  assert.equal(Number((await persistence.alerts.listRules())[0].auto_complete), 1);

  const saved = await persistence.jqlDefinitions.replace([definitions[1]]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, definitions[1].id);
  assert.equal((await persistence.query('SELECT COUNT(*) AS total FROM ALERT_RULES'))[0].total, 0n);
  assert.equal((await persistence.query('SELECT COUNT(*) AS total FROM ALERTS'))[0].total, 0n);

  await persistence.close();
});
