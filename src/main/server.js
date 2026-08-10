import http from 'node:http';
import { bootstrapApp } from './app/bootstrap.js';
import { saveAppConfig } from './config/configLoader.js';

const PORT = Number(process.env.PORT ?? 3000);

function log(message, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.log(`[backend ${new Date().toISOString()}] ${message}${suffix}`);
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload));
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
let syncTimer = null;

function stopAutoSyncTimer() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

function startAutoSyncTimer() {
  stopAutoSyncTimer();
  const intervalSeconds = Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 0);
  if (!state.runtime.configuration?.app?.autoSyncEnabled
    || !Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    return;
  }

  syncTimer = setInterval(() => {
    runSyncCycle().catch(() => {});
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
  json(res, 200, {
    appState: state.appState,
    session: toPublicSession(state.session),
    syncStatus: state.syncStatus,
    syncIntervalSeconds: Number(state.runtime.configuration?.app?.syncIntervalSeconds ?? 300),
    jqlQueries: state.runtime.configuration?.app?.jqlQueries ?? [],
    autoSyncEnabled: Boolean(state.runtime.configuration?.app?.autoSyncEnabled),
  });
}

async function handleSettings(req, res) {
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

  const appConfig = await saveAppConfig(updates);
  state.runtime.configuration.app = appConfig;
  if (appConfig.autoSyncEnabled) {
    startAutoSyncTimer();
  } else {
    stopAutoSyncTimer();
  }
  log('settings updated', `jqlCount=${appConfig.jqlQueries.length} autoSync=${appConfig.autoSyncEnabled}`);
  json(res, 200, {
    ok: true,
    jqlQueries: appConfig.jqlQueries,
    autoSyncEnabled: appConfig.autoSyncEnabled,
  });
}

async function handleLogin(res) {
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

  syncInProgress = true;
  await refreshState();

  try {
    const result = await state.runtime.syncService.run();
    state.lastSyncResult = result;
    await refreshState();
    json(res, 200, result);
  } finally {
    syncInProgress = false;
    await refreshState();
  }
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

async function handleAlertsSummary(res) {
  const unreadAlerts = await state.runtime.persistence.alerts.listUnread(20);
  const unreadCount = await state.runtime.persistence.alerts.getUnreadCount();

  json(res, 200, {
    unreadCount,
    unreadAlerts,
  });
}

function handleShutdown(res) {
  json(res, 200, { ok: true, message: 'Servicios en proceso de apagado.' });
  setTimeout(() => {
    stopAutoSyncTimer();

    server.close(() => process.exit(0));
  }, 100);
}

async function runSyncCycle() {
  if (syncInProgress) {
    return { ok: false, error: 'Synchronization already in progress.' };
  }

  syncInProgress = true;
  await refreshState();

  try {
    const result = await state.runtime.syncService.run();
    state.lastSyncResult = result;
    await refreshState();
    return result;
  } finally {
    syncInProgress = false;
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
      const result = await runSyncCycle();
      const statusCode = result?.ok === false && result?.error === 'Synchronization already in progress.' ? 409 : 200;
      json(res, statusCode, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/database/reset') {
      await readBody(req).catch(() => ({}));
      await handleDatabaseReset(res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/alerts-summary') {
      await handleAlertsSummary(res);
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
  startAutoSyncTimer();
});

process.on('SIGINT', () => {
  stopAutoSyncTimer();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  stopAutoSyncTimer();
  server.close(() => process.exit(0));
});
