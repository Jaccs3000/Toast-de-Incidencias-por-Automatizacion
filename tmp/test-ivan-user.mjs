import { TimeReportsService } from '../src/main/reports/timeReportsService.js';

const users = [
  { accountId: 'ivan-1', displayName: 'Ivan Andres Moreno Ruiz', emailAddress: 'ivan.moreno@sprc.com.co' },
  { accountId: 'jesus-1', displayName: 'Jesus Antonio Clavijo Castellar', emailAddress: 'jaclavijo@sprc.com.co' },
  { accountId: 'app', accountType: 'app', displayName: 'Ivan Bot' },
];

const service = new TimeReportsService({
  jira: {
    async searchUsers(query) {
      return users.filter((user) => user.displayName.toLowerCase().includes(String(query).toLowerCase()));
    },
    async searchIssues() {
      return { issues: [] };
    },
  },
  persistence: {
    query: async () => [],
  },
  logs: {
    info: async () => {},
    warn: async () => {},
  },
});

const found = await service.searchUsers('ivan andres moreno ruiz');
console.log(JSON.stringify(found, null, 2));
console.log('selected user accountId =', found[0]?.accountId ?? null);
