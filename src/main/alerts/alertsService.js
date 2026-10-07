import { gridConditionMatches } from '../../shared/grids/gridCondition.js';

const JQL_SOURCE_ISSUE_OPTION = '__jql_source_issue__';

function formatToastValue(field, value) {
  if (field === 'timeConsumedPercent') {
    const percentage = Number(value);
    return Number.isFinite(percentage) ? `${Number(percentage.toFixed(2))}%` : value;
  }

  if (!['created', 'updated', 'resolutiondate'].includes(field) || !value) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(',', '');
}

function isPersistenceFailure(error) {
  const message = String(error?.message ?? error ?? '').toLowerCase();
  return /duplicate key|constraint error|transactioncontext|transaction is aborted|transaction aborted/.test(message);
}

function composeToastMessage(baseMessage, displayValue) {
  const base = String(baseMessage ?? '').trim();
  const value = String(displayValue ?? '').trim();
  return value ? `${base}\n• ${value}` : base;
}

function retryMinutesForAlert(alert) {
  return Math.max(Number(alert?.rule?.retry_minutes ?? alert?.retry_minutes ?? 0) || 0, 0);
}

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

  async alertExists(ruleId, issueId, identityKey = null) {
    const rows = await this.persistence.query(
      `
      SELECT id, is_read, project_group_id, identity_key
      FROM ALERTS
      WHERE ${identityKey ? 'identity_key = ?' : 'rule_id = ? AND issue_id = ?'}
      LIMIT 1
      `,
      identityKey ? [identityKey] : [ruleId, issueId],
    );

    return rows[0] ?? null;
  }

  async resolveToastText(template, row) {
    const text = String(template ?? '');
    const fieldLabels = {
      'Incidencia': 'key',
      'Clave': 'key',
      'Resumen': 'summary',
      'Tipo': 'issuetype',
      'Estado': 'status',
      'Responsable': 'assignee',
      'Informador': 'reporter',
      'Reportero': 'reporter',
      'Proyecto': 'project',
      'Fecha de creación': 'created',
      'Fecha de creacion': 'created',
      'Fecha de actualización': 'updated',
      'Fecha de actualizacion': 'updated',
      'Fecha de resolucion': 'resolutiondate',
      'Incidencia padre': 'parent',
      'Estimación': 'timeestimate',
      'Estimacion': 'timeestimate',
      'Tiempo empleado': 'timespent',
      'Tiempo restante': 'timeremaining',
      'Tiempo consumido (%)': 'timeConsumedPercent',
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
        ? String(formatToastValue(field, value))
        : '';
    });
  }

  async upsertAlert({ rule, row, projectGroupId, identityKey = null, toastMessage = null, notify = false }) {
    const ruleId = String(rule.id);
    const issueId = String(row.issue_id ?? row.id ?? row.issueId ?? '');

    if (!ruleId || !issueId) {
      return { created: false };
    }

    const stableIdentity = identityKey ?? `${ruleId}:${projectGroupId ?? ''}:${issueId}`;
    const existing = await this.alertExists(ruleId, issueId, stableIdentity);
    const now = new Date().toISOString();
    const resolvedToastMessage = toastMessage ?? await this.resolveToastText(rule.toast_text ?? '', row, projectGroupId);
    const payloadJson = JSON.stringify({ ...row, toast_message: resolvedToastMessage });

    if (existing) {
      await this.persistence.exec(
        `
        UPDATE ALERTS
        SET
          updated = ?,
          payload_json = ?,
          project_group_id = ?
        WHERE id = ?
        `,
        [now, payloadJson, projectGroupId ?? existing.project_group_id ?? null, existing.id],
      );

      return { created: false, id: existing.id };
    }

    const alertId = `alert-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const insertParameters = [
      alertId,
      stableIdentity,
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
    ];

    await this.logs?.info?.('Alert insert attempt', { alertId, ruleId, issueId });
    try {
      await this.persistence.exec(
        `
        INSERT OR IGNORE INTO ALERTS (
          id, identity_key, rule_id, issue_id, project_group_id, is_read,
          created, updated, last_notified_at, retry_count,
          next_retry_sync, next_retry_at, payload_json
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM ALERTS WHERE identity_key = ?
        )
        `,
        [...insertParameters, stableIdentity],
      );
    } catch (error) {
      await this.logs?.error?.('Alert insert failed', { alertId, ruleId, issueId, error: error.message });
      throw error;
    }
    await this.logs?.info?.('Alert insert completed', { alertId, ruleId, issueId });

    const persisted = await this.alertExists(ruleId, issueId, stableIdentity);
    if (!persisted || persisted.id !== alertId) {
      return { created: false, id: persisted?.id ?? null };
    }

    await this.logs?.info?.('Alert created and toast pending', {
      alertId,
      ruleId,
      issueId,
      retryMinutes: Number(rule.retry_minutes ?? 0),
      lastNotifiedAt: now,
      nextRetryAt: new Date(Date.now() + Math.max(Number(rule.retry_minutes ?? 0) || 0, 0) * 60000).toISOString(),
    });

    // Alerts with a configured retry wait for their first countdown to finish.
    if (notify && retryMinutesForAlert({ rule }) === 0 && this.toast?.show) {
      await this.toast.show({
        title: rule.toast_text ?? 'Alerta Jira',
        message: rule.toast_text ?? 'Se detectó una alerta en Jira.',
        payload: row,
      });
    }

      return { created: true, id: alertId, rule, row, toastMessage: resolvedToastMessage };
  }

  parseConditionConfig(rule) {
    try {
      const parsed = typeof rule?.condition_config === 'string'
        ? JSON.parse(rule.condition_config)
        : rule?.condition_config;
      return parsed && typeof parsed === 'object' ? parsed : { conditions: [] };
    } catch {
      return { conditions: [] };
    }
  }

  sourceIdentity(source) {
    return [
      source?.jql_id ?? source?.jqlId,
      source?.project_group_id ?? source?.projectGroupId,
      source?.seed_issue_id ?? source?.seedIssueId,
    ].map((value) => String(value ?? '')).join('|');
  }

  sourceScope(source) {
    return [
      source?.jql_id ?? source?.jqlId,
      source?.seed_issue_id ?? source?.seedIssueId,
    ].map((value) => String(value ?? '')).join('|');
  }

  buildSourceLineage(previousSources = [], incomingSources = []) {
    const previousByIdentity = new Map(
      previousSources.map((source) => [this.sourceIdentity(source), source]),
    );
    const previousByScope = new Map();
    const incomingByScope = new Map();

    for (const source of previousSources) {
      const scope = this.sourceScope(source);
      const sources = previousByScope.get(scope) ?? [];
      sources.push(source);
      previousByScope.set(scope, sources);
    }
    for (const source of incomingSources) {
      const scope = this.sourceScope(source);
      const sources = incomingByScope.get(scope) ?? [];
      sources.push(source);
      incomingByScope.set(scope, sources);
    }

    const lineage = new Map();
    for (const source of incomingSources) {
      const identity = this.sourceIdentity(source);
      const exact = previousByIdentity.get(identity);
      if (exact) {
        lineage.set(identity, exact);
        continue;
      }

      const scope = this.sourceScope(source);
      const previousMatches = previousByScope.get(scope) ?? [];
      const incomingMatches = incomingByScope.get(scope) ?? [];
      // A one-to-one group reassignment is structural continuity, not a new
      // JQL result. Ambiguous multi-branch cases remain independent.
      if (previousMatches.length === 1 && incomingMatches.length === 1) {
        lineage.set(identity, previousMatches[0]);
      }
    }

    return lineage;
  }

  async getAlertByIdentity(identityKey) {
    if (!identityKey) return null;
    const rows = await this.persistence.query(
      `
      SELECT id, is_read, project_group_id, identity_key, created,
             last_notified_at, next_retry_at, retry_count, next_retry_sync
      FROM ALERTS
      WHERE identity_key = ?
      LIMIT 1
      `,
      [identityKey],
    );
    return rows[0] ?? null;
  }

  async migrateReassignedAlert({ rule, jqlId, previousSource, source, payloadJson }) {
    const previousGroupId = String(previousSource?.project_group_id ?? previousSource?.projectGroupId ?? '');
    const groupId = String(source?.project_group_id ?? source?.projectGroupId ?? '');
    const seedIssueId = String(source?.seed_issue_id ?? source?.seedIssueId ?? '');
    if (!previousGroupId || !groupId || previousGroupId === groupId || !seedIssueId) {
      return null;
    }

    const previousIdentity = `${rule.id}:${jqlId}:${previousGroupId}:${seedIssueId}`;
    const currentIdentity = `${rule.id}:${jqlId}:${groupId}:${seedIssueId}`;
    const previousAlert = await this.getAlertByIdentity(previousIdentity);
    if (!previousAlert) return null;

    const currentAlert = await this.getAlertByIdentity(currentIdentity);
    const now = new Date().toISOString();
    if (!currentAlert) {
      await this.persistence.exec(
        `
        UPDATE ALERTS
        SET identity_key = ?, project_group_id = ?, payload_json = ?, updated = ?
        WHERE id = ?
        `,
        [currentIdentity, groupId, payloadJson, now, previousAlert.id],
      );
      return previousAlert.id;
    }

    if (currentAlert.id === previousAlert.id) {
      return currentAlert.id;
    }

    // Keep one occurrence when both identities already exist. An unread
    // occurrence wins so a notification cannot be lost during reassignment.
    const isRead = Number(previousAlert.is_read ?? 0) === 0
      || Number(currentAlert.is_read ?? 0) === 0
      ? 0
      : 1;
    await this.persistence.exec(
      `
      UPDATE ALERTS
      SET is_read = ?, project_group_id = ?, payload_json = ?, updated = ?
      WHERE id = ?
      `,
      [isRead, groupId, payloadJson, now, currentAlert.id],
    );
    await this.persistence.exec('DELETE FROM ALERTS WHERE id = ?', [previousAlert.id]);
    return currentAlert.id;
  }

  groupRows(rows = []) {
    const groups = new Map();
    for (const row of rows) {
      const groupId = String(row?.project_group_id ?? '');
      if (!groupId) continue;
      const current = groups.get(groupId) ?? [];
      current.push(row);
      groups.set(groupId, current);
    }
    return groups;
  }

  projectGroupStates(groups = []) {
    return new Map(groups.map((group) => [
      String(group?.id ?? ''),
      group?.estado_general ?? 'No definido',
    ]));
  }

  conditionMatchesGroup(condition, issues, estadoGeneral) {
    const field = String(condition?.field ?? '').trim();
    const issueType = String(condition?.issueType ?? condition?.issue_type ?? '').trim();
    const operator = String(condition?.operator ?? '=').trim();
    const expected = condition?.value ?? '';
    if (['estado_general', 'estadoGeneral'].includes(field)) {
      return gridConditionMatches(estadoGeneral, operator, expected, field);
    }

    const candidates = issueType && !['Otros', 'ProjectGroup'].includes(issueType)
      ? issues.filter((issue) => String(issue?.issuetype ?? '') === issueType)
      : issues;
    return candidates.some((issue) => gridConditionMatches(issue?.[field], operator, expected, field));
  }

  conditionsMatchGroup(conditions, issues, estadoGeneral) {
    if (!Array.isArray(conditions) || conditions.length === 0) return true;
    let result = this.conditionMatchesGroup(conditions[0], issues, estadoGeneral);
    for (let index = 1; index < conditions.length; index += 1) {
      const condition = conditions[index];
      const matches = this.conditionMatchesGroup(condition, issues, estadoGeneral);
      result = String(condition?.connector ?? 'AND').toUpperCase() === 'OR'
        ? result || matches
        : result && matches;
    }
    return result;
  }

  displayValue(rule, issues, estadoGeneral, seedIssue = null) {
    let configuredFields = [];
    try { configuredFields = JSON.parse(rule?.display_fields_json ?? '[]'); } catch { configuredFields = []; }
    if (configuredFields.length > 0) {
      return configuredFields
        .map((item) => this.displayValue({ ...rule, display_fields_json: '[]', display_issue_type: item.issueType, display_field: item.field }, issues, estadoGeneral, seedIssue))
        .filter(Boolean)
        .join('\n');
    }
    const field = String(rule?.display_field ?? '').trim();
    if (!field) return '';
    if (['estado_general', 'estadoGeneral'].includes(field)) return estadoGeneral ?? '';
    const issueType = String(rule?.display_issue_type ?? '').trim();
    if (issueType === JQL_SOURCE_ISSUE_OPTION) {
      const value = seedIssue?.[field];
      return value !== null && value !== undefined && String(value).trim() !== ''
        ? String(formatToastValue(field, value))
        : '';
    }
    const values = issues
      .filter((issue) => !issueType || String(issue?.issuetype ?? '') === issueType)
      .map((issue) => issue?.[field])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      .map((value) => String(formatToastValue(field, value)));
    return [...new Set(values)].join(' | ');
  }

  async evaluateJqlAlerts({
    previousSnapshot = [],
    incomingSnapshot = [],
    previousSources = [],
    incomingSources = [],
    previousProjectGroups = [],
    incomingProjectGroups = [],
    matchingIssueIdsByJql = new Map(),
  } = {}) {
    const rules = await this.persistence.query(`
      SELECT id, jql_id, alert_type, name, toast_text, toast_image, condition_config,
             display_issue_type, display_field, display_fields_json, retry_minutes, is_active
      FROM ALERT_RULES
      WHERE is_active = 1 AND jql_id IS NOT NULL
      ORDER BY jql_id, created, name
    `);
    const unreadAutoCompleteAlerts = await this.persistence.query(`
      SELECT a.id, a.issue_id, r.jql_id
      FROM ALERTS a
      JOIN ALERT_RULES r ON r.id = a.rule_id
      WHERE a.is_read = 0 AND COALESCE(r.auto_complete, 0) = 1 AND r.jql_id IS NOT NULL
    `);
    let autoCompletedAlertsCount = 0;
    const autoCompletedAt = new Date().toISOString();
    for (const alert of unreadAutoCompleteAlerts) {
      const jqlId = String(alert.jql_id ?? '');
      const matchingIssueIds = matchingIssueIdsByJql.get(jqlId);
      // If this JQL was not successfully evaluated, keep its alerts unread.
      if (!(matchingIssueIds instanceof Set)) continue;
      if (matchingIssueIds.has(String(alert.issue_id))) continue;
      await this.persistence.exec(
        'UPDATE ALERTS SET is_read = 1, updated = ? WHERE id = ? AND is_read = 0',
        [autoCompletedAt, alert.id],
      );
      autoCompletedAlertsCount += 1;
    }
    if (autoCompletedAlertsCount > 0) {
      await this.logs?.info?.('JQL alerts automatically marked as read after leaving their query results', {
        count: autoCompletedAlertsCount,
      });
    }
    const beforeGroups = this.groupRows(previousSnapshot);
    const afterGroups = this.groupRows(incomingSnapshot);
    const beforeStates = new Map(previousProjectGroups.map((group) => [
      String(group.id), group.estado_general ?? 'No definido',
    ]));
    const afterStates = this.projectGroupStates(incomingProjectGroups);
    const previousSourceKeys = new Set(previousSources.map((source) => this.sourceIdentity(source)));
    const sourceLineage = this.buildSourceLineage(previousSources, incomingSources);
    const rulesByJql = new Map();
    for (const rule of rules) {
      const current = rulesByJql.get(String(rule.jql_id)) ?? [];
      current.push(rule);
      rulesByJql.set(String(rule.jql_id), current);
    }

    const createdAlerts = [];
    for (const source of incomingSources) {
      const jqlId = String(source.jqlId ?? source.jql_id ?? '');
      const groupId = String(source.projectGroupId ?? source.project_group_id ?? '');
      const seedIssueId = String(source.seedIssueId ?? source.seed_issue_id ?? '');
      const sourceKey = this.sourceIdentity(source);
      const afterIssues = afterGroups.get(groupId) ?? [];
      const beforeIssues = beforeGroups.get(groupId) ?? [];
      const seedIssue = afterIssues.find((issue) => String(issue.id) === seedIssueId);
      if (!seedIssue) continue;
      const previousSource = sourceLineage.get(sourceKey) ?? null;
      const sourceWasKnown = Boolean(previousSource);
      const sourceWasReassigned = sourceWasKnown
        && String(previousSource.project_group_id ?? previousSource.projectGroupId ?? '') !== groupId;

      for (const rule of rulesByJql.get(jqlId) ?? []) {
        const config = this.parseConditionConfig(rule);
        let shouldCreate = false;
        if (sourceWasReassigned) {
          // A JQL source can move to another graph branch when the graph is
          // rebuilt. Keep the existing alert occurrence attached to the new
          // group instead of creating a duplicate or a false transition.
          const displayValue = this.displayValue(rule, afterIssues, afterStates.get(groupId), seedIssue);
          const baseMessage = String(rule.toast_text ?? rule.name ?? 'Alerta Jira').trim();
          const toastMessage = composeToastMessage(baseMessage, displayValue);
          const row = {
            ...seedIssue,
            issue_id: seedIssueId,
            issue_key: seedIssue.key,
            project_group_id: groupId,
            jql_id: jqlId,
            toast_message: toastMessage,
          };
          await this.migrateReassignedAlert({
            rule,
            jqlId,
            previousSource,
            source,
            payloadJson: JSON.stringify({ ...row, toast_message: toastMessage }),
          });
          continue;
        }

        if (rule.alert_type === 'new_issue') {
          // "New" is scoped to the owning JQL. A seed may already exist in the
          // local mirror because another JQL discovered it previously.
          shouldCreate = !sourceWasKnown && !previousSourceKeys.has(sourceKey);
        } else if (rule.alert_type === 'attribute_changed' && sourceWasKnown && !sourceWasReassigned) {
          const matchedBefore = this.conditionsMatchGroup(
            config.conditions,
            beforeIssues,
            beforeStates.get(groupId) ?? 'No definido',
          );
          const matchedAfter = this.conditionsMatchGroup(
            config.conditions,
            afterIssues,
            afterStates.get(groupId) ?? 'No definido',
          );
          shouldCreate = !matchedBefore && matchedAfter;
        }
        if (!shouldCreate) continue;

        const displayValue = this.displayValue(rule, afterIssues, afterStates.get(groupId), seedIssue);
        const baseMessage = String(rule.toast_text ?? rule.name ?? 'Alerta Jira').trim();
        const toastMessage = composeToastMessage(baseMessage, displayValue);
        const row = {
          ...seedIssue,
          issue_id: seedIssueId,
          issue_key: seedIssue.key,
          project_group_id: groupId,
          jql_id: jqlId,
          toast_message: toastMessage,
        };
        const result = await this.upsertAlert({
          rule,
          row,
          projectGroupId: groupId,
          identityKey: `${rule.id}:${jqlId}:${groupId}:${seedIssueId}`,
          toastMessage,
        });
        if (result.created) {
          createdAlerts.push({
            alertId: result.id,
            issueId: seedIssueId,
            projectGroupId: groupId,
            rule,
            row,
            toastMessage,
          });
        }
      }
    }

    return {
      ok: true,
      createdAlertsCount: createdAlerts.length,
      autoCompletedAlertsCount,
      repeatedAlertsCount: 0,
      createdAlerts,
    };
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
        const storedRetryAt = new Date(alert.next_retry_at ?? '').getTime();
        const legacyRetryAt = new Date(alert.last_notified_at ?? now).getTime() + retryMinutes * 60000;
        const nextRetryAt = Number.isFinite(storedRetryAt) ? storedRetryAt : legacyRetryAt;
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
        const displayRow = { ...row, issuetype: row.issuetype ?? row.type ?? row.issue_type };
        const displayValue = this.displayValue(rule, [displayRow], row.estado_general ?? row.estadoGeneral, displayRow);
        const toastMessage = String(row.toast_message ?? '').trim()
          || composeToastMessage(rule.toast_text ?? rule.name ?? 'Alerta Jira', displayValue);
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
          isRetry: true,
        });
      }
    }

    return repeatedAlerts;
  }

  async repeatDueUnreadAlerts() {
    const rules = await this.persistence.query(
      `
      SELECT id, name, sql, toast_text, toast_image, display_issue_type, display_field, retry_minutes, is_active
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

  async scheduleUnreadRetriesFromNow() {
    const rules = await this.persistence.query(
      `
      SELECT id, retry_minutes
      FROM ALERT_RULES
      WHERE is_active = 1 AND retry_minutes > 0
      `,
    );
    const now = new Date();
    let updated = 0;

    for (const rule of rules) {
      const retryMinutes = Number(rule.retry_minutes);
      if (!Number.isFinite(retryMinutes) || retryMinutes <= 0) continue;

      const nextRetryAt = new Date(now.getTime() + retryMinutes * 60000).toISOString();
      await this.persistence.exec(
        `
        UPDATE ALERTS
        SET next_retry_at = ?, updated = ?
        WHERE rule_id = ? AND is_read = 0
        `,
        [nextRetryAt, now.toISOString(), rule.id],
      );
      updated += 1;
    }

    await this.logs?.info?.('Unread alert retries scheduled after enabling retry service', { updated });
    return updated;
  }

  async evaluate({ projectGroup = null, notify = false } = {}) {
    if (!this.persistence) {
      throw new Error('AlertsService dependencies are not fully configured.');
    }

    const rules = await this.persistence.query(
      `
      SELECT id, name, sql, toast_text, toast_image, display_issue_type, display_field, retry_minutes, is_active
      FROM ALERT_RULES
      WHERE is_active = 1
      ORDER BY name ASC
      `,
    );

    const createdAlerts = [];
    const notifiedIds = new Set();
    const processedAlertKeys = new Set();

    for (const rule of rules) {
      try {
        const rows = await this.getRuleRows(rule.sql);

        for (const row of rows) {
          const issueId = String(row.issue_id ?? row.id ?? row.issueId ?? '').trim();
          const alertKey = `${rule.id}:${issueId}`;
          if (processedAlertKeys.has(alertKey)) {
            continue;
          }
          processedAlertKeys.add(alertKey);

          const displayRow = { ...row, issuetype: row.issuetype ?? row.type ?? row.issue_type };
          const displayValue = this.displayValue(rule, [displayRow], row.estado_general ?? row.estadoGeneral, displayRow);
          const toastMessage = composeToastMessage(rule.toast_text ?? rule.name ?? 'Alerta Jira', displayValue);

          const result = await this.upsertAlert({
            rule,
            row,
            projectGroupId: row.project_group_id ?? projectGroup?.id ?? null,
            toastMessage,
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
      } catch (error) {
        if (isPersistenceFailure(error)) {
          throw error;
        }

        await this.logs?.error?.('Alert rule skipped because its condition could not be evaluated', {
          ruleId: rule.id,
          ruleName: rule.name,
          error: error.message,
        });
      }
    }

    let repeatedAlerts = [];
    try {
      repeatedAlerts = await this.repeatUnreadAlerts(rules, notifiedIds);
    } catch (error) {
      if (isPersistenceFailure(error)) {
        throw error;
      }

      await this.logs?.error?.('Alert retries skipped because they could not be evaluated', {
        error: error.message,
      });
    }

    return {
      ok: true,
      createdAlertsCount: createdAlerts.length,
      repeatedAlertsCount: repeatedAlerts.length,
      createdAlerts: [...createdAlerts, ...repeatedAlerts],
    };
  }

  async notifyCreated(createdAlerts = []) {
    for (const alert of createdAlerts) {
      try {
        const retryMinutes = retryMinutesForAlert(alert);
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
      } catch (error) {
        await this.logs?.error?.('Alert toast skipped after notification error', {
          alertId: alert.alertId,
          ruleId: alert.rule?.id,
          error: error.message,
        });
      }
    }
  }
}
