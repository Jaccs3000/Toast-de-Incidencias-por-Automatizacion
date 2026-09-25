import crypto from 'node:crypto';

function createId() {
  return `time-report-${crypto.randomUUID()}`;
}

function parseJson(value, fallback = {}) {
  try {
    return JSON.parse(value ?? '');
  } catch {
    return fallback;
  }
}

export class TimeReportsRepository {
  constructor(persistence) {
    this.persistence = persistence;
  }

  async clear() {
    await this.persistence.transaction(async () => {
      await this.persistence.exec('DELETE FROM TIME_REPORT_CORRECTIONS');
      await this.persistence.exec('DELETE FROM TIME_REPORT_IMPROVEMENTS');
      await this.persistence.exec('DELETE FROM TIME_REPORT_ISSUES');
      await this.persistence.exec('DELETE FROM TIME_REPORTS');
    });
  }

  async create({ fromDate, toDate, userAccountId, userDisplayName, issues = [], corrections = [] }) {
    const id = createId();
    const now = new Date().toISOString();
    await this.persistence.transaction(async () => {
      await this.persistence.exec(`
        INSERT INTO TIME_REPORTS (
          id, from_date, to_date, user_account_id, user_display_name, status, created, updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, fromDate, toDate, userAccountId, userDisplayName, 'preview', now, now]);

      for (const issue of issues) {
        await this.persistence.exec(`
          INSERT INTO TIME_REPORT_ISSUES (
            report_id, issue_id, issue_key, project, issue_type, summary, status, reporter, assignee,
            created, resolutiondate, range_seconds, total_seconds, planned_seconds, spent_seconds,
            remaining_seconds, assigned_at, started_at, closed_at, selected, data_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, issue.issueId, issue.issueKey, issue.project, issue.issueType, issue.summary, issue.status,
          issue.reporter, issue.assignee, issue.created, issue.resolutiondate, issue.rangeSeconds,
          issue.totalSeconds, issue.plannedSeconds, issue.spentSeconds, issue.remainingSeconds,
          issue.assignedAt, issue.startedAt, issue.closedAt, 1, JSON.stringify(issue),
        ]);
      }

      for (const correction of corrections) {
        await this.persistence.exec(`
          INSERT INTO TIME_REPORT_CORRECTIONS (
            report_id, issue_key, correction_key, summary, status, project_group_id
          ) VALUES (?, ?, ?, ?, ?, ?)
        `, [id, correction.issueKey, correction.correctionKey, correction.summary,
          correction.status, correction.projectGroupId]);
      }
    });
    return id;
  }

  async setSelection(reportId, selectedIssueIds = []) {
    const selected = new Set(selectedIssueIds.map((value) => String(value)));
    const rows = await this.persistence.query(
      'SELECT issue_id FROM TIME_REPORT_ISSUES WHERE report_id = ?',
      [reportId],
    );
    await this.persistence.transaction(async () => {
      for (const row of rows) {
        await this.persistence.exec(
          'UPDATE TIME_REPORT_ISSUES SET selected = ? WHERE report_id = ? AND issue_id = ?',
          [selected.has(String(row.issue_id)) ? 1 : 0, reportId, row.issue_id],
        );
      }
      await this.persistence.exec(
        'UPDATE TIME_REPORTS SET updated = ?, status = ? WHERE id = ?',
        [new Date().toISOString(), 'selected', reportId],
      );
    });
  }

  async markGenerated(reportId, fileName) {
    await this.persistence.exec(
      'UPDATE TIME_REPORTS SET status = ?, pdf_file = ?, updated = ?, error = NULL WHERE id = ?',
      ['generated', fileName, new Date().toISOString(), reportId],
    );
  }

  async markError(reportId, message) {
    await this.persistence.exec(
      'UPDATE TIME_REPORTS SET status = ?, error = ?, updated = ? WHERE id = ?',
      ['error', String(message ?? 'Error desconocido'), new Date().toISOString(), reportId],
    );
  }

  async getSnapshot(reportId) {
    const reports = await this.persistence.query('SELECT * FROM TIME_REPORTS WHERE id = ? LIMIT 1', [reportId]);
    const report = reports[0];
    if (!report) return null;
    const issues = await this.persistence.query(
      'SELECT * FROM TIME_REPORT_ISSUES WHERE report_id = ? ORDER BY issue_key',
      [reportId],
    );
    const correctionRows = await this.persistence.query(
      `SELECT correction_row.*, correction_issue.issuetype_icon_url AS correction_issue_type_icon_url
       FROM TIME_REPORT_CORRECTIONS correction_row
       LEFT JOIN JIRA_ISSUES correction_issue ON correction_issue.key = correction_row.correction_key
       WHERE correction_row.report_id = ?
       ORDER BY correction_row.issue_key, correction_row.correction_key`,
      [reportId],
    );
    const improvementRows = await this.persistence.query(
      'SELECT issue_id, issue_key, memo FROM TIME_REPORT_IMPROVEMENTS WHERE report_id = ?',
      [reportId],
    );
    const improvementByIssue = new Map(improvementRows.map((row) => [String(row.issue_id), {
      issueId: row.issue_id,
      issueKey: row.issue_key,
      memo: row.memo,
    }]));
    const issueDataByKey = new Map(issues.map((row) => [row.issue_key, parseJson(row.data_json, {})]));
    const correctionsByIssue = new Map();
    for (const row of correctionRows) {
      const sourceIssue = issueDataByKey.get(row.issue_key) ?? {};
      const list = correctionsByIssue.get(row.issue_key) ?? [];
      list.push({
        correctionKey: row.correction_key,
        summary: row.summary,
        status: row.status,
        projectGroupId: row.project_group_id,
        projectIconUrl: sourceIssue.projectIconUrl ?? '',
        issueTypeIconUrl: row.correction_issue_type_icon_url
          ?? sourceIssue.issueTypeIconUrl
          ?? '',
      });
      correctionsByIssue.set(row.issue_key, list);
    }
    return {
      id: report.id,
      fromDate: report.from_date,
      toDate: report.to_date,
      userAccountId: report.user_account_id,
      userDisplayName: report.user_display_name,
      status: report.status,
      issues: issues.map((row) => ({
        ...parseJson(row.data_json, {}),
        issueId: row.issue_id,
        issueKey: row.issue_key,
        selected: Number(row.selected) === 1,
        improvement: improvementByIssue.get(String(row.issue_id)) ?? null,
        corrections: correctionsByIssue.get(row.issue_key) ?? [],
      })),
    };
  }

  async saveImprovement({ reportId, issueId, issueKey, memo }) {
    const normalizedMemo = String(memo ?? '').trim();
    if (!reportId || !issueId || !issueKey || !normalizedMemo || normalizedMemo.length > 1000) {
      throw new Error('La acción de mejora debe tener entre 1 y 1000 caracteres.');
    }
    const now = new Date().toISOString();
    await this.persistence.exec(`
      INSERT INTO TIME_REPORT_IMPROVEMENTS (report_id, issue_id, issue_key, memo, created, updated)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(report_id, issue_id) DO UPDATE SET
        issue_key = excluded.issue_key, memo = excluded.memo, updated = excluded.updated
    `, [reportId, issueId, issueKey, normalizedMemo, now, now]);
    return { issueId, issueKey, memo: normalizedMemo };
  }

  async deleteImprovement(reportId, issueId) {
    await this.persistence.exec(
      'DELETE FROM TIME_REPORT_IMPROVEMENTS WHERE report_id = ? AND issue_id = ?',
      [reportId, issueId],
    );
  }
}
