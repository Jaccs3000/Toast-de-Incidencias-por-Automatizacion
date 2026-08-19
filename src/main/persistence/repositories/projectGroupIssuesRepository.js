export class ProjectGroupIssuesRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async replaceForGroup(projectGroupId, issues, relationships = []) {
    if (!projectGroupId) {
      throw new Error('ProjectGroup id is required.');
    }

    await this.persistence.exec(
      'DELETE FROM JIRA_PROJECT_GROUP_ISSUES WHERE project_group_id = ?',
      [projectGroupId],
    );

    const uniqueIssues = new Map();
    for (const issue of Array.isArray(issues) ? issues : []) {
      const issueId = String(issue?.id ?? '').trim();
      if (!issueId) {
        continue;
      }

      const existing = uniqueIssues.get(issueId);
      if (!existing) {
        uniqueIssues.set(issueId, { ...issue, id: issueId });
        continue;
      }

      uniqueIssues.set(issueId, {
        ...existing,
        isRoot: Boolean(existing.isRoot || issue.isRoot),
        depth: Math.min(Number(existing.depth ?? 0), Number(issue.depth ?? 0)),
        relationType: existing.relationType ?? issue.relationType ?? null,
      });
    }

    const uniqueIssueList = [...uniqueIssues.values()];
    if (uniqueIssueList.length > 0) {
      const placeholders = uniqueIssueList.map(() => '(?, ?, ?, ?, ?, ?)').join(',\n');
      const params = uniqueIssueList.flatMap((issue) => [
        projectGroupId,
        issue.id,
        issue.isRoot ? 1 : 0,
        issue.depth ?? 0,
        issue.relationType ?? null,
        issue.created ?? null,
      ]);
      await this.persistence.exec(
        `
        INSERT INTO JIRA_PROJECT_GROUP_ISSUES (
          project_group_id, issue_id, is_root, depth, relation_type, created
        ) VALUES ${placeholders}
        `,
        params,
      );
    }

    return {
      issuesCount: uniqueIssueList.length,
      relationshipsCount: relationships.length,
    };
  }
}
