import crypto from 'node:crypto';

function createId() {
  return `jql-${crypto.randomUUID()}`;
}

export class JqlDefinitionsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async list() {
    const rows = await this.persistence.query(`
      SELECT d.id, d.query_text, d.sort_order, d.created, d.updated,
             COUNT(r.id) AS alert_count
      FROM JQL_DEFINITIONS d
      LEFT JOIN ALERT_RULES r ON r.jql_id = d.id
      GROUP BY d.id, d.query_text, d.sort_order, d.created, d.updated
      ORDER BY d.sort_order ASC, d.created ASC
    `);
    return rows.map((row) => ({
      ...row,
      sort_order: Number(row.sort_order ?? 0),
      alert_count: Number(row.alert_count ?? 0),
    }));
  }

  async ensureFromQueries(queries = []) {
    const existing = await this.list();
    if (existing.length > 0) return existing;

    const now = new Date().toISOString();
    for (const [index, query] of queries.entries()) {
      const text = String(query ?? '').trim();
      if (!text) continue;
      await this.persistence.exec(
        `INSERT INTO JQL_DEFINITIONS (id, query_text, sort_order, created, updated)
         VALUES (?, ?, ?, ?, ?)`,
        [createId(), text, index, now, now],
      );
    }
    return this.list();
  }

  async replace(definitions = []) {
    const now = new Date().toISOString();
    const normalized = definitions.map((definition, index) => ({
      id: String(definition?.id ?? '').trim() || createId(),
      queryText: String(definition?.query_text ?? definition?.queryText ?? '').trim(),
      sortOrder: index,
    })).filter((definition) => definition.queryText);

    const ids = new Set(normalized.map((definition) => definition.id));
    const existing = await this.list();
    const removed = existing.filter((definition) => !ids.has(definition.id));

    await this.persistence.transaction(async () => {
      for (const definition of normalized) {
        await this.persistence.exec(`
          INSERT INTO JQL_DEFINITIONS (id, query_text, sort_order, created, updated)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            query_text = excluded.query_text,
            sort_order = excluded.sort_order,
            updated = excluded.updated
        `, [definition.id, definition.queryText, definition.sortOrder, now, now]);
      }

      for (const definition of removed) {
        await this.persistence.exec(
          'DELETE FROM ALERTS WHERE rule_id IN (SELECT id FROM ALERT_RULES WHERE jql_id = ?)',
          [definition.id],
        );
        await this.persistence.exec('DELETE FROM ALERT_RULES WHERE jql_id = ?', [definition.id]);
        await this.persistence.exec('DELETE FROM JQL_PROJECT_GROUPS WHERE jql_id = ?', [definition.id]);
        await this.persistence.exec('DELETE FROM JQL_DEFINITIONS WHERE id = ?', [definition.id]);
      }
    });

    return this.list();
  }

  async replaceSources(sources = []) {
    const unique = new Map();
    for (const source of sources) {
      const jqlId = String(source?.jqlId ?? '').trim();
      const projectGroupId = String(source?.projectGroupId ?? '').trim();
      const seedIssueId = String(source?.seedIssueId ?? '').trim();
      if (!jqlId || !projectGroupId || !seedIssueId) continue;
      unique.set(`${jqlId}:${projectGroupId}:${seedIssueId}`, { jqlId, projectGroupId, seedIssueId });
    }

    await this.persistence.exec('DELETE FROM JQL_PROJECT_GROUPS');
    const now = new Date().toISOString();
    for (const source of unique.values()) {
      await this.persistence.exec(`
        INSERT INTO JQL_PROJECT_GROUPS (jql_id, project_group_id, seed_issue_id, created)
        VALUES (?, ?, ?, ?)
      `, [source.jqlId, source.projectGroupId, source.seedIssueId, now]);
    }
  }

  async listSources() {
    return this.persistence.query(`
      SELECT jql_id, project_group_id, seed_issue_id, created
      FROM JQL_PROJECT_GROUPS
      ORDER BY jql_id, project_group_id, seed_issue_id
    `);
  }
}
