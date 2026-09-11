import { loadConfiguration } from '../config/configLoader.js';
import { Persistence } from '../persistence/persistence.js';
import { LogService } from '../logs/logService.js';
import { AuthService } from '../auth/authService.js';
import { JiraClient } from '../jira/jiraClient.js';
import { JiraCatalogService } from '../jira/jiraCatalogService.js';
import { GraphService } from '../graph/graphService.js';
import { SyncService } from '../sync/syncService.js';
import { AlertsService } from '../alerts/alertsService.js';
import { ToastService } from '../toast/toastService.js';
import { WindowsSessionTask } from '../windowsSession/windowsSessionTask.js';
import { TimeReportsService } from '../reports/timeReportsService.js';
import fs from 'node:fs/promises';
import path from 'node:path';

async function cleanupFiles(directory, retentionDays, predicate = () => true) {
  await fs.mkdir(directory, { recursive: true });
  const limit = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  await Promise.all(entries.filter((entry) => entry.isFile() && predicate(entry.name)).map(async (entry) => {
    const filePath = path.join(directory, entry.name);
    const fileStat = await fs.stat(filePath);
    if (fileStat.mtimeMs < limit) await fs.unlink(filePath).catch(() => {});
  }));
}

async function cleanupAlertImages(persistence, retentionDays) {
  const directory = path.join(process.cwd(), 'data', 'alert-images');
  const referenced = new Set((await persistence.query('SELECT toast_image FROM ALERT_RULES WHERE toast_image IS NOT NULL'))
    .map((row) => path.basename(String(row.toast_image ?? ''))));
  await cleanupFiles(directory, retentionDays, (name) => !referenced.has(name));
}

async function cleanupRetainedFiles(persistence, retentionDays) {
  await cleanupFiles(path.join(process.cwd(), 'exports'), retentionDays);
  await cleanupAlertImages(persistence, retentionDays);
}

export async function bootstrapApp() {
  const configuration = await loadConfiguration();
  const persistence = new Persistence();
  const logs = new LogService({
    retentionDays: configuration.app.retentionDays,
  });

  await logs.initialize();
  const schema = await persistence.initialize();
  await persistence.alerts.removeReadOlderThan(configuration.app.retentionDays);
  await cleanupRetainedFiles(persistence, configuration.app.retentionDays);
  const jqlDefinitions = await persistence.jqlDefinitions.ensureFromQueries(
    configuration.app.jqlQueries,
  );
  configuration.app.jqlQueries = jqlDefinitions.map((definition) => definition.query_text);

  const auth = new AuthService(configuration, { logs });

  const windowsSession = new WindowsSessionTask({ logs });
  await windowsSession.initialize();

  const session = await auth.validateSession();
  const jira = new JiraClient(configuration?.app?.jiraBaseUrl ? {
    baseUrl: configuration.app.jiraBaseUrl,
    headers: session.ok ? session.headers : {},
  } : {});
  const jiraCatalogService = new JiraCatalogService({ logs });
  const jiraCatalog = await jiraCatalogService.refresh(jira, session);
  const graph = new GraphService({
    configuration,
    jira,
    logs,
  });
  const graphConfigErrors = graph.validateGraphConfig();
  if (graphConfigErrors.length > 0) {
    await logs.warn('Graph configuration has validation errors', { errors: graphConfigErrors });
  } else {
    await logs.info('Graph configuration validated');
  }
  const toast = new ToastService({
    enabled: configuration.app.enableToasts,
    logs,
  });
  const alerts = new AlertsService({
    persistence,
    toast,
    logs,
  });

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
  const timeReports = new TimeReportsService({
    persistence,
    jira,
    logs,
    syncService,
  });

  return {
    configuration,
    persistence,
    auth,
    session,
    jira,
    jiraCatalog,
    jiraCatalogService,
    jqlDefinitions,
    graph,
    alerts,
    toast,
    logs,
    windowsSession,
    syncStatus,
    syncService,
    timeReports,
    schema,
  };
}
