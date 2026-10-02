import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { bootstrapApp } from './app/bootstrap.js';
import { saveAppConfig } from './config/configLoader.js';
import { validateAlertConditionConfig } from '../shared/alerts/alertConditionValidation.js';
import { isJiraAuthenticationSyncFailure } from '../shared/auth/sessionRequirement.js';
import { gridConditionMatches } from '../shared/grids/gridCondition.js';
import { gridRowMatchesSearch } from '../shared/grids/gridSearch.js';
import {
  SUBTASK_COUNT_FIELDS,
  SUBTASK_COUNT_ISSUE_TYPES,
  getSubtaskCountEntries,
} from '../shared/grids/subtaskCounts.js';
import {
  REPORTED_TIMES_FIELD,
  collapseReportedTimeColumns,
  getReportedTimesEntries,
  getReportedTimesSortValue,
} from '../shared/grids/reportedTimes.js';

const PORT = Number(process.env.PORT ?? 3000);
const RENDERER_DIR = path.resolve(process.cwd(), 'dist', 'renderer');
const ALERT_IMAGES_DIR = path.resolve(process.cwd(), 'data', 'alert-images');
const TIME_REPORT_EXPORTS_DIR = path.resolve(process.cwd(), 'exports');
const RESTART_LAUNCHER_PATH = path.resolve(process.cwd(), 'scripts', 'restart-app.mjs');
const JQL_SOURCE_ISSUE_OPTION = '__jql_source_issue__';
const MAX_ALERT_IMAGE_BYTES = 2 * 1024 * 1024;
const ALERT_IMAGE_TYPES = {
  png: { mime: 'image/png' },
  jpg: { mime: 'image/jpeg' },
  jpeg: { mime: 'image/jpeg' },
  webp: { mime: 'image/webp' },
};

function log(message, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.log(`[backend ${new Date().toISOString()}] ${message}${suffix}`);
}

function gridFieldValue(issue, field) {
  const values = {
    key: issue.key,
    project: issue.project,
    issuetype: issue.issuetype,
    summary: issue.summary,
    description: issue.description,
    status: issue.status,
    reporter: issue.reporter,
    assignee: issue.assignee,
    created: issue.created,
    updated: issue.updated,
    resolutiondate: issue.resolutiondate,
    parent: issue.parent,
    timeestimate: issue.timeestimate,
    timespent: issue.timespent,
    timeremaining: issue.timeremaining,
  };
  return values[field] ?? null;
}

function parseGridRow(row) {
  return {
    id: row.id,
    estadoGeneral: row.estado_general,
    issues: Array.isArray(row.issues_json)
      ? row.issues_json
      : row.issues_json ? JSON.parse(row.issues_json) : [],
  };
}

function getGridSortValue(row, column) {
  const rawValue = column.field === 'estadoGeneral'
    ? row.estadoGeneral
    : row[`${column.issueType}::${column.field}`];

  if (column.field === REPORTED_TIMES_FIELD) {
    return getReportedTimesSortValue(rawValue);
  }

  if (Array.isArray(rawValue)) {
    return rawValue.reduce((total, item) => total + (Number(item?.count) || 0), 0);
  }

  const value = String(rawValue ?? '').trim();
  if (!value) return null;
  if (['timeestimate', 'timespent', 'timeremaining'].includes(column.field)) {
    const number = Number(value.split('|')[0].trim());
    return Number.isFinite(number) ? number : null;
  }
  if (['created', 'updated', 'resolutiondate'].includes(column.field)) {
    const timestamp = new Date(value.split('|')[0].trim()).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return value;
}

function compareGridRows(left, right, column, direction) {
  const leftValue = getGridSortValue(left, column);
  const rightValue = getGridSortValue(right, column);
  const leftIsEmpty = leftValue === null || leftValue === '';
  const rightIsEmpty = rightValue === null || rightValue === '';
  if (leftIsEmpty || rightIsEmpty) {
    if (leftIsEmpty && rightIsEmpty) return String(left.projectGroupId).localeCompare(String(right.projectGroupId));
    return leftIsEmpty ? 1 : -1;
  }

  const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue), 'es', { numeric: true, sensitivity: 'base' });
  if (comparison === 0) return String(left.projectGroupId).localeCompare(String(right.projectGroupId));
  return direction === 'desc' ? -comparison : comparison;
}

function parseGridDefinition(row) {
  return {
    id: row.id,
    name: row.name,
    pageSize: Number(row.page_size) || 10,
    visible: Number(row.is_visible ?? 1) !== 0,
    columns: collapseReportedTimeColumns(JSON.parse(row.columns_json ?? '[]')),
    conditions: JSON.parse(row.conditions_json ?? '[]').map((condition) => (
      condition?.field === 'estadoGeneral' && !condition.issueType
        ? { ...condition, issueType: 'Otros' }
        : condition
    )),
    created: row.created,
    updated: row.updated,
  };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, (_, value) => (
    typeof value === 'bigint' ? Number(value) : value
  )));
}

const STATIC_CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

async function serveRenderer(req, res, pathname) {
  if (req.method !== 'GET' || pathname.startsWith('/api/') || pathname.startsWith('/alert-images/')) return false;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return false;
  }

  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const requestedFile = path.resolve(RENDERER_DIR, relativePath);
  if (requestedFile !== RENDERER_DIR && !requestedFile.startsWith(`${RENDERER_DIR}${path.sep}`)) {
    res.writeHead(403).end();
    return true;
  }

  let filePath = requestedFile;
  let body;
  try {
    body = await fs.readFile(filePath);
  } catch {
    if (path.extname(relativePath)) {
      res.writeHead(404).end();
      return true;
    }
    filePath = path.join(RENDERER_DIR, 'index.html');
    try {
      body = await fs.readFile(filePath);
    } catch {
      return false;
    }
  }

  res.writeHead(200, {
    'Content-Type': STATIC_CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': path.basename(filePath) === 'index.html' ? 'no-cache' : 'public, max-age=3600',
  });
  res.end(body);
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });

    req.on('error', reject);
  });
}

async function removeAlertImage(imageUrl) {
  if (!imageUrl) return;
  const fileName = path.basename(String(imageUrl));
  if (!fileName || fileName === '.' || fileName === path.sep) return;
  await fs.unlink(path.join(ALERT_IMAGES_DIR, fileName)).catch(() => {});
}

async function saveAlertImage(dataUrl, originalName) {
  const match = String(dataUrl ?? '').match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('La imagen debe ser PNG, JPG, JPEG o WEBP.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > MAX_ALERT_IMAGE_BYTES) {
    throw new Error('La imagen no puede superar 2 MB.');
  }

  const extension = String(originalName ?? '').toLowerCase().split('.').pop();
  const safeExtension = ALERT_IMAGE_TYPES[extension]?.mime === match[1] ? extension : (
    match[1] === 'image/png' ? 'png' : match[1] === 'image/webp' ? 'webp' : 'jpg'
  );
  const fileName = `${crypto.randomUUID()}.${safeExtension}`;
  await fs.mkdir(ALERT_IMAGES_DIR, { recursive: true });
  await fs.writeFile(path.join(ALERT_IMAGES_DIR, fileName), buffer, { flag: 'wx' });
  return `/alert-images/${fileName}`;
}

async function handleAlertImage(res, fileName) {
  const safeName = path.basename(fileName ?? '');
  const extension = safeName.toLowerCase().split('.').pop();
  const imageType = ALERT_IMAGE_TYPES[extension];
  if (!safeName || !imageType) {
    res.writeHead(404);
    res.end();
    return;
  }

  try {
    const image = await fs.readFile(path.join(ALERT_IMAGES_DIR, safeName));
    res.writeHead(200, {
      'Content-Type': imageType.mime,
      'Cache-Control': 'no-cache',
    });
    res.end(image);
  } catch {
    res.writeHead(404);
    res.end();
  }
}

function toPublicSession(session) {
  if (!session) {
    return null;
  }

  const account = session.account && typeof session.account === 'object'
    ? {
      accountId: session.account.accountId ?? session.account.accountID ?? null,
      displayName: session.account.displayName ?? session.account.name ?? null,
      emailAddress: session.account.emailAddress ?? null,
    }
    : null;

  return {
    ok: Boolean(session.ok),
    reason: session.reason ?? null,
    details: session.details ?? null,
    account: session.ok && account?.accountId && account?.displayName ? account : null,
  };
}

async function createAppState() {
  const runtime = await bootstrapApp();
  const storedSession = await runtime.auth.loadStoredSession();
  const recovery = await runtime.persistence.syncStatus.recoverInterruptedState();
  const syncStatus = recovery.status;

  if (recovery.recovered) {
    log('recovered stale synchronization state');
  }

  return {
    runtime,
    session: storedSession,
    syncStatus,
    appState: storedSession?.ok ? 'ready' : 'auth_required',
    lastSyncResult: null,
  };
}

const state = await createAppState();
let syncInProgress = false;
let syncAbortController = null;
let syncCancellationRequested = false;
let timeReportSearchInProgress = false;
let timeReportAbortController = null;
let timeReportCancellationRequested = false;
let syncTimer = null;
let alertRetryTimer = null;
let alertRetryInProgress = false;
let shuttingDown = false;
let windowsSessionState = { state: 'unknown', updatedAt: null };
let windowsLockStartedAt = null;
let windowsStateReadInProgress = false;

function stopAutoSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

async function refreshWindowsSessionState() {
  if (windowsStateReadInProgress) return windowsSessionState;
  windowsStateReadInProgress = true;
  try {
    const next = await state.runtime.windowsSession?.readState?.() ?? { state: 'unknown', updatedAt: null };
    const previous = windowsSessionState.state;
    windowsSessionState = next;

    if (previous !== 'locked' && next.state === 'locked') {
      windowsLockStartedAt = next.updatedAt ?? Date.now();
      log('Windows session locked; automatic work paused', `lockedAt=${new Date(windowsLockStartedAt).toISOString()}`);
    } else if (previous === 'locked' && next.state === 'unlocked') {
      const unlockedAt = next.updatedAt ?? Date.now();
      if (windowsLockStartedAt !== null) {
        const updated = await state.runtime.alerts.resumeUnreadRetries({ lockedAt: windowsLockStartedAt, unlockedAt });
        log('Windows session unlocked; alert countdowns resumed', `updatedAlerts=${updated}`);
      }
      windowsLockStartedAt = null;
    }
    return windowsSessionState;
  } finally {
    windowsStateReadInProgress = false;
  }
}

function isWindowsSessionUnlocked() {
  return windowsSessionState.state === 'unlocked';
}

function canRunAutomaticWindowsWork() {
  return isWindowsSessionUnlocked()
    && state.runtime.windowsSession?.isMonitoringAvailable?.() === true;
}

function startAlertRetryTimer() {
  if (alertRetryTimer) {
    clearInterval(alertRetryTimer);
    alertRetryTimer = null;
  }

  if (!state.runtime.configuration?.app?.alertRetryEnabled) {
    return;
  }

  alertRetryTimer = setInterval(() => {
    refreshWindowsSessionState().then(() => {
      if (!canRunAutomaticWindowsWork() || syncInProgress || alertRetryInProgress) return;

      alertRetryInProgress = true;
      return state.runtime.alerts.repeatDueUnreadAlerts()
        .then((alerts) => {
          if (alerts.length > 0) log('alert retry cycle found due alerts', `count=${alerts.length}`);
          return state.runtime.alerts.notifyCreated(alerts);
        })
        .catch((error) => log('alert retry failed', error.message))
        .finally(() => { alertRetryInProgress = false; });
    }).catch((error) => log('Windows session state read failed', error.message));
  }, 1000);
}

function stopAlertRetryTimer() {
  if (alertRetryTimer) {
    clearInterval(alertRetryTimer);
    alertRetryTimer = null;
  }
}

async function startAutoSyncTimer({ scheduleNext = false } = {}) {
  stopAutoSyncTimer();
  const intervalSeconds = Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 0);
  if (!state.runtime.configuration?.app?.autoSyncEnabled
    || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return;
  }

  if (scheduleNext) {
    await state.runtime.persistence.syncStatus.updateStatus({
      next_sync_at: new Date(Date.now() + intervalSeconds * 1000).toISOString(),
    });
  }

  syncTimer = setInterval(() => {
    refreshWindowsSessionState().then(async () => {
      const nextSyncAt = new Date(Date.now() + intervalSeconds * 1000).toISOString();
      if (!canRunAutomaticWindowsWork()) {
        await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: nextSyncAt });
        log('automatic synchronization skipped; Windows session is not available', `state=${windowsSessionState.state} monitoring=${state.runtime.windowsSession?.isMonitoringAvailable?.()}`);
        return;
      }
      await refreshWindowsSessionState();
      if (!canRunAutomaticWindowsWork()) {
        await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: nextSyncAt });
        log('automatic synchronization canceled before start; Windows session changed', `state=${windowsSessionState.state} monitoring=${state.runtime.windowsSession?.isMonitoringAvailable?.()}`);
        return;
      }
      await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: null });
      await runSyncCycle({ automatic: true });
    }).catch((error) => log('automatic synchronization failed', error.message));
  }, intervalSeconds * 1000);
}

async function refreshState() {
  const session = await state.runtime.auth.loadStoredSession();
  let syncStatus = await state.runtime.persistence.syncStatus.getCurrent();
  if (!syncInProgress && session.ok && isJiraAuthenticationSyncFailure(syncStatus)) {
    await state.runtime.persistence.syncStatus.updateStatus({
      last_status: 'Sesion Jira iniciada. Pendiente sincronizar.',
      last_error_message: null,
      is_running: false,
      is_canceling: false,
    });
    syncStatus = await state.runtime.persistence.syncStatus.getCurrent();
    log('stale Jira authentication status cleared for a valid session');
  }
  state.session = session;
  state.syncStatus = syncStatus;
  state.appState = syncInProgress ? 'syncing' : (session.ok ? 'ready' : 'auth_required');
  return state;
}

async function handleBootstrapContext(res) {
  await refreshState();
  await refreshWindowsSessionState();
  if (state.runtime.jiraCatalogService) {
    state.runtime.jiraCatalog = await state.runtime.jiraCatalogService.load();
  }
  const jqlDefinitions = await state.runtime.persistence.jqlDefinitions.list();
  json(res, 200, {
    appState: state.appState,
    session: toPublicSession(state.session),
    syncStatus: state.syncStatus,
    jiraBaseUrl: state.runtime.configuration?.app?.jiraBaseUrl ?? '',
    syncIntervalSeconds: Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 300),
    syncIntervalMinutes: Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 300) / 60,
    jqlQueries: jqlDefinitions.map((definition) => definition.query_text),
    jqlDefinitions,
    autoSyncEnabled: Boolean(state.runtime.configuration?.app?.autoSyncEnabled),
    alertRetryEnabled: Boolean(state.runtime.configuration?.app?.alertRetryEnabled),
    alertFields: state.runtime.configuration?.alertFields?.fields ?? [],
    alertOperators: state.runtime.configuration?.alertFields?.operators ?? [],
    projectGroupRules: state.runtime.configuration?.projectGroupRules ?? {
      defaultValue: '',
      rules: [],
    },
    jiraCatalog: state.runtime.jiraCatalog ?? {
      projects: [],
      issueTypes: [],
      statuses: [],
    },
    windowsSession: windowsSessionState,
    graphIssueTypes: Object.keys(state.runtime.configuration?.graph?.nodes ?? {}),
  });
}

async function handleJqlDefinitionsSave(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se pueden modificar los JQL durante una sincronización.' });
    return;
  }
  const body = await readBody(req);
  const definitions = Array.isArray(body?.definitions) ? body.definitions : [];
  const normalized = definitions.map((definition) => ({
    id: String(definition?.id ?? '').trim() || null,
    queryText: String(definition?.query_text ?? definition?.queryText ?? '').trim(),
  })).filter((definition) => definition.queryText);
  if (normalized.length === 0) {
    json(res, 400, { ok: false, error: 'Debe existir al menos un JQL.' });
    return;
  }
  if (new Set(normalized.map((definition) => definition.queryText)).size !== normalized.length) {
    json(res, 400, { ok: false, error: 'No se permiten consultas JQL duplicadas.' });
    return;
  }

  const submittedIds = normalized.map((definition) => definition.id).filter(Boolean);
  if (new Set(submittedIds).size !== submittedIds.length) {
    json(res, 400, { ok: false, error: 'La lista contiene identificadores JQL duplicados.' });
    return;
  }

  const currentDefinitions = await state.runtime.persistence.jqlDefinitions.list();
  const retainedIds = new Set(submittedIds);
  const removedIds = currentDefinitions
    .filter((definition) => !retainedIds.has(definition.id))
    .map((definition) => definition.id);
  const removedImages = removedIds.length > 0
    ? await state.runtime.persistence.query(
      `SELECT toast_image FROM ALERT_RULES WHERE jql_id IN (${removedIds.map(() => '?').join(', ')})`,
      removedIds,
    )
    : [];
  const saved = await state.runtime.persistence.jqlDefinitions.replace(normalized);
  for (const image of removedImages) {
    await removeAlertImage(image.toast_image);
  }
  try {
    const appConfig = await saveAppConfig({
      jqlQueries: saved.map((definition) => definition.query_text),
    });
    state.runtime.configuration.app = appConfig;
  } catch (error) {
    log('JQL compatibility mirror update failed', error.message);
  }
  state.runtime.jqlDefinitions = saved;
  log('JQL definitions updated', `count=${saved.length}`);
  json(res, 200, { ok: true, definitions: saved });
}

async function handleSettings(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede cambiar la configuracion durante una sincronizacion.' });
    return;
  }
  const body = await readBody(req);
  const hasSyncSettings = typeof body?.autoSyncEnabled === 'boolean' || body?.syncIntervalMinutes !== undefined;
  const hasAlertRetrySetting = typeof body?.alertRetryEnabled === 'boolean';
  const alertRetryWasEnabled = Boolean(state.runtime.configuration?.app?.alertRetryEnabled);
  const alertRetryPausedAt = state.runtime.configuration?.app?.alertRetryPausedAt ?? null;
  const alertRetryTransitionAt = hasAlertRetrySetting ? new Date().toISOString() : null;
  const requestedJqlQueries = Array.isArray(body?.jqlQueries)
    ? [...new Set(body.jqlQueries
      .filter((query) => typeof query === 'string')
      .map((query) => query.trim())
      .filter(Boolean))]
    : null;

  if (requestedJqlQueries && requestedJqlQueries.length === 0) {
    json(res, 400, { ok: false, error: 'Debe existir al menos un JQL.' });
    return;
  }

  const updates = {};
  if (requestedJqlQueries) {
    updates.jqlQueries = requestedJqlQueries;
  }
  if (typeof body?.autoSyncEnabled === 'boolean') {
    updates.autoSyncEnabled = body.autoSyncEnabled;
  }
  if (hasAlertRetrySetting) {
    updates.alertRetryEnabled = body.alertRetryEnabled;
    updates.alertRetryPausedAt = body.alertRetryEnabled
      ? null
      : alertRetryPausedAt ?? alertRetryTransitionAt;
  }
  if (body?.syncIntervalMinutes !== undefined) {
    const minutes = Number(body.syncIntervalMinutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 9999) {
      json(res, 400, { ok: false, error: 'El intervalo debe estar entre 1 y 9999 minutos.' });
      return;
    }

    updates.syncIntervalSeconds = Math.round(minutes * 60);
  }

  const appConfig = await saveAppConfig(updates);
  state.runtime.configuration.app = appConfig;
  if (hasSyncSettings) {
    if (appConfig.autoSyncEnabled) {
      await startAutoSyncTimer({ scheduleNext: true });
    } else {
      stopAutoSyncTimer();
      await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: null });
    }
  }
  if (hasAlertRetrySetting) {
    if (appConfig.alertRetryEnabled) {
      if (!alertRetryWasEnabled) {
        const updated = alertRetryPausedAt
          ? await state.runtime.alerts.resumeUnreadRetries({
            lockedAt: alertRetryPausedAt,
            unlockedAt: alertRetryTransitionAt,
          })
          : 0;
        log('alert retry countdowns resumed', `updatedAlerts=${updated}`);
      }
      startAlertRetryTimer();
    } else {
      stopAlertRetryTimer();
    }
  }
  log('settings updated', `jqlCount=${appConfig.jqlQueries.length} autoSync=${appConfig.autoSyncEnabled} alertRetry=${appConfig.alertRetryEnabled}`);
  json(res, 200, {
    ok: true,
    jqlQueries: appConfig.jqlQueries,
    autoSyncEnabled: appConfig.autoSyncEnabled,
    alertRetryEnabled: appConfig.alertRetryEnabled,
    syncIntervalMinutes: appConfig.syncIntervalSeconds / 60,
  });
}

async function handleLogin(res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede iniciar sesion durante una sincronizacion.' });
    return;
  }
  log('login requested');
  const result = await state.runtime.auth.loginAndValidate();
  log('login finished', `ok=${result.ok} reason=${result.reason ?? 'none'}`);
  if (result.ok) {
    state.runtime.jira.setSession({
      baseUrl: result.baseUrl,
      headers: result.headers,
    });
    state.runtime.timeReports.clearWorklogCache?.();
    state.runtime.jiraCatalog = await state.runtime.jiraCatalogService.refresh(
      state.runtime.jira,
      result,
    );
    log('Jira catalog refreshed after successful login', `projects=${state.runtime.jiraCatalog.projects.length} issueTypes=${state.runtime.jiraCatalog.issueTypes.length} statuses=${state.runtime.jiraCatalog.statuses.length}`);

  }
  state.session = result;
  state.appState = result.ok ? 'ready' : 'auth_required';
  if (result.ok) {
    await refreshState();
  }
  json(res, 200, toPublicSession(result));
}

async function handleSync(res) {
  if (syncInProgress) {
    json(res, 409, {
      ok: false,
      error: 'Synchronization already in progress.',
    });
    return;
  }

  syncAbortController = new AbortController();
  syncCancellationRequested = false;
  syncInProgress = true;
  await refreshState();

  try {
    state.runtime.timeReports.clearWorklogCache?.();
    const result = await state.runtime.syncService.run({ signal: syncAbortController.signal });
    state.lastSyncResult = result;
    await refreshState();
    json(res, 200, result);
  } finally {
    const cancellationRequested = syncCancellationRequested;
    const intervalSeconds = Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 0);
    const statusUpdate = {
      next_sync_at: state.runtime.configuration?.app?.autoSyncEnabled
        && Number.isFinite(intervalSeconds)
        && intervalSeconds > 0
        ? new Date(Date.now() + intervalSeconds * 1000).toISOString()
        : null,
    };
    if (cancellationRequested) {
      Object.assign(statusUpdate, {
        last_status: 'Sincronizacion detenida.',
        last_finished_at: new Date().toISOString(),
        last_error_message: null,
        is_running: false,
        is_canceling: false,
      });
    }
    await state.runtime.persistence.syncStatus.updateStatus(statusUpdate);
    syncInProgress = false;
    syncAbortController = null;
    syncCancellationRequested = false;
    await refreshState();
  }
}

async function handleSyncCancel(res) {
  if (!syncInProgress || !syncAbortController) {
    json(res, 409, { ok: false, error: 'No hay una sincronizacion activa.' });
    return;
  }

  await state.runtime.persistence.syncStatus.updateStatus({
    is_canceling: true,
    last_status: 'Deteniendo sincronizacion...',
  });
  syncCancellationRequested = true;
  syncAbortController.abort();
  log('synchronization cancellation requested');
  json(res, 200, { ok: true, message: 'Se solicito detener la sincronizacion.' });
}

async function handleDatabaseReset(res) {
  if (syncInProgress) {
    json(res, 409, {
      ok: false,
      error: 'No se puede borrar la BD mientras hay una sincronizacion activa.',
    });
    return;
  }

  await state.runtime.persistence.reset();
  state.runtime.timeReports.clearWorklogCache?.();
  state.syncStatus = await state.runtime.persistence.syncStatus.getCurrent();
  state.lastSyncResult = null;
  state.appState = state.session?.ok ? 'ready' : 'auth_required';
  log('local database reset');
  json(res, 200, { ok: true, message: 'Base de datos reiniciada correctamente.' });
}

async function handleDatabaseSql(req, res) {
  const body = await readBody(req);
  const sql = String(body?.sql ?? '').trim();
  const normalizedSql = sql.toLowerCase();

  if (!sql || sql.length > 10000) {
    json(res, 400, { ok: false, error: 'La consulta SQL esta vacia o supera el limite permitido.' });
    return;
  }

  if (!/^(select|update|delete)\b/i.test(sql) || /;[\s\S]*\S/.test(sql)) {
    json(res, 400, { ok: false, error: 'Solo se permiten sentencias SELECT, UPDATE o DELETE individuales.' });
    return;
  }

  if (/\b(drop|alter|insert|create|truncate|pragma|copy|attach|detach|install|load)\b/i.test(normalizedSql)) {
    json(res, 400, { ok: false, error: 'La consulta contiene una operacion no permitida.' });
    return;
  }

  const isRead = /^select\b/i.test(sql);
  if (isRead) {
    const rows = await state.runtime.persistence.query(sql);
    json(res, 200, { ok: true, type: 'select', rows });
    return;
  }

  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede modificar la BD durante una sincronizacion.' });
    return;
  }

  await state.runtime.persistence.transaction(async () => {
    await state.runtime.persistence.exec(sql);
  });
  json(res, 200, { ok: true, type: 'write', message: 'Consulta ejecutada correctamente.' });
}

async function reportSessionIsReady(res) {
  const currentSession = await state.runtime.auth.validateSession();
  if (currentSession?.ok) {
    state.session = currentSession;
    state.runtime.jira.setSession(currentSession);
    state.appState = 'ready';
    return true;
  }

  log('time report request found an invalid Jira session; trying headless recovery');
  const recoveredSession = await state.runtime.auth.tryHeadlessContinue();
  if (recoveredSession?.ok) {
    state.session = recoveredSession;
    state.runtime.jira.setSession(recoveredSession);
    state.appState = 'ready';
    log('time report request recovered the Jira session through headless continuation');
    return true;
  }

  state.session = recoveredSession ?? currentSession;
  state.appState = 'auth_required';
  json(res, 401, {
    ok: false,
    code: 'JIRA_LOGIN_REQUIRED',
    error: 'Se requiere iniciar sesion en Jira para consultar reportes de tiempos.',
  });
  return false;
}

async function handleTimeReportUsers(req, res, url) {
  if (!await reportSessionIsReady(res)) return;
  const query = String(url.searchParams.get('query') ?? '').trim();
  if (query.length < 2) {
    json(res, 200, { users: [] });
    return;
  }
  const users = await state.runtime.timeReports.searchUsers(query);
  json(res, 200, { users });
}

async function handleTimeReportSearch(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede generar un reporte durante una sincronizacion.' });
    return;
  }
  if (!await reportSessionIsReady(res)) return;
  if (timeReportSearchInProgress) {
    json(res, 409, { ok: false, error: 'Ya hay una busqueda de incidencias en curso.' });
    return;
  }

  timeReportAbortController = new AbortController();
  timeReportCancellationRequested = false;
  timeReportSearchInProgress = true;
  try {
    const body = await readBody(req);
    const result = await state.runtime.timeReports.search({
      fromDate: body?.fromDate,
      toDate: body?.toDate,
      user: body?.user,
      signal: timeReportAbortController.signal,
    });
    json(res, 200, { ok: true, report: result });
  } catch (error) {
    if (timeReportCancellationRequested || error?.name === 'AbortError') {
      log('time report search canceled');
      if (!res.writableEnded && !res.destroyed) {
        json(res, 409, { ok: false, canceled: true, error: 'Busqueda de incidencias detenida.' });
      }
      return;
    }
    throw error;
  } finally {
    timeReportSearchInProgress = false;
    timeReportAbortController = null;
    timeReportCancellationRequested = false;
  }
}

async function handleTimeReportSearchCancel(res) {
  if (!timeReportSearchInProgress || !timeReportAbortController) {
    json(res, 409, { ok: false, error: 'No hay una busqueda de incidencias activa.' });
    return;
  }

  timeReportCancellationRequested = true;
  timeReportAbortController.abort();
  log('time report search cancellation requested');
  json(res, 200, { ok: true, message: 'Se solicito detener la busqueda de incidencias.' });
}

async function handleTimeReportPdf(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede generar un reporte durante una sincronizacion.' });
    return;
  }
  if (!await reportSessionIsReady(res)) return;
  const body = await readBody(req);
  const result = await state.runtime.timeReports.generatePdf({
    reportId: body?.reportId,
    selectedIssueIds: body?.selectedIssueIds,
    issueOrderIds: body?.issueOrderIds,
    summaryOverrides: body?.summaryOverrides,
    includeCorrectionsIssueIds: body?.includeCorrectionsIssueIds,
    groupedIssueIds: body?.groupedIssueIds,
    pendingIssues: body?.pendingIssues,
    selectedPendingIssueIds: body?.selectedPendingIssueIds,
    pendingIssueOrderIds: body?.pendingIssueOrderIds,
    pdfTheme: body?.pdfTheme,
  });
  json(res, 200, {
    ok: true,
    reportId: result.reportId,
    pages: result.pages,
    fileName: result.fileName,
    downloadUrl: `/api/time-reports/file?name=${encodeURIComponent(result.fileName)}&v=${Date.now()}`,
  });
}

async function handleTimeReportImprovement(req, res, method) {
  if (!await reportSessionIsReady(res)) return;
  const body = await readBody(req);
  if (method === 'DELETE') {
    await state.runtime.timeReports.deleteImprovement({ reportId: body?.reportId, issueId: body?.issueId });
    json(res, 200, { ok: true });
    return;
  }
  const improvement = await state.runtime.timeReports.saveImprovement({
    reportId: body?.reportId,
    issueId: body?.issueId,
    memo: body?.memo,
  });
  json(res, 200, { ok: true, improvement });
}

async function handleTimeReportFile(res, url) {
  const fileName = String(url.searchParams.get('name') ?? '').trim();
  if (!/^[a-z0-9][a-z0-9_.-]*\.pdf$/i.test(fileName)) {
    json(res, 404, { ok: false, error: 'Archivo no encontrado.' });
    return;
  }
  const filePath = path.resolve(TIME_REPORT_EXPORTS_DIR, fileName);
  if (path.dirname(filePath) !== TIME_REPORT_EXPORTS_DIR) {
    json(res, 404, { ok: false, error: 'Archivo no encontrado.' });
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
      Pragma: 'no-cache',
    });
    res.end(content);
  } catch {
    json(res, 404, { ok: false, error: 'Archivo no encontrado.' });
  }
}

async function handleGrids(res) {
  const rows = await state.runtime.persistence.grids.list();
  json(res, 200, { grids: rows.map(parseGridDefinition) });
}

function validateGridPayload(body) {
  const name = String(body?.name ?? '').trim();
  const pageSize = Number(body?.pageSize ?? 10);
  const columns = Array.isArray(body?.columns) ? body.columns : [];
  const conditions = Array.isArray(body?.conditions) ? body.conditions : [];
  const graphTypes = new Set(Object.keys(state.runtime.configuration?.graph?.nodes ?? {}));
  const allowedFields = new Set([
    'key', 'project', 'issuetype', 'summary', 'description', 'status', 'reporter',
    'assignee', 'created', 'updated', 'resolutiondate', 'parent', 'timeestimate',
    'timespent', 'timeremaining', 'estadoGeneral', 'closedSubtasks', 'openSubtasks',
    REPORTED_TIMES_FIELD,
  ]);
  const allowedConditionFields = new Set([...allowedFields].filter((field) => (
    !SUBTASK_COUNT_FIELDS.has(field) && field !== REPORTED_TIMES_FIELD
  )));
  const allowedOperators = new Set(['=', '<>', 'LIKE', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL']);

  if (!name) throw new Error('El grid requiere un nombre.');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) {
    throw new Error('La cantidad de registros por pagina debe estar entre 1 y 200.');
  }
  if (columns.length === 0 || columns.length > 50) throw new Error('El grid debe tener entre 1 y 50 campos.');
  if (columns.some((column) => !column?.field || !allowedFields.has(column.field)
    || (column.field !== 'projectGroupId' && column.field !== 'estadoGeneral' && !graphTypes.has(column.issueType))
    || (SUBTASK_COUNT_FIELDS.has(column.field) && !SUBTASK_COUNT_ISSUE_TYPES.has(column.issueType)))) {
    throw new Error('Uno de los campos seleccionados no es valido para el grafo actual.');
  }
  if (conditions.some((condition) => !condition?.field || !allowedConditionFields.has(condition.field)
    || !allowedOperators.has(condition.operator)
    || (condition.field === 'estadoGeneral'
      ? condition.issueType !== 'Otros'
      : !graphTypes.has(condition.issueType)))) {
    throw new Error('Una de las condiciones del grid no es valida.');
  }

  return {
    name,
    pageSize,
    columns: columns.map((column) => ({
      issueType: column.issueType ?? null,
      field: column.field,
      label: String(column.label ?? '').trim() || `${column.issueType ?? 'ProjectGroup'} - ${column.field}`,
    })),
    conditions: conditions.map((condition, index) => ({
      issueType: condition.issueType ?? null,
      field: condition.field,
      operator: condition.operator,
      value: String(condition.value ?? '').trim(),
      connector: index === 0 ? undefined : (condition.connector === 'OR' ? 'OR' : 'AND'),
    })),
    visible: body?.visible !== false,
  };
}

async function handleGridSave(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede cambiar un grid durante una sincronizacion.' });
    return;
  }
  const body = await readBody(req);
  const payload = validateGridPayload(body);
  const id = String(body?.id ?? crypto.randomUUID());
  const existing = await state.runtime.persistence.grids.get(id);
  const duplicate = await state.runtime.persistence.query(
    'SELECT id FROM GRID_DEFINITIONS WHERE lower(name) = lower(?) AND id <> ? LIMIT 1',
    [payload.name, id],
  );
  if (duplicate.length > 0) {
    json(res, 409, { ok: false, error: 'Ya existe un grid con ese nombre.' });
    return;
  }
  const now = new Date().toISOString();
  await state.runtime.persistence.grids.save({
    ...payload,
    id,
    created: existing?.created ?? now,
    updated: now,
  });
  log('grid saved', `id=${id} name=${payload.name}`);
  await handleGrids(res);
}

async function handleGridDelete(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede eliminar un grid durante una sincronizacion.' });
    return;
  }
  const body = await readBody(req);
  const id = String(body?.id ?? '');
  if (!id) {
    json(res, 400, { ok: false, error: 'Falta el identificador del grid.' });
    return;
  }
  await state.runtime.persistence.grids.remove(id);
  log('grid deleted', `id=${id}`);
  await handleGrids(res);
}

async function handleGridData(req, res, id) {
  const gridRow = await state.runtime.persistence.grids.get(id);
  if (!gridRow) {
    json(res, 404, { ok: false, error: 'Grid no encontrado.' });
    return;
  }
  const grid = parseGridDefinition(gridRow);
  const rows = await state.runtime.persistence.query(`
    SELECT
      p.id,
      p.estado_general,
      COALESCE(
        list(
          struct_pack(
            id := i.id, key := i.key, project := i.project, issuetype := i.issuetype,
            issuetype_icon_url := i.issuetype_icon_url,
            summary := i.summary, description := i.description, status := i.status,
            reporter := i.reporter, assignee := i.assignee, created := i.created,
            updated := i.updated, resolutiondate := i.resolutiondate, parent := i.parent,
            timeestimate := i.timeestimate, timespent := i.timespent, timeremaining := i.timeremaining,
            issuelinks := i.issuelinks
          )
        ) FILTER (WHERE i.id IS NOT NULL), []
      ) AS issues_json
    FROM JIRA_PROJECT_GROUPS p
    LEFT JOIN JIRA_PROJECT_GROUP_ISSUES pgi ON pgi.project_group_id = p.id
    LEFT JOIN JIRA_ISSUES i ON i.id = pgi.issue_id
    WHERE p.source = 'sync'
    GROUP BY p.id, p.estado_general
    ORDER BY p.id
  `);
  const projectGroups = rows.map(parseGridRow).filter((group) => {
    const matches = grid.conditions.map((condition) => {
      if (condition.field === 'estadoGeneral') {
        return gridConditionMatches(group.estadoGeneral, condition.operator, condition.value, condition.field);
      }
      return group.issues.some((issue) => issue.issuetype === condition.issueType
        && gridConditionMatches(
          gridFieldValue(issue, condition.field),
          condition.operator,
          condition.value,
          condition.field,
        ));
    });
    if (matches.length === 0) return true;
    return matches.reduce((result, match, index) => (
      index === 0 ? match : (grid.conditions[index].connector === 'OR' ? result || match : result && match)
    ), false);
  });
  const data = projectGroups.map((group) => {
    const result = {
      projectGroupId: group.id,
      estadoGeneral: group.estadoGeneral,
      issueDetails: Object.fromEntries(
        group.issues
          .filter((issue) => issue?.key)
          .map((issue) => [issue.key, issue]),
      ),
    };
    for (const column of grid.columns) {
      if (column.field === 'estadoGeneral') continue;
      if (SUBTASK_COUNT_FIELDS.has(column.field)) {
        result[`${column.issueType}::${column.field}`] = getSubtaskCountEntries(
          group.issues,
          column.issueType,
          column.field,
        );
        continue;
      }
      if (column.field === REPORTED_TIMES_FIELD) {
        result[`${column.issueType}::${column.field}`] = getReportedTimesEntries(group.issues, column.issueType);
        continue;
      }
      const values = group.issues
        .filter((issue) => issue.issuetype === column.issueType)
        .map((issue) => gridFieldValue(issue, column.field))
        .filter((value) => value !== null && value !== undefined && value !== '');
      result[`${column.issueType}::${column.field}`] = [...new Set(values.map(String))].join(' | ');
    }
    return result;
  });

  const searchParams = new URL(req.url, 'http://127.0.0.1').searchParams;
  const search = String(searchParams.get('search') ?? '').trim();
  const totalUnfiltered = data.length;
  const filteredData = search
    ? data.filter((row) => gridRowMatchesSearch(row, grid.columns, search))
    : data;
  const page = Math.max(1, Number(searchParams.get('page') ?? 1));
  const requestedPageSize = Number(searchParams.get('pageSize'));
  const pageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, grid.pageSize)
    : grid.pageSize;

  const sortField = String(searchParams.get('sortField') ?? '').trim();
  const sortIssueType = String(searchParams.get('sortIssueType') ?? '');
  const sortDirection = searchParams.get('sortDirection') === 'desc' ? 'desc' : 'asc';
  const sortColumn = grid.columns.find((column) => (
    column.field === sortField && String(column.issueType ?? '') === sortIssueType
  ));
  if (sortColumn) {
    filteredData.sort((left, right) => compareGridRows(left, right, sortColumn, sortDirection));
  }

  const pagedData = filteredData.slice((page - 1) * pageSize, page * pageSize);
  json(res, 200, {
    grid,
    rows: pagedData,
    total: filteredData.length,
    totalUnfiltered,
    page,
    pageSize,
    search,
    sort: sortColumn ? { issueType: sortColumn.issueType ?? null, field: sortColumn.field, direction: sortDirection } : null,
  });
}

async function handleAlertsSummary(res) {
  const unreadAlerts = await state.runtime.persistence.alerts.listUnread(20);
  const unreadCount = await state.runtime.persistence.alerts.getUnreadCount();

  json(res, 200, {
    unreadCount,
    unreadAlerts,
  });
}

async function handleAlertRules(res) {
  const rules = await state.runtime.persistence.alerts.listRules();
  json(res, 200, { ok: true, rules });
}

async function handleAlertRuleSave(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se pueden modificar alertas durante una sincronizacion.' });
    return;
  }
  const body = await readBody(req);
  const now = new Date().toISOString();
  const id = String(body?.id ?? `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const jqlId = String(body?.jql_id ?? '').trim();
  const alertType = String(body?.alert_type ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const sql = '';

  if (!jqlId || !['new_issue', 'attribute_changed'].includes(alertType)) {
    json(res, 400, { ok: false, error: 'La alerta debe pertenecer a un JQL y tener un tipo válido.' });
    return;
  }
  const jqlRows = await state.runtime.persistence.query(
    'SELECT id FROM JQL_DEFINITIONS WHERE id = ? LIMIT 1',
    [jqlId],
  );
  if (jqlRows.length === 0) {
    json(res, 400, { ok: false, error: 'El JQL asociado ya no existe.' });
    return;
  }
  if (!name || !String(body?.toast_text ?? '').trim()) {
    json(res, 400, { ok: false, error: 'El nombre y el texto del Toast son obligatorios.' });
    return;
  }

  let conditionConfig = body?.condition_config;
  let parsedConditionConfig = null;
  try {
    const parsed = typeof conditionConfig === 'string' ? JSON.parse(conditionConfig) : conditionConfig;
    parsedConditionConfig = {
      ...(parsed ?? {}),
      event: alertType,
      conditions: alertType === 'new_issue' ? [] : (parsed?.conditions ?? []),
    };
    conditionConfig = JSON.stringify(parsedConditionConfig);
  } catch {
    parsedConditionConfig = { event: alertType, conditions: [] };
    conditionConfig = JSON.stringify(parsedConditionConfig);
  }
  const conditionValidation = validateAlertConditionConfig(conditionConfig, {
    fields: state.runtime.configuration?.alertFields?.fields ?? [],
    operators: state.runtime.configuration?.alertFields?.operators ?? [],
  });
  if (!conditionValidation.ok) {
    json(res, 400, {
      ok: false,
      error: 'La alerta contiene condiciones inválidas.',
      details: conditionValidation.errors,
    });
    return;
  }
  const graphTypes = new Set(Object.keys(state.runtime.configuration?.graph?.nodes ?? {}));
  if ((parsedConditionConfig?.conditions ?? []).some((condition) => (
    condition.field === 'estadoGeneral'
      ? condition.issueType !== 'Otros'
      : !graphTypes.has(condition.issueType)
  ))) {
    json(res, 400, { ok: false, error: 'Una condición usa un tipo de incidencia que no pertenece al grafo.' });
    return;
  }

  const displayIssueType = String(body?.display_issue_type ?? '').trim() || null;
  const displayField = String(body?.display_field ?? '').trim() || null;
  const displayFields = Array.isArray(body?.display_fields)
    ? body.display_fields.map((item) => ({
      issueType: String(item?.issueType ?? '').trim(),
      field: String(item?.field ?? '').trim(),
    })).filter((item) => item.issueType && item.field)
    : (displayIssueType && displayField ? [{ issueType: displayIssueType, field: displayField }] : []);
  if (Boolean(displayIssueType) !== Boolean(displayField)) {
    json(res, 400, { ok: false, error: 'Para mostrar información debes seleccionar tipo de incidencia y atributo.' });
    return;
  }
  const allowedDisplayFields = new Set([
    ...(state.runtime.configuration?.alertFields?.fields ?? []).map((field) => field.field),
    'estado_general',
  ]);
  const isJqlSourceIssue = displayIssueType === JQL_SOURCE_ISSUE_OPTION;
  const hasValidDisplaySource = displayIssueType === 'Otros'
    ? displayField === 'estado_general'
    : isJqlSourceIssue
      ? displayField !== 'estado_general'
      : graphTypes.has(displayIssueType);
  if (displayIssueType && (
    !allowedDisplayFields.has(displayField)
    || !hasValidDisplaySource
  )) {
    json(res, 400, { ok: false, error: 'La información seleccionada para el Toast no es válida.' });
    return;
  }

  const existingRows = await state.runtime.persistence.query(
    'SELECT toast_image FROM ALERT_RULES WHERE id = ? LIMIT 1',
    [id],
  );
  const previousImage = existingRows[0]?.toast_image ?? null;
  let toastImage = body?.toast_image ?? previousImage;
  let newImage = null;

  if (body?.toast_image_data) {
    newImage = await saveAlertImage(body.toast_image_data, body.toast_image_name);
    toastImage = newImage;
  } else if (body?.remove_toast_image === true) {
    toastImage = null;
  }

  try {
    await state.runtime.persistence.exec(
      `
      INSERT INTO ALERT_RULES (
        id, jql_id, alert_type, name, sql, toast_text, toast_image, condition_config,
        display_issue_type, display_field, display_fields_json, retry_syncs, retry_minutes, is_active, created, updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        jql_id = excluded.jql_id,
        alert_type = excluded.alert_type,
        name = excluded.name,
        sql = excluded.sql,
        toast_text = excluded.toast_text,
        toast_image = excluded.toast_image,
        condition_config = excluded.condition_config,
        display_issue_type = excluded.display_issue_type,
        display_field = excluded.display_field,
        display_fields_json = excluded.display_fields_json,
        retry_syncs = excluded.retry_syncs,
        retry_minutes = excluded.retry_minutes,
        is_active = excluded.is_active,
        updated = excluded.updated
      `,
      [
        id,
        jqlId,
        alertType,
        name,
        sql,
        String(body?.toast_text ?? '').trim() || null,
        toastImage,
        conditionConfig,
        displayIssueType,
        displayField,
        JSON.stringify(displayFields),
        Math.max(Number(body?.retry_syncs ?? 0) || 0, 0),
        Math.max(Number(body?.retry_minutes ?? 0) || 0, 0),
        body?.is_active === false ? 0 : 1,
        body?.created ?? now,
        now,
      ],
    );
  } catch (error) {
    if (newImage) await removeAlertImage(newImage);
    throw error;
  }

  if (previousImage && previousImage !== toastImage) {
    await removeAlertImage(previousImage);
  }

  const rules = await state.runtime.persistence.alerts.listRules();
  json(res, 200, { ok: true, rules });
}

async function handleAlertRuleDelete(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se pueden modificar alertas durante una sincronizacion.' });
    return;
  }
  const body = await readBody(req);
  const id = String(body?.id ?? '').trim();

  if (!id) {
    json(res, 400, { ok: false, error: 'El id de la alerta es obligatorio.' });
    return;
  }

  const imageRows = await state.runtime.persistence.query(
    'SELECT toast_image FROM ALERT_RULES WHERE id = ? LIMIT 1',
    [id],
  );

  await state.runtime.persistence.transaction(async () => {
    await state.runtime.persistence.exec('DELETE FROM ALERTS WHERE rule_id = ?', [id]);
    await state.runtime.persistence.exec('DELETE FROM ALERT_RULES WHERE id = ?', [id]);
  });

  await removeAlertImage(imageRows[0]?.toast_image);

  json(res, 200, { ok: true });
}

async function handleAlertRead(req, res) {
  const body = await readBody(req);
  const id = String(body?.id ?? '').trim();
  await state.runtime.persistence.alerts.markRead(id);
  json(res, 200, { ok: true });
}

function scheduleShutdown() {
  if (shuttingDown) return false;
  shuttingDown = true;
  setTimeout(async () => {
    stopAutoSyncTimer();
    stopAlertRetryTimer();
    try {
      await state.runtime.windowsSession?.disableTasks();
    } finally {
      server.close(() => process.exit(0));
    }
  }, 100);
  return true;
}

function handleShutdown(res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se pueden detener los servicios durante una sincronizacion.' });
    return;
  }
  if (shuttingDown) {
    json(res, 409, { ok: false, error: 'Los servicios ya se estan deteniendo.' });
    return;
  }
  json(res, 200, { ok: true, message: 'Servicios en proceso de apagado.' });
  scheduleShutdown();
}

async function handleRestart(res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede reiniciar la aplicacion durante una sincronizacion.' });
    return;
  }
  if (shuttingDown) {
    json(res, 409, { ok: false, error: 'Los servicios ya se estan deteniendo.' });
    return;
  }

  try {
    await fs.access(RESTART_LAUNCHER_PATH);
    const restartLauncher = spawn(process.execPath, [RESTART_LAUNCHER_PATH], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    restartLauncher.unref();
    log('restart launcher started', `pid=${restartLauncher.pid}`);
    json(res, 200, { ok: true, message: 'La aplicacion se reiniciara.' });
    scheduleShutdown();
  } catch (error) {
    log('restart launcher could not start', error.message);
    json(res, 500, { ok: false, error: 'No se pudo iniciar el reinicio de la aplicacion.' });
  }
}

async function runSyncCycle({ automatic = false } = {}) {
  if (syncInProgress) {
    return { ok: false, error: 'Synchronization already in progress.' };
  }

  await refreshWindowsSessionState();
  if (automatic && !canRunAutomaticWindowsWork()) {
    log('automatic synchronization skipped; Windows session is not available', `state=${windowsSessionState.state} monitoring=${state.runtime.windowsSession?.isMonitoringAvailable?.()}`);
    return { ok: false, skipped: true, reason: 'windows-session-not-unlocked' };
  }

  syncAbortController = new AbortController();
  syncCancellationRequested = false;
  syncInProgress = true;
  await refreshState();

  try {
    state.runtime.timeReports.clearWorklogCache?.();
    const result = await state.runtime.syncService.run({ signal: syncAbortController.signal });
    state.lastSyncResult = result;
    await refreshState();
    return result;
  } finally {
    const cancellationRequested = syncCancellationRequested;
    const intervalSeconds = Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 0);
    const statusUpdate = {
      next_sync_at: state.runtime.configuration?.app?.autoSyncEnabled
        && Number.isFinite(intervalSeconds)
        && intervalSeconds > 0
        ? new Date(Date.now() + intervalSeconds * 1000).toISOString()
        : null,
    };
    if (cancellationRequested) {
      Object.assign(statusUpdate, {
        last_status: 'Sincronizacion detenida.',
        last_finished_at: new Date().toISOString(),
        last_error_message: null,
        is_running: false,
        is_canceling: false,
      });
    }
    await state.runtime.persistence.syncStatus.updateStatus(statusUpdate);
    syncInProgress = false;
    syncAbortController = null;
    syncCancellationRequested = false;
    await refreshState();
  }
}

const server = http.createServer(async (req, res) => {
  log('request', `${req.method} ${req.url}`);
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

    if (await serveRenderer(req, res, url.pathname)) return;

    if (req.method === 'GET' && url.pathname === '/api/bootstrap-context') {
      await handleBootstrapContext(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/login') {
      await readBody(req).catch(() => ({}));
      await handleLogin(res);
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/settings') {
      await handleSettings(req, res);
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/jql-definitions') {
      await handleJqlDefinitionsSave(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/sync') {
      await readBody(req).catch(() => ({}));
      const currentWindowsState = await refreshWindowsSessionState();
      if (!isWindowsSessionUnlocked()) {
        await state.runtime.windowsSession?.markManualSyncUnlocked?.();
        await refreshWindowsSessionState();
        log('manual synchronization changed Windows session state to unlocked', `previousState=${currentWindowsState.state}`);
      }
      const result = await runSyncCycle();
      const statusCode = result?.ok === false && result?.error === 'Synchronization already in progress.' ? 409 : 200;
      json(res, statusCode, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/sync/cancel') {
      await readBody(req).catch(() => ({}));
      await handleSyncCancel(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/database/reset') {
      await readBody(req).catch(() => ({}));
      await handleDatabaseReset(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/database/sql') {
      await handleDatabaseSql(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/time-reports/users') {
      await handleTimeReportUsers(req, res, url);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/time-reports/search') {
      await handleTimeReportSearch(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/time-reports/search/cancel') {
      await readBody(req).catch(() => ({}));
      await handleTimeReportSearchCancel(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/time-reports/pdf') {
      await handleTimeReportPdf(req, res);
      return;
    }

    if ((req.method === 'POST' || req.method === 'DELETE') && url.pathname === '/api/time-reports/improvement') {
      await handleTimeReportImprovement(req, res, req.method);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/time-reports/file') {
      await handleTimeReportFile(res, url);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/grids') {
      await handleGrids(res);
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/grids') {
      await handleGridSave(req, res);
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/grids') {
      await handleGridDelete(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/api/grids/') && url.pathname.endsWith('/data')) {
      const gridId = decodeURIComponent(url.pathname.slice('/api/grids/'.length, -'/data'.length));
      await handleGridData(req, res, gridId);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/alerts-summary') {
      await handleAlertsSummary(res);
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/alert-images/')) {
      await handleAlertImage(res, decodeURIComponent(url.pathname.slice('/alert-images/'.length)));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/alert-rules') {
      await handleAlertRules(res);
      return;
    }

    if (req.method === 'PUT' && url.pathname === '/api/alert-rules') {
      await handleAlertRuleSave(req, res);
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/alert-rules') {
      await handleAlertRuleDelete(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/alerts/read') {
      await handleAlertRead(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/shutdown') {
      await readBody(req).catch(() => ({}));
      handleShutdown(res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/restart') {
      await readBody(req).catch(() => ({}));
      await handleRestart(res);
      return;
    }

    json(res, 404, { ok: false, error: 'Not found' });
  } catch (error) {
    log('request failed', `${req.method} ${req.url} error=${error.stack ?? error.message}`);
    json(res, 500, {
      ok: false,
      error: error.message,
    });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Jira Notifications backend listening on http://127.0.0.1:${PORT}`);
  refreshWindowsSessionState()
    .then(() => startAutoSyncTimer({ scheduleNext: true }))
    .then(() => startAlertRetryTimer())
    .catch((error) => log('automatic synchronization setup failed', error.message));
});

async function shutdownFromSignal() {
  if (shuttingDown) return;
  shuttingDown = true;
  stopAutoSyncTimer();
  stopAlertRetryTimer();
  try {
    await state.runtime.windowsSession?.disableTasks();
  } finally {
    server.close(() => process.exit(0));
  }
}

process.on('SIGINT', shutdownFromSignal);
process.on('SIGTERM', shutdownFromSignal);
