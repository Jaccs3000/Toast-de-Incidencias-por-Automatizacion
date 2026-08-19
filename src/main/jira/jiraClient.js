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

export class JiraClient {
  constructor({ baseUrl, headers = {} } = {}) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    this.headers = headers;
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
