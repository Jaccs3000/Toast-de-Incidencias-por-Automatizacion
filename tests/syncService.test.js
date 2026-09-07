import assert from 'node:assert/strict';
import test from 'node:test';

import { SyncService } from '../src/main/sync/syncService.js';
import { isJiraAuthenticationSyncFailure, requiresVisibleJiraLogin } from '../src/shared/auth/sessionRequirement.js';

test('normalizes a moved source group for snapshot comparison', () => {
  const service = new SyncService();
  const result = service.normalizePreviousSnapshotForReassignedSources(
    [{ project_group_id: 'old-group', id: '100', key: 'ABC-100' }],
    [{ jql_id: 'jql-1', project_group_id: 'old-group', seed_issue_id: '100' }],
    [{ jqlId: 'jql-1', projectGroupId: 'new-group', seedIssueId: '100' }],
  );

  assert.deepEqual(result.snapshot, [
    { project_group_id: 'new-group', id: '100', key: 'ABC-100' },
  ]);
  assert.equal(result.moves.get('old-group'), 'new-group');
});

test('does not normalize an ambiguous group reassignment', () => {
  const service = new SyncService();
  const previousSources = [
    { jql_id: 'jql-1', project_group_id: 'old-group', seed_issue_id: '100' },
    { jql_id: 'jql-2', project_group_id: 'old-group', seed_issue_id: '200' },
  ];
  const incomingSources = [
    { jqlId: 'jql-1', projectGroupId: 'new-group-1', seedIssueId: '100' },
    { jqlId: 'jql-2', projectGroupId: 'new-group-2', seedIssueId: '200' },
  ];
  const snapshot = [{ project_group_id: 'old-group', id: '100', key: 'ABC-100' }];

  const result = service.normalizePreviousSnapshotForReassignedSources(
    snapshot,
    previousSources,
    incomingSources,
  );

  assert.deepEqual(result.snapshot, snapshot);
  assert.equal(result.moves.size, 0);
});

test('keeps the explicit login-required status when headless recovery fails', async () => {
  const statusUpdates = [];
  const service = new SyncService({
    persistence: {
      syncStatus: {
        async updateStatus(update) {
          statusUpdates.push(update);
        },
      },
    },
    auth: {
      async validateSession() {
        return { ok: false, reason: 'Jira login is required.' };
      },
      async tryHeadlessContinue() {
        return null;
      },
    },
    jira: { getMetrics() { return null; } },
    graph: {},
    alerts: {},
    logs: { info: async () => {}, warn: async () => {}, error: async () => {} },
    configuration: { app: { jiraBaseUrl: 'https://jira.example.test' } },
  });

  const result = await service.run();

  assert.equal(result.ok, false);
  assert.equal(statusUpdates.at(-1).last_status, 'Requiere inicio de sesión en Jira.');
});

test('only requests a visible login after headless recovery has failed', () => {
  assert.equal(requiresVisibleJiraLogin({
    session: { ok: false },
    appState: 'syncing',
    syncStatus: { is_running: 1, last_status: 'Sincronizando...' },
  }), false);
  assert.equal(requiresVisibleJiraLogin({
    session: { ok: false },
    appState: 'auth_required',
    syncStatus: { is_running: 0, last_status: 'Sincronizacion no iniciada' },
  }), false);
  assert.equal(requiresVisibleJiraLogin({
    session: { ok: false },
    appState: 'auth_required',
    syncStatus: { is_running: 0, last_status: 'Requiere inicio de sesión en Jira.' },
  }), true);
});

test('identifies stale synchronization errors caused by Jira authentication', () => {
  assert.equal(isJiraAuthenticationSyncFailure({
    last_status: 'Requiere inicio de sesion en Jira.',
    last_error_message: 'Jira session is not valid.',
  }), true);
  assert.equal(isJiraAuthenticationSyncFailure({
    last_status: 'Error al sincronizar',
    last_error_message: 'Connection timed out.',
  }), false);
});
