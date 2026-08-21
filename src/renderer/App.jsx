import { useEffect, useRef, useState } from 'react';
import { validateAlertConditionConfig } from '../shared/alerts/alertConditionValidation.js';

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error ?? `Request failed (${response.status})`);
  }

  return response.json();
}

function formatBogotaDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});

  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
}

const gridIssueDetailFields = [
  ['key', 'Incidencia'],
  ['issuetype', 'Tipo'],
  ['summary', 'Resumen'],
  ['status', 'Estado'],
  ['reporter', 'Informador'],
  ['assignee', 'Responsable'],
  ['created', 'Creado'],
  ['updated', 'Actualizado'],
  ['resolutiondate', 'Finalizado'],
  ['parent', 'Incidencia padre'],
  ['timeestimate', 'Estimación'],
  ['timespent', 'Tiempo empleado'],
  ['timeremaining', 'Tiempo restante'],
  ['description', 'Descripción'],
];

function gridDescriptionText(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string') {
    if (value.trim() === '[object Object]') return '-';
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return gridDescriptionText(parsed);
    } catch {
      return value;
    }
    return value;
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (Array.isArray(value.content)) return value.content.map(gridDescriptionText).filter((item) => item !== '-').join(' ');
    return Object.values(value).map(gridDescriptionText).filter((item) => item !== '-').join(' ');
  }
  return String(value);
}

function formatGridIssueDetailValue(field, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (['created', 'updated', 'resolutiondate'].includes(field)) return formatBogotaDate(value);
  if (['reporter', 'assignee'].includes(field)) return compactPersonName(value);
  if (field === 'description') return gridDescriptionText(value);
  if (typeof value === 'object') return gridDescriptionText(value);
  return String(value);
}

function hasGridIssueDetailValue(field, value) {
  const formatted = formatGridIssueDetailValue(field, value);
  return formatted !== '-' && formatted.trim() !== '';
}

function isNegativeGridTimeRemaining(field, value) {
  return field === 'timeremaining' && Number.isFinite(Number(value)) && Number(value) < 0;
}

function formatCountdown(nextSyncAt, now = Date.now()) {
  if (!nextSyncAt) {
    return '-';
  }

  const remainingSeconds = Math.max(0, Math.ceil((new Date(nextSyncAt).getTime() - now) / 1000));
  const days = Math.floor(remainingSeconds / 86400);
  const hours = Math.floor((remainingSeconds % 86400) / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const parts = [];

  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(' ');
}

function compactPersonName(value) {
  const words = String(value ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length <= 2) return words.join(' ');

  const logicalWords = [];
  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    const normalized = current.toLocaleLowerCase('es-CO');
    if (normalized === 'del' && words[index + 1]) {
      logicalWords.push(`${current} ${words[index + 1]}`);
      index += 1;
    } else if (normalized === 'de' && ['la', 'las', 'los'].includes(words[index + 1]?.toLocaleLowerCase('es-CO')) && words[index + 2]) {
      logicalWords.push(`${current} ${words[index + 1]} ${words[index + 2]}`);
      index += 2;
    } else {
      logicalWords.push(current);
    }
  }

  if (logicalWords.length === 3) return `${logicalWords[0]} ${logicalWords[1]}`;
  if (logicalWords.length >= 4) return `${logicalWords[0]} ${logicalWords[2]}`;
  return logicalWords.join(' ');
}

function compactGridPersonValues(value) {
  return String(value ?? '').split(' | ').map(compactPersonName).join(' | ');
}

function normalizeGridVisualValue(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es-CO');
}

function hashGridVisualValue(value) {
  let hash = 2166136261;
  for (const character of normalizeGridVisualValue(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function gridStateCategory(value) {
  const normalized = normalizeGridVisualValue(value);
  if (/en progreso|trabajando|en curso|desarrollo/.test(normalized)) return 'progress';
  if (/espera|pendiente|pausad|bloquead/.test(normalized)) return 'waiting';
  if (/cerrad|aceptad|resuelt|finalizad|completad|terminad/.test(normalized)) return 'closed';
  if (/produccion|productiv/.test(normalized)) return 'production';
  if (/cancelad|rechazad|fallid|error/.test(normalized)) return 'danger';
  if (/cread|nuev|abiert|por hacer|solicitad/.test(normalized)) return 'new';
  return 'other';
}

function createGridVisualRegistry() {
  return {
    colors: new Map(),
    initials: new Map(),
    usedColors: new Set(),
    usedInitials: new Set(),
  };
}

function allocateGridVisualColor(registry, registryKey, value, kind = 'state') {
  const existing = registry.colors.get(registryKey);
  if (existing) return existing;

  const category = kind === 'state' ? gridStateCategory(value) : 'person';
  const categoryHue = {
    progress: 142,
    waiting: 34,
    closed: 0,
    production: 181,
    danger: 336,
    new: 270,
  }[category];
  const hash = hashGridVisualValue(registryKey);
  const familyOffset = categoryHue === undefined ? hash % 360 : (hash % 9) - 4;
  const baseHue = categoryHue === undefined ? familyOffset : categoryHue + familyOffset;
  const saturation = kind === 'person' ? 91 : 94;
  const lightness = kind === 'person' ? 68 : category === 'closed' ? 70 : 64;
  let attempt = 0;
  let hue;
  let colorKey;

  do {
    hue = ((baseHue + (attempt * 11)) % 360 + 360) % 360;
    colorKey = `${hue}-${saturation}-${lightness}`;
    attempt += 1;
  } while (registry.usedColors.has(colorKey));

  const visual = {
    color: `hsl(${hue} ${saturation}% ${lightness}%)`,
    glow: `hsl(${hue} ${saturation}% ${lightness}% / .28)`,
    avatar: `hsl(${hue} 78% 46%)`,
  };
  registry.usedColors.add(colorKey);
  registry.colors.set(registryKey, visual);
  return visual;
}

function gridPersonInitialCandidates(value) {
  const particles = new Set(['de', 'del', 'la', 'las', 'los']);
  const words = String(value ?? '').trim().split(/\s+/).filter((word) => word && !particles.has(normalizeGridVisualValue(word)));
  if (words.length === 0) return ['?'];

  const initial = (word, characterIndex = 0) => normalizeGridVisualValue(word)[characterIndex]?.toLocaleUpperCase('es-CO') ?? '';
  const surnameIndex = words.length >= 4 ? 2 : Math.min(1, words.length - 1);
  const preferredPairs = [
    [0, surnameIndex],
    [0, words.length - 1],
    [0, 1],
    [1, surnameIndex],
    [1, words.length - 1],
  ];
  const candidates = preferredPairs.map(([left, right]) => `${initial(words[left])}${initial(words[right])}`);

  for (let left = 0; left < words.length; left += 1) {
    for (let right = 0; right < words.length; right += 1) {
      candidates.push(`${initial(words[left])}${initial(words[right])}`);
    }
  }
  for (const word of words) {
    for (let characterIndex = 1; characterIndex < normalizeGridVisualValue(word).length; characterIndex += 1) {
      candidates.push(`${initial(words[0])}${initial(word, characterIndex)}`);
    }
  }

  return [...new Set(candidates.filter((candidate) => candidate.length >= 2))];
}

function allocateGridPersonInitials(registry, value) {
  const registryKey = `person:${normalizeGridVisualValue(value)}`;
  const existing = registry.initials.get(registryKey);
  if (existing) return existing;

  const candidates = gridPersonInitialCandidates(value);
  const selected = candidates.find((candidate) => !registry.usedInitials.has(candidate))
    ?? `${candidates[0] ?? '?'}${registry.usedInitials.size + 1}`;
  registry.usedInitials.add(selected);
  registry.initials.set(registryKey, selected);
  return selected;
}

function registerGridVisualValues(registry, rows, columns) {
  const stateValues = new Map();
  const people = new Map();
  const addValues = (target, value) => String(value ?? '').split(' | ').forEach((item) => {
    const normalized = normalizeGridVisualValue(item);
    if (normalized) target.set(normalized, item.trim());
  });

  rows.forEach((row) => {
    addValues(stateValues, row.estadoGeneral);
    columns.forEach((column) => {
      const value = row[`${column.issueType}::${column.field}`];
      if (column.field === 'status') addValues(stateValues, value);
      if (['assignee', 'reporter'].includes(column.field)) addValues(people, value);
    });
  });

  [...stateValues.entries()].sort(([left], [right]) => left.localeCompare(right, 'es')).forEach(([normalized, value]) => {
    allocateGridVisualColor(registry, `value:${normalized}`, value, 'state');
  });
  [...people.entries()].sort(([left], [right]) => left.localeCompare(right, 'es')).forEach(([normalized, value]) => {
    allocateGridVisualColor(registry, `person:${normalized}`, value, 'person');
    allocateGridPersonInitials(registry, value);
  });
}

function gridVisualStyle(visual) {
  return {
    '--grid-accent': visual.color,
    '--grid-accent-glow': visual.glow,
    '--grid-avatar': visual.avatar,
  };
}

function GridStateText({ value, registry, prominent = false }) {
  const values = String(value ?? '').split(' | ').map((item) => item.trim()).filter(Boolean);
  if (values.length === 0) return null;

  const renderStateValue = (item) => {
    if (!prominent) return item;
    const words = item.split(/\s+/).filter(Boolean);
    if (words.length < 3) return item;
    const splitAt = Math.ceil(words.length / 2);
    return <>{words.slice(0, splitAt).join(' ')}<br />{words.slice(splitAt).join(' ')}</>;
  };

  return (
    <span className={`grid-semantic-values${prominent ? ' is-prominent' : ''}`} title={String(value)}>
      {values.map((item, index) => {
        const normalized = normalizeGridVisualValue(item);
        const visual = allocateGridVisualColor(registry, `value:${normalized}`, item, 'state');
        return (
          <span className="grid-semantic-value-wrap" key={normalized}>
            {index > 0 ? <span className="grid-semantic-separator">·</span> : null}
            <span className="grid-state-marker" style={{ background: visual.color }} aria-hidden="true" />
            <span className="grid-semantic-value" style={gridVisualStyle(visual)}>{renderStateValue(item)}</span>
          </span>
        );
      })}
    </span>
  );
}

function GridPersonText({ value, registry }) {
  const people = String(value ?? '').split(' | ').map((item) => item.trim()).filter(Boolean);
  if (people.length === 0) return null;
  return (
    <span className="grid-person-values">
      {people.map((person) => {
        const normalized = normalizeGridVisualValue(person);
        const visual = allocateGridVisualColor(registry, `person:${normalized}`, person, 'person');
        const initials = allocateGridPersonInitials(registry, person);
        return (
          <span className="grid-person-value" style={gridVisualStyle(visual)} title={person} aria-label={person} key={normalized}>
            <span className="grid-person-avatar" aria-hidden="true">{initials}</span>
            <span className="grid-person-name">{compactPersonName(person)}</span>
          </span>
        );
      })}
    </span>
  );
}

function GridIssueTooltip({ issue }) {
  return (
    <span className="grid-issue-tooltip" role="tooltip">
      {gridIssueDetailFields.map(([field, label]) => {
        if (!hasGridIssueDetailValue(field, issue?.[field])) return null;
        const value = formatGridIssueDetailValue(field, issue?.[field]);
        return (
          <span className={`grid-issue-detail-row${field === 'description' ? ' is-description' : ''}`} key={field}>
            <b>{label}</b>
            <span className={isNegativeGridTimeRemaining(field, issue?.[field]) ? 'is-negative-time' : ''}>{value}</span>
          </span>
        );
      })}
    </span>
  );
}

function GridIssueText({ value, issueDetails = {}, jiraBaseUrl = '' }) {
  const issueKeys = String(value ?? '').split(' | ').map((item) => item.trim()).filter(Boolean);
  if (issueKeys.length === 0) return null;
  const [openKey, setOpenKey] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const hideTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(hideTimerRef.current), []);

  const showTooltip = (event, key) => {
    clearTimeout(hideTimerRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    const width = Math.min(430, Math.max(240, window.innerWidth - 24));
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const placement = spaceBelow >= 260 || spaceBelow >= spaceAbove ? 'below' : 'above';
    const maxHeight = Math.max(180, Math.min(560, placement === 'below' ? spaceBelow : spaceAbove));
    setOpenKey(key);
    setTooltipPosition({ left, top: placement === 'below' ? rect.bottom + 8 : rect.top - 8, placement, maxHeight });
  };

  const hideTooltip = () => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setOpenKey(null);
      setTooltipPosition(null);
    }, 250);
  };

  const keepTooltip = () => clearTimeout(hideTimerRef.current);
  const baseUrl = String(jiraBaseUrl ?? '').replace(/\/+$/, '');

  return (
    <span className="grid-issue-values">
      {issueKeys.map((key, index) => {
        const issue = issueDetails[key] ?? { key };
        const href = baseUrl ? `${baseUrl}/browse/${encodeURIComponent(key)}` : null;
        return (
          <span className="grid-issue-value" key={key}>
            {index > 0 ? <span className="grid-issue-separator">Â·</span> : null}
            <a
              href={href ?? '#'}
              target={href ? '_blank' : undefined}
              rel={href ? 'noreferrer' : undefined}
              onClick={(event) => { if (!href) event.preventDefault(); }}
              onPointerEnter={(event) => showTooltip(event, key)}
              onPointerLeave={hideTooltip}
              onFocus={(event) => showTooltip(event, key)}
              onBlur={hideTooltip}
            >
              {key}
            </a>
            {openKey === key && tooltipPosition ? (
              <span
                className="grid-issue-tooltip-shell"
                data-placement={tooltipPosition.placement}
                style={{ left: tooltipPosition.left, top: tooltipPosition.top, maxHeight: tooltipPosition.maxHeight }}
                onPointerEnter={keepTooltip}
                onPointerLeave={hideTooltip}
              >
                <GridIssueTooltip issue={issue} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

function formatAlertRetryCountdown(alert, now = Date.now()) {
  const retryMinutes = Number(alert?.retry_minutes ?? 0);
  if (!alert?.last_notified_at || retryMinutes <= 0) {
    return null;
  }

  const storedRetryAt = new Date(alert.next_retry_at ?? '').getTime();
  const retryDueAt = Number.isFinite(storedRetryAt)
    ? storedRetryAt
    : new Date(alert.last_notified_at).getTime() + retryMinutes * 60000;
  return formatCountdown(new Date(retryDueAt).toISOString(), now);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backendAssetUrl(value) {
  if (!value) return null;
  return new URL(value, 'http://127.0.0.1:3000').href;
}

const jiraIssueKeyPattern = /^\b[A-Z][A-Z0-9_]*-\d+\b$/;

function renderAlertMessage(message, jiraBaseUrl) {
  const text = String(message ?? 'Nueva alerta de Jira');
  const baseUrl = String(jiraBaseUrl ?? '').replace(/\/+$/, '');
  if (!baseUrl) return text;

  return text.split(/(\b[A-Z][A-Z0-9_]*-\d+\b)/g).map((part, index) => (
    jiraIssueKeyPattern.test(part) ? (
      <a
        className="alert-issue-link"
        href={`${baseUrl}/browse/${encodeURIComponent(part)}`}
        target="_blank"
        rel="noreferrer"
        title={`Abrir ${part} en Jira`}
        key={`${part}-${index}`}
      >
        {part}
      </a>
    ) : <span key={`text-${index}`}>{part}</span>
  ));
}

function LineIcon({ name }) {
  const paths = {
    sync: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M6.6 9a7 7 0 0 1 11.7-2L20 8.5" /><path d="M17.4 15a7 7 0 0 1-11.7 2L4 15.5" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4L3 10" /><path d="M3 5v5h5" /><path d="M4 13a8 8 0 0 0 14.8 4L21 14" /></>,
    search: <><circle cx="10.5" cy="10.5" r="5.5" /><path d="m15 15 4 4" /></>,
    bell: <><path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 22h4" /></>,
    settings: <><path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65-2-3.46-2.49 1a7.7 7.7 0 0 0-1.69-.98L15 3h-4l-.37 2.93c-.61.25-1.18.58-1.69.98l-2.49-1-2 3.46 2.11 1.65c-.04.32-.08.65-.08.98s.03.66.08.98l-2.11 1.65 2 3.46 2.49-1c.51.4 1.08.73 1.69.98L11 21h4l.37-2.93c.61-.25 1.18-.58 1.69-.98l2.49 1 2-3.46-2.12-1.65Z" /><circle cx="12" cy="12" r="3.2" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    database: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" /></>,
    power: <><path d="M12 3v9" /><path d="M7.1 6.6a8 8 0 1 0 9.8 0" /></>,
    pulse: <path d="M3 12h4l2-5 4 10 2-5h6" />,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></>,
    shield: <path d="m12 3 7 3v5c0 4.5-3 7.5-7 10-4-2.5-7-5.5-7-10V6l7-3Z" />,
    calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
    flag: <><path d="M5 22V4" /><path d="M5 5c4-3 6 3 11 0v9c-5 3-7-3-11 0" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m7 7 1 14h8l1-14" /><path d="M10 11v6M14 11v6" /></>,
    save: <><path d="M5 3h12l2 2v16H5z" /><path d="M8 3v6h8V3M8 21v-7h8v7" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chevron: <path d="m7 9 5 5 5-5" />,
    arrowLeft: <><path d="m15 18-6-6 6-6" /><path d="M9 12h10" /></>,
    arrowRight: <><path d="m9 18 6-6-6-6" /><path d="M5 12h10" /></>,
    upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 14v6h14v-6" /></>,
  };
  return <svg className="line-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.pulse}</svg>;
}

function AutoResizeTextarea({ value, onChange, ...props }) {
  const textareaRef = useRef(null);

  const resizeTextarea = (element = textareaRef.current) => {
    if (!element) return;
    element.style.height = 'auto';
    const minimumHeight = Number.parseFloat(window.getComputedStyle(element).minHeight) || 0;
    element.style.height = `${Math.max(element.scrollHeight, minimumHeight)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [value]);

  useEffect(() => {
    const element = textareaRef.current;
    const container = element?.parentElement;
    if (!element || !container || typeof ResizeObserver === 'undefined') return undefined;

    let previousWidth = container.clientWidth;
    const observer = new ResizeObserver(() => {
      const nextWidth = container.clientWidth;
      if (nextWidth === previousWidth) return;
      previousWidth = nextWidth;
      resizeTextarea(element);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      rows={2}
      value={value}
      onChange={(event) => {
        resizeTextarea(event.currentTarget);
        onChange(event);
      }}
    />
  );
}

const alertFieldLabels = {
  key: 'Incidencia',
  project: 'Proyecto',
  issuetype: 'Tipo',
  summary: 'Resumen',
  description: 'Descripcion',
  status: 'Estado',
  reporter: 'Informador',
  assignee: 'Responsable',
  created: 'Fecha de creacion',
  updated: 'Fecha de actualizacion',
  resolutiondate: 'Fecha de resolucion',
  parent: 'Incidencia padre',
  timeestimate: 'Estimacion',
  timespent: 'Tiempo empleado',
  timeremaining: 'Tiempo restante',
};

const gridSubtaskFields = [
  { field: 'closedSubtasks', label: 'Subtareas cerradas' },
  { field: 'openSubtasks', label: 'Subtareas abiertas' },
];

const gridSubtaskIssueTypes = new Set([
  'Solicitud Paso a Producción',
  'Solicitud Paso a Pre-Producción',
]);

const alertOperators = {
  '=': 'es igual',
  '<>': 'distinto de',
  LIKE: 'contiene',
};

const alertMessageFields = {
  key: 'Incidencia',
  summary: 'Resumen',
  issuetype: 'Tipo',
  status: 'Estado',
  assignee: 'Responsable',
  reporter: 'Informador',
  project: 'Proyecto',
  created: 'Fecha de creación',
  updated: 'Fecha de actualización',
  parent: 'Incidencia padre',
  timeestimate: 'Estimación',
  timespent: 'Tiempo empleado',
  resolutiondate: 'Fecha de resolucion',
  timeremaining: 'Tiempo restante',
};

function sqlText(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function normalizedSqlTextExpression(expression) {
  return `lower(strip_accents(COALESCE(${expression}, '')))`;
}

function normalizedSqlValue(value) {
  return `lower(strip_accents(${sqlText(value)}))`;
}

function normalizeDateConditionValue(value) {
  const text = String(value ?? '').trim();
  const colombian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!colombian) return text;
  const [, day, month, year, hour = '00', minute = '00', second = '00'] = colombian;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
}

function formatDateDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 12);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  let result = parts.filter(Boolean).join('/');
  if (digits.length > 8) result += ` ${digits.slice(8, 10)}`;
  if (digits.length > 10) result += `:${digits.slice(10, 12)}`;
  return result;
}

function formatDateForInput(value) {
  const text = String(value ?? '').trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(text)) return formatDateDigits(text);
  if (!/^\d{4}-\d{2}-\d{2}/.test(text)) return formatDateDigits(text);
  const date = new Date(text);
  if (!text || Number.isNaN(date.getTime())) return formatDateDigits(text);
  const parts = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

function formatDateMask(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 12);
  let digitIndex = 0;
  return 'dd/mm/aaaa HH:mm'.split('').map((character) => {
    if (!'dmaH'.includes(character)) return character;
    const replacement = digits[digitIndex];
    digitIndex += 1;
    return replacement ?? character;
  }).join('');
}

function ClampedGridText({ children, tooltipText, className = '' }) {
  const contentRef = useRef(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) return undefined;

    const updateTruncation = () => {
      setTruncated(element.scrollHeight > element.clientHeight + 1
        || element.scrollWidth > element.clientWidth + 1);
    };
    updateTruncation();
    const observer = new ResizeObserver(updateTruncation);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tooltipText]);

  return (
    <div
      className={`grid-clamped-text ${className}`.trim()}
      ref={contentRef}
      title={truncated ? tooltipText : undefined}
    >
      {children}
    </div>
  );
}

function SubtaskCountEntry({ entry, isOpen }) {
  const [tooltipPosition, setTooltipPosition] = useState(null);
  const isHoveringRef = useRef(false);
  const hideTooltipTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(hideTooltipTimerRef.current), []);

  const showTooltip = (event) => {
    clearTimeout(hideTooltipTimerRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportPadding = 12;
    const spaceAbove = Math.max(0, rect.top - viewportPadding);
    const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding);
    const estimatedHeight = Math.min(720, 56 + entry.subtasks.length * 112);
    const placement = spaceBelow >= estimatedHeight || spaceBelow > spaceAbove ? 'below' : 'above';
    const availableHeight = placement === 'below' ? spaceBelow : spaceAbove;
    setTooltipPosition({
      left: Math.max(170, Math.min(rect.left + rect.width / 2, window.innerWidth - 170)),
      top: placement === 'below' ? rect.bottom + 4 : rect.top - 4,
      placement,
      maxHeight: Math.max(120, availableHeight),
    });
  };

  const keepTooltipVisible = (event) => {
    isHoveringRef.current = true;
    showTooltip(event);
  };

  const hideTooltipWhenPointerLeaves = () => {
    isHoveringRef.current = false;
    clearTimeout(hideTooltipTimerRef.current);
    hideTooltipTimerRef.current = setTimeout(() => {
      if (!isHoveringRef.current) {
        setTooltipPosition(null);
      }
    }, 500);
  };

  const keepTooltipOpen = () => {
    isHoveringRef.current = true;
    clearTimeout(hideTooltipTimerRef.current);
  };

  if (entry.count === 0) {
    return <span className="subtask-count-zero">0</span>;
  }

  return (
    <div className="subtask-count-entry" onPointerLeave={hideTooltipWhenPointerLeaves}>
      <span
        className="subtask-count-trigger"
        tabIndex="0"
        aria-label={`${entry.count} subtareas. Mostrar detalle.`}
        onPointerEnter={keepTooltipVisible}
        onFocus={showTooltip}
        onBlur={hideTooltipWhenPointerLeaves}
      >
        <span className={`subtask-count-number${isOpen ? ' subtask-count-number-open' : ''}`}>{entry.count}</span>
      </span>
      {tooltipPosition ? (
        <span
          className="subtask-count-card"
          role="tooltip"
          data-placement={tooltipPosition.placement}
          style={{
            left: tooltipPosition.left,
            top: tooltipPosition.top,
            maxHeight: tooltipPosition.maxHeight,
          }}
          onPointerEnter={keepTooltipOpen}
          onPointerLeave={hideTooltipWhenPointerLeaves}
        >
          <strong>{entry.count === 1 ? '1 subtarea' : `${entry.count} subtareas`}</strong>
          {entry.subtasks.length === 0 ? <span>No hay subtareas en esta categoría.</span> : entry.subtasks.map((subtask) => (
            <span className="subtask-count-card-row" key={subtask.key}>
              <b>{subtask.key}</b>
              <span>{subtask.summary || 'Sin resumen'}</span>
              <span>Tipo: {subtask.issuetype || 'Sin tipo'}</span>
              <span>{subtask.assignee ? `Responsable: ${compactPersonName(subtask.assignee)}` : 'Sin responsable'}</span>
              <span>Creada: {formatBogotaDate(subtask.created)}</span>
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

function SubtaskCountValue({ entries = [], isOpen = false }) {
  if (entries.length === 0) return '-';
  return <div className="subtask-count-list">{entries.map((entry) => <SubtaskCountEntry entry={entry} isOpen={isOpen} key={entry.parentKey} />)}</div>;
}

function getGridColumnMetrics(groupKey, columns) {
  const fields = columns.map((column) => column.field);
  const hasLongText = fields.some((field) => ['summary', 'description'].includes(field));
  const isCompact = groupKey.startsWith('__other::')
    || fields.every((field) => ['key', 'status', 'timeestimate', 'timespent', 'timeremaining'].includes(field));
  return {
    minimum: hasLongText ? 250 : isCompact ? 150 : fields.length >= 4 ? 220 : 180,
    weight: hasLongText ? 1.8 : isCompact ? 0.75 : 1 + Math.max(0, fields.length - 1) * 0.18,
  };
}

function calculateGridColumnWidths(columnGroups, availableWidth) {
  const groups = [...columnGroups.entries()];
  if (groups.length === 0) return [];
  const metrics = groups.map(([groupKey, columns]) => getGridColumnMetrics(groupKey, columns));
  const minimumWidth = metrics.reduce((total, metric) => total + metric.minimum, 0);
  const distributableWidth = Math.max(0, availableWidth - minimumWidth);
  const totalWeight = metrics.reduce((total, metric) => total + metric.weight, 0);
  return metrics.map((metric) => Math.round(
    metric.minimum + distributableWidth * (metric.weight / totalWeight),
  ));
}

function buildAlertSql(alertForm) {
  const eventExpression = `c.change_type = ${sqlText(alertForm.event)}`;
  const conditionExpressions = [];
  const numericFields = new Set(['timeestimate', 'timespent', 'timeremaining']);
  const datetimeFields = new Set(['created', 'updated', 'resolutiondate']);
  alertForm.conditions
    .filter((condition) => condition.value.trim() || ['IS NULL', 'IS NOT NULL'].includes(condition.operator))
    .forEach((condition, index) => {
      const rawField = `COALESCE(json_extract_string(c.after_json, '$.${condition.field}'), json_extract_string(c.before_json, '$.${condition.field}'))`;
      const field = numericFields.has(condition.field)
        ? `TRY_CAST(${rawField} AS DOUBLE)`
        : datetimeFields.has(condition.field)
          ? `TRY_CAST(${rawField} AS TIMESTAMP)`
          : normalizedSqlTextExpression(rawField);
      const textField = normalizedSqlTextExpression(rawField);
      const normalizedValue = numericFields.has(condition.field)
        ? `TRY_CAST(${sqlText(condition.value.trim().replace(',', '.'))} AS DOUBLE)`
        : datetimeFields.has(condition.field)
          ? `TRY_CAST(${sqlText(normalizeDateConditionValue(condition.value))} AS TIMESTAMP)`
          : normalizedSqlValue(condition.value);
      const usesContains = condition.operator === 'LIKE'
        || (condition.field === 'assignee' && condition.operator === '=');
      const value = condition.operator === 'IS NULL'
        ? `COALESCE(${rawField}, '') = ''`
        : condition.operator === 'IS NOT NULL'
        ? `COALESCE(${rawField}, '') <> ''`
        : usesContains
        ? condition.field === 'assignee'
          ? condition.value.trim().split(/\s+/).map((token) => (
            `${textField} LIKE '%' || ${normalizedSqlValue(token)} || '%'`
          )).join(' AND ')
          : `${textField} LIKE '%' || ${normalizedValue} || '%'`
          : `${field} ${condition.operator} ${normalizedValue}`;
      const connector = index === 0 ? '' : (condition.connector || 'AND');
      conditionExpressions.push({ connector, value });
    });

  const expressions = [eventExpression];
  if (conditionExpressions.length > 0) {
    const groupedConditions = conditionExpressions.reduce((result, { connector, value }, index) => (
      index === 0 ? `(${value})` : `(${result} ${connector} (${value}))`
    ), '');
    expressions.push(groupedConditions);
  }

  return `SELECT issue_id, issue_key, project_group_id, change_type, changed_fields, after_json, before_json\nFROM SYNC_CHANGES c\nWHERE ${expressions.join('\n  AND ')}`;
}

function emptyAlertForm() {
  return {
    id: null,
    name: '',
    event: 'created',
    retryMinutes: 0,
    conditions: [],
    toastText: '',
    isActive: true,
  };
}

function parseStoredAlertRule(rule, fieldDefinitions = alertFieldLabels) {
  const allowedFields = new Set(Array.isArray(fieldDefinitions)
    ? fieldDefinitions.map((definition) => definition.field)
    : Object.keys(fieldDefinitions));

  try {
    const stored = JSON.parse(rule.condition_config ?? '');
    if (stored?.event && Array.isArray(stored.conditions)) {
      return {
        event: stored.event,
        conditions: stored.conditions.map((condition, index) => ({
          ...condition,
          connector: index === 0 ? undefined : (condition.connector || 'AND'),
        })),
      };
    }
  } catch {
    // Fall back to the SQL format generated by the visual builder.
  }

  const eventMatch = rule.sql?.match(/c\.change_type\s*=\s*'([^']+)'/i);
  const conditionMatches = [...(rule.sql ?? '').matchAll(
    /json_extract_string\(c\.(?:after|before)_json,\s*'\$\.([a-z]+)'\).*?\s(=|<>|ILIKE)\s*'([^']*)'/gi,
  )];
  const conditions = conditionMatches.map((match) => ({
    field: match[1],
    operator: match[2].toUpperCase() === 'ILIKE' ? 'LIKE' : match[2],
    value: match[3].replace(/^%|%$/g, ''),
  })).filter((condition) => allowedFields.has(condition.field)).map((condition, index) => ({
    ...condition,
    connector: index === 0 ? undefined : 'AND',
  }));

  return {
    event: eventMatch?.[1] ?? 'created',
    conditions: conditions.length > 0 ? conditions : [{ field: 'issuetype', operator: '=', value: '' }],
  };
}

export default function App() {
  const [bootstrapContext, setBootstrapContext] = useState(null);
  const [loginState, setLoginState] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [manualSyncInProgress, setManualSyncInProgress] = useState(false);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [alertRules, setAlertRules] = useState([]);
  const [newAlertOpen, setNewAlertOpen] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);
  const [countdownNow, setCountdownNow] = useState(Date.now());
  const [graphIssueTypes, setGraphIssueTypes] = useState([]);
  const [alertFieldDefinitions, setAlertFieldDefinitions] = useState([]);
  const [alertOperatorDefinitions, setAlertOperatorDefinitions] = useState([]);
  const [jiraCatalog, setJiraCatalog] = useState({ projects: [], issueTypes: [], statuses: [] });
  const [alertForm, setAlertForm] = useState(emptyAlertForm);
  const [messageBuilderExpanded, setMessageBuilderExpanded] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertValidationShown, setAlertValidationShown] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [startupError, setStartupError] = useState(null);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [shutdownRequested, setShutdownRequested] = useState(false);
  const [servicesStopped, setServicesStopped] = useState(false);
  const [jqlQueries, setJqlQueries] = useState([]);
  const [jqlSaving, setJqlSaving] = useState(false);
  const [jqlMessage, setJqlMessage] = useState(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [alertRetryEnabled, setAlertRetryEnabled] = useState(true);
  const [alertRetrySaving, setAlertRetrySaving] = useState(false);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(5);
  const [databaseResetting, setDatabaseResetting] = useState(false);
  const [sqlQueries, setSqlQueries] = useState(['SELECT key, issuetype, status FROM JIRA_ISSUES LIMIT 20']);
  const [selectedSqlIndex, setSelectedSqlIndex] = useState(0);
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlExecuting, setSqlExecuting] = useState(false);
  const [sessionToast, setSessionToast] = useState(null);
  const [sessionToastType, setSessionToastType] = useState('warning');
  const [alertToast, setAlertToast] = useState(null);
  const [headerAlertsOpen, setHeaderAlertsOpen] = useState(false);
  const headerAlertsRef = useRef(null);
  const alertToastInputRef = useRef(null);
  const [messageIssueType, setMessageIssueType] = useState('');
  const [messageField, setMessageField] = useState('key');
  const [alertImageData, setAlertImageData] = useState(null);
  const [alertImageName, setAlertImageName] = useState('');
  const [alertImageUrl, setAlertImageUrl] = useState(null);
  const [alertImageRemoved, setAlertImageRemoved] = useState(false);
  const [uiToast, setUiToast] = useState(null);
  const hideToastTimerRef = useRef(null);
  const uiToastTimerRef = useRef(null);
  const lastSessionNotificationAtRef = useRef(0);
  const permissionRequestStartedRef = useRef(false);
  const sessionNotificationRef = useRef(null);
  const knownAlertNotifiedAtRef = useRef(new Map());
  const alertNotificationQueueRef = useRef([]);
  const queuedAlertIdsRef = useRef(new Set());
  const alertNotificationProcessingRef = useRef(false);
  const alertNotificationTimerRef = useRef(null);
  const alertRetryEnabledRef = useRef(true);
  const alertsInitializedRef = useRef(false);
  const servicesStoppedRef = useRef(false);
  const jqlInitializedRef = useRef(false);
  const jqlDirtyRef = useRef(false);
  const syncIntervalDirtyRef = useRef(false);
  const autoSyncDirtyRef = useRef(false);
  const alertRetryDirtyRef = useRef(false);

  useEffect(() => {
    if (!headerAlertsOpen) return undefined;

    const closeHeaderAlerts = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type !== 'keydown' && headerAlertsRef.current?.contains(event.target)) return;
      setHeaderAlertsOpen(false);
    };

    document.addEventListener('pointerdown', closeHeaderAlerts);
    document.addEventListener('keydown', closeHeaderAlerts);
    return () => {
      document.removeEventListener('pointerdown', closeHeaderAlerts);
      document.removeEventListener('keydown', closeHeaderAlerts);
    };
  }, [headerAlertsOpen]);
  const [activeTab, setActiveTab] = useState('config');
  const [configSection, setConfigSection] = useState('status');
  const [grids, setGrids] = useState([]);
  const [gridFormOpen, setGridFormOpen] = useState(false);
  const [expandedGridId, setExpandedGridId] = useState(null);
  const [gridForm, setGridForm] = useState({
    id: null,
    name: '',
    pageSize: 10,
    visible: true,
    columns: [{ issueType: '', field: '' }],
    conditions: [],
  });
  const [gridData, setGridData] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [gridPage, setGridPage] = useState(1);
  const [gridSort, setGridSort] = useState(null);
  const [gridVisiblePageSize, setGridVisiblePageSize] = useState(10);
  const gridTableWrapRef = useRef(null);
  const gridPaginationRef = useRef(null);
  const gridVisualRegistryRef = useRef(createGridVisualRegistry());
  const [gridTableAvailableWidth, setGridTableAvailableWidth] = useState(0);
  const [draggedGridColumnIndex, setDraggedGridColumnIndex] = useState(null);
  const [gridValidationShown, setGridValidationShown] = useState(false);
  const [openGridAttributeGroup, setOpenGridAttributeGroup] = useState(null);
  const [draggedGridAttribute, setDraggedGridAttribute] = useState(null);

  const syncStatus = bootstrapContext?.syncStatus ?? null;
  const session = bootstrapContext?.session ?? null;
  const jiraBaseUrl = bootstrapContext?.jiraBaseUrl ?? '';
  const appState = bootstrapContext?.appState ?? 'booting';
  const sessionIsValid = Boolean(session?.ok);
  const sessionExpired = session?.ok === false;
  const syncResultLabel = sessionExpired
    ? 'Inicie sesión en Jira'
    : (syncStatus?.last_status ?? 'Sincronizacion no iniciada');
  const syncInProgress = manualSyncInProgress || Boolean(syncStatus?.is_running) || appState === 'syncing';
  const syncCanceling = Boolean(syncStatus?.is_canceling);
  const configurationSections = [
    { id: 'status', label: 'Estado y sincronización', icon: 'sync', description: 'Supervisa el estado de la aplicación, la sincronización con Jira y la sesión activa.' },
    { id: 'jql', label: 'Consultas JQL', icon: 'search', description: 'Define las consultas que determinan las incidencias a sincronizar.' },
    { id: 'alerts', label: 'Alertas', icon: 'bell', description: 'Configura las condiciones y el contenido de las notificaciones.' },
    { id: 'grids', label: 'Grids', icon: 'grid', description: 'Crea y administra las pestañas de seguimiento por ProjectGroup.' },
    { id: 'sql', label: 'SQL temporal', icon: 'database', description: 'Consulta o ajusta temporalmente la base de datos local.' },
  ];
  const selectedConfigurationSection = configurationSections.find((section) => section.id === configSection)
    ?? configurationSections[0];
  const conditionFields = alertFieldDefinitions.length > 0
    ? alertFieldDefinitions
    : Object.entries(alertFieldLabels).map(([field, label]) => ({ field, label }));
  const conditionOperators = alertOperatorDefinitions.length > 0
    ? alertOperatorDefinitions
    : Object.entries(alertOperators).map(([value, label]) => ({ value, label }));
  const operatorsForField = (fieldName) => {
    const field = conditionFields.find((item) => item.field === fieldName);
    const allowed = field?.type === 'text'
      ? new Set(['=', '<>', 'LIKE', 'IS NULL', 'IS NOT NULL'])
      : new Set(['=', '<>', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL']);
    return conditionOperators.filter((operator) => allowed.has(operator.value));
  };
  const alertValidation = validateAlertConditionConfig({
    event: alertForm.event,
    conditions: alertForm.conditions,
  }, {
    fields: conditionFields,
    operators: conditionOperators,
  });

  const gridConditionFieldOptions = [
    { field: 'estadoGeneral', label: 'Estado General', projectGroup: true },
    ...conditionFields.map((field) => ({ field: field.field, label: field.label })),
  ];
  const gridFieldOptions = [
    ...gridConditionFieldOptions,
    ...gridSubtaskFields,
  ];

  const gridFieldLabel = (field) => gridFieldOptions.find((item) => item.field === field)?.label ?? field;
  const gridIssueTypes = graphIssueTypes.length > 0 ? graphIssueTypes : (jiraCatalog.issueTypes ?? []).map((item) => item.name ?? item);
  const gridColumnGroupKey = (column) => column.field === 'estadoGeneral' ? '__other' : (column.issueType || '__empty');
  const gridColumnGroups = [...gridForm.columns.reduce((groups, column) => {
    const key = gridColumnGroupKey(column);
    const current = groups.get(key) ?? [];
    current.push(column);
    groups.set(key, current);
    return groups;
  }, new Map()).entries()];

  const updateGridGroupType = (groupKey, type) => {
    setGridForm((current) => {
      const columns = current.columns.map((column) => {
        if (gridColumnGroupKey(column) !== groupKey) return column;
        if (type === '__projectGroup') return { ...column, issueType: null, field: 'estadoGeneral' };
        return { ...column, issueType: type, field: type ? (column.field === 'estadoGeneral' ? '' : column.field) : '' };
      });
      return { ...current, columns };
    });
    setOpenGridAttributeGroup(null);
  };

  const toggleGridGroupAttribute = (groupKey, field) => {
    setGridForm((current) => {
      const groupColumns = current.columns.filter((column) => gridColumnGroupKey(column) === groupKey);
      const selected = groupColumns.some((column) => column.field === field);
      if (selected) {
        const remaining = current.columns.filter((column) => gridColumnGroupKey(column) !== groupKey || column.field !== field);
        const groupStillExists = remaining.some((column) => gridColumnGroupKey(column) === groupKey);
        if (!groupStillExists && groupColumns[0]) {
          const placeholder = groupKey === '__other'
            ? { issueType: null, field: 'estadoGeneral' }
            : { issueType: groupColumns[0].issueType ?? '', field: '' };
          remaining.push(placeholder);
        }
        return { ...current, columns: remaining };
      }
      const base = groupColumns[0] ?? { issueType: groupKey === '__other' ? null : groupKey, field: '' };
      const withoutPlaceholder = current.columns.filter((column) => !(gridColumnGroupKey(column) === groupKey && !column.field));
      return { ...current, columns: [...withoutPlaceholder, { ...base, field }] };
    });
  };

  const reorderGridGroupAttribute = (groupKey, fromField, toField) => {
    if (fromField === toField) return;
    setGridForm((current) => {
      const groupColumns = current.columns.filter((column) => gridColumnGroupKey(column) === groupKey);
      const fromIndex = groupColumns.findIndex((column) => column.field === fromField);
      const toIndex = groupColumns.findIndex((column) => column.field === toField);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [moved] = groupColumns.splice(fromIndex, 1);
      groupColumns.splice(toIndex, 0, moved);
      const firstIndex = current.columns.findIndex((column) => gridColumnGroupKey(column) === groupKey);
      const columnsWithoutGroup = current.columns.filter((column) => gridColumnGroupKey(column) !== groupKey);
      const insertIndex = current.columns.slice(0, firstIndex)
        .filter((column) => gridColumnGroupKey(column) !== groupKey).length;
      return {
        ...current,
        columns: [
          ...columnsWithoutGroup.slice(0, insertIndex),
          ...groupColumns,
          ...columnsWithoutGroup.slice(insertIndex),
        ],
      };
    });
  };

  const gridConditionCatalogOptions = (field) => {
    const catalogKey = field === 'project' ? 'projects' : field === 'issuetype' ? 'issueTypes' : field === 'status' ? 'statuses' : null;
    if (!catalogKey) return [];
    return (jiraCatalog?.[catalogKey] ?? []).map((item) => typeof item === 'string' ? { value: item, label: item } : item);
  };
  const gridValidationErrors = [
    !gridForm.name.trim() ? 'Debes indicar un nombre para la pestaña.' : null,
    gridForm.columns.length === 0 ? 'Debes agregar al menos un campo para mostrar.' : null,
    ...gridForm.columns.flatMap((column, index) => {
      const errors = [];
      if (!column.issueType && column.field !== 'estadoGeneral') errors.push(`Campo ${index + 1}: debes seleccionar un tipo de incidencia.`);
      if (!column.field) errors.push(`Campo ${index + 1}: debes seleccionar un atributo.`);
      return errors;
    }),
    ...gridForm.conditions.flatMap((condition, index) => {
      const errors = [];
      if (!condition.issueType && condition.field !== 'estadoGeneral') errors.push(`Condicion ${index + 1}: debes seleccionar un tipo de incidencia.`);
      if (!condition.field) errors.push(`Condicion ${index + 1}: debes seleccionar un atributo.`);
      if (!condition.operator) errors.push(`Condicion ${index + 1}: debes seleccionar un operador.`);
      if (!['IS NULL', 'IS NOT NULL'].includes(condition.operator) && !String(condition.value ?? '').trim()) errors.push(`Condicion ${index + 1}: debes indicar un valor.`);
      return errors;
    }),
    !Number.isInteger(Number(gridForm.pageSize)) || Number(gridForm.pageSize) < 1 || Number(gridForm.pageSize) > 200
      ? 'Los registros por pagina deben estar entre 1 y 200.' : null,
  ].filter(Boolean);
  const gridConditionValidationErrors = gridValidationErrors.filter((error) => error.startsWith('Condicion '));

  const refreshGrids = async () => {
    const result = await api('/api/grids');
    setGrids(result.grids ?? []);
    return result.grids ?? [];
  };

  const refreshGridData = async (id = activeTab, page = gridPage, pageSize = gridVisiblePageSize, sort = gridSort) => {
    if (!id || id === 'config') return;
    setGridLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (sort?.field) {
        query.set('sortField', sort.field);
        query.set('sortIssueType', sort.issueType ?? '');
        query.set('sortDirection', sort.direction);
      }
      const result = await api(`/api/grids/${encodeURIComponent(id)}/data?${query.toString()}`);
      setGridData(result);
    } catch (error) {
      showUiToast(`No se pudo cargar el grid: ${error.message}`, 'error');
    } finally {
      setGridLoading(false);
    }
  };

  const handleRefreshAll = async () => {
    if (refreshingAll) return;
    setRefreshingAll(true);
    try {
      await Promise.all([
        refreshBootstrapContext(),
        refreshAlerts(),
        refreshAlertRules(),
        refreshGrids(),
      ]);
      if (activeTab !== 'config') {
        await refreshGridData(activeTab, gridPage, gridVisiblePageSize, gridSort);
      }
      showUiToast('Informacion actualizada correctamente.');
    } catch (error) {
      showUiToast(`No se pudo actualizar la informacion: ${error.message}`, 'error');
    } finally {
      setRefreshingAll(false);
    }
  };

  const resetGridForm = () => setGridForm({
    id: null,
    name: '',
    pageSize: 10,
    visible: true,
    columns: [{ issueType: '', field: '' }],
    conditions: [],
  });

  const handleNewGrid = () => {
    resetGridForm();
    setGridValidationShown(false);
    setExpandedGridId(null);
    setGridFormOpen(true);
  };

  const handleEditGrid = (grid) => {
    setGridForm({ ...grid, columns: grid.columns ?? [], conditions: grid.conditions ?? [] });
    setGridValidationShown(false);
    setExpandedGridId(grid.id);
    setGridFormOpen(true);
  };

  const handleSaveGrid = async () => {
    setGridValidationShown(true);
    if (gridValidationErrors.length > 0) {
      showUiToast('Corrige los campos pendientes del grid.', 'error');
      return;
    }
    try {
      const result = await api('/api/grids', {
        method: 'PUT',
        body: JSON.stringify(gridForm),
      });
      setGrids(result.grids ?? []);
      setGridFormOpen(false);
      setExpandedGridId(null);
      const saved = (result.grids ?? []).find((grid) => grid.name === gridForm.name.trim());
      if (saved) setActiveTab(saved.visible === false ? 'config' : saved.id);
      showUiToast('Grid guardado correctamente.');
    } catch (error) {
      showUiToast(`No se pudo guardar el grid: ${error.message}`, 'error');
    }
  };

  const handleDeleteGrid = async (id) => {
    if (!window.confirm('El grid y su configuración serán eliminados. ¿Desea continuar?')) return;
    try {
      const result = await api('/api/grids', { method: 'DELETE', body: JSON.stringify({ id }) });
      setGrids(result.grids ?? []);
      if (activeTab === id) setActiveTab('config');
      if (gridForm.id === id) setGridFormOpen(false);
      if (expandedGridId === id) setExpandedGridId(null);
      showUiToast('Grid eliminado correctamente.');
    } catch (error) {
      showUiToast(`No se pudo eliminar el grid: ${error.message}`, 'error');
    }
  };

  const renderConditionValueControl = (condition, index) => {
    const definition = conditionFields.find((item) => item.field === condition.field);
    const catalogKey = condition.field === 'project'
      ? 'projects'
      : condition.field === 'issuetype' ? 'issueTypes' : 'statuses';
    const catalogOptions = (jiraCatalog?.[catalogKey] ?? []).map((item) => (
      typeof item === 'string' ? { value: item, label: item } : item
    ));
    const updateValue = (event) => setAlertForm((current) => ({
      ...current,
      conditions: current.conditions.map((item, itemIndex) => itemIndex === index
        ? {
          ...item,
          value: definition?.type === 'datetime'
            ? formatDateDigits(event.target.value)
            : event.target.value,
        }
        : item),
    }));

    if (['project', 'issuetype', 'status'].includes(condition.field) && catalogOptions.length > 0) {
      return (
        <select className="condition-value-combobox" value={condition.value} onChange={updateValue}>
          <option value="">Seleccione una opcion</option>
          {catalogOptions.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      );
    }

    if (definition?.type === 'datetime') {
      const displayValue = formatDateForInput(condition.value);
      return (
        <span className="date-mask-input">
          <span className="date-mask-guide" aria-hidden="true">{formatDateMask(displayValue)}</span>
          <input
            type="text"
            inputMode="numeric"
            maxLength="16"
            value={displayValue}
            onChange={updateValue}
            placeholder="dd/mm/aaaa HH:mm"
            aria-label="Fecha y hora en formato dd/mm/aaaa HH:mm"
          />
        </span>
      );
    }

    return (
      <input
        type={definition?.type === 'number' ? 'number' : 'text'}
        inputMode={definition?.type === 'datetime' ? 'numeric' : undefined}
        maxLength={definition?.type === 'datetime' ? 16 : undefined}
        step={definition?.type === 'number' ? 'any' : undefined}
        value={definition?.type === 'datetime' ? formatDateForInput(condition.value) : condition.value}
        onChange={updateValue}
        placeholder={definition?.type === 'datetime' ? 'dd/mm/aaaa HH:mm' : definition?.type === 'number' ? 'Valor en minutos' : 'Valor'}
      />
    );
  };

  const appStateLabel = {
    booting: 'Iniciando app',
    auth_required: 'Requiere inicio de sesion',
    ready: 'Listo',
    syncing: 'Sincronizando',
  }[appState] ?? appState;

  const clearToastTimer = () => {
    if (hideToastTimerRef.current) {
      clearTimeout(hideToastTimerRef.current);
      hideToastTimerRef.current = null;
    }
  };

  const showSessionToast = (message, autoHideMs = 0) => {
    clearToastTimer();
    setSessionToast(message);
    setSessionToastType(autoHideMs > 0 ? 'success' : 'warning');

    if (autoHideMs > 0) {
      hideToastTimerRef.current = setTimeout(() => {
        setSessionToast(null);
        hideToastTimerRef.current = null;
      }, autoHideMs);
    }
  };

  const showUiToast = (message, type = 'success') => {
    if (uiToastTimerRef.current) {
      clearTimeout(uiToastTimerRef.current);
    }
    setUiToast({ message, type });
    uiToastTimerRef.current = setTimeout(() => {
      setUiToast(null);
      uiToastTimerRef.current = null;
    }, 3500);
  };

  const closeSessionNotification = () => {
    if (sessionNotificationRef.current) {
      sessionNotificationRef.current.close();
      sessionNotificationRef.current = null;
    }
  };

  const showNativeNotification = (title, body, onClick, icon = null) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    const notification = new Notification(title, { body, ...(icon ? { icon } : {}) });
    notification.onclick = () => {
      notification.close();
      onClick?.();
    };
    return true;
  };

  const processAlertNotificationQueue = () => {
    if (alertNotificationProcessingRef.current) {
      return;
    }

    const alert = alertNotificationQueueRef.current.shift();
    if (!alert) {
      return;
    }

    alertNotificationProcessingRef.current = true;
    const message = alert.toast_message || alert.toast_text || alert.rule_name || 'Nueva alerta de Jira';
    setAlertToast({ id: alert.id, message });
    const imageUrl = alert.toast_image
      ? backendAssetUrl(alert.toast_image)
      : alert.issuetype_icon_url;
    showNativeNotification('Jira Notifications', message, () => handleReadAlert(alert.id), imageUrl);

    alertNotificationTimerRef.current = setTimeout(() => {
      queuedAlertIdsRef.current.delete(alert.id);
      alertNotificationProcessingRef.current = false;
      alertNotificationTimerRef.current = null;
      processAlertNotificationQueue();
    }, 2500);
  };

  const enqueueAlertNotifications = (alerts) => {
    for (const alert of alerts) {
      if (queuedAlertIdsRef.current.has(alert.id)) {
        continue;
      }

      queuedAlertIdsRef.current.add(alert.id);
      alertNotificationQueueRef.current.push(alert);
    }
    processAlertNotificationQueue();
  };

  const notifySessionRequired = (intervalSeconds = 300) => {
    const intervalMs = Math.max(Number(intervalSeconds) || 300, 1) * 1000;
    const now = Date.now();

    if (now - lastSessionNotificationAtRef.current < intervalMs) {
      return;
    }

    lastSessionNotificationAtRef.current = now;
    const fallback = () => showSessionToast('Se requiere inicio de sesion en Jira', 10000);

    if (!('Notification' in window)) {
      fallback();
      return;
    }

    if (Notification.permission === 'granted') {
      sessionNotificationRef.current = new Notification(
        'Jira Notifications',
        { body: 'Se requiere inicio de sesion en Jira' },
      );
      sessionNotificationRef.current.onclick = () => {
        window.focus();
        closeSessionNotification();
        handleLogin();
      };
      return;
    }

    if (Notification.permission === 'default' && !permissionRequestStartedRef.current) {
      permissionRequestStartedRef.current = true;
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          sessionNotificationRef.current = new Notification(
            'Jira Notifications',
            { body: 'Se requiere inicio de sesion en Jira' },
          );
          sessionNotificationRef.current.onclick = () => {
            window.focus();
            closeSessionNotification();
            handleLogin();
          };
        } else {
          fallback();
        }
      }).catch(fallback);
      return;
    }

    if (Notification.permission !== 'default') {
      fallback();
    }
  };

  const refreshBootstrapContext = async () => {
    const context = await api('/api/bootstrap-context');
    setBootstrapContext(context);
    if (Array.isArray(context?.jqlQueries) && (!jqlInitializedRef.current || !jqlDirtyRef.current)) {
      setJqlQueries(context.jqlQueries);
      jqlInitializedRef.current = true;
      jqlDirtyRef.current = false;
    }
    if (Array.isArray(context?.graphIssueTypes)) {
      setGraphIssueTypes(context.graphIssueTypes);
      setMessageIssueType((current) => current || context.graphIssueTypes[0] || '');
    }
    if (Array.isArray(context?.alertFields)) {
      setAlertFieldDefinitions(context.alertFields);
    }
    if (Array.isArray(context?.alertOperators)) {
      setAlertOperatorDefinitions(context.alertOperators);
    }
    if (context?.jiraCatalog && typeof context.jiraCatalog === 'object') {
      setJiraCatalog({
        projects: Array.isArray(context.jiraCatalog.projects) ? context.jiraCatalog.projects : [],
        issueTypes: Array.isArray(context.jiraCatalog.issueTypes) ? context.jiraCatalog.issueTypes : [],
        statuses: Array.isArray(context.jiraCatalog.statuses) ? context.jiraCatalog.statuses : [],
      });
    }
    if (!autoSyncDirtyRef.current && typeof context?.autoSyncEnabled === 'boolean') {
      setAutoSyncEnabled(context.autoSyncEnabled);
    }
    if (!alertRetryDirtyRef.current && typeof context?.alertRetryEnabled === 'boolean') {
      alertRetryEnabledRef.current = context.alertRetryEnabled;
      setAlertRetryEnabled(context.alertRetryEnabled);
    }
    if (!syncIntervalDirtyRef.current && Number.isFinite(Number(context?.syncIntervalMinutes))) {
      setSyncIntervalMinutes(Number(context.syncIntervalMinutes));
    }

    if (context?.session?.ok) {
      lastSessionNotificationAtRef.current = 0;
      closeSessionNotification();
      setSessionToast(null);
    } else {
      notifySessionRequired(context?.syncIntervalSeconds);
    }

    return context;
  };

  const refreshAlerts = async () => {
    const summary = await api('/api/alerts-summary');
    setAlertsSummary(summary);

    const unreadAlerts = Array.isArray(summary?.unreadAlerts) ? summary.unreadAlerts : [];
    const knownAlerts = knownAlertNotifiedAtRef.current;
    const alertsToShow = alertRetryEnabledRef.current && alertsInitializedRef.current
      ? unreadAlerts.filter((alert) => {
        const previous = knownAlerts.get(alert.id);
        if (!previous) {
          const retryMinutes = Number(alert?.retry_minutes ?? 0);
          if (!Number.isFinite(retryMinutes) || retryMinutes <= 0) {
            return true;
          }

          const retryAt = new Date(alert?.next_retry_at ?? '').getTime();
          return !Number.isFinite(retryAt) || Date.now() >= retryAt;
        }

        // A changed last_notified_at proves the backend sent a new retry.
        // next_retry_at already points to the following retry at this point.
        return Boolean(
          alert.last_notified_at
          && previous.lastNotifiedAt
          && new Date(alert.last_notified_at).getTime() > new Date(previous.lastNotifiedAt).getTime(),
        );
      })
      : [];
    enqueueAlertNotifications(alertsToShow);
    knownAlertNotifiedAtRef.current = new Map(
      unreadAlerts.map((alert) => [alert.id, {
        lastNotifiedAt: alert.last_notified_at ?? null,
        nextRetryAt: alert.next_retry_at ?? null,
      }]),
    );
    alertsInitializedRef.current = true;
    return summary;
  };

  const refreshAlertRules = async () => {
    const result = await api('/api/alert-rules');
    setAlertRules(result.rules ?? []);
    return result;
  };

  useEffect(() => {
    let mounted = true;
    let pollHandle = null;

    const initialize = async () => {
      setIsLoading(true);
      setStartupError(null);

      let lastError = null;
      let initialized = false;

      for (let attempt = 0; attempt < 30 && mounted; attempt += 1) {
        try {
          await refreshBootstrapContext();
          await refreshAlerts();
          await refreshAlertRules();
          await refreshGrids();
          initialized = true;
          break;
        } catch (error) {
          lastError = error;
          await sleep(1000);
        }
      }

      if (mounted) {
        if (!initialized) {
          setStartupError(lastError?.message ?? 'El backend no respondio correctamente.');
        }
        setIsLoading(false);
      }
    };

    initialize();
    pollHandle = setInterval(() => {
      if (!mounted || servicesStoppedRef.current) {
        return;
      }

      refreshBootstrapContext().catch(() => {});
      refreshAlerts().catch(() => {});
      refreshAlertRules().catch(() => {});
      refreshGrids().catch(() => {});
    }, 1000);

    return () => {
      mounted = false;
      if (pollHandle) {
        clearInterval(pollHandle);
      }
      clearToastTimer();
      if (uiToastTimerRef.current) {
        clearTimeout(uiToastTimerRef.current);
      }
      if (alertNotificationTimerRef.current) {
        clearTimeout(alertNotificationTimerRef.current);
      }
      closeSessionNotification();
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'config') {
      refreshGridData(activeTab, gridPage, gridVisiblePageSize);
    }
  }, [activeTab, gridPage, gridVisiblePageSize, gridSort, bootstrapContext?.syncStatus?.last_success_at]);

  useEffect(() => {
    if (activeTab === 'config' || !gridData || gridLoading) return undefined;

    const calculateVisibleRows = () => {
      const tableWrap = gridTableWrapRef.current;
      const pagination = gridPaginationRef.current;
      if (!tableWrap || !pagination) return;

      const headerHeight = tableWrap.querySelector('thead')?.getBoundingClientRect().height ?? 48;
      const fieldsByGroup = (gridData.grid?.columns ?? []).reduce((groups, column) => {
        const key = column.issueType || `__other::${column.field}`;
        const current = groups.get(key) ?? [];
        current.push(column.field);
        groups.set(key, current);
        return groups;
      }, new Map());
      const lineBudget = Math.max(1, ...[...fieldsByGroup.values()].map((fields) => (
        fields.reduce((total, field) => total + (['summary', 'description'].includes(field) ? 2 : 1), 0)
      )));
      const rowHeight = Math.max(56, 26 + lineBudget * 20 + Math.max(0, lineBudget - 1) * 7);
      const availableHeight = window.innerHeight
        - tableWrap.getBoundingClientRect().top
        - pagination.getBoundingClientRect().height
        - 54;
      const configuredMaximum = Number(gridData.grid?.pageSize) || 10;
      const nextPageSize = Math.max(1, Math.min(
        configuredMaximum,
        Math.floor((availableHeight - headerHeight) / rowHeight),
      ));

      setGridVisiblePageSize((current) => {
        if (current === nextPageSize) return current;
        const nextTotalPages = Math.max(1, Math.ceil((gridData.total ?? 0) / nextPageSize));
        setGridPage((page) => {
          const firstVisibleRecordIndex = Math.max(0, (page - 1) * current);
          const pageKeepingCurrentRecord = Math.floor(firstVisibleRecordIndex / nextPageSize) + 1;
          return Math.min(pageKeepingCurrentRecord, nextTotalPages);
        });
        return nextPageSize;
      });
    };

    const frame = window.requestAnimationFrame(calculateVisibleRows);
    window.addEventListener('resize', calculateVisibleRows);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', calculateVisibleRows);
    };
  }, [activeTab, gridData, gridLoading]);

  useEffect(() => {
    if (activeTab === 'config') return undefined;
    const tableWrap = gridTableWrapRef.current;
    if (!tableWrap) return undefined;

    const updateAvailableWidth = () => setGridTableAvailableWidth(tableWrap.clientWidth);
    updateAvailableWidth();
    const observer = new ResizeObserver(updateAvailableWidth);
    observer.observe(tableWrap);
    return () => observer.disconnect();
  }, [activeTab, gridData?.grid?.id]);

  useEffect(() => {
    const countdownHandle = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(countdownHandle);
  }, []);

  useEffect(() => {
    if (openGridAttributeGroup === null) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!event.target.closest('.grid-attribute-picker')) {
        setOpenGridAttributeGroup(null);
      }
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenGridAttributeGroup(null);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openGridAttributeGroup]);

  const handleLogin = async () => {
    if (loginInProgress) {
      return;
    }

    setLoginInProgress(true);

    try {
      const result = await api('/api/login', { method: 'POST', body: '{}' });
      setLoginState(result);

      if (result?.ok) {
        const shownNatively = showNativeNotification(
          'Jira Notifications',
          'Inicio de sesion iniciado con exito',
        );
        if (!shownNatively) {
          showSessionToast('Inicio de sesion iniciado con exito', 3000);
        }
      } else {
        showSessionToast('Se requiere inicio de sesion en Jira');
      }

      await refreshBootstrapContext();
      await refreshAlerts();
    } catch (error) {
      showSessionToast(`No se pudo iniciar sesion: ${error.message}`);
    } finally {
      setLoginInProgress(false);
    }
  };

  const handleSync = async () => {
    if (syncInProgress) {
      try {
        await api('/api/sync/cancel', { method: 'POST', body: '{}' });
        showUiToast('Deteniendo sincronización...');
      } catch (error) {
        showUiToast(`No se pudo detener la sincronización: ${error.message}`, 'error');
      }
      return;
    }

    setManualSyncInProgress(true);
    setBootstrapContext((current) => current ? {
      ...current,
      appState: 'syncing',
      syncStatus: {
        ...(current.syncStatus ?? {}),
        is_running: 1,
        is_canceling: 0,
        last_status: 'Sincronizando...',
      },
    } : current);

    try {
      const result = await api('/api/sync', { method: 'POST', body: '{}' });
      setSyncState(result);
      await refreshBootstrapContext();
      await refreshAlerts();
    } finally {
      setManualSyncInProgress(false);
    }
  };

  const handleSaveJql = async () => {
    const queries = jqlQueries
      .map((query) => query.replace(/\s+/g, ' ').trim())
      .filter(Boolean);

    if (queries.length === 0) {
      setJqlMessage('Debe existir al menos un JQL.');
      return;
    }

    const minutes = Number(syncIntervalMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 9999) {
      setJqlMessage('El intervalo debe estar entre 1 y 9999 minutos.');
      return;
    }

    setJqlSaving(true);
    setJqlMessage(null);

    try {
      const result = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          jqlQueries: queries,
          autoSyncEnabled,
          syncIntervalMinutes: minutes,
        }),
      });
      setJqlQueries(result.jqlQueries ?? queries);
      setAutoSyncEnabled(Boolean(result.autoSyncEnabled));
      setSyncIntervalMinutes(Number(result.syncIntervalMinutes ?? minutes));
      jqlDirtyRef.current = false;
      autoSyncDirtyRef.current = false;
      syncIntervalDirtyRef.current = false;
      setJqlMessage('Configuracion guardada correctamente.');
      showUiToast('Configuracion guardada correctamente.');
    } catch (error) {
      setJqlMessage(`No se pudo guardar la configuracion: ${error.message}`);
    } finally {
      setJqlSaving(false);
    }
  };

  const loadAlertImageFile = (file, inputElement = null) => {
    if (!file) return;

    const extension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedExtensions.includes(extension)
      || (file.type && !allowedTypes.includes(file.type))
      || file.size > 2 * 1024 * 1024) {
      setJqlMessage('La imagen debe ser PNG, JPG, JPEG o WEBP y no superar 2 MB.');
      if (inputElement) inputElement.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAlertImageData(String(reader.result));
      setAlertImageName(file.name);
      setAlertImageRemoved(false);
      setJqlMessage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAlertImageChange = (event) => {
    loadAlertImageFile(event.target.files?.[0], event.target);
  };

  const handleAlertImageDrop = (event) => {
    event.preventDefault();
    loadAlertImageFile(event.dataTransfer.files?.[0]);
  };

  const handleSaveAlert = async () => {
    setAlertValidationShown(true);
    const validConditions = alertForm.conditions.filter((condition) => (
      ['IS NULL', 'IS NOT NULL'].includes(condition.operator) || condition.value.trim()
    ));
    if (!alertForm.name.trim() || !alertForm.toastText.trim()) {
      setJqlMessage('La alerta requiere nombre y texto de Toast.');
      showUiToast('Completa el nombre y el texto del Toast.', 'error');
      return;
    }
    if (!alertValidation.ok || validConditions.length === 0) {
      setJqlMessage(alertValidation.errors.join(' '));
      showUiToast('Corrige las condiciones de la alerta.', 'error');
      return;
    }

    setAlertSaving(true);
    try {
      const result = await api('/api/alert-rules', {
        method: 'PUT',
        body: JSON.stringify({
          id: alertForm.id,
          name: alertForm.name,
          sql: buildAlertSql({ ...alertForm, conditions: validConditions }),
          condition_config: JSON.stringify({
            event: alertForm.event,
            conditions: validConditions,
          }),
          toast_text: alertForm.toastText,
          toast_image_data: alertImageData,
          toast_image_name: alertImageName,
          remove_toast_image: alertImageRemoved,
          retry_minutes: Math.max(Number(alertForm.retryMinutes) || 0, 0),
          is_active: alertForm.isActive,
        }),
      });
      setAlertRules(result.rules ?? []);
      setAlertForm(emptyAlertForm());
      setMessageBuilderExpanded(false);
      setAlertImageData(null);
      setAlertImageName('');
      setAlertImageUrl(null);
      setAlertImageRemoved(false);
      setNewAlertOpen(false);
      setExpandedAlertId(null);
      setAlertValidationShown(false);
      setJqlMessage('Alerta guardada correctamente.');
      showUiToast('Alerta guardada correctamente.');
    } catch (error) {
      setJqlMessage(`No se pudo guardar la alerta: ${error.message}`);
    } finally {
      setAlertSaving(false);
    }
  };

  const insertAlertMessageField = () => {
    if (!messageIssueType) {
      return;
    }

    const token = `[[${messageIssueType}::${alertMessageFields[messageField]}]]`;
    const input = alertToastInputRef.current;
    const currentText = alertForm.toastText;
    const start = input?.selectionStart ?? currentText.length;
    const end = input?.selectionEnd ?? currentText.length;
    const nextText = `${currentText.slice(0, start)}${token}${currentText.slice(end)}`;
    setAlertForm((current) => ({ ...current, toastText: nextText }));
    window.setTimeout(() => {
      input?.focus();
      const cursor = start + token.length;
      input?.setSelectionRange(cursor, cursor);
    }, 0);
  };

  const handleDeleteAlert = async (id) => {
    try {
      await api('/api/alert-rules', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      if (expandedAlertId === id) {
        setExpandedAlertId(null);
      }
      await refreshAlertRules();
      showUiToast('Alerta eliminada correctamente.');
    } catch (error) {
      setJqlMessage(`No se pudo eliminar la alerta: ${error.message}`);
    }
  };

  const handleEditAlert = (rule) => {
    const stored = parseStoredAlertRule(rule, alertFieldDefinitions);
    setAlertForm({
      id: rule.id,
      name: rule.name ?? '',
      event: stored.event,
      retryMinutes: Number(rule.retry_minutes ?? 0),
      conditions: stored.conditions,
      toastText: rule.toast_text ?? '',
      isActive: Boolean(rule.is_active),
    });
    setAlertImageData(null);
    setAlertImageName('');
    setAlertImageUrl(rule.toast_image ?? null);
    setAlertImageRemoved(false);
    setNewAlertOpen(false);
    setExpandedAlertId(rule.id);
    setMessageBuilderExpanded(false);
    setAlertValidationShown(false);
    setJqlMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewAlert = () => {
    setAlertForm(emptyAlertForm());
    setMessageBuilderExpanded(false);
    setAlertValidationShown(false);
    setAlertImageData(null);
    setAlertImageName('');
    setAlertImageUrl(null);
    setAlertImageRemoved(false);
    setExpandedAlertId(null);
    setNewAlertOpen(true);
    setJqlMessage(null);
  };

  const handleCancelAlert = () => {
    setAlertForm(emptyAlertForm());
    setMessageBuilderExpanded(false);
    setAlertValidationShown(false);
    setAlertImageData(null);
    setAlertImageName('');
    setAlertImageUrl(null);
    setAlertImageRemoved(false);
    setNewAlertOpen(false);
    setExpandedAlertId(null);
    setJqlMessage(null);
  };

  const renderAlertForm = (isNew) => {
    const imageInputId = `alert-image-input-${isNew ? 'new' : alertForm.id}`;
    return (
      <div className="alert-builder-form">
        <section className="alert-form-section alert-general-section">
          <header className="alert-form-section-heading">
            <span>1</span>
            <h4>Información general</h4>
          </header>
          <div className="alert-builder-grid">
            <label className="alert-field">
              <span>Nombre</span>
              <input
                value={alertForm.name}
                onChange={(event) => setAlertForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Criterios pendientes"
              />
            </label>
            <label className="alert-field">
              <span>Evento</span>
              <select
                value={alertForm.event}
                onChange={(event) => setAlertForm((current) => ({ ...current, event: event.target.value }))}
              >
                <option value="created">Incidencia nueva</option>
                <option value="updated">Incidencia actualizada</option>
                <option value="removed">Incidencia eliminada</option>
              </select>
            </label>
            <label className="alert-field">
              <span>Reenviar Toast cada</span>
              <span className="alert-number-field">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={alertForm.retryMinutes}
                  onChange={(event) => setAlertForm((current) => ({ ...current, retryMinutes: event.target.value }))}
                  placeholder="0"
                />
                <small>minutos</small>
              </span>
            </label>
            <label className="alert-switch-field">
              <span>Alerta activa</span>
              <span className="alert-switch-row">
                <input
                  type="checkbox"
                  checked={alertForm.isActive}
                  onChange={(event) => setAlertForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                <span className="alert-switch-control" aria-hidden="true" />
                <small>{alertForm.isActive ? 'Activada' : 'Desactivada'}</small>
              </span>
            </label>
          </div>
        </section>

        <section className="alert-form-section alert-conditions-section">
          <header className="alert-form-section-heading">
            <span>2</span>
            <h4>Condiciones</h4>
          </header>
          {alertValidationShown && alertValidation.errors.length > 0 ? (
            <div className="alert-validation-errors" role="alert">
              {alertValidation.errors.map((error) => <div key={error}>{error}</div>)}
            </div>
          ) : null}
          <div className="condition-builder">
            {alertForm.conditions.map((condition, index) => (
              <div className="alert-condition-block" key={`condition-${index}`}>
                {index > 0 ? (
                  <span className="condition-connector-wrap">
                    <select
                      className="condition-connector-row"
                      value={condition.connector || 'AND'}
                      onChange={(event) => setAlertForm((current) => ({
                        ...current,
                        conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                          ? { ...item, connector: event.target.value }
                          : item),
                      }))}
                      aria-label={`Conector de la condición ${index + 1}`}
                    >
                      <option value="AND">AND</option>
                      <option value="OR">OR</option>
                    </select>
                  </span>
                ) : null}
                <div className="condition-row">
                  <span className="condition-index" aria-hidden="true">{index + 1}</span>
                  <select
                    value={condition.field}
                    aria-label={`Campo de la condición ${index + 1}`}
                    onChange={(event) => setAlertForm((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                        ? {
                          ...item,
                          field: event.target.value,
                          operator: event.target.value === 'assignee' && item.operator === '='
                            ? 'LIKE'
                            : operatorsForField(event.target.value).some((option) => option.value === item.operator)
                              ? item.operator
                              : operatorsForField(event.target.value)[0]?.value,
                        }
                        : item),
                    }))}
                  >
                    {conditionFields.map(({ field, label }) => (
                      <option value={field} key={field}>{label}</option>
                    ))}
                  </select>
                  <select
                    value={condition.operator}
                    aria-label={`Operador de la condición ${index + 1}`}
                    onChange={(event) => setAlertForm((current) => ({
                      ...current,
                      conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                        ? { ...item, operator: event.target.value }
                        : item),
                    }))}
                  >
                    {operatorsForField(condition.field).map(({ value, label }) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                  {renderConditionValueControl(condition, index)}
                  <button
                    type="button"
                    className="alert-condition-delete"
                    onClick={() => setAlertForm((current) => ({
                      ...current,
                      conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index),
                    }))}
                    aria-label={`Eliminar condición ${index + 1}`}
                    title="Eliminar condición"
                  >
                    <LineIcon name="trash" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="alert-add-condition unified-add-button"
              onClick={() => setAlertForm((current) => ({
                ...current,
                conditions: [...current.conditions, {
                  field: 'status',
                  operator: '=',
                  value: '',
                  connector: current.conditions.length === 0 ? undefined : 'AND',
                }],
              }))}
            >
              <LineIcon name="plus" />
              Agregar condición
            </button>
          </div>
        </section>

        <section className="alert-form-section alert-content-section">
          <header className="alert-form-section-heading">
            <span>3</span>
            <h4>Contenido de la notificación</h4>
          </header>
          <div className="alert-message-insert">
            <span>Insertar dato de Jira</span>
            <select value={messageIssueType} onChange={(event) => setMessageIssueType(event.target.value)}>
              <option value="">Tipo de incidencia</option>
              {graphIssueTypes.map((issueType) => (
                <option value={issueType} key={issueType}>{issueType}</option>
              ))}
            </select>
            <select value={messageField} onChange={(event) => setMessageField(event.target.value)}>
              {Object.entries(alertMessageFields).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
            <button type="button" onClick={insertAlertMessageField} disabled={!messageIssueType}>
              Insertar
            </button>
          </div>
          <div className="alert-content-grid">
            <label className="alert-message-builder">
              <span>Texto del Toast</span>
              <textarea
                ref={alertToastInputRef}
                value={alertForm.toastText}
                onChange={(event) => setAlertForm((current) => ({ ...current, toastText: event.target.value }))}
                rows={4}
                placeholder="Hay criterios pendientes. Responsable: "
              />
              <small className="alert-message-help">Combina texto libre y datos de Jira en el orden que prefieras.</small>
            </label>
            <div className="alert-image-field">
              <span>Imagen del Toast</span>
              <div className={`alert-image-controls${alertImageData || alertImageUrl ? ' has-preview' : ''}`}>
                <input
                  id={imageInputId}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={handleAlertImageChange}
                />
                <label
                  className="alert-image-dropzone"
                  htmlFor={imageInputId}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleAlertImageDrop}
                >
                  <LineIcon name="upload" />
                  <strong>Arrastra una imagen</strong>
                  <small>o selecciónala</small>
                  <em>PNG, JPG o WEBP · máximo 2 MB</em>
                </label>
                {(alertImageData || alertImageUrl) ? (
                  <div className="alert-image-preview">
                    <img src={alertImageData || backendAssetUrl(alertImageUrl)} alt="Vista previa de la imagen del Toast" />
                    <button
                      type="button"
                      onClick={() => {
                        setAlertImageData(null);
                        setAlertImageName('');
                        setAlertImageUrl(null);
                        setAlertImageRemoved(true);
                      }}
                      aria-label="Eliminar imagen"
                      title="Eliminar imagen"
                    >
                      ×
                    </button>
                  </div>
                ) : null}
              </div>
              {alertImageData ? <small className="alert-image-selected">Imagen seleccionada: {alertImageName}</small> : null}
            </div>
          </div>
        </section>

        <footer className="alert-form-actions">
          <span>
            {!isNew ? (
              <button
                type="button"
                className="alert-delete-rule"
                onClick={() => handleDeleteAlert(alertForm.id)}
                disabled={alertSaving}
              >
                <LineIcon name="trash" />
                Eliminar alerta
              </button>
            ) : null}
          </span>
          <span>
            <button type="button" className="alert-cancel-button" onClick={handleCancelAlert} disabled={alertSaving}>
              Cancelar
            </button>
            <button type="button" className="alert-save-button save-action-button" onClick={handleSaveAlert} disabled={alertSaving}>
              <LineIcon name="save" />
              {alertSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </span>
        </footer>
      </div>
    );
  };

  const handleReadAlert = async (id) => {
    try {
      await api('/api/alerts/read', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      if (alertToast?.id === id) {
        setAlertToast(null);
      }
      showUiToast('Alerta marcada como leída.');
      await refreshAlerts();
    } catch (error) {
      setJqlMessage(`No se pudo marcar la alerta: ${error.message}`);
    }
  };

  const handleAddJql = () => {
    jqlDirtyRef.current = true;
    setJqlQueries((current) => [...current, '']);
    setJqlMessage(null);
  };

  const handleRemoveJql = (index) => {
    jqlDirtyRef.current = true;
    setJqlQueries((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setJqlMessage(null);
  };

  const handleAutoSyncToggle = (event) => {
    const nextValue = event.target.checked;
    autoSyncDirtyRef.current = true;
    setAutoSyncEnabled(nextValue);
    setJqlMessage(null);
  };

  const handleAlertRetryToggle = async (event) => {
    const nextValue = event.target.checked;
    alertRetryDirtyRef.current = true;
    alertRetryEnabledRef.current = nextValue;
    setAlertRetryEnabled(nextValue);
    setAlertRetrySaving(true);

    try {
      const result = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ alertRetryEnabled: nextValue }),
      });
      alertRetryDirtyRef.current = false;
      const savedValue = Boolean(result.alertRetryEnabled);
      alertRetryEnabledRef.current = savedValue;
      setAlertRetryEnabled(savedValue);
      showUiToast('Reenvio de toast de alertas actualizado.');
    } catch (error) {
      alertRetryDirtyRef.current = false;
      alertRetryEnabledRef.current = !nextValue;
      setAlertRetryEnabled(!nextValue);
      setJqlMessage(`No se pudo cambiar el reenvio de toast: ${error.message}`);
    } finally {
      setAlertRetrySaving(false);
    }
  };

  const handleDatabaseReset = async () => {
    if (!window.confirm('Se borraran los datos locales de Jira y ProjectGroups. La sesion y la configuracion se conservaran. Desea continuar?')) {
      return;
    }

    setDatabaseResetting(true);
    try {
      await api('/api/database/reset', { method: 'POST', body: '{}' });
      setSyncState(null);
      setJqlMessage('Base de datos reiniciada correctamente.');
      showUiToast('Base de datos local reiniciada.');
      await refreshBootstrapContext();
      await refreshAlerts();
    } catch (error) {
      setJqlMessage(`No se pudo borrar la base de datos: ${error.message}`);
    } finally {
      setDatabaseResetting(false);
    }
  };

  const handleExecuteSql = async () => {
    const sql = (sqlQueries[selectedSqlIndex] ?? '').trim();
    if (!sql) {
      setSqlResult({ ok: false, error: 'Escribe una consulta SQL.' });
      return;
    }

    const isWrite = /^(update|delete)\b/i.test(sql);
    if (isWrite && !window.confirm('Esta consulta modificara la BD local. Desea continuar?')) {
      return;
    }

    setSqlExecuting(true);
    try {
      const result = await api('/api/database/sql', {
        method: 'POST',
        body: JSON.stringify({ sql }),
      });
      setSqlResult(result);
      if (result.ok) {
        showUiToast('Consulta SQL ejecutada correctamente.');
      }
    } catch (error) {
      setSqlResult({ ok: false, error: error.message });
    } finally {
      setSqlExecuting(false);
    }
  };

  const handleShutdown = async () => {
    setShutdownRequested(true);
    try {
      await api('/api/shutdown', { method: 'POST', body: '{}' });
    } catch {
      // The backend is expected to close immediately after accepting the request.
    }

    closeSessionNotification();
    clearToastTimer();
    servicesStoppedRef.current = true;
    setServicesStopped(true);
    window.setTimeout(() => window.close(), 300);
  };

  const closeGridBuilder = () => {
    setGridFormOpen(false);
    setExpandedGridId(null);
    setOpenGridAttributeGroup(null);
  };

  const renderGridBuilder = () => (
    <div className="grid-builder-form">
          {gridValidationShown && gridValidationErrors.length > 0 ? (
            <div className="alert-validation-errors grid-validation-errors" role="alert">
              {gridValidationErrors.map((error) => <div key={error}>{error}</div>)}
            </div>
          ) : null}
          <section className="grid-builder-section grid-general-section">
            <div className="grid-section-title"><span>01</span><h3>Información general</h3></div>
            <div className="grid-general-fields">
              <label className="grid-name-field">
                Nombre de la pestaña
                <input value={gridForm.name} onChange={(event) => setGridForm((current) => ({ ...current, name: event.target.value }))} placeholder="Seguimiento QA" />
              </label>
              <label className="grid-page-size">Máximo de registros
                <input type="number" min="1" max="200" value={gridForm.pageSize} onChange={(event) => setGridForm((current) => ({ ...current, pageSize: event.target.value }))} />
              </label>
              <label className="settings-toggle settings-unified-toggle grid-visibility-toggle">
                <span className="grid-toggle-label">Mostrar pestaña</span>
                <input type="checkbox" checked={gridForm.visible !== false} onChange={(event) => setGridForm((current) => ({ ...current, visible: event.target.checked }))} />
                <span className="settings-switch-control" aria-hidden="true" />
              </label>
            </div>
          </section>
          <div className="grid-builder-section grid-fields-section">
            <div className="grid-section-title"><span>02</span><h3>Campos a mostrar</h3></div>
            {gridColumnGroups.map(([groupKey, groupColumns], index) => {
              const groupType = groupKey === '__other' ? '__projectGroup' : groupKey;
              const selectedFields = groupColumns.filter((column) => column.field).map((column) => column.field);
              const attributeOptions = groupKey === '__other'
                ? [{ field: 'estadoGeneral', label: 'Estado General' }]
                : [
                  ...conditionFields,
                  ...(gridSubtaskIssueTypes.has(groupType) ? gridSubtaskFields : []),
                ];
              return (
                <div
                  className={`grid-builder-row grid-column-group${draggedGridColumnIndex === index ? ' is-dragging' : ''}`}
                  key={`grid-column-group-${groupKey}`}
                  draggable
                  onDragStart={() => setDraggedGridColumnIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedGridColumnIndex === null || draggedGridColumnIndex === index) return;
                    const reordered = [...gridColumnGroups];
                    const [moved] = reordered.splice(draggedGridColumnIndex, 1);
                    reordered.splice(index, 0, moved);
                    setGridForm((current) => ({ ...current, columns: reordered.flatMap(([, columns]) => columns) }));
                    setDraggedGridColumnIndex(null);
                  }}
                  onDragEnd={() => setDraggedGridColumnIndex(null)}
                >
                  <span className="grid-row-number">{index + 1}</span>
                  <select value={groupType} onChange={(event) => updateGridGroupType(groupKey, event.target.value)}>
                    <option value="">Seleccione Tipo de Incidencia</option>
                    {gridIssueTypes.map((type) => <option value={type} key={type}>{type}</option>)}
                    <option value="__projectGroup">Otros</option>
                  </select>
                  <div className="grid-attribute-picker">
                    <button type="button" className="grid-attribute-trigger" disabled={!groupType || groupType === ''} onClick={() => setOpenGridAttributeGroup((current) => current === groupKey ? null : groupKey)}>
                      {selectedFields.length > 0 ? (
                        <span className="grid-selected-attributes">
                          {selectedFields.map((field) => (
                            <span
                              className="grid-selected-attribute"
                              key={field}
                              draggable
                              onDragStart={(event) => {
                                event.stopPropagation();
                                setDraggedGridAttribute({ groupKey, field });
                              }}
                              onDragOver={(event) => event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                if (draggedGridAttribute?.groupKey === groupKey) {
                                  reorderGridGroupAttribute(groupKey, draggedGridAttribute.field, field);
                                }
                                setDraggedGridAttribute(null);
                              }}
                              onDragEnd={() => setDraggedGridAttribute(null)}
                            >
                              {gridFieldLabel(field)}
                            </span>
                          ))}
                        </span>
                      ) : 'Seleccione atributos'}
                      <span aria-hidden="true">&#9662;</span>
                    </button>
                    {openGridAttributeGroup === groupKey ? (
                      <div className="grid-attribute-menu">
                        {[...attributeOptions].sort((left, right) => Number(selectedFields.includes(right.field)) - Number(selectedFields.includes(left.field))).map((field) => {
                          const selected = selectedFields.includes(field.field);
                          return (
                            <label
                              key={field.field}
                              className={selected ? 'is-selected' : ''}
                              draggable={selected}
                              onDragStart={() => selected && setDraggedGridAttribute({ groupKey, field: field.field })}
                              onDragOver={(event) => selected && event.preventDefault()}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (draggedGridAttribute?.groupKey === groupKey) {
                                  reorderGridGroupAttribute(groupKey, draggedGridAttribute.field, field.field);
                                }
                                setDraggedGridAttribute(null);
                              }}
                              onDragEnd={() => setDraggedGridAttribute(null)}
                            >
                              <input type="checkbox" checked={selected} onChange={() => toggleGridGroupAttribute(groupKey, field.field)} />
                              <span>{field.label}</span>
                              {selected ? <span className="grid-attribute-drag-handle" title="Arrastrar para ordenar">&#8942;</span> : null}
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                  <span className="grid-column-drag-handle" title="Arrastrar para mover" aria-label="Arrastrar para mover">&#8942;</span>
                  <button type="button" className="jql-delete" disabled={gridColumnGroups.length === 1} onClick={() => setGridForm((current) => ({ ...current, columns: current.columns.filter((column) => gridColumnGroupKey(column) !== groupKey) }))} aria-label="Eliminar tipo de incidencia"><LineIcon name="trash" /></button>
                </div>
              );
            })}
            <button type="button" className="jql-add unified-add-button" onClick={() => setGridForm((current) => ({ ...current, columns: [...current.columns, { issueType: '', field: '' }] }))}><LineIcon name="plus" /> Agregar tipo de incidencia</button>
          </div>
          <div className="grid-builder-section grid-conditions-section">
            <div className="grid-section-title"><span>03</span><h3>Condiciones</h3></div>
            {gridForm.conditions.length > 0 && gridConditionValidationErrors.length > 0 ? (
              <div className="alert-validation-errors grid-validation-errors" role="alert">
                {gridConditionValidationErrors.map((error) => <div key={error}>{error}</div>)}
              </div>
            ) : null}
            {gridForm.conditions.flatMap((condition, index) => [
              index > 0 ? (
                <select
                  className="grid-condition-connector"
                  key={`grid-condition-connector-${index}`}
                  value={condition.connector ?? 'AND'}
                  onChange={(event) => setGridForm((current) => ({
                    ...current,
                    conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                      ? { ...item, connector: event.target.value }
                      : item),
                  }))}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              ) : null,
              <div className="grid-builder-row" key={`grid-condition-${index}`}>
                <span className="grid-row-number">{index + 1}</span>
                <select value={condition.issueType ?? ''} disabled={condition.field === 'estadoGeneral'} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, issueType: event.target.value } : item) }))}>
                  <option value="">Seleccione tipo de incidencia</option>
                  {gridIssueTypes.map((type) => <option value={type} key={type}>{type}</option>)}
                </select>
                <select value={condition.field} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value, issueType: event.target.value === 'estadoGeneral' ? null : item.issueType } : item) }))}>
                  <option value="">Seleccione atributo</option>
                  {gridConditionFieldOptions.map((field) => <option value={field.field} key={field.field}>{field.label}</option>)}
                </select>
                <select value={condition.operator} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) }))}>
                  <option value="">Seleccione operador</option>
                  {conditionOperators.map((operator) => <option value={operator.value} key={operator.value}>{operator.label}</option>)}
                </select>
                {gridConditionCatalogOptions(condition.field).length > 0 ? (
                  <select value={condition.value ?? ''} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))}>
                    <option value="">Seleccione valor</option>
                    {gridConditionCatalogOptions(condition.field).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
                  </select>
                ) : (
                  <input value={condition.value ?? ''} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item) }))} placeholder="Valor" />
                )}
                <button type="button" className="jql-delete" onClick={() => setGridForm((current) => ({ ...current, conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Eliminar condición"><LineIcon name="trash" /></button>
              </div>
            ])}
            <button type="button" className="jql-add unified-add-button" onClick={() => setGridForm((current) => ({ ...current, conditions: [...current.conditions, { issueType: '', field: '', operator: '', value: '', connector: current.conditions.length ? 'AND' : undefined }] }))}><LineIcon name="plus" /> Agregar condición</button>
          </div>
          <div className="grid-form-actions">
            <button type="button" className="save-action-button" onClick={handleSaveGrid}>
              <LineIcon name="save" />
              Guardar
            </button>
            <button type="button" className="secondary-button" onClick={closeGridBuilder}>Cancelar</button>
            {gridForm.id ? (
              <button type="button" className="danger-button grid-delete-button" onClick={() => handleDeleteGrid(gridForm.id)}>
                <LineIcon name="trash" />
                Eliminar grid
              </button>
            ) : null}
          </div>
    </div>
  );

  const renderGridConfiguration = () => (
    <div className="settings-card dashboard-card dashboard-grids">
      <div className="section-heading grid-panel-heading">
        <div>
          <div className="grid-panel-title">
            <h2>Grids configurados</h2>
            <span className="grid-count-badge">{grids.length}</span>
          </div>
          <p className="copy">Crea pestañas con una fila por ProjectGroup y los campos que necesites consultar.</p>
        </div>
        <button type="button" className="secondary-button grid-new-button" onClick={handleNewGrid} disabled={syncInProgress}>
          <LineIcon name="plus" />
          Nuevo grid
        </button>
      </div>
      <div className="grid-configured-list">
        {gridFormOpen && !gridForm.id ? (
          <div className="grid-configured-row is-expanded is-new-grid">
            <div className="grid-configured-name grid-new-summary">
              <span className="grid-summary-icon"><LineIcon name="grid" /></span>
              <span className="grid-summary-title">Nuevo grid</span>
              <span className="grid-visibility-status">Sin guardar</span>
              <span className="grid-accordion-chevron is-expanded" aria-hidden="true"><LineIcon name="chevron" /></span>
            </div>
            {renderGridBuilder()}
          </div>
        ) : null}
        {grids.length === 0 && !gridFormOpen ? <p className="grid-empty-state">No hay grids configurados.</p> : grids.map((grid) => {
          const expanded = expandedGridId === grid.id && gridFormOpen;
          const fieldCount = grid.columns?.length ?? 0;
          const conditionCount = grid.conditions?.length ?? 0;
          return (
            <div className={`grid-configured-row${expanded ? ' is-expanded' : ''}`} key={grid.id}>
              <button
                type="button"
                className="grid-configured-name"
                onClick={() => {
                  if (expanded) {
                    closeGridBuilder();
                    return;
                  }
                  handleEditGrid(grid);
                }}
                aria-expanded={expanded}
              >
                <span className="grid-summary-icon"><LineIcon name="grid" /></span>
                <span className="grid-summary-title">{grid.name}</span>
                <span className={`grid-visibility-status${grid.visible === false ? ' is-hidden' : ''}`}>
                  {grid.visible === false ? 'Oculto' : 'Visible'}
                </span>
                <span className="grid-summary-meta">
                  {fieldCount} {fieldCount === 1 ? 'campo' : 'campos'} · {conditionCount} {conditionCount === 1 ? 'condición' : 'condiciones'}
                </span>
                <span className={`grid-accordion-chevron${expanded ? ' is-expanded' : ''}`} aria-hidden="true"><LineIcon name="chevron" /></span>
              </button>
              {expanded ? renderGridBuilder() : null}
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderGridTab = () => {
    const columns = gridData?.grid?.columns ?? [];
    const rows = gridData?.rows ?? [];
    const columnGroups = columns.reduce((groups, column) => {
      const groupKey = column.issueType || `__other::${column.field}`;
      const current = groups.get(groupKey) ?? [];
      current.push(column);
      groups.set(groupKey, current);
      return groups;
    }, new Map());
    const columnWidths = calculateGridColumnWidths(columnGroups, gridTableAvailableWidth);
    const tableMinimumWidth = columnWidths.reduce((total, width) => total + width, 0);
    const horizontalScrollRequired = gridTableAvailableWidth > 0
      && tableMinimumWidth > gridTableAvailableWidth + 1;
    const totalRecords = Number(gridData?.total ?? 0);
    const effectivePageSize = Number(gridData?.pageSize ?? gridVisiblePageSize) || 1;
    const totalPages = Math.max(1, Math.ceil(totalRecords / effectivePageSize));
    const firstVisibleRecord = rows.length > 0 ? ((gridPage - 1) * effectivePageSize) + 1 : 0;
    const lastVisibleRecord = rows.length > 0
      ? Math.min(firstVisibleRecord + rows.length - 1, totalRecords)
      : 0;
    registerGridVisualValues(gridVisualRegistryRef.current, rows, columns);
    return (
      <section className="grid-tab-view">
        <div className="grid-tab-heading"><div><p className="eyebrow">Jira Notifications</p><h1>{gridData?.grid?.name ?? grids.find((grid) => grid.id === activeTab)?.name}</h1><p className="copy">Información agrupada por ProjectGroup.</p></div></div>
        <div className={`grid-table-wrap${gridLoading ? ' is-loading' : ''}${horizontalScrollRequired ? ' has-horizontal-overflow' : ''}`} ref={gridTableWrapRef} aria-busy={gridLoading}>
          <table className="project-grid" style={{ minWidth: `${tableMinimumWidth}px` }}>
            <colgroup>
              {columnWidths.map((width, index) => <col style={{ width: `${width}px` }} key={`grid-column-${index}`} />)}
            </colgroup>
            <thead>
              <tr>
                {[...columnGroups.entries()].map(([groupKey, groupColumns]) => {
                  const heading = groupKey.startsWith('__other::')
                    ? gridFieldLabel(groupColumns[0].field)
                    : groupKey;
                  const sortColumn = groupColumns[0];
                  const isSorted = gridSort?.issueType === sortColumn.issueType && gridSort?.field === sortColumn.field;
                  const direction = isSorted ? gridSort.direction : null;
                  return (
                    <th key={groupKey}>
                      <button
                        type="button"
                        className={`grid-sort-button${isSorted ? ' is-sorted' : ''}`}
                        onClick={() => {
                          setGridSort({
                            issueType: sortColumn.issueType ?? null,
                            field: sortColumn.field,
                            direction: direction === 'asc' ? 'desc' : 'asc',
                          });
                          setGridPage(1);
                        }}
                        title={`Ordenar por ${heading}${direction === 'asc' ? ': ascendente' : direction === 'desc' ? ': descendente' : ''}`}
                      >
                        <ClampedGridText tooltipText={heading} className="grid-column-heading">{heading}</ClampedGridText>
                        <span className="grid-sort-icon" aria-hidden="true">{direction === 'asc' ? '↑' : direction === 'desc' ? '↓' : '↕'}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.projectGroupId}>
                  {[...columnGroups.entries()].map(([groupKey, groupColumns]) => (
                    <td className={`grid-group-cell${groupColumns.some((column) => gridSubtaskFields.some((field) => field.field === column.field)) ? ' has-subtask-count' : ''}`} key={`${row.projectGroupId}-${groupKey}`}>
                      {groupKey.startsWith('__other::')
                        ? groupColumns.map((column) => {
                          const value = column.field === 'estadoGeneral' ? row.estadoGeneral : '';
                          return (
                            <div className="grid-group-value grid-general-state" key={`${column.issueType}-${column.field}`}>
                              <GridStateText value={value} registry={gridVisualRegistryRef.current} prominent />
                            </div>
                          );
                        })
                        : groupColumns.map((column) => {
                          const rawValue = row[`${column.issueType}::${column.field}`] ?? '';
                          const isSubtaskCount = gridSubtaskFields.some((field) => field.field === column.field);
                          const hasVisibleValue = isSubtaskCount
                            ? Array.isArray(rawValue) && rawValue.length > 0
                            : (rawValue !== null && rawValue !== undefined && String(rawValue).trim() !== '');
                          if (!hasVisibleValue) {
                            return null;
                          }
                          if (isSubtaskCount) {
                            return (
                              <div className="grid-group-value grid-subtask-count-value" key={`${column.issueType}-${column.field}`}>
                                <strong>{gridFieldLabel(column.field)}:</strong>{' '}
                                <SubtaskCountValue
                                  entries={Array.isArray(rawValue) ? rawValue : []}
                                  isOpen={column.field === 'openSubtasks'}
                                />
                              </div>
                            );
                          }
                          const label = gridFieldLabel(column.field);
                          if (column.field === 'status') {
                            return (
                              <div className="grid-group-value grid-highlight-row" key={`${column.issueType}-${column.field}`}>
                                <strong>{label}:</strong>{' '}
                                <GridStateText value={rawValue} registry={gridVisualRegistryRef.current} />
                              </div>
                            );
                          }
                          if (['reporter', 'assignee'].includes(column.field)) {
                            return (
                              <div className="grid-group-value grid-highlight-row grid-person-row" key={`${column.issueType}-${column.field}`}>
                                <strong>{label}:</strong>{' '}
                                <GridPersonText value={rawValue} registry={gridVisualRegistryRef.current} />
                              </div>
                            );
                          }
                          if (column.field === 'key') {
                            return (
                              <div className="grid-group-value grid-highlight-row" key={`${column.issueType}-${column.field}`}>
                                <span className="grid-attribute-label">{label}:</span>{' '}
                                <GridIssueText
                                  value={rawValue}
                                  issueDetails={row.issueDetails}
                                  jiraBaseUrl={jiraBaseUrl}
                                />
                              </div>
                            );
                          }
                          const tooltipText = `${label}: ${rawValue}`;
                          const negativeTimeRemaining = isNegativeGridTimeRemaining(column.field, rawValue);
                          return (
                            <ClampedGridText
                              tooltipText={tooltipText}
                              className="grid-group-value"
                              key={`${column.issueType}-${column.field}`}
                            >
                              <span className="grid-attribute-label">{label}:</span>{' '}
                              <span className={negativeTimeRemaining ? 'grid-negative-time' : ''}>{rawValue}</span>
                            </ClampedGridText>
                          );
                        })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!gridLoading && rows.length === 0 ? <p className="copy">No hay ProjectGroups que cumplan las condiciones.</p> : null}
        <nav className="grid-pagination" ref={gridPaginationRef} aria-label="Paginación de registros">
          <button
            type="button"
            className="grid-pagination-button"
            disabled={gridLoading || gridPage <= 1}
            onClick={() => setGridPage((page) => page - 1)}
            aria-label="Mostrar registros anteriores"
            title="Registros anteriores"
          >
            <LineIcon name="arrowLeft" />
          </button>
          <span className="grid-pagination-range" aria-live="polite">
            {firstVisibleRecord}-{lastVisibleRecord} de {totalRecords}
          </span>
          <button
            type="button"
            className="grid-pagination-button"
            disabled={gridLoading || gridPage >= totalPages}
            onClick={() => setGridPage((page) => page + 1)}
            aria-label="Mostrar registros siguientes"
            title="Registros siguientes"
          >
            <LineIcon name="arrowRight" />
          </button>
        </nav>
      </section>
    );
  };

  if (isLoading) {
    return (
      <main className="app-shell">
        <section className="hero startup-hero">
          <div className="startup-card">
            <div className="startup-spinner" aria-hidden="true" />
            <div>
              <p className="eyebrow">Jira Notifications</p>
              <h1>Iniciando app...</h1>
              <p className="copy">Estamos cargando el backend y la interfaz.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (startupError) {
    return (
      <main className="app-shell">
        <section className="hero startup-hero">
          <div className="startup-card">
            <div>
              <p className="eyebrow">Jira Notifications</p>
              <h1>No se pudo iniciar la app</h1>
              <p className="copy">El backend no respondio correctamente.</p>
              <p className="copy">{startupError}</p>
              <button type="button" onClick={() => window.location.reload()}>
                Reintentar
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (servicesStopped) {
    return (
      <main className="app-shell">
        <section className="hero startup-hero">
          <div className="startup-card">
            <div>
              <p className="eyebrow">Jira Notifications</p>
              <h1>Servicios detenidos</h1>
              <p className="copy">
                El backend y el frontend se estan cerrando. Ya puede cerrar esta pestana.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="app-header-bar">
          <div className="app-tabs-scroll">
            <nav className="app-tabs" aria-label="Navegacion de la aplicacion">
              {grids.filter((grid) => grid.visible !== false).map((grid) => <button type="button" className={activeTab === grid.id ? 'app-tab is-active' : 'app-tab'} onClick={() => { setHeaderAlertsOpen(false); setGridVisiblePageSize(Number(grid.pageSize) || 10); setGridSort(null); setActiveTab(grid.id); setGridPage(1); }} key={grid.id}>{grid.name}</button>)}
            </nav>
          </div>
          <div className="app-header-status-panel">
            <button
              type="button"
              className="header-tool-button header-refresh-button"
              onClick={handleRefreshAll}
              disabled={refreshingAll}
              aria-label="Actualizar toda la informacion"
              title="Actualizar toda la informacion"
            >
              <LineIcon name="refresh" />
            </button>
            <button
              type="button"
              className={activeTab === 'config' ? 'header-tool-button header-settings-button is-active' : 'header-tool-button header-settings-button'}
              onClick={() => { setHeaderAlertsOpen(false); setActiveTab('config'); }}
              aria-label="Abrir configuracion"
              aria-pressed={activeTab === 'config'}
              title="Configuracion"
            >
              <LineIcon name="settings" />
            </button>
            <div className="header-alerts-anchor" ref={headerAlertsRef}>
              <button
                type="button"
                className="header-alert-button"
                onClick={() => {
                  if ((alertsSummary?.unreadCount ?? 0) > 0) {
                    setHeaderAlertsOpen((current) => !current);
                  }
                }}
                aria-expanded={headerAlertsOpen}
                aria-label={(alertsSummary?.unreadCount ?? 0) > 0
                  ? `Alertas sin leer: ${alertsSummary.unreadCount}`
                  : 'No hay alertas sin leer'}
                title={(alertsSummary?.unreadCount ?? 0) > 0 ? 'Mostrar alertas sin leer' : 'No hay alertas sin leer'}
              >
                <LineIcon name="bell" />
                {(alertsSummary?.unreadCount ?? 0) > 0 ? (
                  <span className="header-alert-badge">{alertsSummary.unreadCount}</span>
                ) : null}
              </button>
              {headerAlertsOpen && (alertsSummary?.unreadAlerts?.length ?? 0) > 0 ? (
                  <div className="header-alerts-popover" role="region" aria-label="Alertas sin leer">
                    {(alertsSummary.unreadAlerts ?? []).map((alert) => (
                      <div key={alert.id} className="header-alert-item">
                        {(alert.toast_image || alert.issuetype_icon_url) ? (
                          <img
                            className="header-alert-image"
                            src={alert.toast_image ? backendAssetUrl(alert.toast_image) : alert.issuetype_icon_url}
                            alt=""
                            width="32"
                            height="32"
                          />
                        ) : <span className="header-alert-image-placeholder"><LineIcon name="bell" /></span>}
                        <span className="header-alert-message">
                          {renderAlertMessage(
                            alert.toast_message || alert.toast_text || alert.rule_name || 'Nueva alerta de Jira',
                            jiraBaseUrl,
                          )}
                          {Number(alert.retry_minutes ?? 0) > 0 ? (
                            <small className="alerts-retry-countdown">
                              Proximo Toast: {alertRetryEnabled
                                ? (formatAlertRetryCountdown(alert, countdownNow) ?? 'pendiente')
                                : 'reenvio de toast apagado'}
                            </small>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          className="header-alert-read-button"
                          onClick={() => handleReadAlert(alert.id)}
                          aria-label="Marcar alerta como leida"
                          title="Marcar como leida"
                        >
                          &#10003;
                        </button>
                      </div>
                    ))}
                  </div>
              ) : null}
            </div>
            <div className="header-sync-summary" aria-live="polite">
              <span>Ultima: {formatBogotaDate(syncStatus?.last_finished_at)}</span>
              <span>Proxima: {autoSyncEnabled ? (syncInProgress ? 'En curso' : formatCountdown(syncStatus?.next_sync_at, countdownNow)) : 'Apagada'}</span>
              <span className={`header-sync-result${syncInProgress ? ' sync-status-pulsing' : ''}${sessionExpired ? ' session-required' : ''}`}>
                {sessionExpired ? (
                  <button
                    type="button"
                    className="header-sync-login-link"
                    onClick={handleLogin}
                    disabled={loginInProgress || syncInProgress}
                    title="Iniciar sesión en Jira"
                  >
                    {loginInProgress ? 'Esperando inicio de sesión...' : 'Inicie sesión en Jira'}
                  </button>
                ) : (syncInProgress ? 'Sincronizando...' : syncResultLabel)}
              </span>
            </div>
          </div>
        </div>
        {activeTab === 'config' ? <div className="configuration-layout">
        <aside className="configuration-sidebar" aria-label="Secciones de configuración">
          <div>
            <p className="configuration-sidebar-title">Configuración</p>
            <div className="configuration-menu">
              {configurationSections.map((section) => (
                <button
                  type="button"
                  key={section.id}
                  className={configSection === section.id ? 'configuration-menu-item is-active' : 'configuration-menu-item'}
                  onClick={() => setConfigSection(section.id)}
                >
                  <span className="configuration-menu-icon"><LineIcon name={section.icon} /></span>
                  <span>{section.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={`configuration-session-status${sessionIsValid ? ' is-valid' : ''}`}>
            <span aria-hidden="true" />
            Sesión Jira {sessionIsValid ? 'válida' : 'requiere inicio'}
          </div>
        </aside>
        <div className="configuration-workspace" data-section={configSection}>
          <header className="configuration-workspace-heading">
            <div>
              <p className="eyebrow">Jira Notifications</p>
              <h1>{selectedConfigurationSection.label}</h1>
              <p className="copy">{selectedConfigurationSection.description}</p>
            </div>
          </header>
          <div className="dashboard-grid">
        <fieldset disabled={syncInProgress} className="dashboard-editable-panels">
        <div className="settings-card dashboard-card dashboard-alert">
          <div className="alert-rules-toolbar">
            <div className="alert-rules-title">
              <h2>Reglas de notificación</h2>
              <span>{alertRules.length} {alertRules.length === 1 ? 'configurada' : 'configuradas'}</span>
            </div>
            <button type="button" className="alert-new-rule-button" onClick={handleNewAlert}>
              <LineIcon name="plus" />
              Nueva alerta
            </button>
          </div>
          {false ? <div className="alert-builder-form">
          <div className="alert-builder-grid">
            <label>
              Nombre
              <input
                value={alertForm.name}
                onChange={(event) => setAlertForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Criterios pendientes"
              />
            </label>
            <label>
              Evento
              <select
                value={alertForm.event}
                onChange={(event) => setAlertForm((current) => ({ ...current, event: event.target.value }))}
              >
                <option value="created">Incidencia nueva</option>
                <option value="updated">Incidencia actualizada</option>
                <option value="removed">Incidencia eliminada</option>
              </select>
            </label>
            <label>
              Reenviar Toast cada
              <input
                type="number"
                min="0"
                step="1"
                value={alertForm.retryMinutes}
                onChange={(event) => setAlertForm((current) => ({ ...current, retryMinutes: event.target.value }))}
                placeholder="0"
              />
                <small className="field-help">minutos (0 = no repetir)</small>
            </label>
            <label className="settings-toggle alert-active-toggle">
              <input
                type="checkbox"
                checked={alertForm.isActive}
                onChange={(event) => setAlertForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              <span>Alerta activa</span>
            </label>
          </div>
          <div className="condition-builder">
            <h3>Condiciones</h3>
            {alertForm.conditions.map((condition, index) => (
              <div className="condition-row" key={`condition-${index}`}>
                <select
                  value={condition.field}
                  onChange={(event) => setAlertForm((current) => ({
                    ...current,
                    conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                      ? {
                        ...item,
                        field: event.target.value,
                        operator: event.target.value === 'assignee' && item.operator === '='
                          ? 'LIKE'
                          : operatorsForField(event.target.value).some((option) => option.value === item.operator)
                            ? item.operator
                            : operatorsForField(event.target.value)[0]?.value,
                      }
                      : item),
                  }))}
                >
                  {conditionFields.map(({ field, label }) => (
                    <option value={field} key={field}>{label}</option>
                  ))}
                </select>
                <select
                  value={condition.operator}
                  onChange={(event) => setAlertForm((current) => ({
                    ...current,
                    conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                      ? { ...item, operator: event.target.value }
                      : item),
                  }))}
                >
                  {operatorsForField(condition.field).map(({ value, label }) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
                <input
                  type={conditionFields.find((item) => item.field === condition.field)?.type === 'datetime'
                    ? 'datetime-local'
                    : conditionFields.find((item) => item.field === condition.field)?.type === 'number' ? 'number' : 'text'}
                  step={conditionFields.find((item) => item.field === condition.field)?.type === 'number' ? 'any' : undefined}
                  list={['project', 'issuetype', 'status'].includes(condition.field) ? `jira-catalog-${condition.field}-${index}` : undefined}
                  value={condition.value}
                  onChange={(event) => setAlertForm((current) => ({
                    ...current,
                    conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                      ? { ...item, value: event.target.value }
                      : item),
                  }))}
                  placeholder="Criterios de aceptación"
                />
                <button
                  type="button"
                  className="jql-delete"
                  onClick={() => setAlertForm((current) => ({
                    ...current,
                    conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index),
                  }))}
                  aria-label="Eliminar condicion"
                >
                  &#128465;
                </button>
              </div>
            ))}
            {alertForm.conditions.map((condition, index) => {
              if (!['project', 'issuetype', 'status'].includes(condition.field)) return null;
              const catalogKey = condition.field === 'project' ? 'projects' : condition.field === 'issuetype' ? 'issueTypes' : 'statuses';
              const options = (jiraCatalog?.[catalogKey] ?? []).map((item) => typeof item === 'string' ? { value: item, label: item } : item);
              if (options.length === 0) return null;
              return <datalist id={`jira-catalog-${condition.field}-${index}`} key={`catalog-${condition.field}-${index}`}>
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </datalist>;
            })}
            <button
              type="button"
              className="jql-add"
              onClick={() => setAlertForm((current) => ({
                ...current,
                conditions: [...current.conditions, { field: 'status', operator: '=', value: '' }],
              }))}
            >
              + Agregar condicion
            </button>
          </div>
          <div className="alert-message-builder">
            <div className="alert-message-insert">
              <span>Agregar información de la BD</span>
              {!messageBuilderExpanded ? (
                <button type="button" className="jql-add" onClick={() => setMessageBuilderExpanded(true)}>
                  + Agregar dato
                </button>
              ) : (
                <>
                  <select value={messageIssueType} onChange={(event) => setMessageIssueType(event.target.value)}>
                    <option value="">Tipo de incidencia</option>
                    {graphIssueTypes.map((issueType) => (
                      <option value={issueType} key={issueType}>{issueType}</option>
                    ))}
                  </select>
                  <select value={messageField} onChange={(event) => setMessageField(event.target.value)}>
                    {Object.entries(alertMessageFields).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                  <button type="button" className="jql-add" onClick={insertAlertMessageField} disabled={!messageIssueType}>
                    + Insertar dato
                  </button>
                </>
              )}
            </div>
            <label>
              Texto del Toast
              <textarea
                ref={alertToastInputRef}
                value={alertForm.toastText}
                onChange={(event) => setAlertForm((current) => ({ ...current, toastText: event.target.value }))}
                rows={3}
                placeholder="Hay criterios pendientes. Responsable: "
              />
            </label>
            <small className="alert-message-help">Puedes combinar texto libre y varios datos de la BD en el orden que prefieras.</small>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={handleSaveAlert} disabled={alertSaving}>
              {alertSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          </div> : null}
          {newAlertOpen ? (
            <div className="new-alert-panel">
              <div className="alert-accordion-header">
                <span className="alert-accordion-chevron is-open" aria-hidden="true" />
                <h3>{alertForm.name.trim() || 'Nueva alerta'}</h3>
                <span className={`alert-rule-status${alertForm.isActive ? ' is-active' : ''}`}>
                  {alertForm.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              {renderAlertForm(true)}
            </div>
          ) : null}
          {alertRules.length > 0 ? (
            <div className="saved-alerts">
              {alertRules.map((rule) => (
                <div className="saved-alert-accordion" key={rule.id}>
                  <div
                    className="saved-alert saved-alert-toggle"
                    onClick={() => {
                      if (expandedAlertId === rule.id) {
                        setExpandedAlertId(null);
                      } else {
                        handleEditAlert(rule);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        if (expandedAlertId === rule.id) {
                          setExpandedAlertId(null);
                        } else {
                          handleEditAlert(rule);
                        }
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedAlertId === rule.id}
                  >
                    <span className="alert-accordion-chevron" aria-hidden="true" />
                    <span className="saved-alert-name">{rule.name}</span>
                    <span className={`alert-rule-status${rule.is_active ? ' is-active' : ''}`}>
                      {rule.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                    <span className="alert-accordion-end-chevron" aria-hidden="true" />
                  </div>
                  {expandedAlertId === rule.id ? renderAlertForm(false) : null}
                </div>
              ))}
            </div>
          ) : !newAlertOpen ? <p className="alerts-rules-empty">Aún no hay alertas configuradas.</p> : null}
        </div>

        <div className="settings-card dashboard-card dashboard-jql">
          <h2>Consultas JQL</h2>
          <p className="copy">Cada consulta se ejecuta en cada sincronización. Puedes escribirla en varias líneas.</p>
          <div className="jql-list">
            {jqlQueries.map((query, index) => (
              <div className="jql-row" key={`jql-${index}`}>
                <div className="jql-editor-shell">
                  <span className="jql-line-numbers" aria-hidden="true">
                    {(query || ' ').split('\n').map((_, lineIndex) => <i key={lineIndex}>{lineIndex + 1}</i>)}
                  </span>
                  <AutoResizeTextarea
                    value={query}
                    onChange={(event) => {
                      jqlDirtyRef.current = true;
                      setJqlQueries((current) => current.map((item, currentIndex) => (
                        currentIndex === index ? event.target.value : item
                      )));
                    }}
                    spellCheck="false"
                    placeholder="project = ABC ORDER BY created DESC"
                    aria-label={`Consulta JQL ${index + 1}`}
                  />
                </div>
                <button
                  type="button"
                  className="jql-delete"
                  onClick={() => handleRemoveJql(index)}
                  aria-label={`Eliminar consulta JQL ${index + 1}`}
                  title="Eliminar consulta"
                >
                  <LineIcon name="trash" />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="jql-add unified-add-button" onClick={handleAddJql}>
            <LineIcon name="plus" />
            Agregar JQL
          </button>
          <div className="jql-sync-settings">
            <label className="settings-toggle jql-auto-sync-toggle">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={handleAutoSyncToggle}
              />
              <span className="jql-switch-control" aria-hidden="true" />
              <span className="jql-toggle-label">Sincronización automática</span>
            </label>
            <div className="jql-sync-footer">
              <div className="sync-interval-row">
                <label htmlFor="sync-interval-minutes">Cada</label>
                <input
                  id="sync-interval-minutes"
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  value={syncIntervalMinutes}
                  onChange={(event) => {
                    syncIntervalDirtyRef.current = true;
                    setSyncIntervalMinutes(event.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  onFocus={() => { syncIntervalDirtyRef.current = true; }}
                />
                <span>minutos</span>
              </div>
              <div className="settings-actions">
                <button type="button" className="save-action-button" onClick={handleSaveJql} disabled={jqlSaving}>
                  <LineIcon name="save" />
                  {jqlSaving ? 'Guardando...' : 'Guardar'}
                </button>
                {jqlMessage ? <span className="settings-message">{jqlMessage}</span> : null}
              </div>
            </div>
          </div>
        </div>
        {renderGridConfiguration()}
        </fieldset>

        <div className="settings-card dashboard-card dashboard-sql">
          <h2>Consulta SQL temporal</h2>
          <p className="copy">Solo permite SELECT, UPDATE y DELETE sobre la BD local. No modifica Jira. Selecciona una consulta para ejecutarla.</p>
          <div className="sql-query-list">
            {sqlQueries.map((query, index) => (
              <div className={`sql-query-row${selectedSqlIndex === index ? ' is-selected' : ''}`} key={`sql-query-${index}`}>
                <label className="sql-query-select">
                  <input
                    type="radio"
                    name="selected-sql-query"
                    checked={selectedSqlIndex === index}
                    onChange={() => setSelectedSqlIndex(index)}
                    aria-label={`Seleccionar consulta SQL ${index + 1}`}
                  />
                  <span>SQL {index + 1}</span>
                </label>
                <textarea
                  value={query}
                  onFocus={() => setSelectedSqlIndex(index)}
                  readOnly={syncInProgress}
                  onChange={(event) => {
                    const next = [...sqlQueries];
                    next[index] = event.target.value;
                    setSqlQueries(next);
                  }}
                  rows={4}
                  spellCheck="false"
                  aria-label={`Consulta SQL ${index + 1}`}
                />
                <button
                  type="button"
                  className="sql-query-delete"
                  onClick={() => {
                    if (sqlQueries.length === 1) return;
                    const next = sqlQueries.filter((_, queryIndex) => queryIndex !== index);
                    setSqlQueries(next);
                    setSelectedSqlIndex(Math.min(selectedSqlIndex, next.length - 1));
                  }}
                  disabled={sqlQueries.length === 1 || syncInProgress}
                  aria-label={`Eliminar consulta SQL ${index + 1}`}
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="sql-query-add unified-add-button"
            disabled={syncInProgress}
            onClick={() => {
              setSqlQueries([...sqlQueries, 'SELECT key, issuetype, status FROM JIRA_ISSUES LIMIT 20']);
              setSelectedSqlIndex(sqlQueries.length);
            }}
          >
            <LineIcon name="plus" />
            Agregar consulta SQL
          </button>
          <div className="settings-actions">
            <button
              type="button"
              onClick={handleExecuteSql}
              disabled={sqlExecuting || (syncInProgress && !/^select\b/i.test((sqlQueries[selectedSqlIndex] ?? '').trim()))}
            >
              {sqlExecuting ? 'Ejecutando...' : 'Ejecutar SQL'}
            </button>
            <button
              type="button"
              className="action-database-reset"
              onClick={handleDatabaseReset}
              disabled={databaseResetting || syncInProgress}
            >
              <LineIcon name="database" />
              <span>{databaseResetting ? 'Borrando BD...' : 'Borrar BD'}</span>
            </button>
          </div>
          {sqlResult ? <pre className="sql-result">{JSON.stringify(sqlResult, null, 2)}</pre> : null}
        </div>

        {uiToast ? (
          <div className={`ui-toast ui-toast-${uiToast.type}`} role="status" aria-live="polite">
            {uiToast.message}
          </div>
        ) : null}
        {sessionToast ? (
          <div className={`toast-banner dashboard-toast ${sessionToastType === 'success' ? 'toast-success' : 'toast-warning'}`}>
            <span>{sessionToast}</span>
            {sessionToastType === 'warning' ? (
              <button type="button" onClick={handleLogin} disabled={loginInProgress || syncInProgress}>
                {loginInProgress ? 'Esperando inicio de sesion...' : 'Iniciar sesion'}
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="status-card dashboard-card dashboard-status">
          <div className="status-summary-card">
          <h2>Estado de la aplicación</h2>
          <dl className="status-grid">
            <div>
              <span className="status-row-icon"><LineIcon name="pulse" /></span>
              <dt>Estado app</dt>
              <dd className={`${syncInProgress ? 'sync-status-pulsing ' : ''}${appState === 'ready' ? 'status-value-positive' : ''}`}>{appStateLabel}</dd>
            </div>
            <div>
              <span className="status-row-icon"><LineIcon name="sync" /></span>
              <dt>Sincronizacion</dt>
              <dd className={`${syncInProgress ? 'sync-status-pulsing ' : ''}${sessionExpired ? 'session-required sync-status-pulsing ' : ''}${!sessionExpired && syncStatus?.last_status === 'Sincronizado correctamente.' ? 'status-value-positive' : ''}`}>
                {sessionExpired ? 'Inicie sesión en Jira' : (syncStatus?.last_status ?? 'Cargando...')}
              </dd>
            </div>
            <div>
              <span className="status-row-icon"><LineIcon name="clock" /></span>
              <dt>Proxima sincronizacion automatica</dt>
              <dd className={syncInProgress ? 'sync-status-pulsing' : ''}>
                {syncInProgress
                  ? 'Sincronizando...'
                  : autoSyncEnabled
                    ? formatCountdown(syncStatus?.next_sync_at, countdownNow)
                    : 'Apagada'}
              </dd>
            </div>
            <div>
              <span className="status-row-icon"><LineIcon name="shield" /></span>
              <dt>Sesion</dt>
              <dd className={sessionIsValid ? 'status-value-positive' : ''}>{sessionIsValid ? 'Valida' : 'Requiere login'}</dd>
            </div>
            <div>
              <span className="status-row-icon"><LineIcon name="calendar" /></span>
              <dt>Inicio</dt>
              <dd>{formatBogotaDate(syncStatus?.last_started_at)}</dd>
            </div>
            <div>
              <span className="status-row-icon"><LineIcon name="flag" /></span>
              <dt>Fin</dt>
              <dd>{formatBogotaDate(syncStatus?.last_finished_at)}</dd>
            </div>
          </dl>

          <div className="status-sync-settings">
            <label className="settings-toggle status-auto-sync-toggle">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={handleAutoSyncToggle}
              />
              <span className="status-switch-control" aria-hidden="true" />
              <span className="status-toggle-label">Sincronización automática</span>
              <span className="status-toggle-interval-prefix">cada</span>
                <input
                  id="status-sync-interval-minutes"
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  value={syncIntervalMinutes}
                  onChange={(event) => {
                    syncIntervalDirtyRef.current = true;
                    setSyncIntervalMinutes(event.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  onFocus={() => { syncIntervalDirtyRef.current = true; }}
                />
                <span>minutos</span>
            </label>
            {jqlMessage ? <span className="status-sync-message">{jqlMessage}</span> : null}
          </div>

          <div className={`actions ${appState === 'auth_required' || !sessionIsValid ? 'actions-with-login' : 'actions-ready'}`}>
            <button
              type="button"
              className={syncInProgress ? 'sync-button is-syncing' : 'sync-button'}
              onClick={handleSync}
              disabled={syncCanceling}
            >
              <LineIcon name="sync" />
              {syncInProgress ? (
                <span>
                  {syncCanceling ? 'Deteniendo sincronización...' : 'Detener sincronización'}
                </span>
              ) : <span>Sincronizar</span>}
            </button>
            <button className="action-shutdown" type="button" onClick={handleShutdown} disabled={shutdownRequested || syncInProgress}>
              <LineIcon name="power" />
              <span>{shutdownRequested ? 'Deteniendo servicios...' : 'Detener app'}</span>
            </button>
            <button className="action-save save-action-button" type="button" onClick={handleSaveJql} disabled={jqlSaving || syncInProgress}>
              <LineIcon name="save" />
              <span>{jqlSaving ? 'Guardando...' : 'Guardar'}</span>
            </button>
            {appState === 'auth_required' || !sessionIsValid ? (
              <button className="action-login" type="button" onClick={handleLogin} disabled={loginInProgress || syncInProgress}>
                {loginInProgress ? 'Esperando inicio de sesion...' : 'Iniciar sesion'}
              </button>
            ) : null}
          </div>
          </div>

          <div className="alerts-panel">
            <div className="alerts-header">
              <div className="alerts-heading">
                <h3>Alertas no leídas</h3>
                <label className="alerts-toggle alerts-retry-toggle">
                  <input
                    type="checkbox"
                    checked={alertRetryEnabled}
                    onChange={handleAlertRetryToggle}
                    disabled={alertRetrySaving}
                  />
                  <span className="alerts-switch-control" aria-hidden="true" />
                  <span className="alerts-retry-label">Reenvío de Toast</span>
                  <small>{alertRetryEnabled ? 'Activo' : 'Apagado'}</small>
                </label>
              </div>
              <span className="alerts-badge">{alertsSummary?.unreadCount ?? 0}</span>
            </div>
            {Array.isArray(alertsSummary?.unreadAlerts) && alertsSummary.unreadAlerts.length > 0 ? (
              <ul className="alerts-list">
                {alertsSummary.unreadAlerts.map((alert) => (
                  <li key={alert.id} className="alerts-item">
                    {(alert.toast_image || alert.issuetype_icon_url) ? (
                      <img
                        className="alerts-item-image"
                        src={alert.toast_image ? backendAssetUrl(alert.toast_image) : alert.issuetype_icon_url}
                        alt=""
                        width="30"
                        height="30"
                      />
                    ) : null}
                    <span className="alerts-item-message">
                      {renderAlertMessage(
                        alert.toast_message || alert.toast_text || alert.rule_name || 'Nueva alerta de Jira',
                        jiraBaseUrl,
                      )}
                      {Number(alert.retry_minutes ?? 0) > 0 ? (
                        <small className="alerts-retry-countdown">
                          Proximo Toast: {alertRetryEnabled
                            ? (formatAlertRetryCountdown(alert, countdownNow) ?? 'pendiente')
                            : 'reenvio de toast apagado'}
                        </small>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="alerts-read-button"
                      onClick={() => handleReadAlert(alert.id)}
                      aria-label="Marcar alerta como leida"
                      title="Marcar como leida"
                    >
                      &#10003;
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="alerts-empty">No hay alertas pendientes.</p>
            )}
          </div>

        </div>
        </div>
        </div>
        </div> : renderGridTab()}
      </section>
    </main>
  );
}
