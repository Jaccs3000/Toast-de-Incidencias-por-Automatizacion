function normalizeDate(value) {
  return String(value ?? '').trim();
}

export function calculateSecondFriday(fromDate, maxDate = '') {
  const value = normalizeDate(fromDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) {
    return '';
  }

  const daysUntilFriday = (5 - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntilFriday + 7);
  const result = date.toISOString().slice(0, 10);
  const maximum = normalizeDate(maxDate);
  return /^\d{4}-\d{2}-\d{2}$/.test(maximum) && maximum < result ? maximum : result;
}

export function validateTimeReportRange(fromDate, toDate) {
  const from = normalizeDate(fromDate);
  const to = normalizeDate(toDate);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(from) || !datePattern.test(to)) {
    throw new Error('Selecciona un rango de fechas valido.');
  }
  if (from > to) {
    throw new Error('La fecha inicial no puede ser posterior a la fecha final.');
  }
  return { fromDate: from, toDate: to };
}

export function worklogDate(worklog) {
  return normalizeDate(worklog?.startDate ?? worklog?.started).slice(0, 10);
}

export function isWorklogByUserInRange(worklog, accountId, fromDate, toDate) {
  const authorId = worklog?.tempoAuthorId
    ?? worklog?.workerId
    ?? worklog?.author?.accountId
    ?? worklog?.author?.accountID;
  const date = worklogDate(worklog);
  return String(authorId ?? '') === String(accountId ?? '') && date >= fromDate && date <= toDate;
}

export function aggregateUserWorklogs(worklogs, accountId, fromDate, toDate) {
  let rangeSeconds = 0;
  let totalSeconds = 0;
  for (const worklog of Array.isArray(worklogs) ? worklogs : []) {
    const authorId = worklog?.tempoAuthorId
      ?? worklog?.workerId
      ?? worklog?.author?.accountId
      ?? worklog?.author?.accountID;
    if (String(authorId ?? '') !== String(accountId ?? '')) continue;
    const seconds = Number(worklog?.timeSpentSeconds ?? 0);
    if (!Number.isFinite(seconds) || seconds < 0) continue;
    totalSeconds += seconds;
    if (worklogDate(worklog) >= fromDate && worklogDate(worklog) <= toDate) {
      rangeSeconds += seconds;
    }
  }
  return { rangeSeconds, totalSeconds };
}

function tempoWorklogId(worklog) {
  const property = (Array.isArray(worklog?.properties) ? worklog.properties : [])
    .find((item) => item?.key === 'tempo');
  const value = property?.value?.tempo_id;
  return value === null || value === undefined ? null : String(value);
}

export function enrichTempoWorklogs(worklogs, auditEvents) {
  const events = Array.isArray(auditEvents) ? auditEvents : [];
  const eventsByWorklogId = new Map();
  for (const event of events) {
    const tempoId = String(event?.entity?.entity_id ?? '');
    if (!tempoId) continue;
    const relatedEvents = eventsByWorklogId.get(tempoId) ?? [];
    relatedEvents.push(event);
    eventsByWorklogId.set(tempoId, relatedEvents);
  }
  for (const relatedEvents of eventsByWorklogId.values()) {
    relatedEvents.sort((left, right) => String(left?.timestamp ?? '')
      .localeCompare(String(right?.timestamp ?? '')));
  }

  return (Array.isArray(worklogs) ? worklogs : []).map((worklog) => {
    const tempoId = tempoWorklogId(worklog);
    if (!tempoId) return worklog;

    let tempoAuthorId = null;
    const relatedEvents = eventsByWorklogId.get(tempoId) ?? [];
    for (const event of relatedEvents) {
      for (const change of Array.isArray(event?.changes) ? event.changes : []) {
        if (change?.field === 'workerId' && change.new) {
          tempoAuthorId = String(change.new);
        }
      }
    }
    return tempoAuthorId ? { ...worklog, tempoAuthorId } : worklog;
  });
}

function comparable(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es');
}

export function extractFirstLifecycleDates(changelog, accountId, issue) {
  const histories = [...(Array.isArray(changelog) ? changelog : [])]
    .filter((history) => history?.created)
    .sort((left, right) => String(left.created).localeCompare(String(right.created)));
  let assignedAt = null;
  let startedAt = null;
  for (const history of histories) {
    for (const item of Array.isArray(history.items) ? history.items : []) {
      if (!assignedAt && item.field === 'assignee'
        && String(item.to ?? '') === String(accountId ?? '')) {
        assignedAt = history.created;
      }
      if (!startedAt && item.field === 'status'
        && String(history.author?.accountId ?? '') === String(accountId ?? '')
        && comparable(item.toString) === comparable('En Progreso')) {
        startedAt = history.created;
      }
    }
  }
  const closedAt = issue?.fields?.resolutiondate ?? null;
  const currentAssigneeId = issue?.fields?.assignee?.accountId ?? issue?.fields?.assignee?.accountID;
  if (!assignedAt && String(currentAssigneeId ?? '') === String(accountId ?? '')) {
    assignedAt = issue?.fields?.created ?? null;
  }
  if (!startedAt && closedAt) {
    startedAt = closedAt;
  }
  return {
    assignedAt,
    startedAt,
    closedAt,
  };
}

export function formatReportDuration(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return '';
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '';
  const minutes = Math.round(value / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return `${hours}h${rest ? ` ${rest}m` : ''}`;
}

export function isSprintOnlyProject(issue) {
  return String(issue?.project ?? '').trim().toLocaleUpperCase() === 'TA2';
}
