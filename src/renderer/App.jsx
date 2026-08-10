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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [bootstrapContext, setBootstrapContext] = useState(null);
  const [loginState, setLoginState] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [alertsSummary, setAlertsSummary] = useState(null);
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
  const [databaseResetting, setDatabaseResetting] = useState(false);
  const [sessionToast, setSessionToast] = useState(null);
  const [sessionToastType, setSessionToastType] = useState('warning');
  const hideToastTimerRef = useRef(null);
  const lastSessionNotificationAtRef = useRef(0);
  const permissionRequestStartedRef = useRef(false);
  const sessionNotificationRef = useRef(null);
  const servicesStoppedRef = useRef(false);
  const jqlInitializedRef = useRef(false);
  const jqlDirtyRef = useRef(false);

  const syncStatus = bootstrapContext?.syncStatus ?? null;
  const session = bootstrapContext?.session ?? null;
  const appState = bootstrapContext?.appState ?? 'booting';
  const sessionIsValid = Boolean(session?.ok);
  const syncInProgress = Boolean(syncStatus?.is_running) || appState === 'syncing';

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

  const closeSessionNotification = () => {
    if (sessionNotificationRef.current) {
      sessionNotificationRef.current.close();
      sessionNotificationRef.current = null;
    }
  };

  const showNativeNotification = (title, body, onClick) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return false;
    }

    const notification = new Notification(title, { body });
    notification.onclick = () => {
      window.focus();
      notification.close();
      onClick?.();
    };
    return true;
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
    if (typeof context?.autoSyncEnabled === 'boolean') {
      setAutoSyncEnabled(context.autoSyncEnabled);
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
    return summary;
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
    }, 5000);

    return () => {
      mounted = false;
      if (pollHandle) {
        clearInterval(pollHandle);
      }
      clearToastTimer();
      closeSessionNotification();
    };
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
      return;
    }

    const result = await api('/api/sync', { method: 'POST', body: '{}' });
    setSyncState(result);
    await refreshBootstrapContext();
    await refreshAlerts();
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
    } catch (error) {
      setJqlMessage(`No se pudo guardar el JQL: ${error.message}`);
    } finally {
      setJqlSaving(false);
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
    } catch (error) {
      setAutoSyncEnabled(!nextValue);
      setJqlMessage(`No se pudo cambiar la sincronizacion automatica: ${error.message}`);
    } finally {
      setAutoSyncSaving(false);
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
      await refreshBootstrapContext();
      await refreshAlerts();
    } catch (error) {
      setJqlMessage(`No se pudo borrar la base de datos: ${error.message}`);
    } finally {
      setDatabaseResetting(false);
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
        <p className="eyebrow">Jira Notifications</p>
        <h1>Monitor local de Jira Cloud</h1>
        <p className="copy">
          Base inicial de la aplicacion. La fase 1 deja preparado el arranque,
          la configuracion y la estructura por modulos.
        </p>

        <div className="settings-card">
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
        </div>

        {sessionToast ? (
          <div className={`toast-banner ${sessionToastType === 'success' ? 'toast-success' : 'toast-warning'}`}>
            <span>{sessionToast}</span>
            {sessionToastType === 'warning' ? (
              <button type="button" onClick={handleLogin} disabled={loginInProgress}>
                {loginInProgress ? 'Esperando inicio de sesion...' : 'Iniciar sesion'}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="status-card">
          <h2>Estado inicial</h2>
          <dl className="status-grid">
            <div>
              <dt>Estado app</dt>
              <dd>{appStateLabel}</dd>
            </div>
            <div>
              <dt>Sincronizacion</dt>
              <dd>{syncStatus?.last_status ?? 'Cargando...'}</dd>
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
              <button type="button" onClick={handleLogin} disabled={loginInProgress}>
                {loginInProgress ? 'Esperando inicio de sesion...' : 'Iniciar sesion'}
              </button>
            ) : null}
            <button type="button" onClick={handleSync} disabled={syncInProgress}>
              {syncInProgress ? 'Sincronizando...' : 'Sincronizar ahora'}
            </button>
            <button type="button" onClick={handleDatabaseReset} disabled={databaseResetting || syncInProgress}>
              {databaseResetting ? 'Borrando BD...' : 'Borrar BD local'}
            </button>
            <button type="button" onClick={handleShutdown} disabled={shutdownRequested}>
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
                    <strong>{alert.rule_id}</strong>
                    <span>{alert.issue_id}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="alerts-empty">No hay alertas pendientes.</p>
            )}
          </div>

          {loginState ? (
            <pre className="login-state">{JSON.stringify(loginState, null, 2)}</pre>
          ) : null}
          {syncState ? (
            <pre className="login-state">{JSON.stringify(syncState, null, 2)}</pre>
          ) : null}
        </div>
      </section>
    </main>
  );
}
