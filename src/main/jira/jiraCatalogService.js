import fs from 'node:fs/promises';
import path from 'node:path';

const EMPTY_CATALOG = {
  version: 1,
  updatedAt: null,
  projects: [],
  issueTypes: [],
  statuses: [],
};

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
    .sort((left, right) => left.localeCompare(right, 'es'));
}

function normalizeCatalog(value = {}) {
  return {
    ...EMPTY_CATALOG,
    ...value,
    projects: Array.isArray(value.projects) ? value.projects : [],
    issueTypes: uniqueStrings(Array.isArray(value.issueTypes) ? value.issueTypes : []),
    statuses: uniqueStrings(Array.isArray(value.statuses) ? value.statuses : []),
  };
}

export class JiraCatalogService {
  constructor({ logs, filePath = path.join(process.cwd(), 'config', 'jira-catalog.json') } = {}) {
    this.logs = logs;
    this.filePath = filePath;
  }

  async load() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      return normalizeCatalog(JSON.parse(raw));
    } catch {
      return { ...EMPTY_CATALOG };
    }
  }

  async save(catalog) {
    const normalized = normalizeCatalog(catalog);
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, this.filePath);
    return normalized;
  }

  async refresh(jira, session) {
    const current = await this.load();
    if (!session?.ok || !jira) {
      return current;
    }

    const requests = await Promise.allSettled([
      jira.listProjects(),
      jira.listIssueTypes(),
      jira.listStatuses(),
    ]);
    const [projectsResult, issueTypesResult, statusesResult] = requests;
    const resultNames = ['projects', 'issueTypes', 'statuses'];
    requests.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logs?.warn?.('Jira catalog endpoint failed', {
          catalog: resultNames[index],
          error: result.reason?.message ?? String(result.reason),
        });
      }
    });

    const hasSuccessfulResult = requests.some((result) => result.status === 'fulfilled');
    if (!hasSuccessfulResult) {
      return current;
    }

    try {
      const next = {
        version: 1,
        updatedAt: new Date().toISOString(),
        projects: (projectsResult.status === 'fulfilled' ? projectsResult.value : current.projects)
          .filter((project) => project?.key)
          .map((project) => ({ value: project.key, label: project.name || project.key }))
          .sort((left, right) => left.label.localeCompare(right.label, 'es')),
        issueTypes: issueTypesResult.status === 'fulfilled'
          ? uniqueStrings(issueTypesResult.value.map((item) => item?.name))
          : current.issueTypes,
        statuses: statusesResult.status === 'fulfilled'
          ? uniqueStrings(statusesResult.value.map((item) => item?.name))
          : current.statuses,
      };

      await this.save(next);
      this.logs?.info?.('Jira catalog refreshed', `projects=${next.projects.length} issueTypes=${next.issueTypes.length} statuses=${next.statuses.length}`);
      return next;
    } catch (error) {
      this.logs?.warn?.('Jira catalog refresh failed; using cached catalog', error.message);
      return current;
    }
  }
}
