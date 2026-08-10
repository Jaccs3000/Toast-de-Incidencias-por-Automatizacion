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

  async getIssue(issueKey) {
    if (!issueKey) {
      throw new Error('issueKey is required.');
    }

    return this.request(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
  }

  async searchIssues(jql, startAt = 0, maxResults = 50) {
    if (!jql) {
      throw new Error('jql is required.');
    }

    const query = new URLSearchParams({
      jql,
      startAt: String(startAt),
      maxResults: String(maxResults),
    });

    return this.request(`/rest/api/3/search?${query.toString()}`);
  }

  async getMyself() {
    return this.request('/rest/api/3/myself');
  }
}
