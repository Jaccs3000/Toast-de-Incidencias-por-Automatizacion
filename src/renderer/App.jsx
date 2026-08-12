import { useEffect, useRef, useState } from 'react';

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

function formatAlertRetryCountdown(alert, now = Date.now()) {
  const retryMinutes = Number(alert?.retry_minutes ?? 0);
  if (!alert?.last_notified_at || retryMinutes <= 0) {
    return null;
  }

  const retryDueAt = new Date(alert.last_notified_at).getTime() + retryMinutes * 60000;
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
  issuetype: 'Tipo',
  status: 'Estado',
  assignee: 'Responsable',
  project: 'Proyecto',
};

const alertOperators = {
  '=': 'es igual',
  '<>': 'distinto de',
  LIKE: 'contiene',
};

const alertMessageFields = {
  key: 'Clave',
  summary: 'Resumen',
  issuetype: 'Tipo',
  status: 'Estado',
  assignee: 'Responsable',
  reporter: 'Reportero',
  project: 'Proyecto',
  created: 'Fecha de creación',
  updated: 'Fecha de actualización',
  parent: 'Incidencia padre',
  timeestimate: 'Estimación',
  timespent: 'Tiempo empleado',
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

function buildAlertSql(alertForm) {
  const eventExpression = `c.change_type = ${sqlText(alertForm.event)}`;
  const conditionExpressions = [];
  alertForm.conditions
    .filter((condition) => condition.value.trim())
    .forEach((condition, index) => {
      const field = normalizedSqlTextExpression(
        `COALESCE(json_extract_string(c.after_json, '$.${condition.field}'), json_extract_string(c.before_json, '$.${condition.field}'))`,
      );
      const normalizedValue = normalizedSqlValue(condition.value);
      const usesContains = condition.operator === 'LIKE'
        || (condition.field === 'assignee' && condition.operator === '=');
      const value = usesContains
        ? condition.field === 'assignee'
          ? condition.value.trim().split(/\s+/).map((token) => (
            `${field} LIKE '%' || ${normalizedSqlValue(token)} || '%'`
          )).join(' AND ')
          : `${field} LIKE '%' || ${normalizedValue} || '%'`
        : `${field} ${condition.operator} ${normalizedValue}`;
      const connector = index === 0 ? '' : (condition.connector || 'AND');
      conditionExpressions.push({ connector, value });
    });

  const expressions = [eventExpression];
  if (conditionExpressions.length > 0) {
    expressions.push(`(${conditionExpressions.map(({ connector, value }) => `${connector ? `${connector} ` : ''}${value}`).join(' ')})`);
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

function parseStoredAlertRule(rule) {
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
  })).filter((condition) => alertFieldLabels[condition.field]).map((condition, index) => ({
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
  const alertsInitializedRef = useRef(false);
  const servicesStoppedRef = useRef(false);
  const jqlInitializedRef = useRef(false);
  const jqlDirtyRef = useRef(false);

  const syncStatus = bootstrapContext?.syncStatus ?? null;
  const session = bootstrapContext?.session ?? null;
  const appState = bootstrapContext?.appState ?? 'booting';
  const sessionIsValid = Boolean(session?.ok);
  const syncInProgress = manualSyncInProgress || Boolean(syncStatus?.is_running) || appState === 'syncing';
  const syncCanceling = Boolean(syncStatus?.is_canceling);

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
      window.focus();
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
    if (typeof context?.autoSyncEnabled === 'boolean') {
      setAutoSyncEnabled(context.autoSyncEnabled);
    }
    if (Number.isFinite(Number(context?.syncIntervalMinutes))) {
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
    const alertsToShow = alertsInitializedRef.current
      ? unreadAlerts.filter((alert) => {
        if (!knownAlerts.has(alert.id)) {
          return true;
        }

        const previousNotifiedAt = knownAlerts.get(alert.id);
        return Boolean(
          alert.last_notified_at
          && previousNotifiedAt
          && new Date(alert.last_notified_at).getTime() > new Date(previousNotifiedAt).getTime(),
        );
      })
      : [];
    enqueueAlertNotifications(alertsToShow);
    knownAlertNotifiedAtRef.current = new Map(
      unreadAlerts.map((alert) => [alert.id, alert.last_notified_at ?? null]),
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
    const countdownHandle = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(countdownHandle);
  }, []);

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
    const validConditions = alertForm.conditions.filter((condition) => condition.value.trim());
    if (!alertForm.name.trim() || !alertForm.toastText.trim() || validConditions.length === 0) {
      setJqlMessage('La alerta requiere nombre, texto de Toast y al menos una condicion con valor.');
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
    const stored = parseStoredAlertRule(rule);
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
                      : item.operator,
                  }
                  : item),
              }))}
            >
              {Object.entries(alertFieldLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
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
              {Object.entries(alertOperators).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
            <input
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
          </div>
        ))}
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
    setAutoSyncEnabled(nextValue);
    setAutoSyncSaving(true);

    try {
      const result = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ autoSyncEnabled: nextValue }),
      });
      setAutoSyncEnabled(Boolean(result.autoSyncEnabled));
      showUiToast('Sincronización automática actualizada.');
    } catch (error) {
      setAutoSyncEnabled(!nextValue);
      setJqlMessage(`No se pudo cambiar la sincronizacion automatica: ${error.message}`);
    } finally {
      setAutoSyncSaving(false);
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
        <div className="dashboard-grid">
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
                          : item.operator,
                      }
                      : item),
                  }))}
                >
                  {Object.entries(alertFieldLabels).map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
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
                  {Object.entries(alertOperators).map(([value, label]) => (
                    <option value={value} key={value}>{label}</option>
                  ))}
                </select>
                <input
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
              onChange={(event) => setSyncIntervalMinutes(event.target.value)}
            />
            <span>minutos</span>
            <button type="button" onClick={handleSyncIntervalSave} disabled={syncIntervalSaving}>
              {syncIntervalSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
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
              <h3>Alertas</h3>
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
                          Proximo Toast: {autoSyncEnabled
                            ? (formatAlertRetryCountdown(alert, countdownNow) ?? 'pendiente')
                            : 'sincronizacion automatica apagada'}
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
      </section>
    </main>
  );
}
