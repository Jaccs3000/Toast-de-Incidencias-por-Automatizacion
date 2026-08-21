export const SUBTASK_COUNT_FIELDS = new Set(['closedSubtasks', 'openSubtasks']);
export const SUBTASK_COUNT_ISSUE_TYPES = new Set([
  'Solicitud Paso a Producción',
  'Solicitud Paso a Pre-Producción',
]);

export function getSubtaskCountEntries(issues, issueType, field) {
  const isClosed = field === 'closedSubtasks';
  return issues
    .filter((issue) => issue.issuetype === issueType)
    .map((parentIssue) => {
      const subtasks = issues
        .filter((issue) => issue.parent === parentIssue.key)
        .filter((issue) => {
          const status = String(issue.status ?? '').trim();
          const isClosedSubtask = status === 'Cerrado' || status === 'Aceptado';
          return isClosedSubtask === isClosed;
        })
        .map((issue) => {
          const subtask = {
            key: issue.key,
            summary: issue.summary ?? null,
            issuetype: issue.issuetype,
            assignee: issue.assignee,
            created: issue.created,
          };
          return subtask;
        });
      return { parentKey: parentIssue.key, count: subtasks.length, subtasks };
    });
}
