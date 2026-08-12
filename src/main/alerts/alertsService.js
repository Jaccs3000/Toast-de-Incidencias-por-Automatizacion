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

  async resolveToastText(template, row) {
    const text = String(template ?? '');
    const fieldLabels = {
      'Clave': 'key',
      'Resumen': 'summary',
      'Tipo': 'issuetype',
      'Estado': 'status',
      'Responsable': 'assignee',
      'Reportero': 'reporter',
      'Proyecto': 'project',
      'Fecha de creación': 'created',
      'Fecha de creacion': 'created',
      'Fecha de actualización': 'updated',
      'Fecha de actualizacion': 'updated',
      'Incidencia padre': 'parent',
      'Estimación': 'timeestimate',
      'Estimacion': 'timeestimate',
      'Tiempo empleado': 'timespent',
    };
    const tokenPattern = /\[\[([^:]+)::([^\]]+)\]\]/g;
    const tokens = [...text.matchAll(tokenPattern)];
    if (tokens.length === 0) {
      return text;
    }

    let before = {};
    let after = {};
    try {
      before = typeof row?.before_json === 'string'
        ? JSON.parse(row.before_json)
        : (row?.before_json ?? {});
      after = typeof row?.after_json === 'string'
        ? JSON.parse(row.after_json)
        : (row?.after_json ?? {});
    } catch {
      // Keep the row-level values when a change snapshot is incomplete.
    }

    const matchingIssue = { ...row, ...before, ...after };

    return text.replace(tokenPattern, (_token, issueType, fieldLabel) => {
      const field = fieldLabels[fieldLabel] ?? fieldLabel;
      if (String(matchingIssue.issuetype ?? '').trim() !== String(issueType).trim()) {
        return '';
      }

      const value = matchingIssue[field];
      return value !== null && value !== undefined && String(value).trim() !== ''
        ? String(value)
        : '';
    });
  }

  async upsertAlert({ rule, row, projectGroupId, notify = false }) {
    const ruleId = String(rule.id);
    const issueId = String(row.issue_id ?? row.id ?? row.issueId ?? '');

    if (!ruleId || !issueId) {
      return { created: false };
    }

    const existing = await this.alertExists(ruleId, issueId);
    const now = new Date().toISOString();
    const toastMessage = await this.resolveToastText(rule.toast_text ?? '', row, projectGroupId);
    const payloadJson = JSON.stringify({ ...row, toast_message: toastMessage });

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
        next_retry_sync, next_retry_at, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        Math.max(Number(rule.retry_syncs ?? 0) || 0, 0),
        new Date(Date.now() + Math.max(Number(rule.retry_minutes ?? 0) || 0, 0) * 60000).toISOString(),
        payloadJson,
      ],
    );

    await this.logs?.info?.('Alert created and toast pending', {
      alertId,
      ruleId,
      issueId,
      retryMinutes: Number(rule.retry_minutes ?? 0),
      lastNotifiedAt: now,
      nextRetryAt: new Date(Date.now() + Math.max(Number(rule.retry_minutes ?? 0) || 0, 0) * 60000).toISOString(),
    });

    if (notify && this.toast?.show) {
      await this.toast.show({
        title: rule.toast_text ?? 'Alerta Jira',
        message: rule.toast_text ?? 'Se detectó una alerta en Jira.',
        payload: row,
      });
    }

      return { created: true, id: alertId, rule, row, toastMessage };
  }

  async repeatUnreadAlerts(rules, notifiedIds = new Set()) {
    const repeatedAlerts = [];

    for (const rule of rules) {
      const retryMinutes = Math.max(Number(rule.retry_minutes ?? 0) || 0, 0);
      if (retryMinutes === 0) {
        continue;
      }

      const unreadRows = await this.persistence.query(
        `
        SELECT id, issue_id, project_group_id, last_notified_at, next_retry_at, payload_json
        FROM ALERTS
        WHERE rule_id = ? AND is_read = 0
        `,
        [rule.id],
      );

      for (const alert of unreadRows) {
        if (notifiedIds.has(alert.id)) {
          continue;
        }

        const now = new Date().toISOString();
        const nextRetryAt = new Date(alert.last_notified_at ?? now).getTime() + retryMinutes * 60000;
        if (Date.now() < nextRetryAt) {
          continue;
        }

        await this.logs?.info?.('Alert retry due; requesting toast', {
          alertId: alert.id,
          ruleId: rule.id,
          issueId: alert.issue_id,
          lastNotifiedAt: alert.last_notified_at,
          scheduledRetryAt: new Date(nextRetryAt).toISOString(),
          requestedAt: now,
        });

        const row = JSON.parse(alert.payload_json ?? '{}');
        const toastMessage = await this.resolveToastText(rule.toast_text ?? '', row, alert.project_group_id);
        const payloadJson = JSON.stringify({ ...row, toast_message: toastMessage });
        await this.persistence.exec(
          `
          UPDATE ALERTS
          SET retry_count = 0, next_retry_sync = 0, last_notified_at = ?, next_retry_at = ?, updated = ?, payload_json = ?
          WHERE id = ?
          `,
          [now, new Date(Date.now() + retryMinutes * 60000).toISOString(), now, payloadJson, alert.id],
        );

        repeatedAlerts.push({
          alertId: alert.id,
          issueId: String(alert.issue_id),
          rule,
          row,
          projectGroupId: alert.project_group_id,
          toastMessage,
        });
      }
    }

    return repeatedAlerts;
  }

  async repeatDueUnreadAlerts() {
    const rules = await this.persistence.query(
      `
      SELECT id, name, sql, toast_text, toast_image, retry_minutes, is_active
      FROM ALERT_RULES
      WHERE is_active = 1 AND retry_minutes > 0
      ORDER BY name ASC
      `,
    );
    return this.repeatUnreadAlerts(rules);
  }

  async resumeUnreadRetries({ lockedAt, unlockedAt } = {}) {
    return this.persistence.alerts.resumeUnreadRetries({ lockedAt, unlockedAt });
  }

  async evaluate({ projectGroup = null, notify = false } = {}) {
    if (!this.persistence) {
      throw new Error('AlertsService dependencies are not fully configured.');
    }

    const rules = await this.persistence.query(
      `
      SELECT id, name, sql, toast_text, toast_image, retry_minutes, is_active
      FROM ALERT_RULES
      WHERE is_active = 1
      ORDER BY name ASC
      `,
    );

    const createdAlerts = [];
    const notifiedIds = new Set();

    for (const rule of rules) {
      const rows = await this.getRuleRows(rule.sql);

      for (const row of rows) {
        const result = await this.upsertAlert({
          rule,
          row,
          projectGroupId: row.project_group_id ?? projectGroup?.id ?? null,
          notify,
        });

        if (result.created) {
          notifiedIds.add(result.id);
          createdAlerts.push({
            ruleId: rule.id,
            issueId: String(row.issue_id ?? row.id ?? row.issueId ?? ''),
            alertId: result.id,
            rule: result.rule,
            row: result.row,
            projectGroupId: row.project_group_id ?? projectGroup?.id ?? null,
            toastMessage: result.toastMessage,
          });
        }
      }
    }

    const repeatedAlerts = await this.repeatUnreadAlerts(rules, notifiedIds);

    return {
      ok: true,
      createdAlertsCount: createdAlerts.length,
      repeatedAlertsCount: repeatedAlerts.length,
      createdAlerts: [...createdAlerts, ...repeatedAlerts],
    };
  }

  async notifyCreated(createdAlerts = []) {
    for (const alert of createdAlerts) {
      if (!this.toast?.show) {
        await this.logs?.warn?.('Toast skipped: toast service unavailable', {
          alertId: alert.alertId,
          ruleId: alert.rule?.id,
        });
        continue;
      }

      const result = await this.toast.show({
        title: alert.toastMessage ?? alert.rule?.toast_text ?? 'Alerta Jira',
        message: alert.toastMessage ?? alert.rule?.toast_text ?? 'Alerta Jira detectada.',
        alertId: alert.alertId,
        ruleId: alert.rule?.id,
        issueId: alert.issueId,
        payload: alert.row,
      });
      await this.logs?.info?.('Toast request completed', {
        alertId: alert.alertId,
        ruleId: alert.rule?.id,
        issueId: alert.issueId,
        result,
        requestedAt: new Date().toISOString(),
      });
    }
  }
}
