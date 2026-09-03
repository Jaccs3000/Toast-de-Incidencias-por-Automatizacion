export const REPORTED_TIMES_FIELD = 'reportedTimes';
const REPORTED_TIME_SOURCE_FIELDS = new Set(['timeestimate', 'timespent', 'timeremaining']);

function toMinutes(value) {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? minutes : 0;
}

export function getReportedTimesEntries(issues, issueType) {
  return (issues ?? [])
    .filter((issue) => issue?.issuetype === issueType)
    .map((issue) => ({
      key: issue.key ?? null,
      timeestimate: toMinutes(issue.timeestimate),
      timespent: toMinutes(issue.timespent),
      timeremaining: toMinutes(issue.timeremaining),
    }))
    // Without a planned time there is no meaningful progress ratio to show.
    .filter((entry) => entry.timeestimate > 0);
}

export function getReportedTimesSortValue(entries) {
  const firstEntry = Array.isArray(entries) ? entries[0] : null;
  return firstEntry?.timeestimate ?? null;
}

export function collapseReportedTimeColumns(columns) {
  const columnsByIssueType = new Map();
  for (const column of columns ?? []) {
    if (!REPORTED_TIME_SOURCE_FIELDS.has(column?.field) || !column?.issueType) continue;
    const fields = columnsByIssueType.get(column.issueType) ?? new Set();
    fields.add(column.field);
    columnsByIssueType.set(column.issueType, fields);
  }
  const issueTypesToCollapse = new Set(
    [...columnsByIssueType.entries()]
      .filter(([, fields]) => [...REPORTED_TIME_SOURCE_FIELDS].every((field) => fields.has(field)))
      .map(([issueType]) => issueType),
  );
  const emittedIssueTypes = new Set();

  return (columns ?? []).flatMap((column) => {
    const isReportedTimesColumn = column?.field === REPORTED_TIMES_FIELD;
    const isLegacyTimeColumn = REPORTED_TIME_SOURCE_FIELDS.has(column?.field);
    const shouldCollapse = issueTypesToCollapse.has(column?.issueType)
      && (isLegacyTimeColumn || isReportedTimesColumn);

    if (!shouldCollapse) {
      return [column];
    }
    if (emittedIssueTypes.has(column.issueType)) return [];
    emittedIssueTypes.add(column.issueType);
    return [{ ...column, field: REPORTED_TIMES_FIELD, label: `${column.issueType} - ${REPORTED_TIMES_FIELD}` }];
  });
}
