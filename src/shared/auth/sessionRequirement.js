function normalizedStatus(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function isJiraAuthenticationSyncFailure(syncStatus) {
  const value = normalizedStatus([
    syncStatus?.last_status,
    syncStatus?.last_error_message,
  ].filter(Boolean).join(' '));

  return /requiere inicio de sesion en jira|jira session is not valid|jira login is required|sesion.*(invalida|invalid)/.test(value);
}

export function requiresVisibleJiraLogin(context) {
  if (context?.session?.ok !== false) {
    return false;
  }

  if (context?.appState === 'syncing' || Boolean(context?.syncStatus?.is_running)) {
    return false;
  }

  return normalizedStatus(context?.syncStatus?.last_status)
    === 'requiere inicio de sesion en jira.';
}
