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

test('matches bulk-fetched issues by Jira ID as well as issue key', async () => {
  const jira = {
    async bulkFetchIssues() {
      return { issues: [makeIssue('ABC-1')], issueErrors: [] };
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0 });

  const issue = await loader.load('1');

  assert.equal(issue.key, 'ABC-1');
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

test('falls back to individual reads when Jira rejects the bulk endpoint', async () => {
  const bulkCalls = [];
  const individualCalls = [];
  const jira = {
    async bulkFetchIssues(keys) {
      bulkCalls.push(keys);
      const error = new Error('Bulk endpoint rejected');
      error.status = 400;
      throw error;
    },
    async getIssue(key) {
      individualCalls.push(key);
      return makeIssue(key);
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0, fallbackConcurrency: 2 });

  const [first, second] = await Promise.all([loader.load('ABC-1'), loader.load('ABC-2')]);

  assert.equal(bulkCalls.length, 1);
  assert.deepEqual(individualCalls.sort(), ['ABC-1', 'ABC-2']);
  assert.equal(first.key, 'ABC-1');
  assert.equal(second.key, 'ABC-2');
  assert.deepEqual(loader.getStats(), {
    batchRequests: 1,
    requestedKeys: 2,
    returnedIssues: 2,
    maxBatchSize: 2,
    cacheHits: 0,
    deduplicatedLoads: 0,
    flushes: 1,
    retries: 0,
    fallbackBatches: 1,
    fallbackIssueRequests: 2,
  });
});

test('keeps using individual reads after the bulk endpoint is rejected once', async () => {
  let bulkCalls = 0;
  const individualCalls = [];
  const jira = {
    async bulkFetchIssues() {
      bulkCalls += 1;
      const error = new Error('Bulk endpoint rejected');
      error.status = 404;
      throw error;
    },
    async getIssue(key) {
      individualCalls.push(key);
      return makeIssue(key);
    },
  };
  const loader = new JiraBatchLoader({ jira, flushDelayMs: 0 });

  await loader.load('ABC-1');
  await loader.load('ABC-2');

  assert.equal(bulkCalls, 1);
  assert.deepEqual(individualCalls, ['ABC-1', 'ABC-2']);
  assert.equal(loader.getStats().fallbackBatches, 1);
  assert.equal(loader.getStats().fallbackIssueRequests, 2);
});
