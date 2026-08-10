export class ProjectGroupsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async upsert(group) {
    if (!group?.id) {
      throw new Error('ProjectGroup id is required.');
    }

    await this.persistence.exec(
      `
      INSERT INTO JIRA_PROJECT_GROUPS (
        id, root_issue_id, root_issue_key, estado_general, created, updated
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        root_issue_id = excluded.root_issue_id,
        root_issue_key = excluded.root_issue_key,
        estado_general = excluded.estado_general,
        updated = excluded.updated
      `,
      [
        group.id,
        group.rootIssueId ?? null,
        group.rootIssueKey ?? null,
        group.estado_general ?? null,
        group.created ?? null,
        group.updated ?? null,
      ],
    );

    return group;
  }
}
