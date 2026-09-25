import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIssueTypeColorMap, getIssueTypeColor } from '../src/shared/reports/issueTypeColors.js';

test('assigns different colors to different time-report issue types', () => {
  const colors = buildIssueTypeColorMap([
    { issueType: 'Criterios Pre-Producción' },
    { issueType: 'Documentar Criterios de Aceptación' },
    { issueType: 'Tarea' },
  ]);

  assert.equal(colors.size, 3);
  assert.equal(new Set(colors.values()).size, 3);
  assert.notEqual(
    getIssueTypeColor('Criterios Pre-Producción', colors),
    getIssueTypeColor('Documentar Criterios de Aceptación', colors),
  );
});

test('keeps the same color for a type regardless of row order', () => {
  const firstMap = buildIssueTypeColorMap([{ issueType: 'Tarea' }, { issueType: 'Testing' }]);
  const secondMap = buildIssueTypeColorMap([{ issueType: 'Testing' }, { issueType: 'Tarea' }]);

  assert.equal(getIssueTypeColor('Tarea', firstMap), getIssueTypeColor('Tarea', secondMap));
  assert.equal(getIssueTypeColor('Testing', firstMap), getIssueTypeColor('Testing', secondMap));
});
