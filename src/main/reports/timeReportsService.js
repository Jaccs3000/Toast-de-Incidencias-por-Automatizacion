import crypto from 'node:crypto';
import {
  aggregateUserWorklogs,
  enrichTempoWorklogs,
  extractFirstLifecycleDates,
  validateTimeReportRange,
} from '../../shared/reports/timeReport.js';
import { TimeReportPdfGenerator } from './timeReportPdfGenerator.js';

const ISSUE_FIELDS = [
  'project', 'issuetype', 'summary', 'status', 'reporter', 'assignee', 'created',
  'resolutiondate', 'timeoriginalestimate', 'timeestimate', 'timespent', 'timetracking',
];
const CORRECTION_TYPES = ['Correccion por Testing', 'Correccion por Testing (migrated)'];

const normalizeUserSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function withConcurrency(items, concurrency, worker) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  }));
}

function seconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeIssue(issue) {
  const fields = issue?.fields ?? {};
  return {
    issueId: String(issue?.id ?? issue?.key ?? crypto.randomUUID()),
    issueKey: String(issue?.key ?? ''),
    project: fields.project?.key ?? fields.project?.name ?? '',
    issueType: fields.issuetype?.name ?? '',
    issueTypeIconUrl: fields.issuetype?.iconUrl ?? '',
    projectIconUrl: fields.project?.avatarUrls?.['32x32']
      ?? fields.project?.avatarUrls?.['24x24']
      ?? fields.project?.avatarUrls?.['16x16']
      ?? '',
    summary: fields.summary ?? '',
    status: fields.status?.name ?? '',
    reporter: fields.reporter?.displayName ?? fields.reporter?.name ?? '',
    assignee: fields.assignee?.displayName ?? fields.assignee?.name ?? '',
    assigneeAccountId: fields.assignee?.accountId ?? fields.assignee?.accountID ?? '',
    created: fields.created ?? null,
    resolutiondate: fields.resolutiondate ?? null,
    plannedSeconds: seconds(fields.timeoriginalestimate ?? fields.timetracking?.originalEstimateSeconds),
    spentSeconds: seconds(fields.timespent ?? fields.timetracking?.timeSpentSeconds),
    remainingSeconds: seconds(fields.timeestimate ?? fields.timetracking?.remainingEstimateSeconds),
  };
}

export class TimeReportsService {
  constructor({ persistence, jira, logs, pdfGenerator = null } = {}) {
    this.persistence = persistence;
    this.jira = jira;
    this.logs = logs;
    this.pdfGenerator = pdfGenerator ?? new TimeReportPdfGenerator();
  }

  async searchUsers(query) {
    const users = await this.jira.searchUsers(query);
    const terms = normalizeUserSearchText(query).split(/\s+/).filter(Boolean);
    return users
      .filter((user) => user?.accountId && user?.accountType !== 'app')
      .filter((user) => {
        const searchableText = normalizeUserSearchText(
          `${user.displayName ?? ''} ${user.emailAddress ?? ''}`,
        );
        return terms.every((term) => searchableText.includes(term));
      })
      .map((user) => ({
        accountId: user.accountId,
        displayName: user.displayName ?? user.accountId,
        emailAddress: user.emailAddress ?? null,
      }));
  }

  async loadCorrections(issueIds) {
    if (issueIds.length === 0) return [];
    const placeholders = issueIds.map(() => '?').join(', ');
    const typePlaceholders = CORRECTION_TYPES.map(() => '?').join(', ');
    return this.persistence.query(`
      SELECT source.key AS issue_key, correction.key AS correction_key,
             correction.summary, correction.status, pgi.project_group_id
      FROM JIRA_PROJECT_GROUP_ISSUES pgi
      JOIN JIRA_ISSUES source ON source.id = pgi.issue_id
      JOIN JIRA_PROJECT_GROUP_ISSUES correction_pgi ON correction_pgi.project_group_id = pgi.project_group_id
      JOIN JIRA_ISSUES correction ON correction.id = correction_pgi.issue_id
      WHERE source.id IN (${placeholders})
        AND source.id <> correction.id
        AND correction.issuetype IN (${typePlaceholders})
      ORDER BY source.key, correction.key
    `, [...issueIds, ...CORRECTION_TYPES]);
  }

  async loadProjectGroupDetails(issueIds) {
    if (issueIds.length === 0) return new Map();
    const placeholders = issueIds.map(() => '?').join(', ');
    const rows = await this.persistence.query(`
      SELECT pgi.issue_id, pgi.project_group_id, pg.estado_general,
             tester.assignee AS tester_assignee, tester.key AS tester_key
      FROM JIRA_PROJECT_GROUP_ISSUES pgi
      JOIN JIRA_PROJECT_GROUPS pg ON pg.id = pgi.project_group_id
      LEFT JOIN JIRA_PROJECT_GROUP_ISSUES tester_pgi
        ON tester_pgi.project_group_id = pgi.project_group_id
      LEFT JOIN JIRA_ISSUES tester
        ON tester.id = tester_pgi.issue_id AND tester.issuetype = 'Testing'
      WHERE pgi.issue_id IN (${placeholders})
      ORDER BY pgi.issue_id, pgi.project_group_id, tester.key
    `, issueIds);

    const details = new Map();
    for (const row of rows) {
      const issueId = String(row?.issue_id ?? '').trim();
      if (!issueId) continue;
      const current = details.get(issueId);
      if (!current) {
        details.set(issueId, {
          projectGroupId: row.project_group_id ?? '',
          estadoGeneral: row.estado_general ?? '',
          tester: row.tester_assignee ?? '',
        });
        continue;
      }
      if (!current.tester && row.tester_assignee) current.tester = row.tester_assignee;
    }
    return details;
  }

  async search({ fromDate, toDate, user }) {
    await this.persistence.timeReports.clear();
    const range = validateTimeReportRange(fromDate, toDate);
    const accountId = String(user?.accountId ?? '').trim();
    const displayName = String(user?.displayName ?? '').trim();
    if (!accountId || !displayName) throw new Error('Selecciona un usuario Jira valido.');

    const aggregates = new Map();
    let sourceWorklogCount = 0;

    if (typeof this.jira.searchTempoWorklogs === 'function') {
      const contextJql = `worklogDate >= "${range.fromDate}" AND worklogDate <= "${range.toDate}" ORDER BY updated DESC`;
      const contextPage = await this.jira.searchIssues(contextJql, 1, {
        fields: ['summary'],
        paginate: false,
      });
      const contextIssueKey = contextPage.issues?.[0]?.key ?? null;

      if (contextIssueKey) {
        const tempoWorklogs = await this.jira.searchTempoWorklogs({
          accountId,
          issueKey: contextIssueKey,
        });
        sourceWorklogCount = tempoWorklogs.length;
        for (const worklog of tempoWorklogs) {
          if (String(worklog?.workerId ?? '') !== accountId) continue;
          const issueId = String(worklog?.originTaskId ?? '').trim();
          if (!issueId) continue;
          const current = aggregates.get(issueId) ?? { rangeSeconds: 0, totalSeconds: 0 };
          const aggregate = aggregateUserWorklogs(
            [{ ...worklog, tempoAuthorId: worklog.workerId, startDate: worklog.started }],
            accountId,
            range.fromDate,
            range.toDate,
          );
          current.rangeSeconds += aggregate.rangeSeconds;
          current.totalSeconds += aggregate.totalSeconds;
          if (current.rangeSeconds > 0) aggregates.set(issueId, current);
        }
      }
    } else {
      const fallbackJql = `worklogDate >= "${range.fromDate}" AND worklogDate <= "${range.toDate}" ORDER BY updated DESC`;
      const candidate = await this.jira.searchIssues(fallbackJql, 100, { fields: ['summary'] });
      const keys = [...new Set((candidate.issues ?? []).map((issue) => issue?.key).filter(Boolean))];
      await withConcurrency(keys, 2, async (key) => {
        const worklogs = await this.jira.listIssueWorklogs(key, { expandProperties: true });
        const hasTempoWorklogs = worklogs.some((worklog) => worklog?.properties?.some((property) => property?.key === 'tempo'));
        const tempoAudit = hasTempoWorklogs && worklogs.find((worklog) => worklog.issueId)
          ? await this.jira.listTempoWorklogAudit(worklogs.find((worklog) => worklog.issueId).issueId, { issueKey: key })
          : [];
        const aggregate = aggregateUserWorklogs(
          enrichTempoWorklogs(worklogs, tempoAudit),
          accountId,
          range.fromDate,
          range.toDate,
        );
        if (aggregate.rangeSeconds > 0) aggregates.set(key, aggregate);
      });
    }

    const selectedIssueReferences = [...aggregates.keys()];
    const detailedIssues = [];
    for (const batch of chunks(selectedIssueReferences, 100)) {
      const result = await this.jira.bulkFetchIssues(batch, { fields: ISSUE_FIELDS });
      detailedIssues.push(...(result.issues ?? []));
    }
    const reportIssues = new Map(detailedIssues.map((issue) => {
      const normalized = normalizeIssue(issue);
      const aggregate = aggregates.get(normalized.issueId)
        ?? aggregates.get(normalized.issueKey)
        ?? { rangeSeconds: 0, totalSeconds: 0 };
      return [normalized.issueKey, {
        ...normalized,
        rangeSeconds: aggregate.rangeSeconds,
        totalSeconds: aggregate.totalSeconds,
      }];
    }));

    await withConcurrency([...reportIssues.values()], 2, async (issue) => {
      const changelog = await this.jira.listIssueChangelog(issue.issueKey);
      Object.assign(issue, extractFirstLifecycleDates(changelog, accountId, {
        fields: {
          assignee: { accountId: issue.assigneeAccountId },
          created: issue.created,
          resolutiondate: issue.resolutiondate,
        },
      }));
    });
    const projectGroupDetails = await this.loadProjectGroupDetails(
      [...reportIssues.values()].map((issue) => issue.issueId),
    );
    for (const issue of reportIssues.values()) {
      const details = projectGroupDetails.get(String(issue.issueId));
      issue.projectGroupId = details?.projectGroupId ?? '';
      issue.tester = details?.tester ?? '';
      issue.estadoGeneral = details?.estadoGeneral ?? '';
    }
    const corrections = [...new Map(
      (await this.loadCorrections([...reportIssues.values()].map((issue) => issue.issueId)))
        .map((row) => [`${row.issue_key}|${row.correction_key}`, row]),
    ).values()];
    const reportId = await this.persistence.timeReports.create({
      fromDate: range.fromDate,
      toDate: range.toDate,
      userAccountId: accountId,
      userDisplayName: displayName,
      issues: [...reportIssues.values()],
      corrections: corrections.map((row) => ({
        issueKey: row.issue_key,
        correctionKey: row.correction_key,
        summary: row.summary,
        status: row.status,
        projectGroupId: row.project_group_id,
      })),
    });
    const snapshot = await this.persistence.timeReports.getSnapshot(reportId);
    for (const issue of snapshot.issues) {
      issue.corrections = corrections
        .filter((row) => row.issue_key === issue.issueKey)
        .map((row) => ({ correctionKey: row.correction_key, summary: row.summary, status: row.status }));
    }
    await this.logs?.info('Time report preview created', {
      reportId,
      fromDate: range.fromDate,
      toDate: range.toDate,
      user: accountId,
      sourceWorklogCount,
      issues: snapshot.issues.length,
    });
    return snapshot;
  }

  async generatePdf({ reportId, selectedIssueIds = [] }) {
    const snapshot = await this.persistence.timeReports.getSnapshot(reportId);
    if (!snapshot) throw new Error('El informe temporal no existe. Busca las incidencias nuevamente.');
    if (!Array.isArray(selectedIssueIds) || selectedIssueIds.length === 0) throw new Error('Selecciona al menos una incidencia.');
    const availableIds = new Set(snapshot.issues.map((issue) => String(issue.issueId)));
    const validSelectedIds = selectedIssueIds.filter((issueId) => availableIds.has(String(issueId)));
    if (validSelectedIds.length === 0) throw new Error('Las incidencias seleccionadas ya no existen en el informe temporal.');
    await this.persistence.timeReports.setSelection(reportId, validSelectedIds);
    const selected = await this.persistence.timeReports.getSnapshot(reportId);
    if (!selected.issues.some((issue) => issue.selected)) {
      throw new Error('Las incidencias seleccionadas ya no existen en el informe temporal.');
    }
    const result = await this.pdfGenerator.generate(selected);
    await this.persistence.timeReports.markGenerated(reportId, result.fileName);
    await this.logs?.info('Time report PDF generated', { reportId, fileName: result.fileName, pages: result.pages });
    return { ...result, reportId };
  }
}
