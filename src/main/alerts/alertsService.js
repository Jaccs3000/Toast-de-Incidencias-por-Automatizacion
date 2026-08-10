export class AlertsService {
  constructor({ persistence, toast, logs } = {}) {
    this.persistence = persistence;
    this.toast = toast;
    this.logs = logs;
  }

  async getRuleRows(ruleSql) {
    const rows = await this.persistence.query(ruleSql);
    return Array.isArray(rows) ? rows : [];
  }

  async alertExists(ruleId, issueId) {
    const rows = await this.persistence.query(
      `
      SELECT id, is_read
      FROM ALERTS
      WHERE rule_id = ? AND issue_id = ?
      LIMIT 1
      `,
      [ruleId, issueId],
    );

    return rows[0] ?? null;
  }

  async upsertAlert({ rule, row, projectGroupId }) {
    const ruleId = String(rule.id);
    const issueId = String(row.issue_id ?? row.id ?? row.issueId ?? '');

    if (!ruleId || !issueId) {
      return { created: false };
    }

    const existing = await this.alertExists(ruleId, issueId);
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(row);

    if (existing) {
      await this.persistence.exec(
        `
        UPDATE ALERTS
        SET
          updated = ?,
          payload_json = ?
        WHERE id = ?
        `,
        [now, payloadJson, existing.id],
      );

      return { created: false, id: existing.id };
    }

    const alertId = `alert-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await this.persistence.exec(
      `
      INSERT INTO ALERTS (
        id, rule_id, issue_id, project_group_id, is_read,
        created, updated, last_notified_at, retry_count,
        next_retry_sync, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        alertId,
        ruleId,
        issueId,
        projectGroupId ?? null,
        0,
        now,
        now,
        now,
        0,
        0,
        payloadJson,
      ],
    );

    if (this.toast?.show) {
      await this.toast.show({
        title: rule.toast_text ?? 'Alerta Jira',
        message: rule.toast_text ?? 'Se detectó una alerta en Jira.',
        payload: row,
      });
    }

    return { created: true, id: alertId };
  }

  async evaluate({ projectGroup }) {
    if (!this.persistence || !projectGroup?.id) {
      throw new Error('AlertsService dependencies are not fully configured.');
    }

    const rules = await this.persistence.query(
      `
      SELECT id, name, sql, toast_text, toast_image, retry_syncs, is_active
      FROM ALERT_RULES
      WHERE is_active = 1
      ORDER BY name ASC
      `,
    );

    const createdAlerts = [];

    for (const rule of rules) {
      const rows = await this.getRuleRows(rule.sql);

      for (const row of rows) {
        const result = await this.upsertAlert({
          rule,
          row,
          projectGroupId: projectGroup.id,
        });

        if (result.created) {
          createdAlerts.push({
            ruleId: rule.id,
            issueId: String(row.issue_id ?? row.id ?? row.issueId ?? ''),
            alertId: result.id,
          });
        }
      }
    }

    return {
      ok: true,
      createdAlertsCount: createdAlerts.length,
      createdAlerts,
    };
  }
}
