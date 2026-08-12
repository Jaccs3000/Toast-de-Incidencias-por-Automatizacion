import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { bootstrapApp } from './app/bootstrap.js';
import { saveAppConfig } from './config/configLoader.js';

const PORT = Number(process.env.PORT ?? 3000);
const ALERT_IMAGES_DIR = path.resolve(process.cwd(), 'data', 'alert-images');
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

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, (_, value) => (
    typeof value === 'bigint' ? Number(value) : value
  )));
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

  return {
    ok: Boolean(session.ok),
    reason: session.reason ?? null,
    details: session.details ?? null,
  };
}

async function createAppState() {
  const runtime = await bootstrapApp();
  const storedSession = await runtime.auth.loadStoredSession();
  let syncStatus = await runtime.persistence.syncStatus.getCurrent();

  if (syncStatus?.is_running) {
    const recoveredAt = new Date().toISOString();
    await runtime.persistence.syncStatus.updateStatus({
      last_status: 'Sincronizacion anterior interrumpida.',
      last_finished_at: recoveredAt,
      last_error_message: 'El proceso anterior no finalizo correctamente.',
      is_running: false,
      is_canceling: false,
    });
    syncStatus = await runtime.persistence.syncStatus.getCurrent();
    log('recovered interrupted synchronization state');
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

function startAlertRetryTimer() {
  if (alertRetryTimer) {
    clearInterval(alertRetryTimer);
  }

  alertRetryTimer = setInterval(() => {
    refreshWindowsSessionState().then(() => {
      if (!isWindowsSessionUnlocked() || syncInProgress || alertRetryInProgress) return;

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
      if (!isWindowsSessionUnlocked()) {
        await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: nextSyncAt });
        log('automatic synchronization skipped; Windows session is not unlocked', `state=${windowsSessionState.state}`);
        return;
      }
      await refreshWindowsSessionState();
      if (!isWindowsSessionUnlocked()) {
        await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: nextSyncAt });
        log('automatic synchronization canceled before start; Windows session changed', `state=${windowsSessionState.state}`);
        return;
      }
      await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: null });
      await runSyncCycle({ automatic: true });
    }).catch((error) => log('automatic synchronization failed', error.message));
  }, intervalSeconds * 1000);
}

async function refreshState() {
  const session = await state.runtime.auth.loadStoredSession();
  const syncStatus = await state.runtime.persistence.syncStatus.getCurrent();
  state.session = session;
  state.syncStatus = syncStatus;
  state.appState = syncInProgress ? 'syncing' : (session.ok ? 'ready' : 'auth_required');
  return state;
}

async function handleBootstrapContext(res) {
  await refreshState();
  await refreshWindowsSessionState();
  json(res, 200, {
    appState: state.appState,
    session: toPublicSession(state.session),
    syncStatus: state.syncStatus,
    syncIntervalSeconds: Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 300),
    syncIntervalMinutes: Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 300) / 60,
    jqlQueries: state.runtime.configuration?.app?.jqlQueries ?? [],
    autoSyncEnabled: Boolean(state.runtime.configuration?.app?.autoSyncEnabled),
    windowsSession: windowsSessionState,
    graphIssueTypes: Object.keys(state.runtime.configuration?.graph?.nodes ?? {}),
  });
}

async function handleSettings(req, res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se puede cambiar la configuracion durante una sincronizacion.' });
    return;
  }
  const body = await readBody(req);
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
  if (body?.syncIntervalMinutes !== undefined) {
    const minutes = Number(body.syncIntervalMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) {
      json(res, 400, { ok: false, error: 'El intervalo debe ser de al menos 1 minuto.' });
      return;
    }

    updates.syncIntervalSeconds = Math.round(minutes * 60);
  }

  const appConfig = await saveAppConfig(updates);
  state.runtime.configuration.app = appConfig;
  if (appConfig.autoSyncEnabled) {
    await startAutoSyncTimer({ scheduleNext: true });
  } else {
    stopAutoSyncTimer();
    await state.runtime.persistence.syncStatus.updateStatus({ next_sync_at: null });
  }
  log('settings updated', `jqlCount=${appConfig.jqlQueries.length} autoSync=${appConfig.autoSyncEnabled}`);
  json(res, 200, {
    ok: true,
    jqlQueries: appConfig.jqlQueries,
    autoSyncEnabled: appConfig.autoSyncEnabled,
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
  state.session = result;
  state.appState = result.ok ? 'ready' : 'auth_required';
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
  syncInProgress = true;
  await refreshState();

  try {
    const result = await state.runtime.syncService.run({ signal: syncAbortController.signal });
    state.lastSyncResult = result;
    await refreshState();
    json(res, 200, result);
  } finally {
    syncInProgress = false;
    syncAbortController = null;
    const intervalSeconds = Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 0);
    await state.runtime.persistence.syncStatus.updateStatus({
      next_sync_at: state.runtime.configuration?.app?.autoSyncEnabled
        && Number.isFinite(intervalSeconds)
        && intervalSeconds > 0
        ? new Date(Date.now() + intervalSeconds * 1000).toISOString()
        : null,
    });
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
  const name = String(body?.name ?? '').trim();
  const sql = String(body?.sql ?? '').trim();

  if (!name || !sql) {
    json(res, 400, { ok: false, error: 'El nombre y el SQL de la alerta son obligatorios.' });
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
        id, name, sql, toast_text, toast_image, condition_config, retry_syncs, retry_minutes, is_active, created, updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        sql = excluded.sql,
        toast_text = excluded.toast_text,
        toast_image = excluded.toast_image,
        condition_config = excluded.condition_config,
        retry_syncs = excluded.retry_syncs,
        retry_minutes = excluded.retry_minutes,
        is_active = excluded.is_active,
        updated = excluded.updated
      `,
      [
        id,
        name,
        sql,
        String(body?.toast_text ?? '').trim() || null,
        toastImage,
        String(body?.condition_config ?? '').trim() || null,
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

function handleShutdown(res) {
  if (syncInProgress) {
    json(res, 409, { ok: false, error: 'No se pueden detener los servicios durante una sincronizacion.' });
    return;
  }
  json(res, 200, { ok: true, message: 'Servicios en proceso de apagado.' });
  setTimeout(async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopAutoSyncTimer();
    stopAlertRetryTimer();
    try {
      await state.runtime.windowsSession?.disableTasks();
    } finally {
      server.close(() => process.exit(0));
    }
  }, 100);
}

async function runSyncCycle({ automatic = false } = {}) {
  if (syncInProgress) {
    return { ok: false, error: 'Synchronization already in progress.' };
  }

  await refreshWindowsSessionState();
  if (automatic && !isWindowsSessionUnlocked()) {
    log('automatic synchronization skipped; Windows session is not unlocked', `state=${windowsSessionState.state}`);
    return { ok: false, skipped: true, reason: 'windows-session-not-unlocked' };
  }

  syncAbortController = new AbortController();
  syncInProgress = true;
  await refreshState();

  try {
    const result = await state.runtime.syncService.run({ signal: syncAbortController.signal });
    state.lastSyncResult = result;
    await refreshState();
    return result;
  } finally {
    syncInProgress = false;
    const intervalSeconds = Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 0);
    await state.runtime.persistence.syncStatus.updateStatus({
      next_sync_at: state.runtime.configuration?.app?.autoSyncEnabled
        && Number.isFinite(intervalSeconds)
        && intervalSeconds > 0
        ? new Date(Date.now() + intervalSeconds * 1000).toISOString()
        : null,
    });
    syncAbortController = null;
    await refreshState();
  }
}

const server = http.createServer(async (req, res) => {
  log('request', `${req.method} ${req.url}`);
  try {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');

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
