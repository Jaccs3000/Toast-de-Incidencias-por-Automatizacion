import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertsService } from '../src/main/alerts/alertsService.js';
import { Persistence } from '../src/main/persistence/persistence.js';
import { AlertsRepository } from '../src/main/persistence/repositories/alertsRepository.js';

test('sends the first toast immediately even when retry is configured', async () => {
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
});

test('sends a toast when the retry countdown is due', async () => {
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
    isRetry: true,
    toastMessage: 'Nueva incidencia asignada',
    rule: { id: 'rule-1', retry_minutes: 15, toast_text: 'Nueva incidencia asignada' },
    row: { issue_id: 'ABC-123' },
  }]);

  assert.equal(sentToasts.length, 1);
  assert.equal(sentToasts[0].message, 'Nueva incidencia asignada');
  assert.equal(sentToasts[0].alertId, 'alert-1');
});

test('keeps the persisted complete toast message when retrying', async () => {
  const updates = [];
  const sentToasts = [];
  const alerts = new AlertsService({
    persistence: {
      async query(sql) {
        if (sql.includes('FROM ALERT_RULES')) return [{ id: 'rule-1', toast_text: 'Base', retry_minutes: 1, display_fields_json: '[]' }];
        if (sql.includes('FROM ALERTS')) return [{ id: 'alert-1', issue_id: 'ABC-123', next_retry_at: '2020-01-01T00:00:00.000Z', payload_json: JSON.stringify({ toast_message: 'Base\n• Resumen\n• Informador' }) }];
        return [];
      },
      async exec(sql, parameters) { updates.push({ sql, parameters }); },
    },
    toast: { async show(toast) { sentToasts.push(toast); return { ok: true }; } },
    logs: { info: async () => {} },
  });
  const result = await alerts.repeatUnreadAlerts([{ id: 'rule-1', toast_text: 'Base', retry_minutes: 1 }]);
  await alerts.notifyCreated(result);
  assert.equal(sentToasts[0].message, 'Base\n• Resumen\n• Informador');
  assert.equal(updates.length, 1);
});

test('sends the initial toast when no retry countdown is configured', async () => {
  const sentToasts = [];
  const alerts = new AlertsService({
    toast: { async show(toast) { sentToasts.push(toast); return { ok: true }; } },
    logs: { info: async () => {} },
  });

  await alerts.notifyCreated([{
    alertId: 'alert-1', issueId: 'ABC-123', toastMessage: 'Nueva incidencia asignada',
    rule: { id: 'rule-1', retry_minutes: 0 }, row: { issue_id: 'ABC-123' },
  }]);

  assert.equal(sentToasts.length, 1);
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

test('preserves each unread alert retry countdown across a pause', async () => {
  const updates = [];
  const alerts = new AlertsRepository({
    async query() {
      return [
        { id: 'alert-1', next_retry_at: '2026-09-04T10:02:00.000Z' },
        { id: 'alert-2', next_retry_at: '2026-09-04T10:00:00.000Z' },
      ];
    },
    async exec(sql, parameters) {
      updates.push({ sql, parameters });
    },
  });

  const updated = await alerts.resumeUnreadRetries({
    lockedAt: '2026-09-04T10:00:00.000Z',
    unlockedAt: '2026-09-04T10:05:00.000Z',
  });

  assert.equal(updated, 2);
  assert.equal(updates[0].parameters[0], '2026-09-04T10:07:00.000Z');
  assert.equal(updates[1].parameters[0], '2026-09-04T10:05:00.000Z');
});

test('uses the alert payload icon when its issue is no longer in the current mirror', async () => {
  const persistence = new Persistence(':memory:');
  await persistence.initialize();

  try {
    const now = new Date().toISOString();
    const iconUrl = 'https://example.test/issuetype-icon.png';
    await persistence.exec(`
      INSERT INTO ALERT_RULES (
        id, jql_id, alert_type, name, sql, toast_text, retry_syncs, retry_minutes,
        is_active, created, updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'rule-icon-fallback', 'jql-icon-fallback', 'new_issue', 'Alerta con icono',
      '', 'Alerta con icono', 0, 0, 1, now, now,
    ]);
    await persistence.exec(`
      INSERT INTO ALERTS (
        id, identity_key, rule_id, issue_id, project_group_id, is_read,
        created, updated, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'alert-icon-fallback', 'identity-icon-fallback', 'rule-icon-fallback',
      'missing-issue-id', 'group-icon-fallback', 0, now, now,
      JSON.stringify({ issuetype_icon_url: iconUrl }),
    ]);

    const unreadAlerts = await new AlertsRepository(persistence).listUnread();

    assert.equal(unreadAlerts.length, 1);
    assert.equal(unreadAlerts[0].issuetype_icon_url, iconUrl);
  } finally {
    await persistence.close();
  }
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
          const alert = persistedAlerts.get(parameters[0]);
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
          persistedAlerts.set(parameters[1], {
            id: parameters[0],
            is_read: 0,
            project_group_id: parameters[4],
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

function createJqlAlertHarness(rules) {
  const persistedAlerts = new Map();
  const operations = [];
  return {
    persistedAlerts,
    operations,
    service: new AlertsService({
      persistence: {
        async query(sql, parameters = []) {
          if (sql.includes('FROM ALERT_RULES')) return rules;
          if (sql.includes('FROM ALERTS')) {
            const alert = persistedAlerts.get(parameters[0]);
            return alert ? [alert] : [];
          }
          return [];
        },
        async exec(sql, parameters = []) {
          operations.push({ sql, parameters });
          if (sql.includes('INTO ALERTS')) {
            persistedAlerts.set(parameters[1], {
              id: parameters[0],
              identity_key: parameters[1],
              is_read: 0,
              project_group_id: parameters[4],
            });
          } else if (sql.includes('SET identity_key')) {
            const alert = [...persistedAlerts.values()].find((item) => item.id === parameters[4]);
            if (alert) {
              persistedAlerts.delete(alert.identity_key);
              alert.identity_key = parameters[0];
              alert.project_group_id = parameters[1];
              alert.payload_json = parameters[2];
              persistedAlerts.set(alert.identity_key, alert);
            }
          } else if (sql.includes('SET is_read')) {
            const alert = [...persistedAlerts.values()].find((item) => item.id === parameters[4]);
            if (alert) {
              alert.is_read = parameters[0];
              alert.project_group_id = parameters[1];
              alert.payload_json = parameters[2];
            }
          } else if (sql.includes('DELETE FROM ALERTS')) {
            const alert = [...persistedAlerts.values()].find((item) => item.id === parameters[0]);
            if (alert) persistedAlerts.delete(alert.identity_key);
          }
        },
      },
      logs: { info: async () => {}, error: async () => {} },
    }),
  };
}

test('auto-completes only unread JQL alerts whose issue left the matching JQL result', async () => {
  const unread = [
    { id: 'alert-left', issue_id: '100', jql_id: 'jql-1' },
    { id: 'alert-still-matches', issue_id: '200', jql_id: 'jql-1' },
    { id: 'alert-query-not-evaluated', issue_id: '300', jql_id: 'jql-2' },
  ];
  const updates = [];
  const service = new AlertsService({
    persistence: {
      async query(sql) {
        if (sql.includes('COALESCE(r.auto_complete')) return unread;
        if (sql.includes('FROM ALERT_RULES')) return [];
        return [];
      },
      async exec(sql, parameters) {
        updates.push({ sql, parameters });
      },
    },
    logs: { info: async () => {} },
  });

  const result = await service.evaluateJqlAlerts({
    matchingIssueIdsByJql: new Map([
      ['jql-1', new Set(['200'])],
    ]),
  });

  assert.equal(result.autoCompletedAlertsCount, 1);
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /SET is_read = 1/);
  assert.equal(updates[0].parameters[1], 'alert-left');
});

test('creates a JQL new-issue alert only when the JQL source is new', async () => {
  const { service } = createJqlAlertHarness([{
    id: 'rule-new',
    jql_id: 'jql-1',
    alert_type: 'new_issue',
    name: 'Nueva incidencia',
    toast_text: 'Llegó una incidencia',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const incomingIssue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Creado',
  };

  const first = await service.evaluateJqlAlerts({
    incomingSnapshot: [incomingIssue],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  });
  const existing = await service.evaluateJqlAlerts({
    previousSnapshot: [incomingIssue],
    incomingSnapshot: [incomingIssue],
    previousSources: [{ jql_id: 'jql-1', project_group_id: 'group-1', seed_issue_id: '100' }],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    previousProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  });

  assert.equal(first.createdAlertsCount, 1);
  assert.equal(existing.createdAlertsCount, 0);
});

test('creates a new-issue alert when a second JQL discovers an existing issue', async () => {
  const { service } = createJqlAlertHarness([{
    id: 'rule-second-jql',
    jql_id: 'jql-2',
    alert_type: 'new_issue',
    name: 'Nueva incidencia',
    toast_text: 'Lleg\u00f3 una incidencia',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const issue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Creado',
  };

  const result = await service.evaluateJqlAlerts({
    previousSnapshot: [issue],
    incomingSnapshot: [issue],
    previousSources: [{ jql_id: 'jql-1', project_group_id: 'group-1', seed_issue_id: '100' }],
    incomingSources: [{ jqlId: 'jql-2', projectGroupId: 'group-1', seedIssueId: '100' }],
    previousProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  });

  assert.equal(result.createdAlertsCount, 1);
  assert.equal(result.createdAlerts[0].issueId, '100');
  assert.equal(result.createdAlerts[0].rule.id, 'rule-second-jql');
});

test('uses the JQL source issue when building the optional notification value', async () => {
  const { service } = createJqlAlertHarness([{
    id: 'rule-new-source',
    jql_id: 'jql-1',
    alert_type: 'new_issue',
    name: 'Nueva incidencia',
    toast_text: 'Llegó una incidencia',
    display_issue_type: '__jql_source_issue__',
    display_field: 'key',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const sourceIssue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Test Tarea', status: 'Creado',
  };
  const relatedIssue = {
    project_group_id: 'group-1', id: '200', key: 'ABC-200', issuetype: 'Testing', status: 'En Progreso',
  };

  const result = await service.evaluateJqlAlerts({
    incomingSnapshot: [sourceIssue, relatedIssue],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  });

  assert.equal(result.createdAlertsCount, 1);
  assert.equal(result.createdAlerts[0].toastMessage, 'Llegó una incidencia\n• ABC-100');
});

test('creates an attribute alert only when its JQL-scoped condition changes to matching', async () => {
  const { service } = createJqlAlertHarness([{
    id: 'rule-change',
    jql_id: 'jql-1',
    alert_type: 'attribute_changed',
    name: 'Producción',
    toast_text: 'Proyecto en producción',
    display_issue_type: 'Testing',
    display_field: 'key',
    condition_config: JSON.stringify({
      event: 'attribute_changed',
      conditions: [{ issueType: 'Otros', field: 'estadoGeneral', operator: '=', value: 'En Producción' }],
    }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const issue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Cerrado',
  };
  const result = await service.evaluateJqlAlerts({
    previousSnapshot: [issue],
    incomingSnapshot: [issue],
    previousSources: [{ jql_id: 'jql-1', project_group_id: 'group-1', seed_issue_id: '100' }],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    previousProjectGroups: [{ id: 'group-1', estado_general: 'Probando en PRE' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'En Producción' }],
  });

  assert.equal(result.createdAlertsCount, 1);
  assert.equal(result.createdAlerts[0].toastMessage, 'Proyecto en producción\n• ABC-100');
});

test('creates every matching alert of the owning JQL independently', async () => {
  const baseRule = {
    jql_id: 'jql-1',
    alert_type: 'new_issue',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 0,
    is_active: 1,
  };
  const { service } = createJqlAlertHarness([
    { ...baseRule, id: 'rule-1', name: 'Primera', toast_text: 'Primera alerta' },
    { ...baseRule, id: 'rule-2', name: 'Segunda', toast_text: 'Segunda alerta' },
    { ...baseRule, id: 'rule-other', jql_id: 'jql-2', name: 'Otro JQL', toast_text: 'No aplica' },
  ]);
  const issue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Creado',
  };

  const result = await service.evaluateJqlAlerts({
    incomingSnapshot: [issue],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  });

  assert.equal(result.createdAlertsCount, 2);
  assert.deepEqual(result.createdAlerts.map((alert) => alert.rule.id), ['rule-1', 'rule-2']);
});

test('does not repeat the same alert occurrence even if it is evaluated again', async () => {
  const { service } = createJqlAlertHarness([{
    id: 'rule-new',
    jql_id: 'jql-1',
    alert_type: 'new_issue',
    name: 'Nueva',
    toast_text: 'Nueva incidencia',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const input = {
    incomingSnapshot: [{
      project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Creado',
    }],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  };

  const first = await service.evaluateJqlAlerts(input);
  const second = await service.evaluateJqlAlerts(input);

  assert.equal(first.createdAlertsCount, 1);
  assert.equal(second.createdAlertsCount, 0);
});

test('does not create an attribute alert when its condition was already true', async () => {
  const { service } = createJqlAlertHarness([{
    id: 'rule-change',
    jql_id: 'jql-1',
    alert_type: 'attribute_changed',
    name: 'Producción',
    toast_text: 'Proyecto en producción',
    condition_config: JSON.stringify({
      event: 'attribute_changed',
      conditions: [{ issueType: 'Otros', field: 'estadoGeneral', operator: '=', value: 'En Producción' }],
    }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const issue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Cerrado',
  };

  const result = await service.evaluateJqlAlerts({
    previousSnapshot: [issue],
    incomingSnapshot: [issue],
    previousSources: [{ jql_id: 'jql-1', project_group_id: 'group-1', seed_issue_id: '100' }],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    previousProjectGroups: [{ id: 'group-1', estado_general: 'En Producción' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'En Producción' }],
  });

  assert.equal(result.createdAlertsCount, 0);
});

test('moves a JQL alert with its source group without creating a duplicate', async () => {
  const { service, persistedAlerts } = createJqlAlertHarness([{
    id: 'rule-new',
    jql_id: 'jql-1',
    alert_type: 'new_issue',
    name: 'Nueva incidencia',
    toast_text: 'Nueva incidencia',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 2,
    is_active: 1,
  }]);
  const oldIssue = {
    project_group_id: 'old-group', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Creado',
  };
  const newIssue = { ...oldIssue, project_group_id: 'new-group' };
  const oldSource = { jql_id: 'jql-1', project_group_id: 'old-group', seed_issue_id: '100' };
  const newSource = { jqlId: 'jql-1', projectGroupId: 'new-group', seedIssueId: '100' };

  const first = await service.evaluateJqlAlerts({
    incomingSnapshot: [oldIssue],
    incomingSources: [oldSource],
    incomingProjectGroups: [{ id: 'old-group', estado_general: 'No definido' }],
  });
  const oldIdentity = 'rule-new:jql-1:old-group:100';
  const newIdentity = 'rule-new:jql-1:new-group:100';
  assert.equal(first.createdAlertsCount, 1);
  assert.equal(persistedAlerts.has(oldIdentity), true);

  const moved = await service.evaluateJqlAlerts({
    previousSnapshot: [oldIssue],
    incomingSnapshot: [newIssue],
    previousSources: [oldSource],
    incomingSources: [newSource],
    previousProjectGroups: [{ id: 'old-group', estado_general: 'No definido' }],
    incomingProjectGroups: [{ id: 'new-group', estado_general: 'No definido' }],
  });

  assert.equal(moved.createdAlertsCount, 0);
  assert.equal(persistedAlerts.has(oldIdentity), false);
  assert.equal(persistedAlerts.has(newIdentity), true);
  assert.equal(persistedAlerts.get(newIdentity).is_read, 0);
});

test('preserves a read JQL alert when its source group is reassigned', async () => {
  const { service, persistedAlerts } = createJqlAlertHarness([{
    id: 'rule-new',
    jql_id: 'jql-1',
    alert_type: 'new_issue',
    name: 'Nueva incidencia',
    toast_text: 'Nueva incidencia',
    condition_config: JSON.stringify({ event: 'new_issue', conditions: [] }),
    retry_minutes: 0,
    is_active: 1,
  }]);
  const oldIssue = {
    project_group_id: 'old-group', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'Creado',
  };
  const newIssue = { ...oldIssue, project_group_id: 'new-group' };
  const oldSource = { jql_id: 'jql-1', project_group_id: 'old-group', seed_issue_id: '100' };
  const newSource = { jqlId: 'jql-1', projectGroupId: 'new-group', seedIssueId: '100' };
  const oldIdentity = 'rule-new:jql-1:old-group:100';
  const newIdentity = 'rule-new:jql-1:new-group:100';

  await service.evaluateJqlAlerts({
    incomingSnapshot: [oldIssue],
    incomingSources: [oldSource],
    incomingProjectGroups: [{ id: 'old-group', estado_general: 'No definido' }],
  });
  persistedAlerts.get(oldIdentity).is_read = 1;

  const moved = await service.evaluateJqlAlerts({
    previousSnapshot: [oldIssue],
    incomingSnapshot: [newIssue],
    previousSources: [oldSource],
    incomingSources: [newSource],
    previousProjectGroups: [{ id: 'old-group', estado_general: 'No definido' }],
    incomingProjectGroups: [{ id: 'new-group', estado_general: 'No definido' }],
  });

  assert.equal(moved.createdAlertsCount, 0);
  assert.equal(persistedAlerts.has(newIdentity), true);
  assert.equal(persistedAlerts.get(newIdentity).is_read, 1);
});
