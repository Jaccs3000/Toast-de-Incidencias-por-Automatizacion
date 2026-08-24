import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertsService } from '../src/main/alerts/alertsService.js';

test('sends the first toast immediately even when alert retry is configured', async () => {
  const sentToasts = [];
  const alerts = new AlertsService({
    toast: {
      async show(toast) {
        sentToasts.push(toast);
        return { ok: true };
      },
    },
    logs: { info: async () => {} },
  });

  await alerts.notifyCreated([{
    alertId: 'alert-1',
    issueId: 'ABC-123',
    toastMessage: 'Nueva incidencia asignada',
    rule: { id: 'rule-1', retry_minutes: 15, toast_text: 'Nueva incidencia asignada' },
    row: { issue_id: 'ABC-123' },
  }]);

  assert.equal(sentToasts.length, 1);
  assert.equal(sentToasts[0].message, 'Nueva incidencia asignada');
  assert.equal(sentToasts[0].alertId, 'alert-1');
});

test('reschedules unread alert retries from the moment the retry service is enabled', async () => {
  const updates = [];
  const alerts = new AlertsService({
    persistence: {
      async query() {
        return [
          { id: 'rule-1', retry_minutes: 2 },
          { id: 'rule-2', retry_minutes: 0 },
        ];
      },
      async exec(sql, parameters) {
        updates.push({ sql, parameters });
      },
    },
    logs: { info: async () => {} },
  });
  const before = Date.now();

  await alerts.scheduleUnreadRetriesFromNow();

  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /UPDATE ALERTS/);
  assert.equal(updates[0].parameters[2], 'rule-1');
  const scheduledAt = new Date(updates[0].parameters[0]).getTime();
  assert.ok(scheduledAt >= before + (2 * 60000));
  assert.ok(scheduledAt <= Date.now() + (2 * 60000) + 1000);
});

test('deduplicates repeated issue rows before creating an alert', async () => {
  const inserts = [];
  const persistedAlerts = new Map();
  const alerts = new AlertsService({
    persistence: {
      async query(sql, parameters = []) {
        if (sql.includes('FROM ALERT_RULES')) {
          return [{ id: 'rule-1', name: 'Nueva', sql: 'RULE_ROWS', toast_text: 'Nueva', retry_minutes: 0, is_active: 1 }];
        }
        if (sql.includes('FROM ALERTS')) {
          const key = `${parameters[0]}:${parameters[1]}`;
          const alert = persistedAlerts.get(key);
          return alert ? [alert] : [];
        }
        return [
          { issue_id: 'ABC-123', project_group_id: 'group-1' },
          { issue_id: 'ABC-123', project_group_id: 'group-1' },
        ];
      },
      async exec(sql, parameters = []) {
        if (sql.includes('INTO ALERTS')) {
          inserts.push(sql);
          persistedAlerts.set(`${parameters[1]}:${parameters[2]}`, {
            id: parameters[0],
            is_read: 0,
            project_group_id: parameters[3],
          });
        }
      },
    },
    logs: { info: async () => {} },
  });

  const result = await alerts.evaluate();

  assert.equal(result.createdAlertsCount, 1);
  assert.equal(inserts.length, 1);
});
