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
