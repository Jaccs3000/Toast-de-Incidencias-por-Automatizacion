export class AlertsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async getUnreadCount() {
    const rows = await this.persistence.query(
      'SELECT COUNT(*) AS unread_count FROM ALERTS WHERE is_read = 0',
    );

    return Number(rows[0]?.unread_count ?? 0);
  }

  async listUnread(limit = 20) {
    const rows = await this.persistence.query(
      `
      SELECT id, rule_id, issue_id, project_group_id, is_read, created, updated,
             last_notified_at, retry_count, next_retry_sync, payload_json
      FROM ALERTS
      WHERE is_read = 0
      ORDER BY created DESC
      LIMIT ?
      `,
      [limit],
    );

    return Array.isArray(rows) ? rows : [];
  }
}
