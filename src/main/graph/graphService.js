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

function getLinkedKeys(issue) {
  const links = issue?.fields?.issuelinks;

  if (!Array.isArray(links)) {
    return [];
  }

  return links.flatMap((link) => {
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

function matchesTarget(rule, issue) {
  if (!rule?.to || !Array.isArray(rule.to) || rule.to.includes('*')) {
    if (!rule?.project) {
      return true;
    }

    return getIssueProject(issue) === normalizeComparable(rule.project);
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

  async buildProjectGroup(seedIssue, issueLoader = null) {
    if (!seedIssue) {
      throw new Error('A seed issue is required to build a ProjectGroup.');
    }

    const cache = new Map();
    const loadIssue = issueLoader ?? (async (issueKey) => this.jira.getIssue(issueKey));
    const queue = [{
      issue: seedIssue,
      depth: 0,
      relationType: null,
      isRoot: true,
    }];
    const visited = new Set();
    const issues = new Map();
    const relationships = [];
    const members = [];

    while (queue.length > 0) {
      const currentEntry = queue.shift();
      const current = currentEntry?.issue;
      const currentId = createIssueIdentity(current);

      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      issues.set(currentId, current);
      members.push({
        id: currentId,
        key: normalizeType(current?.key),
        isRoot: Boolean(currentEntry.isRoot),
        depth: currentEntry.depth ?? 0,
        relationType: currentEntry.relationType ?? null,
        created: current?.fields?.created ?? null,
      });

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
          for (const key of getLinkedKeys(current)) {
            followKeys.add(key);
          }
        }

        for (const key of followKeys) {
          if (!key) {
            continue;
          }

          let relatedIssue = cache.get(key);
          if (!relatedIssue) {
            relatedIssue = await loadIssue(key);
            if (relatedIssue) {
              cache.set(key, relatedIssue);
            }
          }

          const relatedId = createIssueIdentity(relatedIssue);

          if (!relatedId || !matchesTarget(rule, relatedIssue)) {
            continue;
          }

          relationships.push({
            fromIssueId: currentId,
            toIssueId: relatedId,
            relationType: rule.relation,
          });

          if (shouldInclude(rule) && relatedId && !issues.has(relatedId)) {
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
}
