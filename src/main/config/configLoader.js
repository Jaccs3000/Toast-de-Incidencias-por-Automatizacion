import fs from 'node:fs/promises';
import path from 'node:path';

const configDir = path.join(process.cwd(), 'config');

const defaultAppConfig = {
  version: 1,
  jiraBaseUrl: '',
  chromeUserDataDir: '',
  chromeProfileDirectory: 'Default',
  syncIntervalSeconds: 300,
  queryDelaySeconds: 1,
  logRetentionDays: 7,
  startMinimized: true,
  enableToasts: true,
};

const defaultGraphConfig = {
  version: 1,
  entryTypes: [],
  nodes: {},
};

const defaultProjectGroupRulesConfig = {
  version: 1,
  defaultValue: 'Creado',
  rules: [],
};

async function readJson(fileName, fallback) {
  const filePath = path.join(configDir, fileName);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function validateAppConfig(config) {
  const normalized = { ...defaultAppConfig, ...config };

  if (!Number.isInteger(normalized.syncIntervalSeconds) || normalized.syncIntervalSeconds < 1) {
    normalized.syncIntervalSeconds = defaultAppConfig.syncIntervalSeconds;
  }

  if (typeof normalized.jiraBaseUrl !== 'string') {
    normalized.jiraBaseUrl = defaultAppConfig.jiraBaseUrl;
  }

  if (typeof normalized.chromeUserDataDir !== 'string') {
    normalized.chromeUserDataDir = defaultAppConfig.chromeUserDataDir;
  }

  if (typeof normalized.chromeProfileDirectory !== 'string' || !normalized.chromeProfileDirectory.trim()) {
    normalized.chromeProfileDirectory = defaultAppConfig.chromeProfileDirectory;
  }

  if (!Number.isInteger(normalized.queryDelaySeconds) || normalized.queryDelaySeconds < 0) {
    normalized.queryDelaySeconds = defaultAppConfig.queryDelaySeconds;
  }

  if (!Number.isInteger(normalized.logRetentionDays) || normalized.logRetentionDays < 1) {
    normalized.logRetentionDays = defaultAppConfig.logRetentionDays;
  }

  normalized.startMinimized = Boolean(normalized.startMinimized);
  normalized.enableToasts = Boolean(normalized.enableToasts);

  return normalized;
}

function validateGraphConfig(config) {
  const normalized = { ...defaultGraphConfig, ...config };

  if (!Array.isArray(normalized.entryTypes)) {
    normalized.entryTypes = [];
  }

  if (!normalized.nodes || typeof normalized.nodes !== 'object' || Array.isArray(normalized.nodes)) {
    normalized.nodes = {};
  }

  return normalized;
}

function validateProjectGroupRulesConfig(config) {
  const normalized = { ...defaultProjectGroupRulesConfig, ...config };

  if (typeof normalized.defaultValue !== 'string' || !normalized.defaultValue.trim()) {
    normalized.defaultValue = defaultProjectGroupRulesConfig.defaultValue;
  }

  if (!Array.isArray(normalized.rules)) {
    normalized.rules = [];
  }

  return normalized;
}

export async function loadConfiguration() {
  const [appConfig, graphConfig, projectGroupRulesConfig] = await Promise.all([
    readJson('app.json', defaultAppConfig),
    readJson('graph.json', defaultGraphConfig),
    readJson('projectgroup_rules.json', defaultProjectGroupRulesConfig),
  ]);

  return {
    app: validateAppConfig(appConfig),
    graph: validateGraphConfig(graphConfig),
    projectGroupRules: validateProjectGroupRulesConfig(projectGroupRulesConfig),
  };
}

export { defaultAppConfig, defaultGraphConfig, defaultProjectGroupRulesConfig };
