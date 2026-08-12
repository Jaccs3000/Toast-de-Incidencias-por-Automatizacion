import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loadDatabaseSchema } from './schema.js';
import { SettingsRepository } from './repositories/settingsRepository.js';
import { SyncStatusRepository } from './repositories/syncStatusRepository.js';
import { IssuesRepository } from './repositories/issuesRepository.js';
import { ProjectGroupsRepository } from './repositories/projectGroupsRepository.js';
import { ProjectGroupIssuesRepository } from './repositories/projectGroupIssuesRepository.js';
import { RelationshipsRepository } from './repositories/relationshipsRepository.js';
import { AlertsRepository } from './repositories/alertsRepository.js';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');

export class Persistence {
  constructor(databasePath = path.join(process.cwd(), 'data', 'jira-notifications.duckdb')) {
    this.databasePath = databasePath;
    this.database = null;
    this.connection = null;
    this.settings = new SettingsRepository(this);
    this.syncStatus = new SyncStatusRepository(this);
    this.issues = new IssuesRepository(this);
    this.projectGroups = new ProjectGroupsRepository(this);
    this.projectGroupIssues = new ProjectGroupIssuesRepository(this);
    this.relationships = new RelationshipsRepository(this);
    this.alerts = new AlertsRepository(this);
  }

  async initialize() {
    await fs.mkdir(path.dirname(this.databasePath), { recursive: true });

    if (!this.database) {
      this.database = new duckdb.Database(this.databasePath);
      this.connection = this.database.connect();
    }

    const schema = await loadDatabaseSchema();
    await this.exec(schema);
    try {
      await this.exec('ALTER TABLE ALERT_RULES ADD COLUMN condition_config TEXT');
    } catch {
      // The column already exists in databases initialized after the schema update.
    }
    try {
      await this.exec('ALTER TABLE JIRA_ISSUES ADD COLUMN issuetype_icon_url TEXT');
    } catch {
      // The column already exists in databases initialized after the schema update.
    }
    try {
      await this.exec('ALTER TABLE ALERT_RULES ADD COLUMN retry_minutes INTEGER');
      await this.exec('UPDATE ALERT_RULES SET retry_minutes = 0 WHERE retry_minutes IS NULL');
    } catch {
      // The column already exists in databases initialized after the schema update.
    }
    try {
      await this.exec('ALTER TABLE ALERTS ADD COLUMN next_retry_at TEXT');
    } catch {
      // The column already exists in databases initialized after the schema update.
    }
    await this.syncStatus.ensureRow();

    return schema;
  }

  async connect() {
    if (!this.connection) {
      await this.initialize();
    }

    return this.connection;
  }

  async exec(sql, params = []) {
    const connection = await this.connect();

    return new Promise((resolve, reject) => {
      if (!Array.isArray(params) || params.length === 0) {
        connection.exec(sql, (error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
        return;
      }

      const statement = connection.prepare(sql);
      statement.run(...params, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  async query(sql, params = []) {
    const connection = await this.connect();

    return new Promise((resolve, reject) => {
      connection.all(sql, ...params, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(rows);
      });
    });
  }

  async transaction(work) {
    await this.exec('BEGIN TRANSACTION');

    try {
      const result = await work();
      await this.exec('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.exec('ROLLBACK');
      } catch {
        // Preserve the original synchronization error.
      }

      throw error;
    }
  }

  async close() {
    if (this.connection) {
      await new Promise((resolve) => this.connection.close(() => resolve()));
      this.connection = null;
    }

    if (this.database) {
      await new Promise((resolve) => this.database.close(() => resolve()));
      this.database = null;
    }
  }

  async reset() {
    await this.exec(`
      BEGIN TRANSACTION;
      DELETE FROM ALERTS;
      DELETE FROM JIRA_RELATIONSHIPS;
      DELETE FROM JIRA_PROJECT_GROUP_ISSUES;
      DELETE FROM JIRA_PROJECT_GROUPS;
      DELETE FROM JIRA_ISSUES;
      DELETE FROM SYNC_CHANGES;
      DELETE FROM SYNC_STATUS;
      COMMIT;
    `);
    await this.syncStatus.ensureRow();
  }
}
