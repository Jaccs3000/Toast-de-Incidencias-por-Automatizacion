import crypto from 'node:crypto';
import { JiraBatchLoader } from '../jira/jiraBatchLoader.js';
import {
  aggregateUserWorklogs,
  enrichTempoWorklogs,
  extractFirstLifecycleDates,
  validateTimeReportRange,
  worklogDate,
} from '../../shared/reports/timeReport.js';
import { TimeReportPdfGenerator } from './timeReportPdfGenerator.js';

const ISSUE_FIELDS = [
  'project', 'issuetype', 'summary', 'status', 'reporter', 'assignee', 'created',
  'resolutiondate', 'timeoriginalestimate', 'timeestimate', 'timespent', 'timetracking',
  'issuelinks', 'comment',
];
const CORRECTION_TYPES = ['Correccion por Testing', 'Correccion por Testing (migrated)'];
const WORKLOG_CONCURRENCY = 4;
const CHANGELOG_CONCURRENCY = 4;
const WORKLOG_CACHE_TTL_MS = 10 * 60 * 1000;

const normalizeUserSearchText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase();

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Time report search canceled.', 'AbortError');
  }
}

async function withConcurrency(items, concurrency, worker, signal = null) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      throwIfAborted(signal);
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

function commentText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(commentText).filter(Boolean).join(' ');
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    return commentText(value.content ?? value.body ?? '');
  }
  return String(value);
}

function normalizeComments(fields) {
  const comments = fields.comment?.comments ?? [];
  return comments.map((comment) => ({
    author: comment.author?.displayName ?? comment.author?.name ?? comment.author?.accountId ?? 'Usuario desconocido',
    created: comment.created ?? null,
    text: commentText(comment.body),
  })).filter((comment) => comment.text || comment.author || comment.created);
}

function isIgnoredTimeDescription(value) {
  return String(value ?? '').trim().toLocaleLowerCase() === 'time-tracking';
}

function normalizeWorklogDescriptions(worklogs, accountId, range) {
  return (Array.isArray(worklogs) ? worklogs : []).map((worklog) => {
    const authorId = worklog?.tempoAuthorId
      ?? worklog?.workerId
      ?? worklog?.author?.accountId
      ?? worklog?.author?.accountID;
    const date = worklogDate(worklog);
    const descriptionText = commentText(worklog?.description);
    const text = descriptionText.trim() ? descriptionText : commentText(worklog?.comment);
    if (String(authorId ?? '') !== String(accountId ?? '')
      || date < range.fromDate || date > range.toDate || !text.trim() || isIgnoredTimeDescription(text)) return null;
    return {
      created: worklog?.started ?? worklog?.startDate ?? null,
      text,
    };
  }).filter(Boolean);
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
    comments: normalizeComments(fields),
    timeDescriptions: [],
    assignee: fields.assignee?.displayName ?? fields.assignee?.name ?? '',
    assigneeAccountId: fields.assignee?.accountId ?? fields.assignee?.accountID ?? '',
    created: fields.created ?? null,
    resolutiondate: fields.resolutiondate ?? null,
    plannedSeconds: seconds(fields.timeoriginalestimate ?? fields.timetracking?.originalEstimateSeconds),
    spentSeconds: seconds(fields.timespent ?? fields.timetracking?.timeSpentSeconds),
    remainingSeconds: seconds(fields.timeestimate ?? fields.timetracking?.remainingEstimateSeconds),
  };
}

function getIssueAggregate(aggregates, issue) {
  for (const reference of [issue?.issueId, issue?.issueKey, issue?.id, issue?.key]) {
    const normalizedReference = String(reference ?? '').trim();
    if (normalizedReference && aggregates.has(normalizedReference)) {
      return aggregates.get(normalizedReference);
    }
  }
  return { rangeSeconds: 0, totalSeconds: 0 };
}

function hasSprintTime(issue) {
  const rangeSeconds = Number(issue?.rangeSeconds);
  return Number.isFinite(rangeSeconds) && rangeSeconds > 0;
}

function issueTypeIconUrl(issue) {
  return String(
    issue?.issueTypeIconUrl
      ?? issue?.issuetypeIconUrl
      ?? issue?.issuetype_icon_url
      ?? '',
  ).trim();
}

function normalizePendingIssue(issue) {
  return {
    ...normalizeIssue(issue),
    rangeSeconds: 0,
    totalSeconds: 0,
    corrections: [],
    includeCorrections: false,
    selected: true,
    grouped: false,
  };
}

export class TimeReportsService {
  constructor({ persistence, jira, logs, syncService = null, pdfGenerator = null } = {}) {
    this.persistence = persistence;
    this.jira = jira;
    this.logs = logs;
    this.syncService = syncService;
    this.pdfGenerator = pdfGenerator ?? new TimeReportPdfGenerator();
    this.pdfIssueTypeIconCache = new Map();
    this.worklogCache = new Map();
  }

  clearWorklogCache() {
    this.worklogCache.clear();
  }

  async embedSelectedIssueTypeIcons(report) {
    if (typeof this.jira?.fetchSessionImageData !== 'function') return report;

    const issueSources = [
      ...(report?.issues ?? []),
      ...(report?.pendingIssues ?? []),
      ...(report?.issues ?? []).flatMap((issue) => issue.corrections ?? []),
    ];
    const urls = [...new Set(issueSources
      .filter((issue) => issue.selected !== false)
      .map(issueTypeIconUrl)
      .filter((url) => /^https?:\/\//i.test(url)))];
    if (urls.length === 0) return report;

    await Promise.all(urls.map(async (url) => {
      if (this.pdfIssueTypeIconCache.has(url)) return;
      try {
        this.pdfIssueTypeIconCache.set(url, await this.jira.fetchSessionImageData(url));
      } catch (error) {
        this.pdfIssueTypeIconCache.set(url, null);
        await this.logs?.warn('No se pudo integrar el icono de tipo Jira en el PDF', {
          message: String(error?.message ?? error).slice(0, 240),
        });
      }
    }));

    const withEmbeddedIcon = (issue) => {
      const embeddedIcon = this.pdfIssueTypeIconCache.get(issueTypeIconUrl(issue));
      const corrections = Array.isArray(issue.corrections)
        ? issue.corrections.map(withEmbeddedIcon)
        : null;
      return {
        ...issue,
        ...(embeddedIcon ? { issueTypeIconUrl: embeddedIcon } : {}),
        ...(corrections ? { corrections } : {}),
      };
    };
    return {
      ...report,
      issues: (report.issues ?? []).map(withEmbeddedIcon),
      pendingIssues: (report.pendingIssues ?? []).map(withEmbeddedIcon),
    };
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

  async loadCorrections(issueIds, signal = null) {
    throwIfAborted(signal);
    if (issueIds.length === 0) return [];
    const placeholders = issueIds.map(() => '?').join(', ');
    const typePlaceholders = CORRECTION_TYPES.map(() => '?').join(', ');
    const corrections = await this.persistence.query(`
      SELECT source.key AS issue_key, correction.key AS correction_key,
             correction.summary, correction.status,
             correction.issuetype_icon_url AS issue_type_icon_url,
             pgi.project_group_id
      FROM JIRA_PROJECT_GROUP_ISSUES pgi
      JOIN JIRA_ISSUES source ON source.id = pgi.issue_id
      JOIN JIRA_PROJECT_GROUP_ISSUES correction_pgi ON correction_pgi.project_group_id = pgi.project_group_id
      JOIN JIRA_ISSUES correction ON correction.id = correction_pgi.issue_id
      WHERE source.id IN (${placeholders})
        AND source.id <> correction.id
        AND correction.issuetype IN (${typePlaceholders})
      ORDER BY source.key, correction.key
    `, [...issueIds, ...CORRECTION_TYPES]);
    throwIfAborted(signal);
    const timeReportSources = new Set(corrections
      .filter((row) => String(row.project_group_id ?? '').startsWith('time-report:'))
      .map((row) => row.issue_key));
    return corrections.filter((row) => (
      !timeReportSources.has(row.issue_key) || String(row.project_group_id ?? '').startsWith('time-report:')
    ));
  }

  async loadProjectGroupDetails(issueIds, signal = null) {
    throwIfAborted(signal);
    if (issueIds.length === 0) return new Map();
    const placeholders = issueIds.map(() => '?').join(', ');
    const rows = await this.persistence.query(`
      SELECT pgi.issue_id, pgi.project_group_id, pg.estado_general,
             tester.assignee AS tester_assignee, tester.key AS tester_key
      FROM JIRA_PROJECT_GROUP_ISSUES pgi
      JOIN JIRA_PROJECT_GROUPS pg ON pg.id = pgi.project_group_id AND pg.source = 'time-report'
      LEFT JOIN JIRA_PROJECT_GROUP_ISSUES tester_pgi
        ON tester_pgi.project_group_id = pgi.project_group_id
      LEFT JOIN JIRA_ISSUES tester
        ON tester.id = tester_pgi.issue_id AND tester.issuetype = 'Testing'
      WHERE pgi.issue_id IN (${placeholders})
      ORDER BY pgi.issue_id, pgi.project_group_id, tester.key
    `, issueIds);

    throwIfAborted(signal);
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

  async loadIssueWorklogAggregate(issueReference, accountId, range, signal = null) {
    throwIfAborted(signal);
    const cacheKey = String(issueReference ?? '').trim();
    const cached = this.worklogCache.get(cacheKey);
    let enrichedWorklogs;
    let worklogCount;
    let cacheHit = false;
    if (cached && Date.now() - cached.fetchedAt < WORKLOG_CACHE_TTL_MS) {
      enrichedWorklogs = cached.worklogs;
      worklogCount = cached.worklogCount;
      cacheHit = true;
    } else {
      const worklogs = await this.jira.listIssueWorklogs(issueReference, {
        expandProperties: true,
        maxResults: 1000,
        maxRetries: 3,
        retryBaseDelayMs: 250,
        signal,
      });
      throwIfAborted(signal);
      const hasTempoWorklogs = worklogs.some((worklog) => (
        worklog?.properties?.some((property) => property?.key === 'tempo')
      ));
      const tempoWorklog = worklogs.find((worklog) => worklog.issueId);
      let tempoAudit = [];
      if (hasTempoWorklogs && tempoWorklog) {
        try {
          tempoAudit = await this.jira.listTempoWorklogAudit(tempoWorklog.issueId, { issueKey: issueReference, signal });
        } catch (error) {
          if (error?.name === 'AbortError') throw error;
          if (error?.status !== 503) throw error;
          await this.logs?.warn('Tempo worklog audit unavailable; continuing without audit enrichment', {
            issueKey: issueReference,
            status: error.status,
            message: String(error.message ?? error).slice(0, 300),
          });
        }
      }
      throwIfAborted(signal);
      enrichedWorklogs = enrichTempoWorklogs(worklogs, tempoAudit);
      worklogCount = worklogs.length;
      this.worklogCache.set(cacheKey, {
        fetchedAt: Date.now(),
        worklogs: enrichedWorklogs,
        worklogCount,
      });
    }
    return {
      aggregate: aggregateUserWorklogs(enrichedWorklogs, accountId, range.fromDate, range.toDate),
      timeDescriptions: normalizeWorklogDescriptions(enrichedWorklogs, accountId, range),
      worklogCount,
      cacheHit,
    };
  }

  async loadHistoricalAggregates(issueReferences, accountId, range, rangeAggregates = new Map(), signal = null) {
    throwIfAborted(signal);
    if (typeof this.jira.listIssueWorklogs !== 'function') {
      return {
        aggregates: new Map(rangeAggregates),
        worklogCount: 0,
      };
    }

    const results = new Map();
    let worklogCount = 0;
    let cacheHits = 0;
    await withConcurrency(issueReferences, WORKLOG_CONCURRENCY, async (issueReference) => {
      const result = await this.loadIssueWorklogAggregate(issueReference, accountId, range, signal);
      worklogCount += result.worklogCount;
      if (result.cacheHit) cacheHits += 1;
      const rangeAggregate = rangeAggregates.get(issueReference);
      if (result.aggregate.rangeSeconds > 0 || rangeAggregate?.rangeSeconds > 0) {
        results.set(issueReference, {
          rangeSeconds: rangeAggregate?.rangeSeconds ?? result.aggregate.rangeSeconds,
          totalSeconds: result.aggregate.totalSeconds,
          timeDescriptions: result.timeDescriptions,
        });
      }
    }, signal);

    return {
      aggregates: new Map(issueReferences
        .filter((issueReference) => results.has(issueReference))
        .map((issueReference) => [issueReference, results.get(issueReference)])),
      worklogCount,
      cacheHits,
    };
  }

  async loadDetailedIssues(issueReferences, signal = null) {
    throwIfAborted(signal);
    if (issueReferences.length === 0) return { issues: [], stats: null };

    if (typeof this.jira.bulkFetchIssues === 'function') {
      const loader = new JiraBatchLoader({
        jira: this.jira,
        signal,
        batchSize: 100,
        concurrency: 2,
        fields: ISSUE_FIELDS,
      });
      return {
        issues: await Promise.all(issueReferences.map((issueReference) => loader.load(issueReference))),
        stats: loader.getStats(),
      };
    }

    const issues = [];
    for (const batch of chunks(issueReferences, 100)) {
      const result = await this.jira.bulkFetchIssues(batch, { fields: ISSUE_FIELDS, signal });
      issues.push(...(result.issues ?? []));
    }
    return { issues, stats: null };
  }

  async loadLifecycleDates(issues, accountId, signal = null) {
    throwIfAborted(signal);
    if (issues.length === 0) return { mode: 'none', bulkEntries: 0, individualRequests: 0 };

    const pending = [...issues];
    let mode = 'individual';
    let bulkEntries = 0;
    if (typeof this.jira.listBulkIssueChangelogs === 'function') {
      try {
        const issueChangeLogs = await this.jira.listBulkIssueChangelogs(
          issues.map((issue) => issue.issueKey || issue.issueId),
          { fieldIds: ['assignee', 'status'], signal },
        );
        const historiesByReference = new Map(issueChangeLogs.map((entry) => [
          String(entry?.issueId ?? '').trim(),
          Array.isArray(entry?.changeHistories) ? entry.changeHistories : [],
        ]));
        bulkEntries = issueChangeLogs.length;
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          const issue = pending[index];
          const reference = [issue.issueId, issue.issueKey]
            .map((value) => String(value ?? '').trim())
            .find((value) => value && historiesByReference.has(value));
          if (!reference) continue;
          Object.assign(issue, extractFirstLifecycleDates(
            historiesByReference.get(reference),
            accountId,
            {
              fields: {
                assignee: { accountId: issue.assigneeAccountId },
                created: issue.created,
                resolutiondate: issue.resolutiondate,
              },
            },
          ));
          pending.splice(index, 1);
        }
        mode = pending.length === 0 ? 'bulk' : 'bulk-with-fallback';
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        await this.logs?.warn('Bulk issue changelog unavailable; using individual changelogs', {
          status: error?.status ?? null,
          message: String(error?.message ?? error).slice(0, 300),
        });
        mode = 'individual-fallback';
      }
    }

    await withConcurrency(pending, CHANGELOG_CONCURRENCY, async (issue) => {
      const changelog = await this.jira.listIssueChangelog(issue.issueKey, {
        maxResults: 1000,
        maxRetries: 3,
        retryBaseDelayMs: 250,
        signal,
      });
      Object.assign(issue, extractFirstLifecycleDates(changelog, accountId, {
        fields: {
          assignee: { accountId: issue.assigneeAccountId },
          created: issue.created,
          resolutiondate: issue.resolutiondate,
        },
      }));
    }, signal);

    return {
      mode,
      bulkEntries,
      individualRequests: pending.length,
    };
  }

  async search({ fromDate, toDate, user, signal = null }) {
    const searchStartedAt = Date.now();
    const phaseTimings = {};
    throwIfAborted(signal);
    await this.persistence.timeReports.clear();
    await this.persistence.clearProjectGroupsBySource?.('time-report');
    throwIfAborted(signal);
    const range = validateTimeReportRange(fromDate, toDate);
    const accountId = String(user?.accountId ?? '').trim();
    const displayName = String(user?.displayName ?? '').trim();
    if (!accountId || !displayName) throw new Error('Selecciona un usuario Jira valido.');

    const pendingJql = `assignee = "${accountId.replace(/"/g, '\\"')}" AND status NOT IN ("Cerrado", "Aceptado", "Terminado", "No aceptado") ORDER BY updated DESC`;
    const pendingTask = this.jira.searchIssues(pendingJql, 1000, {
      fields: ISSUE_FIELDS,
      signal,
    });

    let aggregates = new Map();
    let sourceWorklogCount = 0;
    let historicalWorklogCount = 0;
    let historicalWorklogCacheHits = 0;
    const worklogStartedAt = Date.now();
    let rangeAggregates = new Map();
    const tempoTimeDescriptions = new Map();
    let selectedIssueReferences = [];
    let historicalTask;
    let detailed;

    let tempoSearchFailed = false;
    if (typeof this.jira.searchTempoWorklogs === 'function') {
      try {
        const contextJql = `worklogDate >= "${range.fromDate}" AND worklogDate <= "${range.toDate}" ORDER BY updated DESC`;
        const contextPage = await this.jira.searchIssues(contextJql, 1, {
          fields: ['summary'],
          paginate: false,
          signal,
        });
        throwIfAborted(signal);
        const contextIssueKey = contextPage.issues?.[0]?.key ?? null;

        if (contextIssueKey) {
          const tempoWorklogs = await this.jira.searchTempoWorklogs({
            accountId,
            fromDate: range.fromDate,
            toDate: range.toDate,
            issueKey: contextIssueKey,
            signal,
          });
          throwIfAborted(signal);
          sourceWorklogCount = tempoWorklogs.length;
          for (const worklog of tempoWorklogs) {
            if (String(worklog?.workerId ?? '') !== accountId) continue;
            const issueId = String(worklog?.originTaskId ?? '').trim();
            if (!issueId) continue;
            const worklogDateValue = String(worklog?.started ?? '').slice(0, 10);
            const descriptionText = commentText(worklog?.description ?? worklog?.comment);
            if (descriptionText.trim() && !isIgnoredTimeDescription(descriptionText)
              && worklogDateValue >= range.fromDate && worklogDateValue <= range.toDate) {
              const descriptions = tempoTimeDescriptions.get(issueId) ?? [];
              descriptions.push({ created: worklog.started ?? null, text: descriptionText });
              tempoTimeDescriptions.set(issueId, descriptions);
            }
            const current = rangeAggregates.get(issueId) ?? { rangeSeconds: 0 };
            const aggregate = aggregateUserWorklogs(
              [{ ...worklog, tempoAuthorId: worklog.workerId, startDate: worklog.started }],
              accountId,
              range.fromDate,
              range.toDate,
            );
            current.rangeSeconds += aggregate.rangeSeconds;
            if (current.rangeSeconds > 0) rangeAggregates.set(issueId, current);
          }
        }

        selectedIssueReferences = [...rangeAggregates.keys()];
        historicalTask = this.loadHistoricalAggregates(
          selectedIssueReferences,
          accountId,
          range,
          rangeAggregates,
          signal,
        ).finally(() => {
          phaseTimings.worklogsMs = Date.now() - worklogStartedAt;
        });
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        tempoSearchFailed = true;
        await this.logs?.warn('Tempo worklog search failed; falling back to Jira worklogs', {
          status: error?.status ?? null,
          message: String(error?.message ?? error).slice(0, 300),
        });
      }
    }

    if (typeof this.jira.searchTempoWorklogs !== 'function' || tempoSearchFailed) {
      const fallbackJql = `worklogDate >= "${range.fromDate}" AND worklogDate <= "${range.toDate}" ORDER BY updated DESC`;
      const candidate = await this.jira.searchIssues(fallbackJql, 100, { fields: ['summary'], signal });
      throwIfAborted(signal);
      const keys = [...new Set((candidate.issues ?? []).map((issue) => issue?.key).filter(Boolean))];
      historicalTask = this.loadHistoricalAggregates(keys, accountId, range, new Map(), signal).finally(() => {
        phaseTimings.worklogsMs = Date.now() - worklogStartedAt;
      });
      const historical = await historicalTask;
      aggregates = historical.aggregates;
      historicalWorklogCount = historical.worklogCount;
      historicalWorklogCacheHits = historical.cacheHits ?? 0;
      selectedIssueReferences = [...aggregates.keys()];
    }

    // This task runs beside issue-detail loading, so observe an early abort before awaiting it below.
    void historicalTask.catch(() => {});
    const detailsStartedAt = Date.now();
    throwIfAborted(signal);
    const detailedTask = this.loadDetailedIssues(selectedIssueReferences, signal).finally(() => {
      phaseTimings.issueDetailsMs = Date.now() - detailsStartedAt;
    });
    try {
      detailed = await detailedTask;
    } catch (error) {
      await Promise.allSettled([historicalTask]);
      throw error;
    }
    const detailedIssues = detailed.issues;
    const reportIssues = new Map(detailedIssues.map((issue) => {
      const normalized = normalizeIssue(issue);
      const aggregate = getIssueAggregate(rangeAggregates, normalized);
      return [normalized.issueKey, {
        ...normalized,
        rangeSeconds: aggregate.rangeSeconds,
        totalSeconds: aggregate.totalSeconds,
        timeDescriptions: [
          ...(tempoTimeDescriptions.get(normalized.issueId) ?? []),
          ...(aggregate.timeDescriptions ?? []),
        ],
      }];
    }));

    const lifecycleStartedAt = Date.now();
    const lifecycleTask = this.loadLifecycleDates([...reportIssues.values()], accountId, signal).finally(() => {
      phaseTimings.lifecycleMs = Date.now() - lifecycleStartedAt;
    });

    let historical;
    try {
      historical = await historicalTask;
    } catch (error) {
      await Promise.allSettled([lifecycleTask]);
      throw error;
    }
    aggregates = historical.aggregates;
    historicalWorklogCount = historical.worklogCount;
    historicalWorklogCacheHits = historical.cacheHits ?? 0;
    phaseTimings.worklogsMs ??= Date.now() - worklogStartedAt;
    for (const issue of reportIssues.values()) {
      const aggregate = getIssueAggregate(aggregates, issue);
      issue.rangeSeconds = aggregate.rangeSeconds;
      issue.totalSeconds = aggregate.totalSeconds;
      const descriptions = [
        ...(tempoTimeDescriptions.get(issue.issueId) ?? []),
        ...(aggregate.timeDescriptions ?? []),
      ];
      issue.timeDescriptions = descriptions.filter((description, index, values) => (
        values.findIndex((candidate) => candidate.created === description.created && candidate.text === description.text) === index
      ));
    }

    // The report is scoped to the selected sprint range. Historical worklogs
    // may give an issue a positive total while its sprint time is zero; those
    // issues must not appear in the report grid or PDF.
    for (const [issueId, issue] of reportIssues) {
      if (!hasSprintTime(issue)) reportIssues.delete(issueId);
    }

    const projectGroupsStartedAt = Date.now();
    await this.syncService?.refreshProjectGroupsForIssues(
      detailedIssues.filter((issue) => reportIssues.has(String(issue?.key ?? ''))),
      { signal },
    );
    phaseTimings.projectGroupsMs = Date.now() - projectGroupsStartedAt;

    const issueIds = [...reportIssues.values()].map((issue) => issue.issueId);
    const projectGroupDetailsTask = this.loadProjectGroupDetails(issueIds, signal);
    const correctionsTask = this.loadCorrections(issueIds, signal);

    const [lifecycle, projectGroupDetails, correctionRows] = await Promise.all([
      lifecycleTask,
      projectGroupDetailsTask,
      correctionsTask,
    ]);
    for (const issue of reportIssues.values()) {
      const details = projectGroupDetails.get(String(issue.issueId));
      issue.projectGroupId = details?.projectGroupId ?? '';
      issue.tester = details?.tester ?? '';
      issue.estadoGeneral = details?.estadoGeneral ?? '';
    }
    const corrections = [...new Map(
      correctionRows
        .map((row) => [`${row.issue_key}|${row.correction_key}`, row]),
    ).values()];
    throwIfAborted(signal);
    try {
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
          issueTypeIconUrl: row.issue_type_icon_url ?? '',
          projectIconUrl: '',
          projectGroupId: row.project_group_id,
        })),
      });
      throwIfAborted(signal);
      const snapshot = await this.persistence.timeReports.getSnapshot(reportId);
      throwIfAborted(signal);
      for (const issue of snapshot.issues) {
        issue.corrections = corrections
          .filter((row) => row.issue_key === issue.issueKey)
          .map((row) => ({
            issueKey: row.issue_key,
            correctionKey: row.correction_key,
            summary: row.summary,
            status: row.status,
            issueTypeIconUrl: row.issue_type_icon_url ?? '',
            projectIconUrl: '',
            projectGroupId: row.project_group_id,
          }));
      }
      await this.logs?.info('Time report preview created', {
        reportId,
        fromDate: range.fromDate,
        toDate: range.toDate,
        user: accountId,
        sourceWorklogCount,
        historicalWorklogCount,
        historicalWorklogCacheHits,
        candidateIssues: selectedIssueReferences.length,
        detailedBatchMetrics: detailed.stats,
        lifecycle,
        phaseTimings,
        durationMs: Date.now() - searchStartedAt,
        issues: snapshot.issues.length,
        jiraMetrics: typeof this.jira.getMetrics === 'function' ? this.jira.getMetrics() : null,
      });
      throwIfAborted(signal);
      const pendingResult = await pendingTask;
      throwIfAborted(signal);
      return {
        ...snapshot,
        pendingIssues: (pendingResult.issues ?? []).map(normalizePendingIssue),
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        await this.persistence.timeReports.clear();
      }
      throw error;
    }
  }

  async generatePdf({
    reportId,
    selectedIssueIds = [],
    issueOrderIds = [],
    summaryOverrides = null,
    includeCorrectionsIssueIds = null,
    groupedIssueIds = [],
    pendingIssues = [],
    selectedPendingIssueIds = [],
    pendingIssueOrderIds = [],
    pdfTheme = 'oscuro',
  }) {
    const snapshot = await this.persistence.timeReports.getSnapshot(reportId);
    if (!snapshot) throw new Error('El informe temporal no existe. Busca las incidencias nuevamente.');
    if (summaryOverrides && typeof summaryOverrides === 'object' && !Array.isArray(summaryOverrides)) {
      snapshot.issues = snapshot.issues.map((issue) => {
        const override = summaryOverrides[String(issue.issueId)];
        return typeof override === 'string' ? { ...issue, summary: override } : issue;
      });
    }
    if (!Array.isArray(selectedIssueIds) || selectedIssueIds.length === 0) throw new Error('Selecciona al menos una incidencia.');
    const availableIds = new Set(snapshot.issues.map((issue) => String(issue.issueId)));
    const validSelectedIds = selectedIssueIds.filter((issueId) => availableIds.has(String(issueId)));
    if (validSelectedIds.length === 0) throw new Error('Las incidencias seleccionadas ya no existen en el informe temporal.');
    await this.persistence.timeReports.setSelection(reportId, validSelectedIds);
    const selectedSnapshot = await this.persistence.timeReports.getSnapshot(reportId);
    const selected = summaryOverrides && typeof summaryOverrides === 'object' && !Array.isArray(summaryOverrides)
      ? {
        ...selectedSnapshot,
        issues: selectedSnapshot.issues.map((issue) => {
          const override = summaryOverrides[String(issue.issueId)];
          return typeof override === 'string' ? { ...issue, summary: override } : issue;
        }),
      }
      : selectedSnapshot;
    if (!selected.issues.some((issue) => issue.selected)) {
      throw new Error('Las incidencias seleccionadas ya no existen en el informe temporal.');
    }
    const correctionSelection = Array.isArray(includeCorrectionsIssueIds)
      ? new Set(includeCorrectionsIssueIds.map((issueId) => String(issueId)))
      : null;
    const groupedSelection = new Set((Array.isArray(groupedIssueIds) ? groupedIssueIds : [])
      .map((issueId) => String(issueId)));
    const selectedForPdf = {
      ...selected,
      issues: selected.issues.map((issue) => {
        const grouped = groupedSelection.has(String(issue.issueId));
        const includeCorrections = !grouped
          && (correctionSelection === null || correctionSelection.has(String(issue.issueId)));
        return {
          ...issue,
          grouped,
          corrections: includeCorrections ? issue.corrections : [],
        };
      }).sort((left, right) => {
        const groupedDifference = Number(left.grouped === true) - Number(right.grouped === true);
        if (groupedDifference !== 0) return groupedDifference;
        const leftIndex = issueOrderIds.findIndex((issueId) => String(issueId) === String(left.issueId));
        const rightIndex = issueOrderIds.findIndex((issueId) => String(issueId) === String(right.issueId));
        return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex)
          - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
      }),
    };
    const pendingSelection = new Set((Array.isArray(selectedPendingIssueIds) ? selectedPendingIssueIds : [])
      .map((issueId) => String(issueId)));
    const pendingForPdf = (Array.isArray(pendingIssues) ? pendingIssues : [])
      .filter((issue) => pendingSelection.has(String(issue.issueId)))
      .sort((left, right) => {
        const leftIndex = pendingIssueOrderIds.findIndex((issueId) => String(issueId) === String(left.issueId));
        const rightIndex = pendingIssueOrderIds.findIndex((issueId) => String(issueId) === String(right.issueId));
        return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex)
          - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
      });
    const pdfReport = await this.embedSelectedIssueTypeIcons({
      ...selectedForPdf,
      pendingIssues: pendingForPdf,
    });
    pdfReport.pdfTheme = pdfTheme;
    const result = await this.pdfGenerator.generate(pdfReport);
    await this.persistence.timeReports.markGenerated(reportId, result.fileName);
    await this.logs?.info('Time report PDF generated', { reportId, fileName: result.fileName, pages: result.pages });
    return { ...result, reportId };
  }

  async saveImprovement({ reportId, issueId, memo }) {
    const snapshot = await this.persistence.timeReports.getSnapshot(reportId);
    const issue = snapshot?.issues.find((item) => String(item.issueId) === String(issueId));
    if (!issue) throw new Error('La incidencia no pertenece al reporte actual.');
    const improvement = await this.persistence.timeReports.saveImprovement({
      reportId,
      issueId: issue.issueId,
      issueKey: issue.issueKey,
      memo,
    });
    return improvement;
  }

  async deleteImprovement({ reportId, issueId }) {
    await this.persistence.timeReports.deleteImprovement(reportId, issueId);
  }
}
