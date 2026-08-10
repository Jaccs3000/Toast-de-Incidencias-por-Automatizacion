import { loadConfiguration } from '../config/configLoader.js';
import { Persistence } from '../persistence/persistence.js';
import { LogService } from '../logs/logService.js';
import { AuthService } from '../auth/authService.js';
import { JiraClient } from '../jira/jiraClient.js';
import { GraphService } from '../graph/graphService.js';
import { SyncService } from '../sync/syncService.js';
import { AlertsService } from '../alerts/alertsService.js';
import { ToastService } from '../toast/toastService.js';

export async function bootstrapApp() {
  const configuration = await loadConfiguration();
  const persistence = new Persistence();
  const auth = new AuthService(configuration);
  const logs = new LogService({
    retentionDays: configuration.app.logRetentionDays,
  });

  await logs.initialize();

  const session = await auth.validateSession();
  const jira = new JiraClient(configuration?.app?.jiraBaseUrl ? {
    baseUrl: configuration.app.jiraBaseUrl,
    headers: session.ok ? session.headers : {},
  } : {});
  const graph = new GraphService({
    configuration,
    jira,
    logs,
  });
  const toast = new ToastService({
    enabled: configuration.app.enableToasts,
    logs,
  });
  const alerts = new AlertsService({
    persistence,
    toast,
    logs,
  });

  const schema = await persistence.initialize();
  const syncStatus = await persistence.syncStatus.getCurrent();
  const syncService = new SyncService({
    persistence,
    jira,
    auth,
    graph,
    alerts,
    toast,
    logs,
    configuration,
  });

  return {
    configuration,
    persistence,
    auth,
    session,
    jira,
    graph,
    alerts,
    toast,
    logs,
    syncStatus,
    syncService,
    schema,
  };
}
