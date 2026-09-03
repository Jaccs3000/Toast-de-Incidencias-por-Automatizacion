import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPORTED_TIMES_FIELD,
  collapseReportedTimeColumns,
  getReportedTimesEntries,
  getReportedTimesSortValue,
} from '../src/shared/grids/reportedTimes.js';

test('collects reported times for the requested issue type only', () => {
  const entries = getReportedTimesEntries([
    { key: 'AC-1', issuetype: 'Testing', timeestimate: 240, timespent: 150, timeremaining: 90 },
    { key: 'AC-2', issuetype: 'Testing', timeestimate: 0, timespent: 0, timeremaining: 0 },
    { key: 'AC-3', issuetype: 'Implementacion Q&A', timeestimate: 120, timespent: 30, timeremaining: 90 },
  ], 'Testing');

  assert.equal(REPORTED_TIMES_FIELD, 'reportedTimes');
  assert.deepEqual(entries, [{ key: 'AC-1', timeestimate: 240, timespent: 150, timeremaining: 90 }]);
});

test('uses the first reported time entry for grid sorting', () => {
  assert.equal(getReportedTimesSortValue([{ timeestimate: 240 }]), 240);
  assert.equal(getReportedTimesSortValue([]), null);
});

test('collapses legacy time columns only when all three are present for the same issue type', () => {
  const columns = collapseReportedTimeColumns([
    { issueType: 'Testing', field: 'key' },
    { issueType: 'Testing', field: 'timeestimate' },
    { issueType: 'Testing', field: 'timespent' },
    { issueType: 'Testing', field: 'timeremaining' },
    { issueType: 'Implementacion Q&A', field: 'timeestimate' },
  ]);

  assert.deepEqual(columns.map(({ issueType, field }) => ({ issueType, field })), [
    { issueType: 'Testing', field: 'key' },
    { issueType: 'Testing', field: 'reportedTimes' },
    { issueType: 'Implementacion Q&A', field: 'timeestimate' },
  ]);
});

test('keeps one reported times column when a prior migration left mixed time fields', () => {
  const columns = collapseReportedTimeColumns([
    { issueType: 'Testing', field: 'reportedTimes' },
    { issueType: 'Testing', field: 'timeestimate' },
    { issueType: 'Testing', field: 'timespent' },
    { issueType: 'Testing', field: 'timeremaining' },
  ]);

  assert.deepEqual(columns.map(({ issueType, field }) => ({ issueType, field })), [
    { issueType: 'Testing', field: 'reportedTimes' },
  ]);
});
