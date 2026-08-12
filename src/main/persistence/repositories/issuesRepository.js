function toText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function normalizeIssue(issue) {
  return {
    id: issue?.id ? String(issue.id) : null,
    key: issue?.key ?? null,
    project: issue?.fields?.project?.key ?? issue?.fields?.project?.name ?? null,
    issuetype: issue?.fields?.issuetype?.name ?? null,
    issuetype_icon_url: issue?.fields?.issuetype?.iconUrl ?? null,
    summary: issue?.fields?.summary ?? null,
    description: issue?.fields?.description ?? null,
    status: issue?.fields?.status?.name ?? null,
    reporter: issue?.fields?.reporter?.displayName ?? issue?.fields?.reporter?.name ?? null,
    assignee: issue?.fields?.assignee?.displayName ?? issue?.fields?.assignee?.name ?? null,
    created: issue?.fields?.created ?? null,
    updated: issue?.fields?.updated ?? null,
    parent: issue?.fields?.parent?.key ?? null,
    timeestimate: issue?.fields?.timeoriginalestimate ?? issue?.fields?.timeestimate ?? null,
    timespent: issue?.fields?.timespent ?? null,
    issuelinks: toText(issue?.fields?.issuelinks ?? null),
  };
}

export class IssuesRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async upsert(issue) {
    const normalized = normalizeIssue(issue);

    if (!normalized.id) {
      throw new Error('Issue id is required.');
    }

    await this.persistence.exec(
      `
      INSERT INTO JIRA_ISSUES (
        id, key, project, issuetype, issuetype_icon_url, summary, description, status,
        reporter, assignee, created, updated, parent, timeestimate,
        timespent, issuelinks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        parent = excluded.parent,
        timeestimate = excluded.timeestimate,
        timespent = excluded.timespent,
        issuelinks = excluded.issuelinks
      `,
      [
        normalized.id,
        normalized.key,
        normalized.project,
        normalized.issuetype,
        normalized.issuetype_icon_url,
        normalized.summary,
        normalized.description,
        normalized.status,
        normalized.reporter,
        normalized.assignee,
        normalized.created,
        normalized.updated,
        normalized.parent,
        normalized.timeestimate,
        normalized.timespent,
        normalized.issuelinks,
      ],
    );

    return normalized;
  }
}
