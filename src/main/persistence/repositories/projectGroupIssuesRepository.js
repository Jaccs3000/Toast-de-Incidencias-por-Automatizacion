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

    for (const issue of issues) {
      await this.persistence.exec(
        `
        INSERT INTO JIRA_PROJECT_GROUP_ISSUES (
          project_group_id, issue_id, is_root, depth, relation_type, created
        ) VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          projectGroupId,
          issue.id,
          issue.isRoot ? 1 : 0,
          issue.depth ?? 0,
          issue.relationType ?? null,
          issue.created ?? null,
        ],
      );
    }

    return {
      issuesCount: issues.length,
      relationshipsCount: relationships.length,
    };
  }
}
