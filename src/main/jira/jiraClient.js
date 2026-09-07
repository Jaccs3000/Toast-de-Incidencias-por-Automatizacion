export const JIRA_ISSUE_FIELDS = [
  'project',
  'issuetype',
  'summary',
  'description',
  'status',
  'reporter',
  'assignee',
  'created',
  'updated',
  'resolutiondate',
  'parent',
  'subtasks',
  'timeoriginalestimate',
  'timeestimate',
  'timespent',
  'timetracking',
  'issuelinks',
];

function decodeJavaScriptEscapes(value) {
  return String(value ?? '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replaceAll('\\/', '/');
}

function extractTempoIframeUrl(issueHtml) {
  const html = String(issueHtml ?? '');
  const marker = 'https:\\u002F\\u002Fapp.';
  let position = html.indexOf(marker);
  while (position >= 0) {
    const endCandidates = [html.indexOf('",', position), html.indexOf('\\",', position)]
      .filter((value) => value >= 0);
    const end = endCandidates.length > 0 ? Math.min(...endCandidates) : -1;
    if (end >= 0) {
      let rawUrl = html.slice(position, end);
      if (rawUrl.endsWith('\\')) rawUrl = rawUrl.slice(0, -1);
      try {
        const url = JSON.parse(`"${rawUrl}"`);
        if (url.includes('/timesheets/jira/issue-worklog-tab/')) return url;
      } catch {
        // Continue searching in case another embedded Tempo module is present.
      }
    }
    position = html.indexOf(marker, position + marker.length);
  }

  const decodedHtml = decodeJavaScriptEscapes(html);
  const match = decodedHtml.match(
    /https:\/\/app\.[^"'\\\s]+\.tempo\.io\/timesheets\/jira\/issue-worklog-tab\/\?[^"'\\\s]+/i,
  );
  return match?.[0] ?? null;
}

function extractTempoToken(iframeHtml) {
  const marker = 'window.INITIAL_STATE = ';
  const start = iframeHtml.indexOf(marker);
  if (start < 0) return null;
  const jsonStart = start + marker.length;
  const jsonEnd = iframeHtml.indexOf(';', jsonStart);
  if (jsonEnd < 0) return null;
  try {
    const state = JSON.parse(iframeHtml.slice(jsonStart, jsonEnd));
    return {
      token: state?.token?.token ?? null,
      expiresAt: Number(state?.token?.expires ?? 0) * 1000,
    };
  } catch {
    return null;
  }
}

function splitIntoChunks(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function wait(delayMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request canceled.', 'AbortError'));
      return;
    }

    const timer = setTimeout(resolve, delayMs);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Request canceled.', 'AbortError'));
    }, { once: true });
  });
}

async function withRateLimitRetry(request, {
  signal = null,
  maxRetries = 3,
  retryBaseDelayMs = 250,
} = {}) {
  let attempt = 0;
  while (true) {
    try {
      return await request();
    } catch (error) {
      if (error?.status !== 429 || attempt >= maxRetries) throw error;
      const retryAfterSeconds = error?.retryAfterSeconds === null
        || error?.retryAfterSeconds === undefined
        ? Number.NaN
        : Number(error.retryAfterSeconds);
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(retryAfterSeconds * 1000, 0)
        : retryBaseDelayMs * (2 ** attempt);
      attempt += 1;
      await wait(delayMs, signal);
    }
  }
}

function isUnsupportedPageSizeError(error) {
  return error?.status === 400 || error?.status === 413;
}

function isUnavailableBulkChangelogError(error) {
  return [400, 403, 404, 405, 501].includes(Number(error?.status));
}

function normalizeChangelogCreated(value) {
  if (typeof value === 'number' || /^\d+$/.test(String(value ?? '').trim())) {
    const timestamp = Number(value);
    if (Number.isFinite(timestamp)) {
      const milliseconds = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
      const date = new Date(milliseconds);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return value;
}

function normalizeBulkChangelogHistory(history) {
  if (!history || typeof history !== 'object') return history;
  return {
    ...history,
    created: normalizeChangelogCreated(history.created),
  };
}

export class JiraClient {
  constructor({ baseUrl, headers = {} } = {}) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    this.headers = headers;
    this.tempoContext = null;
    this.bulkChangelogAvailability = null;
    this.resetMetrics();
  }

  resetMetrics() {
    this.metrics = {
      requests: 0,
      successes: 0,
      failures: 0,
      totalDurationMs: 0,
      byCategory: {},
    };
  }

  getMetrics() {
    return JSON.parse(JSON.stringify(this.metrics));
  }

  getRequestCategory(pathname) {
    if (pathname.includes('/rest/api/3/changelog/')) return 'changelog';
    if (pathname.includes('/rest/api/3/issue/')) return 'issue';
    if (pathname.includes('/rest/api/3/search/')) return 'jql';
    if (pathname.includes('/rest/api/3/myself')) return 'myself';
    if (pathname.includes('/rest/api/3/project/')) return 'projects';
    if (pathname.includes('/rest/api/3/issuetype')) return 'issueTypes';
    if (pathname.includes('/rest/api/3/status')) return 'statuses';
    return 'other';
  }

  setSession({ baseUrl, headers = {} } = {}) {
    if (baseUrl) {
      this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    this.headers = headers;
    this.tempoContext = null;
    this.bulkChangelogAvailability = null;
  }

  buildUrl(pathname) {
    if (!this.baseUrl) {
      throw new Error('Jira base URL is not configured.');
    }

    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${this.baseUrl}${normalizedPath}`;
  }

  async request(pathname, options = {}) {
    const url = this.buildUrl(pathname);
    const category = this.getRequestCategory(pathname);
    const startedAt = Date.now();
    const categoryMetrics = this.metrics.byCategory[category] ?? { requests: 0, failures: 0, durationMs: 0 };
    this.metrics.byCategory[category] = categoryMetrics;
    this.metrics.requests += 1;
    categoryMetrics.requests += 1;

    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(30000),
        headers: {
          Accept: 'application/json',
          ...this.headers,
          ...(options.headers ?? {}),
        },
      });

      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`Jira request failed (${response.status}): ${text}`);
        error.status = response.status;
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
        error.retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
        throw error;
      }

      this.metrics.successes += 1;
      return response.json();
    } catch (error) {
      this.metrics.failures += 1;
      categoryMetrics.failures += 1;
      throw error;
    } finally {
      const durationMs = Date.now() - startedAt;
      this.metrics.totalDurationMs += durationMs;
      categoryMetrics.durationMs += durationMs;
    }
  }

  async getIssue(issueKey, options = {}) {
    if (!issueKey) {
      throw new Error('issueKey is required.');
    }

    return this.request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, options);
  }

  async fetchSessionImageData(imageUrl, options = {}) {
    let source;
    try {
      source = new URL(String(imageUrl ?? ''));
    } catch {
      throw new Error('La URL del icono de Jira no es valida.');
    }
    if (!['http:', 'https:'].includes(source.protocol)) {
      throw new Error('La URL del icono de Jira no es valida.');
    }

    const jiraOrigin = new URL(this.baseUrl).origin;
    if (source.origin !== jiraOrigin) {
      throw new Error('El icono no pertenece al sitio Jira configurado.');
    }

    const response = await fetch(source, {
      headers: {
        Accept: 'image/*',
        ...this.headers,
      },
      signal: options.signal ?? AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const error = new Error(`No se pudo obtener el icono de Jira (${response.status}).`);
      error.status = response.status;
      throw error;
    }

    const contentType = String(response.headers.get('content-type') ?? '')
      .split(';', 1)[0]
      .trim()
      .toLocaleLowerCase();
    if (!contentType.startsWith('image/')) {
      throw new Error('Jira no devolvio una imagen valida para el icono.');
    }

    const image = Buffer.from(await response.arrayBuffer());
    if (image.length === 0 || image.length > 256 * 1024) {
      throw new Error('El icono de Jira tiene un tamano no permitido.');
    }
    return `data:${contentType};base64,${image.toString('base64')}`;
  }

  async bulkFetchIssues(issueIdsOrKeys, options = {}) {
    const keys = [...new Set((Array.isArray(issueIdsOrKeys) ? issueIdsOrKeys : [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean))];

    if (keys.length === 0) {
      return { issues: [], issueErrors: [] };
    }

    if (keys.length > 100) {
      throw new Error('Jira bulk fetch accepts a maximum of 100 issue keys.');
    }

    return this.request('/rest/api/3/issue/bulkfetch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        issueIdsOrKeys: keys,
        fields: options.fields ?? JIRA_ISSUE_FIELDS,
      }),
      signal: options.signal,
    });
  }

  async searchIssues(jql, maxResults = 50, options = {}) {
    if (!jql) {
      throw new Error('jql is required.');
    }

    const issues = [];
    let nextPageToken;

    do {
      const body = {
        jql,
        maxResults,
        fields: options.fields ?? JIRA_ISSUE_FIELDS,
      };

      if (nextPageToken) {
        body.nextPageToken = nextPageToken;
      }

      const page = await this.request('/rest/api/3/search/jql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: options.signal,
      });

      if (Array.isArray(page?.issues)) {
        issues.push(...page.issues);
      }

      if (options.paginate === false) break;
      nextPageToken = page?.nextPageToken || null;
    } while (nextPageToken);

    return {
      issues,
      total: issues.length,
      isLast: true,
    };
  }

  async getMyself(options = {}) {
    return this.request('/rest/api/3/myself', options);
  }

  async searchUsers(query, options = {}) {
    const value = String(query ?? '').trim();
    if (!value) return [];

    const result = await this.request(
      `/rest/api/3/user/search?query=${encodeURIComponent(value)}&maxResults=20`,
      options,
    );
    return Array.isArray(result) ? result : [];
  }

  async listIssueWorklogs(issueIdOrKey, options = {}) {
    if (!issueIdOrKey) throw new Error('issueIdOrKey is required.');

    const worklogs = [];
    let startAt = 0;
    let maxResults = Math.min(Math.max(Number(options.maxResults) || 1000, 1), 1000);
    const fallbackMaxResults = Math.min(maxResults, 100);
    let retriedWithFallback = false;
    const expand = options.expandProperties === true ? '&expand=properties' : '';
    while (true) {
      let page;
      try {
        page = await withRateLimitRetry(
          () => this.request(
            `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/worklog?startAt=${startAt}&maxResults=${maxResults}${expand}`,
            { signal: options.signal },
          ),
          options,
        );
      } catch (error) {
        if (startAt === 0 && !retriedWithFallback && maxResults > fallbackMaxResults
          && isUnsupportedPageSizeError(error)) {
          maxResults = fallbackMaxResults;
          retriedWithFallback = true;
          continue;
        }
        throw error;
      }

      const pageWorklogs = Array.isArray(page?.worklogs) ? page.worklogs : [];
      worklogs.push(...pageWorklogs);
      const totalValue = Number(page?.total);
      const total = Number.isFinite(totalValue) ? totalValue : null;
      if (!pageWorklogs.length || page?.isLast === true || (total !== null && worklogs.length >= total)) break;
      const increment = pageWorklogs.length;
      const nextStartAt = startAt + increment;
      if (nextStartAt <= startAt) break;
      startAt = nextStartAt;
    }
    return worklogs;
  }

  async getTempoContext(issueIdOrKey, options = {}) {
    const now = Date.now();
    if (this.tempoContext?.token && this.tempoContext.expiresAt > now + 30000) {
      return this.tempoContext;
    }

    const signal = options.signal ?? AbortSignal.timeout(30000);
    const issueResponse = await fetch(
      this.buildUrl(`/browse/${encodeURIComponent(issueIdOrKey)}`),
      {
        headers: {
          Accept: 'text/html',
          ...this.headers,
        },
        signal,
      },
    );
    if (!issueResponse.ok) {
      throw new Error(`No se pudo obtener el contexto de Tempo (${issueResponse.status}).`);
    }
    const issueHtml = await issueResponse.text();
    const iframeUrl = extractTempoIframeUrl(issueHtml);
    if (!iframeUrl) {
      throw new Error('No se encontro la integracion de Tempo en Jira.');
    }

    const iframeResponse = await fetch(iframeUrl, {
      headers: { Accept: 'text/html' },
      signal,
    });
    if (!iframeResponse.ok) {
      throw new Error(`No se pudo obtener la sesion de Tempo (${iframeResponse.status}).`);
    }
    const tempoToken = extractTempoToken(await iframeResponse.text());
    if (!tempoToken?.token) {
      throw new Error('Tempo no devolvio un token de sesion valido.');
    }

    this.tempoContext = {
      origin: new URL(iframeUrl).origin,
      token: tempoToken.token,
      expiresAt: tempoToken.expiresAt || now + 300000,
    };
    return this.tempoContext;
  }

  async listTempoWorklogAudit(issueId, options = {}) {
    if (!issueId) throw new Error('issueId is required.');

    const load = async (context) => {
      const results = [];
      let lastEvaluatedKey = null;
      do {
        const query = lastEvaluatedKey
          ? `?lastEvaluatedKey=${encodeURIComponent(lastEvaluatedKey)}`
          : '';
        const response = await withRateLimitRetry(async () => {
          const response = await fetch(
            `${context.origin}/rest/audit/worklog/${encodeURIComponent(issueId)}/${query}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: `Tempo-Bearer ${context.token}`,
                'Tempo-User-TimeZone': Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
              },
              signal: options.signal ?? AbortSignal.timeout(30000),
            },
          );
          if (!response.ok) {
            const error = new Error(`Tempo worklog audit failed (${response.status}).`);
            error.status = response.status;
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
            error.retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
            throw error;
          }
          return response;
        }, {
          signal: options.signal,
          maxRetries: 3,
          retryBaseDelayMs: 250,
        });
        const body = await response.json();
        if (Array.isArray(body?.results)) results.push(...body.results);
        lastEvaluatedKey = body?.metadata?.next ? body.metadata.lastEvaluatedKey : null;
      } while (lastEvaluatedKey);
      return results;
    };

    const contextIssue = options.issueKey ?? issueId;
    let context = await this.getTempoContext(contextIssue, options);
    try {
      return await load(context);
    } catch (error) {
      if (error?.status !== 401) throw error;
      this.tempoContext = null;
      context = await this.getTempoContext(contextIssue, options);
      return load(context);
    }
  }

  async searchTempoWorklogs({ accountId, fromDate = null, toDate = null, issueKey = null, signal } = {}) {
    const selectedAccountId = String(accountId ?? '').trim();
    if (!selectedAccountId) throw new Error('accountId is required.');

    const context = await this.getTempoContext(issueKey, { signal });
    const body = {
      accountIds: [selectedAccountId],
      userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    };
    if (fromDate) body.from = fromDate;
    if (toDate) body.to = toDate;

    const load = async (currentContext) => {
      const worklogs = [];
      let nextPageToken = null;
      const seenPageTokens = new Set();
      do {
        const requestBody = { ...body };
        if (nextPageToken) requestBody.nextPageToken = nextPageToken;
        const response = await withRateLimitRetry(async () => {
          const response = await fetch(
            `${currentContext.origin}/rest/tempo-timesheets/4/worklogs/search`,
            {
              method: 'POST',
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Tempo-Bearer ${currentContext.token}`,
                'Tempo-User-TimeZone': body.userTimeZone,
                'x-atlassian-force-account-id': 'true',
              },
              body: JSON.stringify(requestBody),
              signal: signal ?? AbortSignal.timeout(30000),
            },
          );
          if (!response.ok) {
            const text = await response.text();
            const error = new Error(`Tempo worklog search failed (${response.status}): ${text}`);
            error.status = response.status;
            const retryAfterHeader = response.headers.get('retry-after');
            const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
            error.retryAfterSeconds = Number.isFinite(retryAfter) ? retryAfter : null;
            throw error;
          }
          return response;
        }, { signal, maxRetries: 3, retryBaseDelayMs: 250 });
        const result = await response.json();
        if (Array.isArray(result)) {
          worklogs.push(...result);
          nextPageToken = null;
        } else {
          worklogs.push(...(Array.isArray(result?.worklogs) ? result.worklogs : []));
          const candidateToken = result?.nextPageToken ?? null;
          nextPageToken = candidateToken && !seenPageTokens.has(candidateToken) ? candidateToken : null;
          if (candidateToken) seenPageTokens.add(candidateToken);
        }
      } while (nextPageToken);
      return worklogs;
    };

    try {
      return await load(context);
    } catch (error) {
      if (error?.status !== 401) throw error;
      this.tempoContext = null;
      return load(await this.getTempoContext(issueKey, { signal }));
    }
  }

  async listIssueChangelog(issueIdOrKey, options = {}) {
    if (!issueIdOrKey) throw new Error('issueIdOrKey is required.');

    const values = [];
    let startAt = 0;
    let maxResults = Math.min(Math.max(Number(options.maxResults) || 1000, 1), 1000);
    const fallbackMaxResults = Math.min(maxResults, 100);
    let retriedWithFallback = false;
    while (true) {
      let page;
      try {
        page = await withRateLimitRetry(
          () => this.request(
            `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/changelog?startAt=${startAt}&maxResults=${maxResults}`,
            { signal: options.signal },
          ),
          options,
        );
      } catch (error) {
        if (startAt === 0 && !retriedWithFallback && maxResults > fallbackMaxResults
          && isUnsupportedPageSizeError(error)) {
          maxResults = fallbackMaxResults;
          retriedWithFallback = true;
          continue;
        }
        throw error;
      }

      const pageValues = Array.isArray(page?.values) ? page.values : [];
      values.push(...pageValues);
      const totalValue = Number(page?.total);
      const total = Number.isFinite(totalValue) ? totalValue : null;
      if (!pageValues.length || values.length >= (total ?? Number.POSITIVE_INFINITY) || page?.isLast === true) break;
      const increment = pageValues.length;
      const nextStartAt = startAt + increment;
      if (nextStartAt <= startAt) break;
      startAt = nextStartAt;
    }
    return values;
  }

  async listBulkIssueChangelogs(issueIdsOrKeys, options = {}) {
    const issueReferences = [...new Set((Array.isArray(issueIdsOrKeys) ? issueIdsOrKeys : [])
      .map((value) => String(value ?? '').trim())
      .filter(Boolean))];
    if (issueReferences.length === 0) return [];

    const fieldIds = Array.isArray(options.fieldIds) && options.fieldIds.length > 0
      ? options.fieldIds.slice(0, 10)
      : ['assignee', 'status'];
    const maxResults = Math.min(Math.max(Number(options.maxResults) || 1000, 1), 1000);
    if (this.bulkChangelogAvailability === false) {
      const error = new Error('Jira bulk changelog endpoint is unavailable for this session.');
      error.status = 404;
      throw error;
    }
    const grouped = new Map();

    try {
      for (const batch of splitIntoChunks(issueReferences, 1000)) {
        let nextPageToken = null;
        const seenPageTokens = new Set();
        do {
          const body = {
            issueIdsOrKeys: batch,
            fieldIds,
            maxResults,
          };
          if (nextPageToken) body.nextPageToken = nextPageToken;

          const page = await withRateLimitRetry(
            () => this.request('/rest/api/3/changelog/bulkfetch', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(body),
              signal: options.signal,
            }),
            options,
          );

          for (const issueChangeLog of Array.isArray(page?.issueChangeLogs) ? page.issueChangeLogs : []) {
            const issueId = String(issueChangeLog?.issueId ?? '').trim();
            if (!issueId) continue;
            const current = grouped.get(issueId) ?? new Map();
            for (const history of Array.isArray(issueChangeLog?.changeHistories)
              ? issueChangeLog.changeHistories
              : []) {
              const normalized = normalizeBulkChangelogHistory(history);
              const historyId = String(normalized?.id ?? '');
              const identity = historyId || JSON.stringify(normalized);
              current.set(identity, normalized);
            }
            grouped.set(issueId, current);
          }

          const candidateToken = page?.nextPageToken ?? null;
          nextPageToken = candidateToken && !seenPageTokens.has(candidateToken)
            ? candidateToken
            : null;
          if (candidateToken) seenPageTokens.add(candidateToken);
        } while (nextPageToken);
      }
      this.bulkChangelogAvailability = true;
    } catch (error) {
      if (isUnavailableBulkChangelogError(error)) this.bulkChangelogAvailability = false;
      throw error;
    }

    return [...grouped.entries()].map(([issueId, histories]) => ({
      issueId,
      changeHistories: [...histories.values()],
    }));
  }

  async listProjects(options = {}) {
    const projects = [];
    let startAt = 0;
    const maxResults = 50;

    while (true) {
      const page = await this.request(`/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}`, options);
      projects.push(...(Array.isArray(page?.values) ? page.values : []));
      if (page?.isLast || projects.length >= Number(page?.total ?? projects.length) || !page?.values?.length) break;
      startAt += maxResults;
    }

    return projects;
  }

  async listIssueTypes(options = {}) {
    return this.request('/rest/api/3/issuetype', options);
  }

  async listStatuses(options = {}) {
    return this.request('/rest/api/3/status', options);
  }
}
