import { JIRA_ISSUE_FIELDS } from './jiraClient.js';

function normalizeKey(value) {
  return String(value ?? '').trim().toLocaleUpperCase('en');
}

function splitIntoChunks(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  });
  await Promise.all(workers);
}

function wait(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Synchronization canceled.', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Synchronization canceled.', 'AbortError'));
    }, { once: true });
  });
}

export class JiraBatchLoader {
  constructor({
    jira,
    signal = null,
    batchSize = 100,
    concurrency = 2,
    flushDelayMs = 10,
    maxRetries = 3,
    retryBaseDelayMs = 1000,
    fields = JIRA_ISSUE_FIELDS,
  } = {}) {
    if (!jira?.bulkFetchIssues) {
      throw new Error('JiraBatchLoader requires a Jira client with bulkFetchIssues().');
    }

    this.jira = jira;
    this.signal = signal;
    this.batchSize = Math.min(Math.max(Number(batchSize) || 100, 1), 100);
    this.concurrency = Math.max(Number(concurrency) || 2, 1);
    this.flushDelayMs = Math.max(Number(flushDelayMs) || 0, 0);
    this.maxRetries = Math.max(Number(maxRetries) || 0, 0);
    this.retryBaseDelayMs = Math.max(Number(retryBaseDelayMs) || 0, 0);
    this.fields = fields;
    this.pending = new Map();
    this.inFlight = new Map();
    this.cache = new Map();
    this.flushTimer = null;
    this.stats = {
      batchRequests: 0,
      requestedKeys: 0,
      returnedIssues: 0,
      maxBatchSize: 0,
      cacheHits: 0,
      deduplicatedLoads: 0,
      flushes: 0,
      retries: 0,
    };
  }

  getStats() {
    return { ...this.stats };
  }

  load(issueKey) {
    const normalizedKey = normalizeKey(issueKey);
    if (!normalizedKey) {
      return Promise.reject(new Error('An issue key is required for batched loading.'));
    }

    if (this.signal?.aborted) {
      return Promise.reject(new DOMException('Synchronization canceled.', 'AbortError'));
    }

    if (this.cache.has(normalizedKey)) {
      this.stats.cacheHits += 1;
      return Promise.resolve(this.cache.get(normalizedKey));
    }

    if (this.inFlight.has(normalizedKey)) {
      this.stats.deduplicatedLoads += 1;
      return this.inFlight.get(normalizedKey);
    }

    let resolveRequest;
    let rejectRequest;
    const promise = new Promise((resolve, reject) => {
      resolveRequest = resolve;
      rejectRequest = reject;
    });

    this.inFlight.set(normalizedKey, promise);
    this.pending.set(normalizedKey, {
      key: String(issueKey).trim(),
      normalizedKey,
      resolve: resolveRequest,
      reject: rejectRequest,
    });
    this.scheduleFlush();
    return promise;
  }

  scheduleFlush() {
    if (this.flushTimer !== null) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush().catch(() => {
        // Each pending promise receives the concrete failure in processChunk().
      });
    }, this.flushDelayMs);
  }

  async flush() {
    if (this.pending.size === 0) return;

    const requests = [...this.pending.values()];
    this.pending.clear();
    this.stats.flushes += 1;
    const chunks = splitIntoChunks(requests, this.batchSize);

    await runWithConcurrency(chunks, this.concurrency, async (chunk) => {
      await this.processChunk(chunk);
    });
  }

  async processChunk(chunk) {
    const keys = chunk.map((entry) => entry.key);
    this.stats.batchRequests += 1;
    this.stats.requestedKeys += keys.length;
    this.stats.maxBatchSize = Math.max(this.stats.maxBatchSize, keys.length);

    try {
      const result = await this.fetchChunk(keys);
      const issues = Array.isArray(result?.issues) ? result.issues : [];
      const issuesByKey = new Map(issues.map((issue) => [normalizeKey(issue?.key), issue]));
      this.stats.returnedIssues += issues.length;

      const errors = Array.isArray(result?.issueErrors) ? result.issueErrors : [];
      if (errors.length > 0) {
        throw new Error(`Jira bulk fetch could not load ${errors.length} issue(s): ${JSON.stringify(errors)}`);
      }

      for (const entry of chunk) {
        const issue = issuesByKey.get(entry.normalizedKey);
        if (!issue) {
          throw new Error(`Jira bulk fetch did not return issue ${entry.key}.`);
        }
      }

      for (const entry of chunk) {
        const issue = issuesByKey.get(entry.normalizedKey);
        this.cache.set(entry.normalizedKey, issue);
        this.inFlight.delete(entry.normalizedKey);
        entry.resolve(issue);
      }
    } catch (error) {
      for (const entry of chunk) {
        this.inFlight.delete(entry.normalizedKey);
        entry.reject(error);
      }
      throw error;
    }
  }

  async fetchChunk(keys) {
    let attempt = 0;
    while (true) {
      try {
        return await this.jira.bulkFetchIssues(keys, {
          signal: this.signal,
          fields: this.fields,
        });
      } catch (error) {
        if (error?.status !== 429 || attempt >= this.maxRetries) {
          throw error;
        }

        const retryAfterSeconds = Number(error.retryAfterSeconds);
        const delayMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(retryAfterSeconds * 1000, 0)
          : this.retryBaseDelayMs * (2 ** attempt);
        attempt += 1;
        this.stats.retries += 1;
        await wait(delayMs, this.signal);
      }
    }
  }
}
