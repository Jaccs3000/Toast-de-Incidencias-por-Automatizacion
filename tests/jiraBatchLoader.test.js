import assert from 'node:assert/strict';
import test from 'node:test';

import { JiraBatchLoader } from '../src/main/jira/jiraBatchLoader.js';

function makeIssue(key) {
  return {
    id: key.replace(/\D/g, '') || key,
    key,
    fields: {
      issuetype: { name: 'Testing' },
    },
  };
}

test('groups pending issue keys and deduplicates shared requests', async () => {
  const calls = [];
  const jira = {
    async bulkFetchIssues(keys) {
      calls.push(keys);
      return { issues: keys.map(makeIssue), issueErrors: [] };
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0 });

  const [first, duplicate, second] = await Promise.all([
    loader.load('ABC-1'),
    loader.load('abc-1'),
    loader.load('ABC-2'),
  ]);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['ABC-1', 'ABC-2']);
  assert.equal(first.key, 'ABC-1');
  assert.strictEqual(first, duplicate);
  assert.equal(second.key, 'ABC-2');
  assert.equal(loader.getStats().deduplicatedLoads, 1);
});

test('splits more than 100 issue keys into bounded batches', async () => {
  const calls = [];
  const jira = {
    async bulkFetchIssues(keys) {
      calls.push(keys);
      return { issues: keys.map(makeIssue), issueErrors: [] };
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0, concurrency: 2 });
  const issues = await Promise.all(Array.from({ length: 205 }, (_, index) => loader.load(`ABC-${index + 1}`)));

  assert.equal(issues.length, 205);
  assert.deepEqual(calls.map((keys) => keys.length).sort((a, b) => b - a), [100, 100, 5]);
  assert.equal(loader.getStats().batchRequests, 3);
  assert.equal(loader.getStats().requestedKeys, 205);
});

test('rejects the complete batch when Jira reports an issue error', async () => {
  const jira = {
    async bulkFetchIssues(keys) {
      return {
        issues: keys.slice(0, 1).map(makeIssue),
        issueErrors: [{ issueIdOrKey: keys[1], errorMessage: 'Not found' }],
      };
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0 });
  const results = await Promise.allSettled([loader.load('ABC-1'), loader.load('ABC-2')]);

  assert.equal(results[0].status, 'rejected');
  assert.equal(results[1].status, 'rejected');
  assert.match(results[0].reason.message, /could not load 1 issue/i);
});

test('does not call Jira when synchronization is already canceled', async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false;
  const jira = {
    async bulkFetchIssues() {
      called = true;
      return { issues: [], issueErrors: [] };
    },
  };
  const loader = new JiraBatchLoader({ jira, signal: controller.signal, flushDelayMs: 0 });

  await assert.rejects(loader.load('ABC-1'), { name: 'AbortError' });
  assert.equal(called, false);
});

test('retries a rate-limited batch using Jira retry metadata', async () => {
  let calls = 0;
  const jira = {
    async bulkFetchIssues(keys) {
      calls += 1;
      if (calls === 1) {
        const error = new Error('Rate limited');
        error.status = 429;
        error.retryAfterSeconds = 0;
        throw error;
      }
      return { issues: keys.map(makeIssue), issueErrors: [] };
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0, retryBaseDelayMs: 0 });

  const issue = await loader.load('ABC-1');
  assert.equal(issue.key, 'ABC-1');
  assert.equal(calls, 2);
  assert.equal(loader.getStats().retries, 1);
});
