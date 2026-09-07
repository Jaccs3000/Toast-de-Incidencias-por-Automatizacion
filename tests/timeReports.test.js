import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateUserWorklogs,
  enrichTempoWorklogs,
  extractFirstLifecycleDates,
  formatReportDuration,
} from '../src/shared/reports/timeReport.js';
import { TimeReportsService } from '../src/main/reports/timeReportsService.js';
import { buildTimeReportHtml, launchPdfBrowser } from '../src/main/reports/timeReportPdfGenerator.js';
import { Persistence } from '../src/main/persistence/persistence.js';

const userId = 'account-jesus';

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

test('renders the selected user total and correction-only continuation pages', () => {
  const corrections = Array.from({ length: 7 }, (_, index) => ({
    correctionKey: `ABC-${index + 10}`,
    summary: `Correccion ${index + 1}`,
    status: 'Cerrado',
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
  assert.match(html, /width:22px; height:22px; flex:0 0 22px/);
  assert.match(html, /https:\/\/example\.test\/project\.png/);
  assert.match(html, />Jesus Clavijo</);
  assert.match(html, />Heider Neira</);
  assert.match(html, />Leonardo Tester</);
  assert.match(html, />Probando en TEST</);
  assert.doesNotMatch(html, />Jesus Antonio Clavijo Castellar</);
  assert.match(html, /\.status, \.correction-status/);
  assert.match(html, /issue-heading/);
  assert.match(html, /correction-status status-closed/);
  assert.doesNotMatch(html, /time-ring|Total usuario|>Restante</);
  assert.doesNotMatch(html, /27h 45m/);
  const continuation = html.slice(html.indexOf('Correcciones 2'));
  assert.match(continuation, /ABC-16/);
  assert.doesNotMatch(continuation, /Planeado/);
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
    async searchTempoWorklogs() {
      return [
        { workerId: userId, originTaskId: '1', started: '2026-09-02 09:00:00.000', timeSpentSeconds: 3600 },
        { workerId: userId, originTaskId: '1', started: '2026-08-30 09:00:00.000', timeSpentSeconds: 1800 },
        { workerId: userId, originTaskId: '2', started: '2026-09-04 09:00:00.000', timeSpentSeconds: 7200 },
        { workerId: 'other-user', originTaskId: '3', started: '2026-09-02 09:00:00.000', timeSpentSeconds: 9000 },
      ];
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
});
