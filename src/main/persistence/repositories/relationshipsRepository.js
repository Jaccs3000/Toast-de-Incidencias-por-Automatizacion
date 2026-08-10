export class RelationshipsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async replaceForGroup(projectGroupId, relationships) {
    if (!projectGroupId) {
      throw new Error('ProjectGroup id is required.');
    }

    await this.persistence.exec(
      'DELETE FROM JIRA_RELATIONSHIPS WHERE project_group_id = ?',
      [projectGroupId],
    );

    if (!Array.isArray(relationships) || relationships.length === 0) {
      return { relationshipsCount: 0 };
    }

    const normalized = relationships.map((relationship, index) => ({
      id: relationship.id ?? `rel-${Date.now()}-${index}`,
      projectGroupId,
      fromIssueId: relationship.fromIssueId,
      toIssueId: relationship.toIssueId,
      relationType: relationship.relationType ?? null,
      linkType: relationship.linkType ?? null,
      created: relationship.created ?? new Date().toISOString(),
    }));

    for (const relationship of normalized) {
      if (!relationship.fromIssueId || !relationship.toIssueId) {
        continue;
      }

      await this.persistence.exec(
        `
        INSERT INTO JIRA_RELATIONSHIPS (
          id, project_group_id, from_issue_id, to_issue_id, relation_type, link_type, created
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          project_group_id = excluded.project_group_id,
          from_issue_id = excluded.from_issue_id,
          to_issue_id = excluded.to_issue_id,
          relation_type = excluded.relation_type,
          link_type = excluded.link_type,
          created = excluded.created
        `,
        [
          relationship.id,
          projectGroupId,
          relationship.fromIssueId,
          relationship.toIssueId,
          relationship.relationType,
          relationship.linkType,
          relationship.created,
        ],
      );
    }

    return { relationshipsCount: normalized.length };
  }
}
