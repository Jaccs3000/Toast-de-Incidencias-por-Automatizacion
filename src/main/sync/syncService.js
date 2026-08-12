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

  async persistProjectGroup(projectGroup, detailedSeedIssue, startedAt) {
    await this.persistence.projectGroups.upsert({
      id: projectGroup.id,
      rootIssueId: projectGroup.rootIssueId,
      rootIssueKey: projectGroup.rootIssueKey,
      estado_general: 'Creado',
      created: detailedSeedIssue?.fields?.created ?? startedAt,
      updated: new Date().toISOString(),
    });

    for (const issue of projectGroup.issues) {
      await this.persistence.issues.upsert(issue);
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
        i.summary,
        i.description,
        i.status,
        i.reporter,
        i.assignee,
        i.created,
        i.updated,
        i.parent,
        i.timeestimate,
        i.timespent,
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
          summary: issue.fields?.summary ?? null,
          description: issue.fields?.description ?? null,
          status: issue.fields?.status?.name ?? null,
          reporter: issue.fields?.reporter?.displayName ?? issue.fields?.reporter?.name ?? null,
          assignee: issue.fields?.assignee?.displayName ?? issue.fields?.assignee?.name ?? null,
          created: issue.fields?.created ?? null,
          updated: issue.fields?.updated ?? null,
          parent: issue.fields?.parent?.key ?? null,
          timeestimate: issue.fields?.timeoriginalestimate ?? issue.fields?.timeestimate ?? null,
          timespent: issue.fields?.timespent ?? null,
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
      'project', 'issuetype', 'summary', 'description', 'status', 'reporter',
      'assignee', 'created', 'updated', 'parent', 'timeestimate', 'timespent', 'issuelinks',
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

  consolidateProjectGroups(candidateGroups) {
    const groups = Array.isArray(candidateGroups) ? candidateGroups : [];
    const parent = groups.map((_, index) => index);

    const find = (index) => {
      if (parent[index] !== index) {
        parent[index] = find(parent[index]);
      }
      return parent[index];
    };

    const union = (left, right) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) {
        parent[rightRoot] = leftRoot;
      }
    };

    const issueSets = groups.map((group) => new Set(
      (group.issues ?? []).map((issue) => String(issue?.id ?? issue?.key ?? '')).filter(Boolean),
    ));

    for (let left = 0; left < issueSets.length; left += 1) {
      for (let right = left + 1; right < issueSets.length; right += 1) {
        const overlaps = [...issueSets[left]].some((issueId) => issueSets[right].has(issueId));
        if (overlaps) {
          union(left, right);
        }
      }
    }

    const components = new Map();
    groups.forEach((group, index) => {
      const root = find(index);
      const current = components.get(root) ?? [];
      current.push(group);
      components.set(root, current);
    });

    return [...components.values()].map((component) => {
      const first = component[0];
      const issues = new Map();
      const members = new Map();
      const relationships = new Map();

      for (const group of component) {
        for (const issue of group.issues ?? []) {
          const issueId = String(issue?.id ?? issue?.key ?? '');
          if (issueId && !issues.has(issueId)) {
            issues.set(issueId, issue);
          }
        }

        for (const member of group.members ?? []) {
          const memberId = String(member?.id ?? '');
          if (!memberId) {
            continue;
          }

          const existing = members.get(memberId);
          if (!existing || (member.depth ?? 0) < (existing.depth ?? 0)) {
            members.set(memberId, { ...member, isRoot: false });
          }
        }

        for (const relationship of group.relationships ?? []) {
          const relationshipKey = [
            relationship.fromIssueId,
            relationship.toIssueId,
            relationship.relationType,
          ].join('|');
          relationships.set(relationshipKey, relationship);
        }
      }

      const rootIssueId = String(first.rootIssueId ?? first.rootIssueKey ?? '');
      if (rootIssueId && members.has(rootIssueId)) {
        members.set(rootIssueId, { ...members.get(rootIssueId), isRoot: true, depth: 0 });
      }

      return {
        ...first,
        issues: [...issues.values()],
        members: [...members.values()],
        relationships: [...relationships.values()],
      };
    });
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

      await this.logs.info('JQL phase completed', {
        uniqueSeedIssues: seedIssues.size,
      });

      const candidateGroups = [];
      if (seedIssues.size > 0) {
        for (const seedIssue of seedIssues.values()) {
          throwIfCanceled();
          await this.logs.info('Loading ProjectGroup seed issue', { issueKey: seedIssue.key });
          const detailedSeedIssue = await this.jira.getIssue(seedIssue.key, { signal });
          await this.logs.info('Traversing graph for ProjectGroup', { issueKey: seedIssue.key });
          const projectGroup = await this.graph.buildProjectGroup(
            detailedSeedIssue,
            async (issueKey) => this.jira.getIssue(issueKey, { signal }),
            { signal },
          );
          await this.logs.info('Graph traversal completed', {
            issueKey: seedIssue.key,
            issuesCount: projectGroup.issues.length,
            relationshipsCount: projectGroup.relationships.length,
          });
          candidateGroups.push(projectGroup);
        }
      } else {
        await this.logs.warn('No seed issue found for ProjectGroup build');
      }

      const consolidatedGroups = this.consolidateProjectGroups(candidateGroups);
      await this.logs.info('ProjectGroup consolidation completed', {
        candidateGroups: candidateGroups.length,
        consolidatedGroups: consolidatedGroups.length,
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

      await this.persistence.transaction(async () => {
        throwIfCanceled();
        await this.persistence.exec('DELETE FROM JIRA_RELATIONSHIPS');
        await this.persistence.exec('DELETE FROM JIRA_PROJECT_GROUP_ISSUES');
        await this.persistence.exec('DELETE FROM JIRA_PROJECT_GROUPS');
        await this.persistence.exec('DELETE FROM JIRA_ISSUES');

        for (const projectGroup of consolidatedGroups) {
          throwIfCanceled();
          const detailedSeedIssue = projectGroup.issues.find((issue) => String(issue?.id) === String(projectGroup.rootIssueId))
            ?? projectGroup.issues[0];
          await this.persistProjectGroup(projectGroup, detailedSeedIssue, startedAt);
        }

        await this.persistChanges(syncId, changes);
        throwIfCanceled();
        alertResult = await this.alerts.evaluate({ notify: false });
      });

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
