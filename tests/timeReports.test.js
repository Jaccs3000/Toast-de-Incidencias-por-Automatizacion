import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateUserWorklogs,
  calculateSecondFriday,
  enrichTempoWorklogs,
  extractFirstLifecycleDates,
  formatReportDuration,
} from '../src/shared/reports/timeReport.js';
import { TimeReportsService } from '../src/main/reports/timeReportsService.js';
import { buildTimeReportHtml, launchPdfBrowser } from '../src/main/reports/timeReportPdfGenerator.js';
import { Persistence } from '../src/main/persistence/persistence.js';
import { JiraClient } from '../src/main/jira/jiraClient.js';

const userId = 'account-jesus';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

test('calculates the second Friday from the selected start date', () => {
  assert.equal(calculateSecondFriday('2026-08-31'), '2026-09-11');
  assert.equal(calculateSecondFriday('2026-09-04'), '2026-09-11');
  assert.equal(calculateSecondFriday('2026-09-06'), '2026-09-18');
  assert.equal(calculateSecondFriday(''), '');
  assert.equal(calculateSecondFriday('2026-02-30'), '');
});

test('filters user suggestions using every search term', async () => {
  const service = new TimeReportsService({
    jira: {
      async searchUsers() {
        return [
          { accountId: '1', displayName: 'Jesus Antonio Clavijo Castellar', emailAddress: 'jaclavijo@sprc.com.co' },
          { accountId: '2', displayName: 'Jesus Pimienta', emailAddress: 'epistem...@sprc.com.co' },
          { accountId: '3', displayName: 'Jesus Gutierrez Mesa', emailAddress: 'jgutierrez@sprc.com.co' },
          { accountId: 'app', accountType: 'app', displayName: 'Jesus Clavijo App' },
        ];
      },
    },
  });

  assert.deepEqual(await service.searchUsers('jesus clavijo'), [{
    accountId: '1',
    displayName: 'Jesus Antonio Clavijo Castellar',
    emailAddress: 'jaclavijo@sprc.com.co',
  }]);
});

test('aggregates only the selected user and separates range from historical total', () => {
  const result = aggregateUserWorklogs([
    { author: { accountId: userId }, startDate: '2026-09-01', timeSpentSeconds: 3600 },
    { author: { accountId: userId }, started: '2026-09-04T10:00:00.000-0500', timeSpentSeconds: 1800 },
    { author: { accountId: userId }, startDate: '2026-08-31', timeSpentSeconds: 7200 },
    { author: { accountId: 'other-user' }, startDate: '2026-09-02', timeSpentSeconds: 9000 },
  ], userId, '2026-09-01', '2026-09-04');

  assert.equal(result.rangeSeconds, 5400);
  assert.equal(result.totalSeconds, 12600);
});

test('uses Tempo workerId when Jira stores the worklog author as the Tempo app', () => {
  const worklogs = enrichTempoWorklogs([
    {
      issueId: '5323908',
      author: { accountId: 'tempo-app', accountType: 'app' },
      properties: [{ key: 'tempo', value: { tempo_id: 192998 } }],
      started: '2026-09-02T09:00:00.000-0500',
      timeSpentSeconds: 3600,
    },
  ], [{
    entity: { entity_id: '192998' },
    timestamp: '2026-09-02T14:00:00.000Z',
    changes: [{ field: 'workerId', new: userId }],
  }]);

  assert.equal(worklogs[0].tempoAuthorId, userId);
  assert.deepEqual(
    aggregateUserWorklogs(worklogs, userId, '2026-09-01', '2026-09-04'),
    { rangeSeconds: 3600, totalSeconds: 3600 },
  );
});

test('takes the first assignment and first En Progreso transition by the selected user', () => {
  const result = extractFirstLifecycleDates([
    {
      created: '2026-09-03T10:00:00.000-0500',
      author: { accountId: userId },
      items: [{ field: 'status', toString: 'En Progreso' }],
    },
    {
      created: '2026-09-02T09:00:00.000-0500',
      author: { accountId: 'other-user' },
      items: [{ field: 'assignee', to: userId }],
    },
    {
      created: '2026-09-01T09:00:00.000-0500',
      author: { accountId: 'other-user' },
      items: [{ field: 'assignee', to: userId }],
    },
    {
      created: '2026-09-04T09:00:00.000-0500',
      author: { accountId: userId },
      items: [{ field: 'status', toString: 'En Progreso' }],
    },
  ], userId, { fields: { resolutiondate: null } });

  assert.equal(result.assignedAt, '2026-09-01T09:00:00.000-0500');
  assert.equal(result.startedAt, '2026-09-03T10:00:00.000-0500');
  assert.equal(result.closedAt, null);
});

test('uses creation for an initial assignment and closing for a missing start date', () => {
  const result = extractFirstLifecycleDates([
    {
      created: '2026-09-04T11:46:36.071-0500',
      author: { accountId: userId },
      items: [{ field: 'status', fromString: 'Creado', toString: 'Cerrado' }],
    },
  ], userId, {
    fields: {
      assignee: { accountId: userId },
      created: '2026-09-04T11:40:58.526-0500',
      resolutiondate: '2026-09-04T11:46:36.025-0500',
    },
  });

  assert.equal(result.assignedAt, '2026-09-04T11:40:58.526-0500');
  assert.equal(result.startedAt, '2026-09-04T11:46:36.025-0500');
  assert.equal(result.closedAt, '2026-09-04T11:46:36.025-0500');
});

test('formats report durations compactly', () => {
  assert.equal(formatReportDuration(0), '0m');
  assert.equal(formatReportDuration(8700), '2h 25m');
  assert.equal(formatReportDuration(null), '');
});

test('embeds Jira type icons with the active session headers', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return {
      ok: true,
      headers: new Headers({ 'content-type': 'image/png' }),
      async arrayBuffer() { return new Uint8Array([1, 2, 3]).buffer; },
    };
  };

  try {
    const jira = new JiraClient({
      baseUrl: 'https://jira.example.test',
      headers: { Cookie: 'session=active' },
    });
    const result = await jira.fetchSessionImageData('https://jira.example.test/secure/viewavatar?avatarId=1');

    assert.equal(result, 'data:image/png;base64,AQID');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.headers.Cookie, 'session=active');
    await assert.rejects(
      () => jira.fetchSessionImageData('https://outside.example.test/icon.png'),
      /no pertenece al sitio Jira configurado/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('paginates and normalizes bulk issue changelogs', async () => {
  const calls = [];
  const pages = [
    {
      issueChangeLogs: [{
        issueId: '1',
        changeHistories: [{ id: 'history-1', created: 1788433200, items: [] }],
      }],
      nextPageToken: 'next-page',
    },
    {
      issueChangeLogs: [{
        issueId: '1',
        changeHistories: [{ id: 'history-2', created: '2026-09-02T10:00:00.000-0500', items: [] }],
      }],
    },
  ];
  const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
  jira.request = async (pathname, options) => {
    calls.push({ pathname, body: JSON.parse(options.body) });
    return pages.shift();
  };

  const result = await jira.listBulkIssueChangelogs(['1'], {
    fieldIds: ['assignee', 'status'],
    maxResults: 1000,
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].pathname, '/rest/api/3/changelog/bulkfetch');
  assert.deepEqual(calls[0].body, {
    issueIdsOrKeys: ['1'], fieldIds: ['assignee', 'status'], maxResults: 1000,
  });
  assert.equal(calls[1].body.nextPageToken, 'next-page');
  assert.deepEqual(result.map((entry) => entry.issueId), ['1']);
  assert.equal(result[0].changeHistories.length, 2);
  assert.equal(result[0].changeHistories[0].created, '2026-09-03T11:00:00.000Z');
});

test('requests larger Jira worklog pages without skipping records', async () => {
  const calls = [];
  const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
  jira.request = async (pathname) => {
    calls.push(pathname);
    return calls.length === 1
      ? { worklogs: [{ id: '1' }, { id: '2' }], total: 3, maxResults: 1000 }
      : { worklogs: [{ id: '3' }], total: 3, maxResults: 1000 };
  };

  const result = await jira.listIssueWorklogs('ABC-1', { expandProperties: true });

  assert.deepEqual(result.map((worklog) => worklog.id), ['1', '2', '3']);
  assert.match(calls[0], /startAt=0&maxResults=1000&expand=properties/);
  assert.match(calls[1], /startAt=2&maxResults=1000&expand=properties/);
});

test('falls back to the compatible Jira worklog page size after a 400', async () => {
  const calls = [];
  const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
  jira.request = async (pathname) => {
    calls.push(pathname);
    if (pathname.includes('maxResults=1000')) {
      const error = new Error('Unsupported page size');
      error.status = 400;
      throw error;
    }
    return { worklogs: [{ id: '1' }], total: 1 };
  };

  const result = await jira.listIssueWorklogs('ABC-1');

  assert.deepEqual(result.map((worklog) => worklog.id), ['1']);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /maxResults=100/);
});

test('retries a rate-limited Jira worklog page without duplicating it', async () => {
  let calls = 0;
  const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
  jira.request = async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error('Rate limited');
      error.status = 429;
      error.retryAfterSeconds = 0;
      throw error;
    }
    return { worklogs: [{ id: '1' }], total: 1 };
  };

  const result = await jira.listIssueWorklogs('ABC-1', { retryBaseDelayMs: 0 });

  assert.deepEqual(result.map((worklog) => worklog.id), ['1']);
  assert.equal(calls, 2);
});

test('requests larger Jira changelog pages while preserving all histories', async () => {
  const calls = [];
  const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
  jira.request = async (pathname) => {
    calls.push(pathname);
    return calls.length === 1
      ? { values: [{ id: 'history-1' }, { id: 'history-2' }], total: 3, maxResults: 1000 }
      : { values: [{ id: 'history-3' }], total: 3, maxResults: 1000 };
  };

  const result = await jira.listIssueChangelog('ABC-1');

  assert.deepEqual(result.map((history) => history.id), ['history-1', 'history-2', 'history-3']);
  assert.match(calls[0], /startAt=0&maxResults=1000/);
  assert.match(calls[1], /startAt=2&maxResults=1000/);
});

test('does not repeat an unavailable bulk changelog request during the session', async () => {
  let calls = 0;
  const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
  jira.request = async () => {
    calls += 1;
    const error = new Error('Unsupported endpoint');
    error.status = 400;
    throw error;
  };

  await assert.rejects(() => jira.listBulkIssueChangelogs(['ABC-1']));
  await assert.rejects(() => jira.listBulkIssueChangelogs(['ABC-2']));

  assert.equal(calls, 1);
});

test('limits and paginates the Tempo worklog search', async () => {
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    const page = requests.length === 1
      ? { worklogs: [{ workerId: userId, originTaskId: '1', timeSpentSeconds: 3600 }], nextPageToken: 'next-page' }
      : { worklogs: [{ workerId: userId, originTaskId: '2', timeSpentSeconds: 1800 }] };
    return { ok: true, async json() { return page; } };
  };

  try {
    const jira = new JiraClient({ baseUrl: 'https://jira.example.test' });
    jira.getTempoContext = async () => ({ origin: 'https://tempo.example.test', token: 'tempo-token' });
    const result = await jira.searchTempoWorklogs({
      accountId: userId,
      fromDate: '2026-09-01',
      toDate: '2026-09-04',
      issueKey: 'ABC-1',
    });

    assert.equal(result.length, 2);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0].body, {
      accountIds: [userId],
      userTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      from: '2026-09-01',
      to: '2026-09-04',
    });
    assert.equal(requests[1].body.nextPageToken, 'next-page');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('uses bulk lifecycle data and falls back to individual changelogs', async () => {
  const issue = {
    issueId: '1',
    issueKey: 'ABC-1',
    assigneeAccountId: userId,
    created: '2026-09-01T08:00:00.000-0500',
    resolutiondate: null,
  };
  let individualCalls = 0;
  let bulkReferences;
  const service = new TimeReportsService({
    jira: {
      async listBulkIssueChangelogs(references) {
        bulkReferences = references;
        return [{
          issueId: '1',
          changeHistories: [{
            created: '2026-09-01T09:00:00.000-0500',
            author: { accountId: userId },
            items: [{ field: 'status', toString: 'En Progreso' }],
          }],
        }];
      },
      async listIssueChangelog() {
        individualCalls += 1;
        return [];
      },
    },
    logs: { async warn() {} },
  });

  const bulkResult = await service.loadLifecycleDates([issue], userId);

  assert.equal(bulkResult.mode, 'bulk');
  assert.equal(bulkResult.individualRequests, 0);
  assert.equal(issue.startedAt, '2026-09-01T09:00:00.000-0500');
  assert.equal(individualCalls, 0);
  assert.deepEqual(bulkReferences, ['ABC-1']);

  const fallbackIssue = { ...issue, issueId: '2', issueKey: 'ABC-2', startedAt: undefined };
  const fallbackService = new TimeReportsService({
    jira: {
      async listBulkIssueChangelogs() {
        const error = new Error('Not supported');
        error.status = 404;
        throw error;
      },
      async listIssueChangelog() {
        return [{
          created: '2026-09-02T09:00:00.000-0500',
          author: { accountId: userId },
          items: [{ field: 'status', toString: 'En Progreso' }],
        }];
      },
    },
    logs: { async warn() {} },
  });

  const fallbackResult = await fallbackService.loadLifecycleDates([fallbackIssue], userId);

  assert.equal(fallbackResult.mode, 'individual-fallback');
  assert.equal(fallbackResult.individualRequests, 1);
  assert.equal(fallbackIssue.startedAt, '2026-09-02T09:00:00.000-0500');
});

test('renders the selected user total and correction-only continuation pages', () => {
  const corrections = Array.from({ length: 7 }, (_, index) => ({
    correctionKey: `ABC-${index + 10}`,
    summary: `Correccion ${index + 1}`,
    status: 'Cerrado',
    projectIconUrl: 'https://example.test/project.png',
  }));
  const html = buildTimeReportHtml({
    fromDate: '2026-09-01',
    toDate: '2026-09-04',
    userDisplayName: 'Jesus Antonio Clavijo Castellar',
    issues: [{
      selected: true,
      issueKey: 'ABC-1',
      summary: 'Prueba',
      status: 'En Progreso',
      issueType: 'Testing',
      projectIconUrl: 'https://example.test/project.png',
      issueTypeIconUrl: 'https://example.test/issue-type.png',
      assignee: 'Jesus Antonio Clavijo Castellar',
      reporter: 'Heider Alberto Neira Perez',
      totalSeconds: 5400,
      spentSeconds: 99900,
      rangeSeconds: 3600,
      plannedSeconds: 7200,
      remainingSeconds: 3600,
      tester: 'Leonardo Alberto Tester Persona',
      estadoGeneral: 'Probando en TEST',
      corrections,
    }],
  });

  assert.equal((html.match(/<section class="page/g) ?? []).length, 2);
  assert.match(html, /1h 30m/);
  assert.match(html, /Tiempo reportado en Sprint/);
  assert.match(html, /Tiempo Total/);
  assert.match(html, /size: Letter landscape/);
  assert.match(html, /report-icon-calendar/);
  assert.match(html, /report-icon-user/);
  assert.match(html, /report-icon-target/);
  assert.match(html, /report-icon-stopwatch/);
  assert.match(html, /report-icon-project/);
  assert.match(html, /jira-issue-icon/);
  assert.match(html, /jira-issue-type-icon/);
  assert.match(html, /\.jira-issue-type-icon img \{ object-fit:contain; padding:2px/);
  assert.match(html, /width:22px; height:22px; flex:0 0 22px/);
  assert.match(html, /https:\/\/example\.test\/project\.png/);
  assert.match(html, /https:\/\/example\.test\/issue-type\.png/);
  assert.match(html, />Jesus Clavijo</);
  assert.match(html, />Heider Neira</);
  assert.match(html, />Leonardo Tester</);
  assert.match(html, />Probando en TEST</);
  assert.match(html, /class="report-details-grid"/);
  assert.match(html, /class="report-divider report-divider-general"/);
  assert.match(html, /class="report-divider report-divider-dates"/);
  assert.match(html, /grid-template-rows:minmax\(54px, auto\) minmax\(54px, auto\) 9px/);
  assert.match(html, /\.report-divider \{ min-width:0; align-self:center;/);
  assert.match(html, /class="general-state status-other"/);
  assert.match(html, /\.correction-status \{ justify-self:end; width:88px/);
  assert.doesNotMatch(html, />Jesus Antonio Clavijo Castellar</);
  assert.match(html, /\.status, \.correction-status/);
  assert.match(html, /issue-heading/);
  assert.match(html, /correction-status status-closed/);
  assert.doesNotMatch(html, /<div class="time-panel"/);
  assert.doesNotMatch(html, /time-ring|Total usuario|>Restante</);
  assert.doesNotMatch(html, /27h 45m/);
  const continuation = html.slice(html.indexOf('Correcciones 2'));
  assert.match(continuation, /ABC-16/);
  assert.doesNotMatch(continuation, /Planeado/);
});

test('renders grouped issues in a paginated grid without individual correction pages', () => {
  const groupedIssues = Array.from({ length: 13 }, (_, index) => ({
    selected: true,
    grouped: true,
    issueKey: `GRP-${index + 1}`,
    issueType: 'Tarea',
    summary: `Asunto agrupado ${index + 1}`,
    rangeSeconds: (index + 1) * 3600,
    status: index % 2 === 0 ? 'Cerrado' : 'En Progreso',
    corrections: [{ correctionKey: `COR-${index + 1}`, summary: 'No debe mostrarse', status: 'Cerrado' }],
  }));
  const html = buildTimeReportHtml({
    fromDate: '2026-09-01',
    toDate: '2026-09-04',
    userDisplayName: 'Jesus Clavijo',
    issues: [{
      selected: true,
      issueKey: 'IND-1',
      issueType: 'Tarea',
      summary: 'Incidencia individual',
      status: 'Creado',
      corrections: [],
    }, ...groupedIssues],
  });

  assert.equal((html.match(/<section class="page/g) ?? []).length, 3);
  assert.equal((html.match(/class="page grouped-issues-page"/g) ?? []).length, 2);
  assert.match(html, /Tiempos adicionales en el Sprint/);
  assert.match(html, /<th>Incidencia<\/th><th>Tipo Incidencia<\/th><th>Asunto<\/th><th>Tiempo Sprint<\/th><th>Estado<\/th>/);
  assert.match(html, /GRP-13/);
  assert.match(html, />13h<\/td>/);
  assert.doesNotMatch(html, /No debe mostrarse/);
});

test('embeds selected type icons before generating the PDF', async () => {
  let generatedReport;
  const snapshot = {
    id: 'report-icons',
    issues: [
      {
        issueId: '1', issueKey: 'ABC-1', selected: true,
        issueTypeIconUrl: 'https://jira.example.test/icon-a.png', corrections: [],
      },
      {
        issueId: '2', issueKey: 'ABC-2', selected: false,
        issueTypeIconUrl: 'https://jira.example.test/icon-b.png', corrections: [],
      },
    ],
  };
  const fetchedUrls = [];
  const persistence = {
    timeReports: {
      async getSnapshot() { return snapshot; },
      async setSelection() {},
      async markGenerated() {},
    },
  };
  const service = new TimeReportsService({
    persistence,
    jira: {
      async fetchSessionImageData(url) {
        fetchedUrls.push(url);
        return `data:image/png;base64,${url.endsWith('icon-a.png') ? 'AQID' : 'BAUG'}`;
      },
    },
    logs: { async info() {} },
    pdfGenerator: {
      async generate(report) {
        generatedReport = report;
        return { fileName: 'report.pdf', filePath: 'C:/report.pdf', pages: 1 };
      },
    },
  });

  await service.generatePdf({ reportId: 'report-icons', selectedIssueIds: ['1'] });

  assert.deepEqual(fetchedUrls, ['https://jira.example.test/icon-a.png']);
  assert.equal(generatedReport.issues[0].issueTypeIconUrl, 'data:image/png;base64,AQID');
  assert.equal(generatedReport.issues[1].issueTypeIconUrl, 'https://jira.example.test/icon-b.png');
});

test('includes corrections only for the issues selected for correction details', async () => {
  let generatedReport;
  const snapshot = {
    id: 'report-corrections',
    issues: [
      {
        issueId: '1', issueKey: 'ABC-1', selected: true,
        corrections: [{ correctionKey: 'ABC-101', summary: 'Correccion 1', status: 'Cerrado' }],
      },
      {
        issueId: '2', issueKey: 'ABC-2', selected: true,
        corrections: [{ correctionKey: 'ABC-201', summary: 'Correccion 2', status: 'Por Probar' }],
      },
    ],
  };
  const persistence = {
    timeReports: {
      async getSnapshot() { return snapshot; },
      async setSelection() {},
      async markGenerated() {},
    },
  };
  const service = new TimeReportsService({
    persistence,
    jira: {},
    pdfGenerator: {
      async generate(report) {
        generatedReport = report;
        return { fileName: 'report.pdf', filePath: 'C:/report.pdf', pages: 2 };
      },
    },
  });

  await service.generatePdf({
    reportId: 'report-corrections',
    selectedIssueIds: ['1', '2'],
    includeCorrectionsIssueIds: ['1'],
  });

  assert.equal(generatedReport.issues[0].corrections.length, 1);
  assert.equal(generatedReport.issues[1].corrections.length, 0);
});

test('groups selected issues and omits their corrections from the PDF', async () => {
  let generatedReport;
  const snapshot = {
    id: 'report-grouped',
    issues: [
      {
        issueId: '1', issueKey: 'ABC-1', selected: true,
        corrections: [{ correctionKey: 'ABC-101', summary: 'Correccion 1', status: 'Cerrado' }],
      },
      {
        issueId: '2', issueKey: 'ABC-2', selected: true,
        corrections: [{ correctionKey: 'ABC-201', summary: 'Correccion 2', status: 'Por Probar' }],
      },
    ],
  };
  const persistence = {
    timeReports: {
      async getSnapshot() { return snapshot; },
      async setSelection() {},
      async markGenerated() {},
    },
  };
  const service = new TimeReportsService({
    persistence,
    jira: {},
    pdfGenerator: {
      async generate(report) {
        generatedReport = report;
        return { fileName: 'report.pdf', filePath: 'C:/report.pdf', pages: 2 };
      },
    },
  });

  await service.generatePdf({
    reportId: 'report-grouped',
    selectedIssueIds: ['1', '2'],
    includeCorrectionsIssueIds: ['1', '2'],
    groupedIssueIds: ['2'],
  });

  assert.equal(generatedReport.issues[0].grouped, false);
  assert.equal(generatedReport.issues[0].corrections.length, 1);
  assert.equal(generatedReport.issues[1].grouped, true);
  assert.equal(generatedReport.issues[1].corrections.length, 0);
});

test('prefers installed browsers when creating a PDF and keeps a concise launch error', async () => {
  const calls = [];
  const browser = { close: async () => {} };
  const result = await launchPdfBrowser(async (options) => {
    calls.push(options);
    if (calls.length === 1) throw new Error('Chrome blocked');
    return browser;
  });

  assert.equal(result.browser, browser);
  assert.equal(result.engine, 'Microsoft Edge');
  assert.deepEqual(calls, [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
  ]);

  await assert.rejects(
    () => launchPdfBrowser(async () => { throw new Error('spawn EPERM'); }),
    /No se pudo iniciar el motor para crear el PDF/,
  );
});

test('initializes and clears only the temporary time report tables', async () => {
  const persistence = new Persistence(':memory:');
  await persistence.initialize();

  try {
    const tables = await persistence.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main' AND table_name LIKE 'TIME_REPORT%'
      ORDER BY table_name
    `);
    assert.deepEqual(tables.map((row) => row.table_name), [
      'TIME_REPORTS',
      'TIME_REPORT_CORRECTIONS',
      'TIME_REPORT_IMPROVEMENTS',
      'TIME_REPORT_ISSUES',
    ]);

    await persistence.timeReports.create({
      fromDate: '2026-09-01',
      toDate: '2026-09-04',
      userAccountId: userId,
      userDisplayName: 'Jesus Clavijo',
    });
    assert.equal(Number((await persistence.query('SELECT COUNT(*) AS total FROM TIME_REPORTS'))[0].total), 1);

    await persistence.timeReports.clear();
    assert.equal(Number((await persistence.query('SELECT COUNT(*) AS total FROM TIME_REPORTS'))[0].total), 0);
    assert.equal(Number((await persistence.query('SELECT COUNT(*) AS total FROM JIRA_ISSUES'))[0].total), 0);
  } finally {
    await persistence.close();
  }
});

test('builds a report from exact worklogs and graph corrections only', async () => {
  let saved;
  const persistence = {
    timeReports: {
      async clear() {},
      async create(value) {
        saved = { ...value, id: 'report-1' };
        return 'report-1';
      },
      async getSnapshot() {
        return {
          id: saved.id,
          fromDate: saved.fromDate,
          toDate: saved.toDate,
          userAccountId: saved.userAccountId,
          userDisplayName: saved.userDisplayName,
          issues: saved.issues.map((issue) => ({ ...issue, selected: true, corrections: saved.corrections.filter((row) => row.issueKey === issue.issueKey) })),
        };
      },
    },
    async query(sql) {
      if (sql.includes('JIRA_PROJECT_GROUPS')) {
        return [{ issue_id: '1', project_group_id: 'group-1', estado_general: 'Probando en TEST', tester_assignee: 'Leonardo Alberto Tester Persona', tester_key: 'ABC-2' }];
      }
      return [{ issue_key: 'ABC-1', correction_key: 'ABC-9', summary: 'Corregir prueba', status: 'Cerrado', project_group_id: 'group-1' }];
    },
  };
  const jira = {
    async searchIssues() {
      return { issues: [{ key: 'ABC-1' }, { key: 'ABC-2' }] };
    },
    async listIssueWorklogs(key) {
      return key === 'ABC-1'
        ? [
          { author: { accountId: userId }, startDate: '2026-09-02', timeSpentSeconds: 3600 },
          { author: { accountId: userId }, startDate: '2026-08-30', timeSpentSeconds: 1800 },
        ]
        : [{ author: { accountId: 'other-user' }, startDate: '2026-09-02', timeSpentSeconds: 7200 }];
    },
    async listTempoWorklogAudit() {
      return [];
    },
    async bulkFetchIssues() {
      return { issues: [{
        id: '1', key: 'ABC-1', fields: {
          project: { key: 'ABC', avatarUrls: { '24x24': 'https://example.test/project-avatar.png' } },
          issuetype: { name: 'Testing', iconUrl: 'https://example.test/issue-type.png' }, summary: 'Prueba', status: { name: 'En Progreso' },
          reporter: { displayName: 'Reporter' }, assignee: { displayName: 'Jesus' }, created: '2026-08-01T10:00:00Z',
          resolutiondate: null, timeoriginalestimate: 7200, timeestimate: 3600, timespent: 3600,
        },
      }] };
    },
    async listIssueChangelog() {
      return [];
    },
  };
  const service = new TimeReportsService({ persistence, jira, logs: { info: async () => {} } });
  const result = await service.search({
    fromDate: '2026-09-01', toDate: '2026-09-04', user: { accountId: userId, displayName: 'Jesus Clavijo' },
  });

  assert.deepEqual(result.issues.map((issue) => issue.issueKey), ['ABC-1']);
  assert.equal(result.issues[0].rangeSeconds, 3600);
  assert.equal(result.issues[0].totalSeconds, 5400);
  assert.equal(result.issues[0].projectIconUrl, 'https://example.test/project-avatar.png');
  assert.equal(result.issues[0].issueTypeIconUrl, 'https://example.test/issue-type.png');
  assert.equal(result.issues[0].projectGroupId, 'group-1');
  assert.equal(result.issues[0].tester, 'Leonardo Alberto Tester Persona');
  assert.equal(result.issues[0].estadoGeneral, 'Probando en TEST');
  assert.equal(result.issues[0].corrections[0].correctionKey, 'ABC-9');
});

test('uses Tempo worklog search to group the selected user by Jira issue', async () => {
  let tempoSearchOptions;
  const worklogCalls = [];
  const persistence = {
    timeReports: {
      async clear() {},
      async create(value) {
        return value.id ?? 'report-tempo';
      },
      async getSnapshot() {
        return {
          id: 'report-tempo',
          issues: [
            {
              issueId: '1', issueKey: 'ABC-1', selected: true,
              corrections: [], rangeSeconds: 3600, totalSeconds: 5400,
            },
            {
              issueId: '2', issueKey: 'ABC-2', selected: true,
              corrections: [], rangeSeconds: 7200, totalSeconds: 7200,
            },
          ],
        };
      },
    },
    async query() { return []; },
  };
  const jira = {
    async searchIssues() { return { issues: [{ key: 'ABC-1' }] }; },
    async searchTempoWorklogs(options) {
      tempoSearchOptions = options;
      return [
        { workerId: userId, originTaskId: '1', started: '2026-09-02 09:00:00.000', timeSpentSeconds: 3600 },
        { workerId: userId, originTaskId: '2', started: '2026-09-04 09:00:00.000', timeSpentSeconds: 7200 },
        { workerId: 'other-user', originTaskId: '3', started: '2026-09-02 09:00:00.000', timeSpentSeconds: 9000 },
      ];
    },
    async listIssueWorklogs(issueReference) {
      worklogCalls.push(issueReference);
      return issueReference === '1'
        ? [
          { author: { accountId: userId }, startDate: '2026-09-02', timeSpentSeconds: 3600 },
          { author: { accountId: userId }, startDate: '2026-08-30', timeSpentSeconds: 1800 },
        ]
        : [{ author: { accountId: userId }, startDate: '2026-09-04', timeSpentSeconds: 7200 }];
    },
    async listTempoWorklogAudit() { return []; },
    async bulkFetchIssues(ids) {
      return {
        issues: ids.map((id) => ({
          id,
          key: `ABC-${id}`,
          fields: {
            project: { key: 'ABC' },
            issuetype: { name: 'Testing' },
            summary: `Incidencia ${id}`,
            status: { name: 'En Progreso' },
          },
        })),
      };
    },
    async listIssueChangelog() { return []; },
  };
  const service = new TimeReportsService({ persistence, jira, logs: { info: async () => {} } });
  const result = await service.search({
    fromDate: '2026-09-01', toDate: '2026-09-04', user: { accountId: userId, displayName: 'Jesus Clavijo' },
  });

  assert.deepEqual(result.issues.map((issue) => issue.issueKey), ['ABC-1', 'ABC-2']);
  assert.deepEqual(result.issues.map((issue) => [issue.rangeSeconds, issue.totalSeconds]), [
    [3600, 5400],
    [7200, 7200],
  ]);
  assert.equal(tempoSearchOptions.fromDate, '2026-09-01');
  assert.equal(tempoSearchOptions.toDate, '2026-09-04');
  assert.deepEqual(worklogCalls.sort(), ['1', '2']);
});

test('cancels a time report search without persisting partial results', async () => {
  let created = false;
  let notifyWorklogStarted;
  const worklogStarted = new Promise((resolve) => { notifyWorklogStarted = resolve; });
  const persistence = {
    timeReports: {
      async clear() {},
      async create() {
        created = true;
        return 'report-canceled';
      },
      async getSnapshot() { return null; },
    },
    async query() { return []; },
  };
  const jira = {
    async searchIssues() { return { issues: [{ key: 'ABC-1' }] }; },
    async searchTempoWorklogs() {
      return [{
        workerId: userId,
        originTaskId: '1',
        started: '2026-09-02 09:00:00.000',
        timeSpentSeconds: 3600,
      }];
    },
    async listIssueWorklogs(issueReference, { signal }) {
      assert.equal(issueReference, '1');
      notifyWorklogStarted();
      await new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new DOMException('Time report search canceled.', 'AbortError'));
        }, { once: true });
      });
      return [];
    },
    async bulkFetchIssues(ids) {
      return {
        issues: ids.map((id) => ({
          id,
          key: `ABC-${id}`,
          fields: {
            project: { key: 'ABC' },
            issuetype: { name: 'Testing' },
            summary: `Incidencia ${id}`,
            status: { name: 'En Progreso' },
          },
        })),
      };
    },
    async listBulkIssueChangelogs() { return []; },
    async listIssueChangelog() { return []; },
  };
  const service = new TimeReportsService({ persistence, jira, logs: { info: async () => {} } });
  const controller = new AbortController();
  const search = service.search({
    fromDate: '2026-09-01',
    toDate: '2026-09-04',
    user: { accountId: userId, displayName: 'Jesus Clavijo' },
    signal: controller.signal,
  });
  const rejected = assert.rejects(search, { name: 'AbortError' });

  await worklogStarted;
  controller.abort();

  await rejected;
  assert.equal(created, false);
});

test('clears the temporary report if cancellation reaches the persistence boundary', async () => {
  let clearCount = 0;
  let created = false;
  const controller = new AbortController();
  const persistence = {
    timeReports: {
      async clear() { clearCount += 1; },
      async create() {
        created = true;
        controller.abort();
        return 'report-canceled-after-create';
      },
      async getSnapshot() {
        throw new Error('The snapshot must not be read after cancellation.');
      },
    },
    async query() { return []; },
  };
  const jira = {
    async searchIssues() { return { issues: [{ key: 'ABC-1' }] }; },
    async searchTempoWorklogs() { return []; },
    async bulkFetchIssues() { return { issues: [] }; },
  };
  const service = new TimeReportsService({ persistence, jira });

  await assert.rejects(() => service.search({
    fromDate: '2026-09-01',
    toDate: '2026-09-04',
    user: { accountId: userId, displayName: 'Jesus Clavijo' },
    signal: controller.signal,
  }), { name: 'AbortError' });

  assert.equal(created, true);
  assert.equal(clearCount, 2);
});

test('overlaps historical worklogs with lifecycle requests without changing totals', async () => {
  let saved;
  let completedHistoricalIssues = 0;
  let lifecycleStartedWhileHistoryWasRunning = false;
  const persistence = {
    timeReports: {
      async clear() {},
      async create(value) {
        saved = value;
        return 'report-overlap';
      },
      async getSnapshot() {
        return {
          id: 'report-overlap',
          issues: saved.issues.map((issue) => ({ ...issue, selected: true, corrections: [] })),
        };
      },
    },
    async query() { return []; },
  };
  const jira = {
    async searchIssues() { return { issues: [{ key: 'ABC-1' }] }; },
    async searchTempoWorklogs() {
      return [
        { workerId: userId, originTaskId: '1', started: '2026-09-02 09:00:00.000', timeSpentSeconds: 3600 },
        { workerId: userId, originTaskId: '2', started: '2026-09-02 10:00:00.000', timeSpentSeconds: 1800 },
      ];
    },
    async listIssueWorklogs(issueReference) {
      await delay(40);
      completedHistoricalIssues += 1;
      return [{
        author: { accountId: userId },
        startDate: '2026-09-02',
        timeSpentSeconds: issueReference === '1' ? 3600 : 1800,
      }];
    },
    async bulkFetchIssues(ids) {
      return {
        issues: ids.map((id) => ({
          id,
          key: `ABC-${id}`,
          fields: {
            project: { key: 'ABC' },
            issuetype: { name: 'Testing' },
            summary: `Incidencia ${id}`,
            status: { name: 'En Progreso' },
          },
        })),
      };
    },
    async listBulkIssueChangelogs() {
      lifecycleStartedWhileHistoryWasRunning = completedHistoricalIssues < 2;
      return [];
    },
    async listIssueChangelog() { return []; },
  };

  const service = new TimeReportsService({ persistence, jira, logs: { info: async () => {} } });
  const result = await service.search({
    fromDate: '2026-09-01',
    toDate: '2026-09-04',
    user: { accountId: userId, displayName: 'Jesus Clavijo' },
  });

  assert.equal(lifecycleStartedWhileHistoryWasRunning, true);
  assert.deepEqual(result.issues.map((issue) => [issue.issueKey, issue.rangeSeconds, issue.totalSeconds]), [
    ['ABC-1', 3600, 3600],
    ['ABC-2', 1800, 1800],
  ]);
});
