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
  const [isLoading, setIsLoading] = useState(true);
  const [startupError, setStartupError] = useState(null);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [shutdownRequested, setShutdownRequested] = useState(false);
  const [servicesStopped, setServicesStopped] = useState(false);
  const [jqlQueries, setJqlQueries] = useState([]);
  const [jqlSaving, setJqlSaving] = useState(false);
  const [jqlMessage, setJqlMessage] = useState(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [autoSyncSaving, setAutoSyncSaving] = useState(false);
  const [alertRetryEnabled, setAlertRetryEnabled] = useState(true);
  const [alertRetrySaving, setAlertRetrySaving] = useState(false);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState(5);
  const [syncIntervalSaving, setSyncIntervalSaving] = useState(false);
  const [databaseResetting, setDatabaseResetting] = useState(false);
  const [sqlQueries, setSqlQueries] = useState(['SELECT key, issuetype, status FROM JIRA_ISSUES LIMIT 20']);
  const [selectedSqlIndex, setSelectedSqlIndex] = useState(0);
  const [sqlResult, setSqlResult] = useState(null);
  const [sqlExecuting, setSqlExecuting] = useState(false);
  const [sessionToast, setSessionToast] = useState(null);
  const [sessionToastType, setSessionToastType] = useState('warning');
  const [alertToast, setAlertToast] = useState(null);
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
  const [activeTab, setActiveTab] = useState('config');
  const [grids, setGrids] = useState([]);
  const [gridFormOpen, setGridFormOpen] = useState(false);
  const [gridForm, setGridForm] = useState({
    id: null,
    name: '',
    pageSize: 25,
    columns: [{ issueType: '', field: '' }],
    conditions: [],
  });
  const [gridData, setGridData] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridPage, setGridPage] = useState(1);
  const [draggedGridColumnIndex, setDraggedGridColumnIndex] = useState(null);
  const [gridValidationShown, setGridValidationShown] = useState(false);
  const [openGridAttributeGroup, setOpenGridAttributeGroup] = useState(null);
  const [draggedGridAttribute, setDraggedGridAttribute] = useState(null);

  const syncStatus = bootstrapContext?.syncStatus ?? null;
  const session = bootstrapContext?.session ?? null;
  const appState = bootstrapContext?.appState ?? 'booting';
  const sessionIsValid = Boolean(session?.ok);
  const syncInProgress = manualSyncInProgress || Boolean(syncStatus?.is_running) || appState === 'syncing';
  const syncCanceling = Boolean(syncStatus?.is_canceling);
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

  const gridFieldOptions = [
    { field: 'estadoGeneral', label: 'Estado General', projectGroup: true },
    ...conditionFields.map((field) => ({ field: field.field, label: field.label })),
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
      if (!['IS NULL', 'IS NOT NULL'].includes(condition.operator) && !String(condition.value ?? '').trim()) errors.push(`Condicion ${index + 1}: debes indicar un valor.`);
      return errors;
    }),
    !Number.isInteger(Number(gridForm.pageSize)) || Number(gridForm.pageSize) < 1 || Number(gridForm.pageSize) > 200
      ? 'Los registros por pagina deben estar entre 1 y 200.' : null,
  ].filter(Boolean);

  const refreshGrids = async () => {
    const result = await api('/api/grids');
    setGrids(result.grids ?? []);
    return result.grids ?? [];
  };

  const refreshGridData = async (id = activeTab, page = gridPage) => {
    if (!id || id === 'config') return;
    setGridLoading(true);
    try {
      const result = await api(`/api/grids/${encodeURIComponent(id)}/data?page=${page}`);
      setGridData(result);
    } catch (error) {
      showUiToast(`No se pudo cargar el grid: ${error.message}`, 'error');
    } finally {
      setGridLoading(false);
    }
  };

  const resetGridForm = () => setGridForm({
    id: null,
    name: '',
    pageSize: 25,
    columns: [{ issueType: '', field: '' }],
    conditions: [],
  });

  const handleNewGrid = () => {
    resetGridForm();
    setGridValidationShown(false);
    setGridFormOpen(true);
  };

  const handleEditGrid = (grid) => {
    setGridForm({ ...grid, columns: grid.columns ?? [], conditions: grid.conditions ?? [] });
    setGridValidationShown(false);
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
      const saved = (result.grids ?? []).find((grid) => grid.name === gridForm.name.trim());
      if (saved) setActiveTab(saved.id);
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
      refreshGridData(activeTab, gridPage);
    }
  }, [activeTab, gridPage, bootstrapContext?.syncStatus?.last_success_at]);

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

    setJqlSaving(true);
    setJqlMessage(null);

    try {
      const result = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ jqlQueries: queries }),
      });
      setJqlQueries(result.jqlQueries ?? queries);
      jqlDirtyRef.current = false;
      setJqlMessage('JQL guardado correctamente.');
      showUiToast('JQL guardado correctamente.');
    } catch (error) {
      setJqlMessage(`No se pudo guardar el JQL: ${error.message}`);
    } finally {
      setJqlSaving(false);
    }
  };

  const handleAlertImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.toLowerCase().split('.').pop();
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedExtensions.includes(extension)
      || (file.type && !allowedTypes.includes(file.type))
      || file.size > 2 * 1024 * 1024) {
      setJqlMessage('La imagen debe ser PNG, JPG, JPEG o WEBP y no superar 2 MB.');
      event.target.value = '';
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

  const handleSaveAlert = async () => {
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
    setJqlMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewAlert = () => {
    setAlertForm(emptyAlertForm());
    setMessageBuilderExpanded(false);
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
    setAlertImageData(null);
    setAlertImageName('');
    setAlertImageUrl(null);
    setAlertImageRemoved(false);
    setNewAlertOpen(false);
    setExpandedAlertId(null);
    setJqlMessage(null);
  };

  const renderAlertForm = (isNew) => (
    <div className="alert-builder-form">
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
        {alertValidation.errors.length > 0 ? (
          <div className="alert-validation-errors" role="alert">
            {alertValidation.errors.map((error) => <div key={error}>{error}</div>)}
          </div>
        ) : null}
        {alertForm.conditions.map((condition, index) => (
          <div key={`condition-${index}`}>
            {index > 0 ? (
              <select
                className="condition-connector-row"
                value={condition.connector || 'AND'}
                onChange={(event) => setAlertForm((current) => ({
                  ...current,
                  conditions: current.conditions.map((item, itemIndex) => itemIndex === index
                    ? { ...item, connector: event.target.value }
                    : item),
                }))}
                aria-label={`Conector de la condicion ${index + 1}`}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            ) : null}
            <div className="condition-row">
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
            {renderConditionValueControl(condition, index)}
            {false && <input
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
            />}
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
          </div>
        ))}
        {alertForm.conditions.map((condition, index) => {
          if (!['project', 'issuetype', 'status'].includes(condition.field)) return null;
          const catalogKey = condition.field === 'project' ? 'projects' : condition.field === 'issuetype' ? 'issueTypes' : 'statuses';
          const options = (jiraCatalog?.[catalogKey] ?? []).map((item) => typeof item === 'string' ? { value: item, label: item } : item);
          if (options.length === 0) return null;
          return (
            <datalist id={`jira-catalog-${condition.field}-${index}`} key={`catalog-${condition.field}-${index}`}>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </datalist>
          );
        })}
        <button
          type="button"
          className="jql-add"
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
      <div className="alert-image-field">
        <label htmlFor="alert-image-input">Imagen del Toast</label>
        <input
          id="alert-image-input"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
          onChange={handleAlertImageChange}
        />
        {alertImageData ? <small className="alert-image-selected">Imagen seleccionada: {alertImageName}</small> : null}
        {(alertImageData || alertImageUrl) ? (
          <div className="alert-image-preview">
            <img src={alertImageData || backendAssetUrl(alertImageUrl)} alt="Vista previa de la imagen del Toast" />
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setAlertImageData(null);
                setAlertImageName('');
                setAlertImageUrl(null);
                setAlertImageRemoved(true);
              }}
            >
              Eliminar imagen
            </button>
          </div>
        ) : null}
      </div>
      <div className="settings-actions">
        <button type="button" onClick={handleSaveAlert} disabled={alertSaving}>
          {alertSaving ? 'Guardando...' : (isNew ? 'Guardar alerta' : 'Guardar cambios')}
        </button>
        <button type="button" className="secondary-button" onClick={handleCancelAlert} disabled={alertSaving}>
          Cancelar
        </button>
        {!isNew ? (
          <button
            type="button"
            className="danger-button"
            onClick={() => handleDeleteAlert(alertForm.id)}
            disabled={alertSaving}
          >
            Eliminar alerta
          </button>
        ) : null}
      </div>
    </div>
  );

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

  const handleAutoSyncToggle = async (event) => {
    const nextValue = event.target.checked;
    autoSyncDirtyRef.current = true;
    setAutoSyncEnabled(nextValue);
    setAutoSyncSaving(true);

    try {
      const result = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ autoSyncEnabled: nextValue }),
      });
      autoSyncDirtyRef.current = false;
      setAutoSyncEnabled(Boolean(result.autoSyncEnabled));
      showUiToast('Sincronización automática actualizada.');
    } catch (error) {
      autoSyncDirtyRef.current = false;
      setAutoSyncEnabled(!nextValue);
      setJqlMessage(`No se pudo cambiar la sincronizacion automatica: ${error.message}`);
    } finally {
      setAutoSyncSaving(false);
    }
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

  const handleSyncIntervalSave = async () => {
    const minutes = Number(syncIntervalMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) {
      setJqlMessage('El intervalo debe ser de al menos 1 minuto.');
      return;
    }

    setSyncIntervalSaving(true);
    try {
      const result = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ syncIntervalMinutes: minutes }),
      });
      syncIntervalDirtyRef.current = false;
      setSyncIntervalMinutes(Number(result.syncIntervalMinutes ?? minutes));
      setJqlMessage('Intervalo de sincronizacion guardado correctamente.');
      showUiToast('Intervalo de sincronización guardado.');
    } catch (error) {
      setJqlMessage(`No se pudo guardar el intervalo: ${error.message}`);
    } finally {
      setSyncIntervalSaving(false);
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

  const renderGridConfiguration = () => (
    <div className="settings-card dashboard-card dashboard-grids">
      <div className="section-heading">
        <div>
          <h2>{gridFormOpen ? 'Crear grid' : 'Grids configurados'}</h2>
          <p className="copy">Crea pestañas con una fila por ProjectGroup y los campos que necesites consultar.</p>
        </div>
        <button type="button" className="primary-button" onClick={handleNewGrid} disabled={syncInProgress}>
          Nuevo grid
        </button>
      </div>
      {gridFormOpen ? (
        <div className="grid-builder-form">
          <div className="grid-builder-title">
            <h3>{gridForm.id ? 'Editar grid' : 'Nuevo grid'}</h3>
            <button type="button" className="secondary-button" onClick={() => setGridFormOpen(false)}>Cancelar</button>
          </div>
          {gridValidationShown && gridValidationErrors.length > 0 ? (
            <div className="alert-validation-errors grid-validation-errors" role="alert">
              {gridValidationErrors.map((error) => <div key={error}>{error}</div>)}
            </div>
          ) : null}
          <label>
            Nombre de la pestaña
            <input value={gridForm.name} onChange={(event) => setGridForm((current) => ({ ...current, name: event.target.value }))} placeholder="Seguimiento QA" />
          </label>
          <div className="grid-builder-section grid-fields-section">
            <h3>Campos a mostrar</h3>
            {gridColumnGroups.map(([groupKey, groupColumns], index) => {
              const groupType = groupKey === '__other' ? '__projectGroup' : groupKey;
              const selectedFields = groupColumns.filter((column) => column.field).map((column) => column.field);
              const attributeOptions = groupKey === '__other'
                ? [{ field: 'estadoGeneral', label: 'Estado General' }]
                : conditionFields;
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
                  <button type="button" className="jql-delete" disabled={gridColumnGroups.length === 1} onClick={() => setGridForm((current) => ({ ...current, columns: current.columns.filter((column) => gridColumnGroupKey(column) !== groupKey) }))} aria-label="Eliminar tipo de incidencia">&#128465;</button>
                </div>
              );
            })}
            <button type="button" className="jql-add" onClick={() => setGridForm((current) => ({ ...current, columns: [...current.columns, { issueType: '', field: '' }] }))}>+ Agregar tipo de incidencia</button>
          </div>
          <div className="grid-builder-section grid-conditions-section">
            <h3>Condiciones</h3>
            {gridForm.conditions.map((condition, index) => (
              <div className={`grid-builder-row${index > 0 ? ' has-connector' : ''}`} key={`grid-condition-${index}`}>
                <select value={condition.issueType ?? ''} disabled={condition.field === 'estadoGeneral'} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, issueType: event.target.value } : item) }))}>
                  {gridIssueTypes.map((type) => <option value={type} key={type}>{type}</option>)}
                  <option value="">Otros</option>
                </select>
                <select value={condition.field} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, field: event.target.value, issueType: event.target.value === 'estadoGeneral' ? null : item.issueType } : item) }))}>
                  {gridFieldOptions.map((field) => <option value={field.field} key={field.field}>{field.label}</option>)}
                </select>
                {index > 0 ? <select value={condition.connector ?? 'AND'} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, connector: event.target.value } : item) }))}><option value="AND">AND</option><option value="OR">OR</option></select> : null}
                <select value={condition.operator} onChange={(event) => setGridForm((current) => ({ ...current, conditions: current.conditions.map((item, itemIndex) => itemIndex === index ? { ...item, operator: event.target.value } : item) }))}>
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
                <button type="button" className="jql-delete" onClick={() => setGridForm((current) => ({ ...current, conditions: current.conditions.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Eliminar condicion">&#128465;</button>
              </div>
            ))}
            <button type="button" className="jql-add" onClick={() => setGridForm((current) => ({ ...current, conditions: [...current.conditions, { issueType: gridIssueTypes[0] ?? '', field: 'status', operator: '=', value: '', connector: current.conditions.length ? 'AND' : undefined }] }))}>+ Agregar condicion</button>
          </div>
          <label className="grid-page-size">Registros por pagina
            <input type="number" min="1" max="200" value={gridForm.pageSize} onChange={(event) => setGridForm((current) => ({ ...current, pageSize: event.target.value }))} />
          </label>
          <div className="settings-actions"><button type="button" onClick={handleSaveGrid}>Guardar {gridForm.id ? 'cambios' : 'grid'}</button></div>
        </div>
      ) : null}
      <div className="grid-configured-list">
        <h3>Grids configurados</h3>
        {grids.length === 0 ? <p className="copy">No hay grids configurados.</p> : grids.map((grid) => (
          <div className="grid-configured-row" key={grid.id}>
            <button type="button" className="grid-configured-name" onClick={() => handleEditGrid(grid)}>{grid.name}</button>
            <button type="button" className="secondary-button" onClick={() => handleEditGrid(grid)}>Editar</button>
            <button type="button" className="danger-button" onClick={() => handleDeleteGrid(grid.id)}>Eliminar</button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGridTab = () => {
    const columns = gridData?.grid?.columns ?? [];
    const columnGroups = columns.reduce((groups, column) => {
      const groupKey = column.issueType || `__other::${column.field}`;
      const current = groups.get(groupKey) ?? [];
      current.push(column);
      groups.set(groupKey, current);
      return groups;
    }, new Map());
    const totalPages = Math.max(1, Math.ceil((gridData?.total ?? 0) / (gridData?.pageSize ?? 25)));
    return (
      <section className="grid-tab-view">
        <div className="grid-tab-heading"><div><p className="eyebrow">Jira Notifications</p><h1>{gridData?.grid?.name ?? grids.find((grid) => grid.id === activeTab)?.name}</h1><p className="copy">Información agrupada por ProjectGroup.</p></div><button type="button" onClick={() => refreshGridData(activeTab, gridPage)} disabled={gridLoading}>Actualizar</button></div>
        {gridLoading ? <p className="copy">Actualizando grid...</p> : null}
        <div className="grid-table-wrap"><table className="project-grid"><thead><tr>{[...columnGroups.entries()].map(([groupKey, groupColumns]) => <th key={groupKey}>{groupKey.startsWith('__other::') ? gridFieldLabel(groupColumns[0].field) : groupKey}</th>)}</tr></thead><tbody>{(gridData?.rows ?? []).map((row) => <tr key={row.projectGroupId}>{[...columnGroups.entries()].map(([groupKey, groupColumns]) => <td className="grid-group-cell" key={`${row.projectGroupId}-${groupKey}`}>{groupKey.startsWith('__other::') ? groupColumns.map((column) => <div className="grid-group-value" key={`${column.issueType}-${column.field}`}>{column.field === 'estadoGeneral' ? row.estadoGeneral : ''}</div>) : groupColumns.map((column) => { const rawValue = row[`${column.issueType}::${column.field}`] ?? ''; const value = ['reporter', 'assignee'].includes(column.field) ? compactGridPersonValues(rawValue) : rawValue; return <div className="grid-group-value" key={`${column.issueType}-${column.field}`}><strong>{gridFieldLabel(column.field)}:</strong> {value}</div>; })}</td>)}</tr>)}</tbody></table></div>
        {!gridLoading && (gridData?.rows ?? []).length === 0 ? <p className="copy">No hay ProjectGroups que cumplan las condiciones.</p> : null}
        <div className="grid-pagination"><button type="button" disabled={gridPage <= 1} onClick={() => setGridPage((page) => page - 1)}>Anterior</button><span>Pagina {gridPage} de {totalPages}</span><button type="button" disabled={gridPage >= totalPages} onClick={() => setGridPage((page) => page + 1)}>Siguiente</button></div>
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
        <nav className="app-tabs" aria-label="Navegacion de la aplicacion">
          <button type="button" className={activeTab === 'config' ? 'app-tab is-active' : 'app-tab'} onClick={() => setActiveTab('config')}>Configuracion</button>
          {grids.map((grid) => <button type="button" className={activeTab === grid.id ? 'app-tab is-active' : 'app-tab'} onClick={() => { setActiveTab(grid.id); setGridPage(1); }} key={grid.id}>{grid.name}</button>)}
        </nav>
        {activeTab === 'config' ? <div className="dashboard-grid">
        <fieldset disabled={syncInProgress} className="dashboard-editable-panels">
        <div className="settings-card dashboard-card dashboard-alert">
          <div className="section-heading">
            <button type="button" className="primary-button" onClick={handleNewAlert}>
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
              {alertSaving ? 'Guardando...' : 'Guardar alerta'}
            </button>
          </div>
          </div> : null}
          {newAlertOpen ? (
            <div className="new-alert-panel">
              <div className="alert-accordion-header">
                <h3>Nueva alerta</h3>
              </div>
              {renderAlertForm(true)}
            </div>
          ) : null}
          {alertRules.length > 0 ? (
            <div className="saved-alerts">
              <h3>Alertas configuradas</h3>
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
                    <span className="saved-alert-name">{rule.name}</span>
                    <span className="alert-accordion-chevron" aria-hidden="true">
                      {expandedAlertId === rule.id ? '⌃' : '⌄'}
                    </span>
                  </div>
                  {expandedAlertId === rule.id ? renderAlertForm(false) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="settings-card dashboard-card dashboard-jql">
          <h2>Consultas JQL</h2>
          <p className="copy">Cada consulta se ejecuta en cada sincronizacion. Puedes escribirla en varias lineas.</p>
          <div className="jql-list">
            {jqlQueries.map((query, index) => (
              <div className="jql-row" key={`jql-${index}`}>
                <textarea
                  value={query}
                  onChange={(event) => {
                    jqlDirtyRef.current = true;
                    setJqlQueries((current) => current.map((item, currentIndex) => (
                      currentIndex === index ? event.target.value : item
                    )));
                  }}
                  rows={3}
                  placeholder="project = ABC ORDER BY created DESC"
                  aria-label={`Consulta JQL ${index + 1}`}
                />
                <button
                  type="button"
                  className="jql-delete"
                  onClick={() => handleRemoveJql(index)}
                  aria-label={`Eliminar consulta JQL ${index + 1}`}
                  title="Eliminar consulta"
                >
                  &#128465;
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="jql-add" onClick={handleAddJql}>
            + Agregar JQL
          </button>
          <div className="settings-actions">
            <button type="button" onClick={handleSaveJql} disabled={jqlSaving}>
              {jqlSaving ? 'Guardando...' : 'Guardar JQL'}
            </button>
            {jqlMessage ? <span className="settings-message">{jqlMessage}</span> : null}
          </div>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={handleAutoSyncToggle}
              disabled={autoSyncSaving}
            />
            <span>Sincronizacion automatica</span>
            <small>{autoSyncEnabled ? 'Activa' : 'Apagada'}</small>
          </label>
          <div className="sync-interval-row">
            <label htmlFor="sync-interval-minutes">Cada</label>
            <input
              id="sync-interval-minutes"
              type="number"
              min="1"
              step="1"
              value={syncIntervalMinutes}
              onChange={(event) => {
                syncIntervalDirtyRef.current = true;
                setSyncIntervalMinutes(event.target.value);
              }}
              onFocus={() => { syncIntervalDirtyRef.current = true; }}
            />
            <span>minutos</span>
            <button type="button" onClick={handleSyncIntervalSave} disabled={syncIntervalSaving}>
              {syncIntervalSaving ? 'Guardando...' : 'Guardar'}
            </button>
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
            className="sql-query-add"
            disabled={syncInProgress}
            onClick={() => {
              setSqlQueries([...sqlQueries, 'SELECT key, issuetype, status FROM JIRA_ISSUES LIMIT 20']);
              setSelectedSqlIndex(sqlQueries.length);
            }}
          >
            + Agregar consulta SQL
          </button>
          <div className="settings-actions">
            <button
              type="button"
              onClick={handleExecuteSql}
              disabled={sqlExecuting || (syncInProgress && !/^select\b/i.test((sqlQueries[selectedSqlIndex] ?? '').trim()))}
            >
              {sqlExecuting ? 'Ejecutando...' : 'Ejecutar SQL'}
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
          <h2>Estado inicial</h2>
          <dl className="status-grid">
            <div>
              <dt>Estado app</dt>
              <dd className={syncInProgress ? 'sync-status-pulsing' : ''}>{appStateLabel}</dd>
            </div>
            <div>
              <dt>Sincronizacion</dt>
              <dd className={syncInProgress ? 'sync-status-pulsing' : ''}>
                {syncStatus?.last_status ?? 'Cargando...'}
              </dd>
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
              <dt>Sesion</dt>
              <dd>{sessionIsValid ? 'Valida' : 'Requiere login'}</dd>
            </div>
            <div>
              <dt>Inicio</dt>
              <dd>{formatBogotaDate(syncStatus?.last_started_at)}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{formatBogotaDate(syncStatus?.last_finished_at)}</dd>
            </div>
          </dl>

          <div className="actions">
            {appState === 'auth_required' || !sessionIsValid ? (
              <button type="button" onClick={handleLogin} disabled={loginInProgress || syncInProgress}>
                {loginInProgress ? 'Esperando inicio de sesion...' : 'Iniciar sesion'}
              </button>
            ) : null}
            <button
              type="button"
              className={syncInProgress ? 'sync-button is-syncing' : 'sync-button'}
              onClick={handleSync}
              disabled={syncCanceling}
            >
              {syncInProgress ? (
                <>
                  {syncCanceling ? 'Deteniendo sincronización...' : 'Detener sincronización'}
                </>
              ) : 'Sincronizar ahora'}
            </button>
            <button type="button" onClick={handleDatabaseReset} disabled={databaseResetting || syncInProgress}>
              {databaseResetting ? 'Borrando BD...' : 'Borrar BD local'}
            </button>
            <button type="button" onClick={handleShutdown} disabled={shutdownRequested || syncInProgress}>
              {shutdownRequested ? 'Deteniendo servicios...' : 'Detener backend y frontend'}
            </button>
          </div>

          <div className="alerts-panel">
            <div className="alerts-header">
              <div className="alerts-heading">
                <h3>Alertas</h3>
                <label className="alerts-toggle">
                  <input
                    type="checkbox"
                    checked={alertRetryEnabled}
                    onChange={handleAlertRetryToggle}
                    disabled={alertRetrySaving}
                  />
                  <span>Reenvio de Toast</span>
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
                      {alert.toast_message || alert.toast_text || alert.rule_name || 'Nueva alerta de Jira'}
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
        </div> : renderGridTab()}
      </section>
    </main>
  );
}
