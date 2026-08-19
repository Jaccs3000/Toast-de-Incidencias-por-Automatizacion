function normalizeType(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeComparable(value) {
  return normalizeType(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('es');
}

function createIssueIdentity(issue) {
  return issue?.id ? String(issue.id) : issue?.key ? String(issue.key) : '';
}

function getIssueType(issue) {
  return normalizeComparable(issue?.fields?.issuetype?.name);
}

function getIssueProject(issue) {
  return normalizeComparable(issue?.fields?.project?.name);
}

function getIssueProjectKey(issue) {
  return normalizeComparable(issue?.fields?.project?.key);
}

function getParentKey(issue) {
  return normalizeType(issue?.fields?.parent?.key);
}

function getSubtaskKeys(issue) {
  const subtasks = issue?.fields?.subtasks;

  if (!Array.isArray(subtasks)) {
    return [];
  }

  return subtasks
    .map((subtask) => normalizeType(subtask?.key))
    .filter(Boolean);
}

function getLinkedKeys(issue, linkTypes = null) {
  const links = issue?.fields?.issuelinks;

  if (!Array.isArray(links)) {
    return [];
  }

  const allowedLinkTypes = Array.isArray(linkTypes) && linkTypes.length > 0
    ? new Set(linkTypes.map(normalizeComparable))
    : null;

  return links.filter((link) => {
    if (!allowedLinkTypes) {
      return true;
    }

    const linkType = normalizeComparable(link?.type?.name ?? link?.type?.inward ?? link?.type?.outward);
    return allowedLinkTypes.has(linkType);
  }).flatMap((link) => {
    const keys = [];

    if (link?.outwardIssue?.key) {
      keys.push(normalizeType(link.outwardIssue.key));
    }

    if (link?.inwardIssue?.key) {
      keys.push(normalizeType(link.inwardIssue.key));
    }

    return keys;
  }).filter(Boolean);
}

function matchesTarget(rule, issue, graphIssueTypes) {
  const projectMatches = !rule?.project || [getIssueProject(issue), getIssueProjectKey(issue)]
    .includes(normalizeComparable(rule.project));

  if (!projectMatches) {
    return false;
  }

  if (!rule?.to || !Array.isArray(rule.to) || rule.to.includes('*')) {
    // Wildcards are open only for subtasks. Other relations stay inside graph.json.
    return Boolean(rule?.project) || rule?.relation === 'subtasks' || graphIssueTypes.has(getIssueType(issue));
  }

  const issueType = getIssueType(issue);
  if (!rule.to.some((allowedType) => normalizeComparable(allowedType) === issueType)) {
    return false;
  }

  return !rule.project || getIssueProject(issue) === normalizeComparable(rule.project);
}

function shouldInclude(rule) {
  return rule?.include !== false;
}

function shouldExpand(rule) {
  return rule?.expand !== false;
}

export class GraphService {
  constructor({ configuration, jira, logs } = {}) {
    this.configuration = configuration;
    this.jira = jira;
    this.logs = logs;
  }

  getGraphConfig() {
    return this.configuration?.graph ?? { version: 1, entryTypes: [], nodes: {} };
  }

  getGraphIssueTypes() {
    return new Set(Object.keys(this.getGraphConfig().nodes ?? {}).map(normalizeComparable));
  }

  getGraphEntryTypes() {
    const configuredEntries = this.getGraphConfig().entryTypes;
    if (Array.isArray(configuredEntries) && configuredEntries.length > 0) {
      return new Set(configuredEntries.map(normalizeComparable));
    }

    return this.getGraphIssueTypes();
  }

  validateGraphConfig() {
    const graph = this.getGraphConfig();
    const errors = [];
    const nodes = graph.nodes ?? {};
    const nodeTypes = new Set(Object.keys(nodes).map(normalizeComparable));

    for (const entryType of Array.isArray(graph.entryTypes) ? graph.entryTypes : []) {
      if (!nodeTypes.has(normalizeComparable(entryType))) {
        errors.push(`entryTypes contiene un tipo que no existe en nodes: ${entryType}`);
      }
    }

    for (const [issueType, node] of Object.entries(nodes)) {
      if (!Array.isArray(node?.follow)) {
        errors.push(`El nodo ${issueType} no tiene una lista follow valida.`);
        continue;
      }

      node.follow.forEach((rule, index) => {
        if (!['subtasks', 'parent', 'issuelinks'].includes(rule?.relation)) {
          errors.push(`Relacion invalida en ${issueType}.follow[${index}].`);
        }
        if (!Array.isArray(rule?.to) || rule.to.length === 0) {
          errors.push(`La relacion ${issueType}.follow[${index}] no tiene destinos.`);
        }
      });
    }

    return errors;
  }

  isAllowedSeed(issue) {
    const issueType = getIssueType(issue);
    // A seed must be a configured graph type. A Jira subtask is also valid,
    // but an arbitrary issue with a parent must not open a new graph.
    return this.getGraphEntryTypes().has(issueType)
      || issue?.fields?.issuetype?.subtask === true;
  }

  getRulesForIssue(issue) {
    const graph = this.getGraphConfig();
    const issueType = getIssueType(issue);
    const nodeEntry = Object.entries(graph.nodes ?? {})
      .find(([configuredType]) => normalizeComparable(configuredType) === issueType);
    const node = nodeEntry?.[1] ?? null;

    if (!node || !Array.isArray(node.follow)) {
      return [];
    }

    return node.follow;
  }

  async buildProjectGroup(seedIssue, issueLoader = null, {
    signal,
    anchorKey = null,
    boundaryRootKey = null,
    boundaryRootType = null,
    stopAtTesting = false,
    issueCache = new Map(),
    metrics = null,
  } = {}) {
    if (!seedIssue) {
      throw new Error('A seed issue is required to build a ProjectGroup.');
    }

    const cache = issueCache;
    const loadIssue = issueLoader ?? (async (issueKey) => this.jira.getIssue(issueKey));
    const queue = [{
      issue: seedIssue,
      depth: 0,
      relationType: null,
      isRoot: true,
    }];
    const visited = new Set();
    const included = new Set();
    const issues = new Map();
    const relationships = [];
    const members = [];

    while (queue.length > 0) {
      if (signal?.aborted) {
        throw new DOMException('Synchronization canceled.', 'AbortError');
      }

      const currentEntry = queue.shift();
      const current = currentEntry?.issue;
      const currentId = createIssueIdentity(current);

      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      if (currentEntry.include !== false && !included.has(currentId)) {
        included.add(currentId);
        issues.set(currentId, current);
        members.push({
          id: currentId,
          key: normalizeType(current?.key),
          isRoot: Boolean(currentEntry.isRoot),
          depth: currentEntry.depth ?? 0,
          relationType: currentEntry.relationType ?? null,
          created: current?.fields?.created ?? null,
        });
      }

      const isNonRootTesting = getIssueType(current) === normalizeComparable('Testing')
        && currentId !== createIssueIdentity(seedIssue);
      if (stopAtTesting && isNonRootTesting) {
        continue;
      }

      const currentRules = this.getRulesForIssue(current);

      for (const rule of currentRules) {
        const followKeys = new Set();

        if (rule.relation === 'subtasks') {
          for (const key of getSubtaskKeys(current)) {
            followKeys.add(key);
          }
        }

        if (rule.relation === 'parent') {
          const parentKey = getParentKey(current);
          if (parentKey) {
            followKeys.add(parentKey);
          }
        }

        if (rule.relation === 'issuelinks') {
          for (const key of getLinkedKeys(current, rule.linkTypes)) {
            followKeys.add(key);
          }
        }

        const relatedEntries = await Promise.all([...followKeys].filter(Boolean).map(async (key) => {
          if (cache.has(key)) {
            if (metrics) metrics.cacheHits = (metrics.cacheHits ?? 0) + 1;
            return { key, relatedIssue: cache.get(key) };
          }

          if (signal?.aborted) {
            throw new DOMException('Synchronization canceled.', 'AbortError');
          }

          let relatedIssue = await loadIssue(key);
          if (cache.has(key)) {
            relatedIssue = cache.get(key);
            if (metrics) metrics.cacheHits = (metrics.cacheHits ?? 0) + 1;
          } else {
            cache.set(key, relatedIssue ?? null);
            if (metrics) metrics.issueLoads = (metrics.issueLoads ?? 0) + 1;
          }
          return { key, relatedIssue };
        }));

        for (const { key, relatedIssue } of relatedEntries) {

          const relatedId = createIssueIdentity(relatedIssue);

          const relatedKey = normalizeType(relatedIssue?.key);
          const isPeerAnchor = anchorKey
            && getIssueType(relatedIssue) === normalizeComparable('Testing')
            && relatedKey !== normalizeType(anchorKey);
          const isPeerBoundaryRoot = boundaryRootKey
            && getIssueType(relatedIssue) === normalizeComparable(boundaryRootType)
            && relatedKey !== normalizeType(boundaryRootKey);
          if (isPeerAnchor || isPeerBoundaryRoot) {
            continue;
          }

          if (!relatedId || !matchesTarget(rule, relatedIssue, this.getGraphIssueTypes())) {
            continue;
          }

          relationships.push({
            fromIssueId: currentId,
            toIssueId: relatedId,
            relationType: rule.relation,
          });

          if (shouldInclude(rule) && relatedId && !included.has(relatedId)) {
            included.add(relatedId);
            issues.set(relatedId, relatedIssue);
            members.push({
              id: relatedId,
              key: normalizeType(relatedIssue?.key),
              isRoot: false,
              depth: (currentEntry.depth ?? 0) + 1,
              relationType: rule.relation,
              created: relatedIssue?.fields?.created ?? null,
            });
          }

          if (shouldExpand(rule) && relatedId && !visited.has(relatedId)) {
            queue.push({
              issue: relatedIssue,
              depth: (currentEntry.depth ?? 0) + 1,
              relationType: rule.relation,
              isRoot: false,
              include: shouldInclude(rule),
            });
          }
        }
      }
    }

    const issueList = [...issues.values()];
    const rootIssue = issueList[0] ?? seedIssue;
    const rootIssueId = createIssueIdentity(rootIssue);
    const rootIssueKey = normalizeType(rootIssue?.key);
    const issueType = getIssueType(seedIssue);
    const projectKey = normalizeType(seedIssue?.fields?.project?.key);

    return {
      id: rootIssueId || rootIssueKey || `${Date.now()}`,
      rootIssueId,
      rootIssueKey,
      rootIssueType: issueType,
      rootProjectKey: projectKey,
      issues: issueList,
      relationships,
      members,
    };
  }

  async buildProjectGroups(seedIssue, issueLoader = null, {
    signal,
    issueCache = new Map(),
    metrics = null,
  } = {}) {
    const discovery = await this.buildProjectGroup(seedIssue, issueLoader, {
      signal,
      issueCache,
      metrics,
      stopAtTesting: true,
    });
    const testingType = normalizeComparable('Testing');
    const issueById = new Map(
      discovery.issues.map((issue) => [createIssueIdentity(issue), issue]),
    );
    const seedIsTesting = getIssueType(seedIssue) === testingType;
    // Only Testing issues directly connected to the seed define branches.
    // A Testing found deeper in another branch must not start a second graph.
    const anchors = seedIsTesting
      ? [seedIssue]
      : discovery.members
        .filter((member) => member.depth === 1)
        .map((member) => issueById.get(String(member.id)))
        .filter((issue) => issue && getIssueType(issue) === testingType);

    if (anchors.length === 0) {
      return [discovery];
    }

    const groups = await Promise.all(anchors.map(async (anchor) => {
      const group = await this.buildProjectGroup(anchor, issueLoader, {
        signal,
        issueCache,
        metrics,
        anchorKey: anchor.key,
        boundaryRootKey: seedIssue.key,
        boundaryRootType: seedIssue?.fields?.issuetype?.name,
      });
      const seedId = createIssueIdentity(seedIssue);
      if (!seedIsTesting && seedId && !group.issues.some((issue) => createIssueIdentity(issue) === seedId)) {
        group.issues.push(seedIssue);
        group.members.push({
          id: seedId,
          key: normalizeType(seedIssue.key),
          isRoot: false,
          depth: 0,
          relationType: 'seed',
          created: seedIssue?.fields?.created ?? null,
        });
      }
      const groupRootId = seedIsTesting ? createIssueIdentity(anchor) : seedId;
      const groupRootKey = seedIsTesting ? normalizeType(anchor.key) : normalizeType(seedIssue.key);
      group.id = `project-group-${createIssueIdentity(anchor) || group.id}-${groupRootId || 'root'}`;
      group.rootIssueId = groupRootId || group.rootIssueId;
      group.rootIssueKey = groupRootKey || group.rootIssueKey;
      group.anchorIssueId = createIssueIdentity(anchor);
      group.anchorIssueKey = normalizeType(anchor.key);
      group.members = group.members.map((member) => ({ ...member, isRoot: member.id === groupRootId }));
      return group;
    }));

    return groups;
  }
}
