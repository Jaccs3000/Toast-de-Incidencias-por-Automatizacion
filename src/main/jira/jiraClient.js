export class JiraClient {
  constructor({ baseUrl, headers = {} } = {}) {
    this.baseUrl = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    this.headers = headers;
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
      throw new Error(`Jira request failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  async getIssue(issueKey, options = {}) {
    if (!issueKey) {
      throw new Error('issueKey is required.');
    }

    return this.request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, options);
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
        fields: ['*all'],
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
}
