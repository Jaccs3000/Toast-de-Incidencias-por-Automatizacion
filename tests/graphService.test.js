import assert from 'node:assert/strict';
import test from 'node:test';

import { GraphService } from '../src/main/graph/graphService.js';

function linkedIssue(key) {
  return { outwardIssue: { key } };
}

function issue(key, type, links = []) {
  return {
    id: key,
    key,
    fields: {
      issuetype: { name: type },
      project: { key: 'ABC', name: 'ABC' },
      issuelinks: links.map(linkedIssue),
      subtasks: [],
    },
  };
}

test('keeps concurrent Testing branches inside the originating graph boundary', async () => {
  const seed = issue('DOC-1', 'Documentar Criterios de Aceptación', ['TEST-1', 'TEST-2']);
  const issues = new Map([
    [seed.key, seed],
    ['TEST-1', issue('TEST-1', 'Testing', ['DOC-1', 'DOC-OTHER', 'IMPL-1'])],
    ['TEST-2', issue('TEST-2', 'Testing', ['DOC-1', 'IMPL-2'])],
    ['DOC-OTHER', issue('DOC-OTHER', 'Documentar Criterios de Aceptación', ['TEST-OTHER'])],
    ['TEST-OTHER', issue('TEST-OTHER', 'Testing')],
    ['IMPL-1', issue('IMPL-1', 'Implementación Q&A', ['TEST-1'])],
    ['IMPL-2', issue('IMPL-2', 'Implementación Q&A', ['TEST-2'])],
  ]);
  const loaded = [];
  const service = new GraphService({
    configuration: {
      graph: {
        entryTypes: ['Testing', 'Documentar Criterios de Aceptación', 'Implementación Q&A'],
        nodes: {
          Testing: {
            follow: [{
              relation: 'issuelinks',
              to: ['Documentar Criterios de Aceptación', 'Implementación Q&A'],
            }],
          },
          'Documentar Criterios de Aceptación': {
            follow: [{ relation: 'issuelinks', to: ['Testing'] }],
          },
          'Implementación Q&A': {
            follow: [{ relation: 'issuelinks', to: ['Testing'] }],
          },
        },
      },
    },
  });

  const groups = await service.buildProjectGroups(seed, async (key) => {
    loaded.push(key);
    const result = issues.get(key);
    if (!result) throw new Error(`Unexpected issue ${key}`);
    return result;
  }, { issueCache: new Map([[seed.key, seed]]) });

  assert.equal(groups.length, 2);
  const keysByAnchor = new Map(groups.map((group) => [
    group.anchorIssueKey,
    new Set(group.issues.map((item) => item.key)),
  ]));
  assert.deepEqual([...keysByAnchor.get('TEST-1')].sort(), ['DOC-1', 'IMPL-1', 'TEST-1']);
  assert.deepEqual([...keysByAnchor.get('TEST-2')].sort(), ['DOC-1', 'IMPL-2', 'TEST-2']);
  assert.equal(loaded.includes('TEST-OTHER'), false);
});
