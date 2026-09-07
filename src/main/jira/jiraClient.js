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

export class JiraClient {
  constructor({ baseUrl, headers = {} } = {}) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    this.headers = headers;
    this.tempoContext = null;
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
    const maxResults = 100;
    const expand = options.expandProperties === true ? '&expand=properties' : '';
    while (true) {
      const page = await this.request(
        `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/worklog?startAt=${startAt}&maxResults=${maxResults}${expand}`,
        { signal: options.signal },
      );
      worklogs.push(...(Array.isArray(page?.worklogs) ? page.worklogs : []));
      const total = Number(page?.total ?? worklogs.length);
      if (!page?.worklogs?.length || worklogs.length >= total) break;
      startAt += Number(page?.maxResults ?? maxResults) || maxResults;
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
          throw error;
        }
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
          body: JSON.stringify(body),
          signal: signal ?? AbortSignal.timeout(30000),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        const error = new Error(`Tempo worklog search failed (${response.status}): ${text}`);
        error.status = response.status;
        throw error;
      }
      const result = await response.json();
      if (Array.isArray(result)) return result;
      return Array.isArray(result?.worklogs) ? result.worklogs : [];
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
    const maxResults = 100;
    while (true) {
      const page = await this.request(
        `/rest/api/3/issue/${encodeURIComponent(issueIdOrKey)}/changelog?startAt=${startAt}&maxResults=${maxResults}`,
        options,
      );
      values.push(...(Array.isArray(page?.values) ? page.values : []));
      const total = Number(page?.total ?? values.length);
      if (!page?.values?.length || values.length >= total || page?.isLast === true) break;
      startAt += Number(page?.maxResults ?? maxResults) || maxResults;
    }
    return values;
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
