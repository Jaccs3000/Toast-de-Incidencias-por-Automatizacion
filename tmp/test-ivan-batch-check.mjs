import { TimeReportsService } from '../src/main/reports/timeReportsService.js';
import { validateTimeReportRange, aggregateUserWorklogs } from '../src/shared/reports/timeReport.js';

const userList = [
  { accountId: 'ivan-1', displayName: 'Ivan Andres Moreno Ruiz', emailAddress: 'ivan.moreno@sprc.com.co' },
  { accountId: 'jesus-1', displayName: 'Jesus Antonio Clavijo Castellar', emailAddress: 'jaclavijo@sprc.com.co' },
  { accountId: 'app', accountType: 'app', displayName: 'Ivan Bot' },
];

const service = new TimeReportsService({
  jira: {
    async searchUsers(query) {
      return userList.filter((user) => user.displayName.toLowerCase().includes(String(query).toLowerCase()));
    },
    async searchIssues() {
      return { issues: [] };
    },
  },
  persistence: { query: async () => [] },
  logs: { info: async () => {}, warn: async () => {} },
});

const matchedUsers = await service.searchUsers('ivan andres moreno ruiz');
const range = validateTimeReportRange('2026-09-14', '2026-09-25');
const userWorklogs = [
  { author: { accountId: 'ivan-1' }, started: '2026-09-15T09:00:00.000-0500', timeSpentSeconds: 7200 },
  { author: { accountId: 'ivan-1' }, started: '2026-09-20T10:00:00.000-0500', timeSpentSeconds: 5400 },
  { author: { accountId: 'other-user' }, started: '2026-09-20T10:00:00.000-0500', timeSpentSeconds: 9000 },
];
const aggregate = aggregateUserWorklogs(userWorklogs, 'ivan-1', '2026-09-14', '2026-09-25');
const issueWithTime = { issueId: 'ISSUE-1', issueKey: 'ISSUE-1', rangeSeconds: 12600 };
const issueWithoutTime = { issueId: 'ISSUE-2', issueKey: 'ISSUE-2', rangeSeconds: 0 };
const hasSprintTime = (issue) => Number.isFinite(Number(issue?.rangeSeconds)) && Number(issue.rangeSeconds) > 0;
const filteredIssues = [issueWithTime, issueWithoutTime].filter(hasSprintTime);

console.log('CHECK_USER_SEARCH');
console.log(JSON.stringify(matchedUsers, null, 2));
console.log('CHECK_DATE_RANGE');
console.log(JSON.stringify(range, null, 2));
console.log('CHECK_WORKLOG_AGGREGATE');
console.log(JSON.stringify(aggregate, null, 2));
console.log('CHECK_FILTERED_ISSUES');
console.log(JSON.stringify(filteredIssues, null, 2));
