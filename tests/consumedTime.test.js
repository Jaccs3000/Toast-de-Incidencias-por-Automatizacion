import test from 'node:test';
import assert from 'node:assert/strict';
import { AlertsService } from '../src/main/alerts/alertsService.js';
import { SyncService } from '../src/main/sync/syncService.js';
import { validateAlertConditionConfig } from '../src/shared/alerts/alertConditionValidation.js';
import { getConsumedTimePercentage } from '../src/shared/time/consumedTime.js';

const fields = [{
  field: 'timeConsumedPercent',
  label: 'Tiempo consumido (%)',
  type: 'number',
  min: 0,
  max: 100,
}];
const operators = [{ value: '>=', label: 'mayor o igual que' }];

function createJqlAlertHarness(rules) {
  const persistedAlerts = new Map();
  return new AlertsService({
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
        if (sql.includes('INTO ALERTS')) {
          persistedAlerts.set(parameters[1], {
            id: parameters[0],
            identity_key: parameters[1],
            is_read: 0,
            project_group_id: parameters[4],
          });
        }
      },
    },
    logs: { info: async () => {}, error: async () => {} },
  });
}

function timeRule() {
  return {
    id: 'rule-time-percent',
    jql_id: 'jql-1',
    alert_type: 'attribute_changed',
    name: 'Tiempo consumido',
    toast_text: 'Tiempo consumido alto',
    display_issue_type: 'Testing',
    display_field: 'timeConsumedPercent',
    condition_config: JSON.stringify({
      event: 'attribute_changed',
      conditions: [{ issueType: 'Testing', field: 'timeConsumedPercent', operator: '>=', value: '80' }],
    }),
    retry_minutes: 0,
    is_active: 1,
  };
}

function sourceInputs(previousPercent, incomingPercent) {
  const previousIssue = {
    project_group_id: 'group-1', id: '100', key: 'ABC-100', issuetype: 'Testing', status: 'En Progreso',
    timeestimate: 240, timespent: (240 * previousPercent) / 100,
    timeremaining: 240 - ((240 * previousPercent) / 100), timeConsumedPercent: previousPercent,
  };
  const incomingIssue = {
    ...previousIssue,
    timespent: (240 * incomingPercent) / 100,
    timeremaining: 240 - ((240 * incomingPercent) / 100),
    timeConsumedPercent: incomingPercent,
  };
  return {
    previousSnapshot: [previousIssue],
    incomingSnapshot: [incomingIssue],
    previousSources: [{ jql_id: 'jql-1', project_group_id: 'group-1', seed_issue_id: '100' }],
    incomingSources: [{ jqlId: 'jql-1', projectGroupId: 'group-1', seedIssueId: '100' }],
    previousProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
    incomingProjectGroups: [{ id: 'group-1', estado_general: 'No definido' }],
  };
}

test('calculates consumed time percentage from planned and spent minutes', () => {
  assert.equal(getConsumedTimePercentage(240, 192), 80);
  assert.ok(Math.abs(getConsumedTimePercentage(240, 264) - 110) < 1e-9);
  assert.equal(getConsumedTimePercentage(0, 10), null);
  assert.equal(getConsumedTimePercentage(null, 10), null);
});

test('adds consumed time percentage to the synchronization snapshot without changing stored time fields', () => {
  const service = new SyncService();
  const [snapshot] = service.getIncomingSnapshot([{
    id: 'group-1',
    members: [],
    issues: [{
      id: '100',
      key: 'ABC-100',
      fields: {
        project: { key: 'ABC' },
        issuetype: { name: 'Testing' },
        timeoriginalestimate: 14400,
        timespent: 7200,
      },
    }],
  }]);

  assert.equal(snapshot.timeestimate, 240);
  assert.equal(snapshot.timespent, 120);
  assert.equal(snapshot.timeremaining, 120);
  assert.equal(snapshot.timeConsumedPercent, 50);
});

test('validates consumed time alert thresholds from 0 to 100', () => {
  const valid = validateAlertConditionConfig({
    event: 'attribute_changed',
    conditions: [{ issueType: 'Testing', field: 'timeConsumedPercent', operator: '>=', value: '80' }],
  }, { fields, operators });
  const invalid = validateAlertConditionConfig({
    event: 'attribute_changed',
    conditions: [{ issueType: 'Testing', field: 'timeConsumedPercent', operator: '>=', value: '101' }],
  }, { fields, operators });

  assert.equal(valid.ok, true);
  assert.equal(invalid.ok, false);
  assert.match(invalid.errors[0], /menor o igual que 100/);
});

test('creates a consumed-time alert when the percentage crosses the threshold', async () => {
  const service = createJqlAlertHarness([timeRule()]);
  const result = await service.evaluateJqlAlerts(sourceInputs(62.5, 80));

  assert.equal(result.createdAlertsCount, 1);
  assert.equal(result.createdAlerts[0].toastMessage, 'Tiempo consumido alto\n\u2022 80%');
});

test('does not repeat a consumed-time alert while the threshold remains reached', async () => {
  const service = createJqlAlertHarness([timeRule()]);
  const result = await service.evaluateJqlAlerts(sourceInputs(80, 90));

  assert.equal(result.createdAlertsCount, 0);
});
