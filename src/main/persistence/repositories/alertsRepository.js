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
      SELECT a.id, a.rule_id, a.issue_id, a.project_group_id, a.is_read, a.created, a.updated,
             a.last_notified_at, a.retry_count, a.next_retry_sync, a.next_retry_at, a.payload_json,
             r.name AS rule_name, r.toast_text, r.toast_image, r.retry_minutes,
             i.issuetype_icon_url,
             json_extract_string(a.payload_json, '$.toast_message') AS toast_message
      FROM ALERTS
      a LEFT JOIN ALERT_RULES r ON r.id = a.rule_id
      LEFT JOIN JIRA_ISSUES i ON i.id = a.issue_id
      WHERE a.is_read = 0
      ORDER BY a.created DESC
      LIMIT ?
      `,
      [limit],
    );

    return Array.isArray(rows) ? rows : [];
  }

  async listRules() {
    const rows = await this.persistence.query(
      `
      SELECT id, name, sql, toast_text, toast_image, condition_config, retry_minutes, is_active, created, updated
      FROM ALERT_RULES
      ORDER BY name ASC
      `,
    );

    return Array.isArray(rows) ? rows : [];
  }

  async markRead(alertId) {
    if (!alertId) {
      throw new Error('Alert id is required.');
    }

    await this.persistence.exec(
      'UPDATE ALERTS SET is_read = 1, updated = ? WHERE id = ?',
      [new Date().toISOString(), alertId],
    );
  }

  async resumeUnreadRetries({ lockedAt, unlockedAt } = {}) {
    const lockTime = Number(lockedAt);
    const unlockTime = Number(unlockedAt);
    if (!Number.isFinite(lockTime) || !Number.isFinite(unlockTime) || unlockTime < lockTime) {
      return 0;
    }

    const rows = await this.persistence.query(
      'SELECT id, next_retry_at FROM ALERTS WHERE is_read = 0 AND next_retry_at IS NOT NULL',
    );
    let updated = 0;
    for (const row of rows) {
      const retryAt = new Date(row.next_retry_at).getTime();
      if (!Number.isFinite(retryAt)) continue;
      const remaining = Math.max(retryAt - lockTime, 0);
      const nextRetryAt = new Date(unlockTime + remaining).toISOString();
      await this.persistence.exec(
        'UPDATE ALERTS SET next_retry_at = ?, updated = ? WHERE id = ? AND is_read = 0',
        [nextRetryAt, new Date(unlockTime).toISOString(), row.id],
      );
      updated += 1;
    }
    return updated;
  }
}
