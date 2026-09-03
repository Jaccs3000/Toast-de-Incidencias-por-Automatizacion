import assert from 'node:assert/strict';
import test from 'node:test';

import { SyncService } from '../src/main/sync/syncService.js';

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
