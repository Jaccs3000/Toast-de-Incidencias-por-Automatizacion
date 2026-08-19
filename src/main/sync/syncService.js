import { JiraBatchLoader } from '../jira/jiraBatchLoader.js';

function secondsToMinutes(value) {
  const seconds = Number(value ?? 0);
  return Number.isFinite(seconds) ? Math.round(seconds / 60) : 0;
}

export class SyncService {
  constructor({
    persistence,
    jira,
    auth,
    graph,
    alerts,
    toast,
    logs,
    configuration,
  } = {}) {
    this.persistence = persistence;
    this.jira = jira;
    this.auth = auth;
    this.graph = graph;
    this.alerts = alerts;
    this.toast = toast;
    this.logs = logs;
    this.configuration = configuration;
  }

  getIssuesByType(issues) {
    const byType = new Map();

    for (const issue of issues) {
      const issueType = issue?.fields?.issuetype?.name ?? '';
      if (!issueType) {
        continue;
      }

      const key = String(issueType).trim();
      const current = byType.get(key) ?? [];
      current.push(issue);
      byType.set(key, current);
    }

    return byType;
  }

  getIssueStatus(issue) {
    return String(issue?.fields?.status?.name ?? '').trim();
  }

  getIssueProjectName(issue) {
    return String(issue?.fields?.project?.name ?? issue?.fields?.project?.key ?? '').trim();
  }

  getIssueProjectKey(issue) {
    return String(issue?.fields?.project?.key ?? '').trim();
  }

  getLinkedIssues(issue, allIssues = []) {
    const links = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
    const linkedKeys = links.flatMap((link) => [link?.outwardIssue?.key, link?.inwardIssue?.key]).filter(Boolean);
    const linkedByKey = new Map((allIssues ?? []).map((item) => [String(item?.key ?? ''), item]));

    return linkedKeys.map((key) => linkedByKey.get(String(key)) ?? {
      key,
      fields: {
        project: { key: String(key).split('-')[0] },
      },
    });
  }

  projectMatches(issue, expectedProject) {
    const expected = String(expectedProject ?? '').trim().toLocaleLowerCase('es-CO');
    if (!expected) return false;
    return [this.getIssueProjectName(issue), this.getIssueProjectKey(issue)]
      .some((value) => String(value).trim().toLocaleLowerCase('es-CO') === expected);
  }

  linkedProjectExists(issue, allIssues, expectedProject) {
    return this.getLinkedIssues(issue, allIssues).some((linkedIssue) => this.projectMatches(linkedIssue, expectedProject));
  }

  subtaskExists(parentIssue, allIssues, condition) {
    const parentKey = String(parentIssue?.key ?? '').trim();
    return (allIssues ?? []).some((subtask) => (
      String(subtask?.fields?.parent?.key ?? '').trim() === parentKey
      && (!condition.subtaskIssueType || String(subtask?.fields?.issuetype?.name ?? '').trim() === condition.subtaskIssueType)
      && (!condition.subtaskStatus || this.getIssueStatus(subtask) === condition.subtaskStatus)
      && (!condition.subtaskStatusNot || this.getIssueStatus(subtask) !== condition.subtaskStatusNot)
    ));
  }

  issueExists(issuesByType, typeName, predicate = null) {
    const issues = issuesByType.get(typeName) ?? [];

    if (typeof predicate !== 'function') {
      return issues.length > 0;
    }

    return issues.some(predicate);
  }

  evaluateProjectGroupState(projectGroup) {
    const rules = this.configuration?.projectGroupRules?.rules ?? [];
    const defaultValue = this.configuration?.projectGroupRules?.defaultValue ?? 'Creado';
    const issuesByType = this.getIssuesByType(projectGroup.issues ?? []);

    const conditions = {
      exists: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => {
        if (condition.project && this.getIssueProjectName(issue) !== condition.project) {
          return false;
        }

        if (condition.status && this.getIssueStatus(issue) !== condition.status) {
          return false;
        }

        if (condition.statusNot && this.getIssueStatus(issue) === condition.statusNot) {
          return false;
        }

        return true;
      }),
      status: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => {
        if (condition.project && this.getIssueProjectName(issue) !== condition.project) {
          return false;
        }

        return this.getIssueStatus(issue) === condition.status;
      }),
      statusNot: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => {
        if (condition.project && this.getIssueProjectName(issue) !== condition.project) {
          return false;
        }

        return this.getIssueStatus(issue) !== condition.statusNot;
      }),
      issueType: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => {
        if (condition.project && this.getIssueProjectName(issue) !== condition.project) {
          return false;
        }

        if (condition.status && this.getIssueStatus(issue) !== condition.status) {
          return false;
        }

        if (condition.statusNot && this.getIssueStatus(issue) === condition.statusNot) {
          return false;
        }

        return true;
      }),
      subtaskExists: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => (
        this.subtaskExists(issue, projectGroup.issues ?? [], condition)
      )),
      linkedProject: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => (
        (!condition.status || this.getIssueStatus(issue) === condition.status)
        && (!condition.statusNot || this.getIssueStatus(issue) !== condition.statusNot)
        && this.linkedProjectExists(issue, projectGroup.issues ?? [], condition.project)
      )),
      linkedProjectNot: (condition) => this.issueExists(issuesByType, condition.issueType, (issue) => (
        (!condition.status || this.getIssueStatus(issue) === condition.status)
        && (!condition.statusNot || this.getIssueStatus(issue) !== condition.statusNot)
        && !this.linkedProjectExists(issue, projectGroup.issues ?? [], condition.project)
      )),
    };

    const evaluateNode = (node) => {
      if (!node || typeof node !== 'object') {
        return false;
      }

      if (Array.isArray(node.all)) {
        return node.all.every(evaluateNode);
      }

      if (Array.isArray(node.any)) {
        return node.any.some(evaluateNode);
      }

      if (Array.isArray(node.none)) {
        return !node.none.some(evaluateNode);
      }

      if (node.match === 'exists' && node.issueType) {
        return conditions.exists(node);
      }

      if (node.match === 'subtaskExists' && node.issueType) {
        return conditions.subtaskExists(node);
      }

      if (node.match === 'linkedProject' && node.issueType) {
        return conditions.linkedProject(node);
      }

      if (node.match === 'linkedProjectNot' && node.issueType) {
        return conditions.linkedProjectNot(node);
      }

      if (node.issueType && node.status && node.statusNot) {
        return conditions.issueType(node);
      }

      if (node.issueType && node.status) {
        return conditions.status(node);
      }

      if (node.issueType && node.statusNot) {
        return conditions.statusNot(node);
      }

      if (node.issueType) {
        return conditions.issueType(node);
      }

      return false;
    };

    const orderedRules = [...rules]
      .filter((rule) => Boolean(rule?.enabled))
      .sort((a, b) => Number(a?.priority ?? 0) - Number(b?.priority ?? 0));

    for (const rule of orderedRules) {
      if (evaluateNode(rule?.when)) {
        return rule.output ?? defaultValue;
      }
    }

    return defaultValue;
  }

  async persistProjectGroup(projectGroup, detailedSeedIssue, startedAt, { persistIssues = true } = {}) {
    await this.persistence.projectGroups.upsert({
      id: projectGroup.id,
      rootIssueId: projectGroup.rootIssueId,
      rootIssueKey: projectGroup.rootIssueKey,
      estado_general: 'Creado',
      created: detailedSeedIssue?.fields?.created ?? startedAt,
      updated: new Date().toISOString(),
    });

    if (persistIssues) {
      await this.persistence.issues.upsertMany(projectGroup.issues);
    }
    await this.persistence.projectGroupIssues.replaceForGroup(
      projectGroup.id,
      projectGroup.members,
      projectGroup.relationships,
    );
    await this.persistence.relationships.replaceForGroup(projectGroup.id, projectGroup.relationships.map((relationship, index) => ({
      id: `${projectGroup.id}-rel-${index}`,
      fromIssueId: relationship.fromIssueId,
      toIssueId: relationship.toIssueId,
      relationType: relationship.relationType,
      created: new Date().toISOString(),
    })));

    const estadoGeneral = this.evaluateProjectGroupState(projectGroup);
    projectGroup.estado_general = estadoGeneral;

    await this.persistence.projectGroups.upsert({
      id: projectGroup.id,
      rootIssueId: projectGroup.rootIssueId,
      rootIssueKey: projectGroup.rootIssueKey,
      estado_general: estadoGeneral,
      created: detailedSeedIssue?.fields?.created ?? startedAt,
      updated: new Date().toISOString(),
    });

    await this.logs.info('ProjectGroup built from seed issue', {
      projectGroupId: projectGroup.id,
      rootIssueKey: projectGroup.rootIssueKey,
      estadoGeneral,
      issuesCount: projectGroup.issues.length,
      relationshipsCount: projectGroup.relationships.length,
    });
  }

  async getExistingSnapshot() {
    return this.persistence.query(
      `
      SELECT
        pgi.project_group_id,
        i.id,
        i.key,
        i.project,
        i.issuetype,
        i.issuetype_icon_url,
        i.summary,
        i.description,
        i.status,
        i.reporter,
        i.assignee,
        i.created,
        i.updated,
        i.resolutiondate,
        i.parent,
        i.timeestimate,
        i.timespent,
        i.timeremaining,
        i.issuelinks
      FROM JIRA_PROJECT_GROUP_ISSUES pgi
      JOIN JIRA_ISSUES i ON i.id = pgi.issue_id
      `,
    );
  }

  getSnapshotMap(rows = []) {
    return new Map(rows.map((row) => [
      `${row.project_group_id}|${row.id}`,
      row,
    ]));
  }

  getIncomingSnapshot(projectGroups = []) {
    const snapshot = [];

    for (const group of projectGroups) {
      for (const issue of group.issues ?? []) {
        const member = (group.members ?? []).find((item) => String(item.id) === String(issue.id));
        snapshot.push({
          project_group_id: group.id,
          id: String(issue.id),
          key: issue.key ?? null,
          project: issue.fields?.project?.key ?? issue.fields?.project?.name ?? null,
          issuetype: issue.fields?.issuetype?.name ?? null,
          issuetype_icon_url: issue.fields?.issuetype?.iconUrl ?? null,
          summary: issue.fields?.summary ?? null,
          description: issue.fields?.description ?? null,
          status: issue.fields?.status?.name ?? null,
          reporter: issue.fields?.reporter?.displayName ?? issue.fields?.reporter?.name ?? null,
          assignee: issue.fields?.assignee?.displayName ?? issue.fields?.assignee?.name ?? null,
          created: issue.fields?.created ?? null,
          updated: issue.fields?.updated ?? null,
          resolutiondate: issue.fields?.resolutiondate ?? null,
          parent: issue.fields?.parent?.key ?? null,
          timeestimate: secondsToMinutes(issue.fields?.timeoriginalestimate ?? issue.fields?.timeestimate),
          timespent: secondsToMinutes(issue.fields?.timespent),
          timeremaining: secondsToMinutes(issue.fields?.timeoriginalestimate ?? issue.fields?.timeestimate)
            - secondsToMinutes(issue.fields?.timespent),
          issuelinks: typeof issue.fields?.issuelinks === 'string'
            ? issue.fields.issuelinks
            : JSON.stringify(issue.fields?.issuelinks ?? null),
          is_root: member?.isRoot ? 1 : 0,
        });
      }
    }

    return snapshot;
  }

  getChangedFields(before, after) {
    const fields = [
      'project', 'issuetype', 'issuetype_icon_url', 'summary', 'description', 'status', 'reporter',
      'assignee', 'created', 'updated', 'resolutiondate', 'parent', 'timeestimate', 'timespent', 'timeremaining', 'issuelinks',
    ];

    return fields.filter((field) => String(before?.[field] ?? '') !== String(after?.[field] ?? ''));
  }

  compareSnapshots(beforeRows, afterRows) {
    const before = this.getSnapshotMap(beforeRows);
    const after = this.getSnapshotMap(afterRows);
    const changes = [];

    for (const [identity, current] of after) {
      const previous = before.get(identity);
      if (!previous) {
        changes.push({
          project_group_id: current.project_group_id,
          issue_id: current.id,
          issue_key: current.key,
          change_type: 'created',
          changed_fields: [],
          before_json: null,
          after_json: current,
        });
        continue;
      }

      const changedFields = this.getChangedFields(previous, current);
      if (changedFields.length > 0) {
        changes.push({
          project_group_id: current.project_group_id,
          issue_id: current.id,
          issue_key: current.key,
          change_type: 'updated',
          changed_fields: changedFields,
          before_json: previous,
          after_json: current,
        });
      }
    }

    for (const [identity, previous] of before) {
      if (!after.has(identity)) {
        changes.push({
          project_group_id: previous.project_group_id,
          issue_id: previous.id,
          issue_key: previous.key,
          change_type: 'removed',
          changed_fields: [],
          before_json: previous,
          after_json: null,
        });
      }
    }

    return changes;
  }

  async persistChanges(syncId, changes) {
    await this.persistence.exec('DELETE FROM SYNC_CHANGES');

    for (const change of changes) {
      await this.persistence.exec(
        `
        INSERT INTO SYNC_CHANGES (
          sync_id, project_group_id, issue_id, issue_key, change_type,
          changed_fields, before_json, after_json, created
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          syncId,
          change.project_group_id ?? null,
          change.issue_id,
          change.issue_key,
          change.change_type,
          JSON.stringify(change.changed_fields ?? []),
          change.before_json ? JSON.stringify(change.before_json) : null,
          change.after_json ? JSON.stringify(change.after_json) : null,
          new Date().toISOString(),
        ],
      );
    }
  }

  deduplicateProjectGroups(candidateGroups) {
    const unique = new Map();
    for (const group of Array.isArray(candidateGroups) ? candidateGroups : []) {
      const signature = [...new Set((group.issues ?? [])
        .map((issue) => String(issue?.id ?? issue?.key ?? ''))
        .filter(Boolean))]
        .sort()
        .join('|');
      if (signature && !unique.has(signature)) {
        unique.set(signature, group);
      }
    }
    return [...unique.values()];
  }

  async run({ signal } = {}) {
    if (!this.persistence || !this.jira || !this.logs || !this.auth || !this.graph || !this.alerts) {
      throw new Error('SyncService dependencies are not fully configured.');
    }

    const startedAt = new Date().toISOString();
    await this.persistence.syncStatus.updateStatus({
      last_status: 'Sincronizando...',
      last_started_at: startedAt,
      last_finished_at: null,
      last_error_message: null,
      is_running: true,
      is_canceling: false,
    });

    try {
      const throwIfCanceled = () => {
        if (signal?.aborted) {
          throw new DOMException('Synchronization canceled.', 'AbortError');
        }
      };

      throwIfCanceled();
      if (!this.configuration?.app?.jiraBaseUrl) {
        throw new Error('Jira base URL is not configured.');
      }

      let session = await this.auth.validateSession();
      throwIfCanceled();

      if (!session.ok) {
        await this.logs.warn('Synchronization stopped: Jira session invalid');
        await this.persistence.syncStatus.updateStatus({
          last_status: 'Requiere inicio de sesión en Jira.',
          is_running: false,
          is_canceling: false,
        });

        await this.logs.warn('Jira session is missing or invalid; login requires explicit user action');
        throw new Error(session.reason ?? 'Jira login is required.');
      }

      if (!session.ok) {
        throw new Error(session.reason ?? 'Jira login was not completed.');
      }

      this.jira.setSession(session);
      this.jira.resetMetrics?.();
      const phaseTimings = {};
      const graphMetrics = {
        seedReuses: 0,
        issueLoads: 0,
        cacheHits: 0,
      };

      await this.logs.info('Synchronization cycle started', {
        startedAt,
        jqlCount: this.configuration?.app?.jqlQueries?.length ?? 0,
      });

      await this.logs.info('Synchronization phase: validating Jira user');
      await this.jira.getMyself({ signal });
      await this.logs.info('Synchronization phase completed: Jira user validated');

      const jqlQueries = this.configuration?.app?.jqlQueries ?? [];
      if (jqlQueries.length === 0) {
        throw new Error('Debe existir al menos un JQL configurado.');
      }

      const seedIssues = new Map();
      const jqlStartedAt = Date.now();
      for (const jql of jqlQueries) {
        throwIfCanceled();
        await this.logs.info('Executing configured JQL', { jql });
        const searchResult = await this.jira.searchIssues(jql, 50, { signal });
        await this.logs.info('Configured JQL completed', {
          jql,
          issuesCount: searchResult?.issues?.length ?? 0,
        });
        for (const issue of searchResult?.issues ?? []) {
          if (issue?.key) {
            seedIssues.set(issue.key, issue);
          }
        }
      }
      phaseTimings.jqlMs = Date.now() - jqlStartedAt;

      await this.logs.info('JQL phase completed', {
        uniqueSeedIssues: seedIssues.size,
        durationMs: phaseTimings.jqlMs,
      });

      await this.logs.info('Full configured graph traversal planned', {
        graphIssueTypes: [...this.graph.getGraphIssueTypes()],
      });

      const candidateGroups = [];
      const graphIssueCache = new Map([...seedIssues.entries()]);
      const batchLoader = new JiraBatchLoader({
        jira: this.jira,
        signal,
        batchSize: 100,
        concurrency: 2,
      });
      const graphStartedAt = Date.now();
      if (seedIssues.size > 0) {
        const groupsBySeed = await Promise.all([...seedIssues.values()].map(async (seedIssue) => {
          throwIfCanceled();
          await this.logs.info('Reusing ProjectGroup seed issue from JQL', { issueKey: seedIssue.key });
          const detailedSeedIssue = seedIssue;
          graphMetrics.seedReuses += 1;
          await this.logs.info('Traversing graph for ProjectGroup', { issueKey: seedIssue.key });
          if (!this.graph.isAllowedSeed(detailedSeedIssue)) {
            await this.logs.warn('Seed issue skipped because its type is outside graph scope', {
              issueKey: seedIssue.key,
              issueType: detailedSeedIssue?.fields?.issuetype?.name ?? null,
            });
            return [];
          }
          const projectGroups = await this.graph.buildProjectGroups(
            detailedSeedIssue,
            async (issueKey) => batchLoader.load(issueKey),
            {
              signal,
              issueCache: graphIssueCache,
              metrics: graphMetrics,
            },
          );
          await this.logs.info('Graph traversal completed', {
            issueKey: seedIssue.key,
            projectGroupsCount: projectGroups.length,
            issuesCount: projectGroups.map((group) => group.issues.length),
            relationshipsCount: projectGroups.map((group) => group.relationships.length),
          });
          return projectGroups;
        }));
        candidateGroups.push(...groupsBySeed.flat());
      } else {
        await this.logs.warn('No seed issue found for ProjectGroup build');
      }
      phaseTimings.graphMs = Date.now() - graphStartedAt;

      const consolidatedGroups = this.deduplicateProjectGroups(candidateGroups);
      await this.logs.info('ProjectGroup consolidation completed', {
        candidateGroups: candidateGroups.length,
        consolidatedGroups: consolidatedGroups.length,
        durationMs: phaseTimings.graphMs,
        graphMetrics,
        batchMetrics: batchLoader.getStats(),
      });

      const previousSnapshot = await this.getExistingSnapshot();
      const incomingSnapshot = this.getIncomingSnapshot(consolidatedGroups);
      const changes = this.compareSnapshots(previousSnapshot, incomingSnapshot);
      const syncId = `sync-${startedAt}`;
      let alertResult = { createdAlertsCount: 0, createdAlerts: [] };

      await this.logs.info('Synchronization comparison completed', {
        syncId,
        created: changes.filter((change) => change.change_type === 'created').length,
        updated: changes.filter((change) => change.change_type === 'updated').length,
        removed: changes.filter((change) => change.change_type === 'removed').length,
      });

      const persistenceStartedAt = Date.now();
      await this.persistence.transaction(async () => {
        throwIfCanceled();
        await this.persistence.exec('DELETE FROM JIRA_RELATIONSHIPS');
        await this.persistence.exec('DELETE FROM JIRA_PROJECT_GROUP_ISSUES');
        await this.persistence.exec('DELETE FROM JIRA_PROJECT_GROUPS');
        await this.persistence.exec('DELETE FROM JIRA_ISSUES');

        const allIssues = new Map();
        for (const projectGroup of consolidatedGroups) {
          for (const issue of projectGroup.issues ?? []) {
            const issueId = String(issue?.id ?? '').trim();
            if (issueId && !allIssues.has(issueId)) {
              allIssues.set(issueId, issue);
            }
          }
        }
        await this.persistence.issues.upsertMany([...allIssues.values()]);

        for (const projectGroup of consolidatedGroups) {
          throwIfCanceled();
          const detailedSeedIssue = projectGroup.issues.find((issue) => String(issue?.id) === String(projectGroup.rootIssueId))
            ?? projectGroup.issues[0];
          await this.persistProjectGroup(projectGroup, detailedSeedIssue, startedAt, { persistIssues: false });
        }

        await this.persistChanges(syncId, changes);
        throwIfCanceled();
        alertResult = await this.alerts.evaluate({ notify: false });
      });
      phaseTimings.persistenceMs = Date.now() - persistenceStartedAt;

      throwIfCanceled();
      await this.alerts.notifyCreated(alertResult.createdAlerts);

      for (const projectGroup of consolidatedGroups) {
        await this.logs.info('ProjectGroup persisted', {
          projectGroupId: projectGroup.id,
          issuesCount: projectGroup.issues.length,
          relationshipsCount: projectGroup.relationships.length,
        });
      }

      await this.logs.info('Alerts evaluated after commit', {
        createdAlertsCount: alertResult.createdAlertsCount,
        phaseTimings,
        batchMetrics: batchLoader.getStats(),
        jiraMetrics: this.jira.getMetrics?.() ?? null,
      });

      await this.logs.info('Synchronization cycle finished', {
        reason: 'ProjectGroup build and persistence completed.',
      });

      const finishedAt = new Date().toISOString();
      await this.persistence.syncStatus.updateStatus({
        last_status: 'Sincronizado correctamente.',
        last_finished_at: finishedAt,
        last_success_at: finishedAt,
        is_running: false,
        is_canceling: false,
        last_error_message: null,
      });

      return {
        ok: true,
        startedAt,
        finishedAt,
      };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const canceled = error?.name === 'AbortError';
      await this.logs[canceled ? 'warn' : 'error'](canceled ? 'Synchronization cycle canceled' : 'Synchronization cycle failed', {
        message: error.message,
        jiraMetrics: this.jira.getMetrics?.() ?? null,
      });

      await this.persistence.syncStatus.updateStatus({
        last_status: 'Error durante la sincronización.',
        last_finished_at: finishedAt,
        last_status: canceled ? 'Sincronizacion detenida.' : 'Error durante la sincronizacion.',
        last_error_message: canceled ? null : error.message,
        is_running: false,
        is_canceling: false,
      });

      return {
        ok: false,
        startedAt,
        finishedAt,
        canceled,
        error: error.message,
      };
    }
  }
}
