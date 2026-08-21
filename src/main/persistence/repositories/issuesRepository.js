import { jiraDescriptionToText } from '../../../shared/jira/descriptionText.js';

function toText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function secondsToMinutes(value) {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) ? Math.round(seconds / 60) : 0;
}

function normalizeIssue(issue) {
  const plannedMinutes = secondsToMinutes(issue?.fields?.timeoriginalestimate ?? issue?.fields?.timeestimate);
  const spentMinutes = secondsToMinutes(issue?.fields?.timespent);
  const timeRemaining = plannedMinutes - spentMinutes;

  return {
    id: issue?.id ? String(issue.id) : null,
    key: issue?.key ?? null,
    project: issue?.fields?.project?.key ?? issue?.fields?.project?.name ?? null,
    issuetype: issue?.fields?.issuetype?.name ?? null,
    issuetype_icon_url: issue?.fields?.issuetype?.iconUrl ?? null,
    summary: issue?.fields?.summary ?? null,
    description: jiraDescriptionToText(issue?.fields?.description),
    status: issue?.fields?.status?.name ?? null,
    reporter: issue?.fields?.reporter?.displayName ?? issue?.fields?.reporter?.name ?? null,
    assignee: issue?.fields?.assignee?.displayName ?? issue?.fields?.assignee?.name ?? null,
    created: issue?.fields?.created ?? null,
    updated: issue?.fields?.updated ?? null,
    resolutiondate: issue?.fields?.resolutiondate ?? null,
    parent: issue?.fields?.parent?.key ?? null,
    timeestimate: plannedMinutes,
    timespent: spentMinutes,
    timeremaining: timeRemaining,
    issuelinks: toText(issue?.fields?.issuelinks ?? null),
  };
}

export class IssuesRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async upsert(issue) {
    const rows = await this.upsertMany([issue]);
    return rows[0] ?? null;
  }

  async upsertMany(issues) {
    const normalizedIssues = [...new Map((Array.isArray(issues) ? issues : [])
      .map((issue) => normalizeIssue(issue))
      .filter((issue) => issue.id)
      .map((issue) => [issue.id, issue])).values()];

    if (normalizedIssues.length === 0) {
      return [];
    }

    const columns = 18;
    const placeholders = normalizedIssues.map(() => `(${Array(columns).fill('?').join(', ')})`).join(',\n');
    const params = normalizedIssues.flatMap((normalized) => [
      normalized.id, normalized.key, normalized.project, normalized.issuetype, normalized.issuetype_icon_url,
      normalized.summary, normalized.description, normalized.status, normalized.reporter, normalized.assignee,
      normalized.created, normalized.updated, normalized.resolutiondate, normalized.parent, normalized.timeestimate,
      normalized.timespent, normalized.timeremaining, normalized.issuelinks,
    ]);

    await this.persistence.exec(
      `
      INSERT INTO JIRA_ISSUES (
        id, key, project, issuetype, issuetype_icon_url, summary, description, status,
        reporter, assignee, created, updated, resolutiondate, parent, timeestimate,
        timespent, timeremaining, issuelinks
      ) VALUES ${placeholders}
      ON CONFLICT(id) DO UPDATE SET
        key = excluded.key,
        project = excluded.project,
        issuetype = excluded.issuetype,
        issuetype_icon_url = excluded.issuetype_icon_url,
        summary = excluded.summary,
        description = excluded.description,
        status = excluded.status,
        reporter = excluded.reporter,
        assignee = excluded.assignee,
        created = excluded.created,
        updated = excluded.updated,
        resolutiondate = excluded.resolutiondate,
        parent = excluded.parent,
        timeestimate = excluded.timeestimate,
        timespent = excluded.timespent,
        timeremaining = excluded.timeremaining,
        issuelinks = excluded.issuelinks
      `,
      params,
    );

    return normalizedIssues;
  }
}
