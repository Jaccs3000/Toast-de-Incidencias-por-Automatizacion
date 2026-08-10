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

export default function App() {
  const [bootstrapContext, setBootstrapContext] = useState(null);
  const [loginState, setLoginState] = useState(null);
  const [syncState, setSyncState] = useState(null);
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startupError, setStartupError] = useState(null);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [shutdownRequested, setShutdownRequested] = useState(false);
  const [sessionToast, setSessionToast] = useState(null);
  const [sessionToastType, setSessionToastType] = useState('warning');
  const hideToastTimerRef = useRef(null);
  const sessionNotificationShownRef = useRef(false);
  const sessionNotificationRef = useRef(null);

  const syncStatus = bootstrapContext?.syncStatus ?? null;
  const session = bootstrapContext?.session ?? null;
  const appState = bootstrapContext?.appState ?? 'booting';
  const sessionIsValid = Boolean(session?.ok);

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

  const notifySessionRequired = () => {
    if (sessionNotificationShownRef.current) {
      return;
    }

    sessionNotificationShownRef.current = true;
    const fallback = () => showSessionToast('Se requiere inicio de sesion en Jira');

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

    if (Notification.permission === 'default') {
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

    fallback();
  };

  const refreshBootstrapContext = async () => {
    const context = await api('/api/bootstrap-context');
    setBootstrapContext(context);

    if (context?.session?.ok) {
      sessionNotificationShownRef.current = false;
      closeSessionNotification();
      setSessionToast(null);
    } else {
      notifySessionRequired();
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

      try {
        await refreshBootstrapContext();
        await refreshAlerts();
      } catch (error) {
        if (mounted) {
          setStartupError(error.message);
        }
      }

      if (mounted) {
        setIsLoading(false);
      }
    };

    initialize();
    pollHandle = setInterval(() => {
      if (!mounted) {
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
    const result = await api('/api/sync', { method: 'POST', body: '{}' });
    setSyncState(result);
    await refreshBootstrapContext();
    await refreshAlerts();
  };

  const handleShutdown = async () => {
    setShutdownRequested(true);
    try {
      await api('/api/shutdown', { method: 'POST', body: '{}' });
    } catch {
      // The backend is expected to close immediately after accepting the request.
    }
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

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Jira Notifications</p>
        <h1>Monitor local de Jira Cloud</h1>
        <p className="copy">
          Base inicial de la aplicacion. La fase 1 deja preparado el arranque,
          la configuracion y la estructura por modulos.
        </p>

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
              <dd>{syncStatus?.last_started_at ?? '-'}</dd>
            </div>
            <div>
              <dt>Fin</dt>
              <dd>{syncStatus?.last_finished_at ?? '-'}</dd>
            </div>
          </dl>

          <div className="actions">
            {appState === 'auth_required' || !sessionIsValid ? (
              <button type="button" onClick={handleLogin} disabled={loginInProgress}>
                {loginInProgress ? 'Esperando inicio de sesion...' : 'Iniciar sesion'}
              </button>
            ) : null}
            <button type="button" onClick={handleSync}>
              Sincronizar ahora
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
