import test from 'node:test';
import assert from 'node:assert/strict';
import { getSubtaskCountEntries } from '../src/shared/grids/subtaskCounts.js';

const issues = [
  { key: 'PROD-1', issuetype: 'Solicitud Paso a Producción' },
  { key: 'PROD-2', issuetype: 'Solicitud Paso a Producción' },
  { key: 'SUB-1', parent: 'PROD-1', issuetype: 'Aprobación', summary: 'Validar montaje', status: 'Cerrado', assignee: 'Ana', created: '2026-08-19T10:00:00Z' },
  { key: 'SUB-2', parent: 'PROD-1', issuetype: 'Subtarea', summary: 'Revisar evidencia', status: 'En Progreso' },
  { key: 'SUB-3', parent: 'PROD-2', issuetype: 'Prueba', summary: 'Probar despliegue', status: 'En Espera' },
  { key: 'SUB-4', parent: 'PROD-1', issuetype: 'Aprobación', summary: 'Aprobar solicitud', status: 'Aceptado' },
];

test('separates closed subtask counts by production request', () => {
  assert.deepEqual(getSubtaskCountEntries(issues, 'Solicitud Paso a Producción', 'closedSubtasks'), [
    { parentKey: 'PROD-1', count: 2, subtasks: [
      { key: 'SUB-1', summary: 'Validar montaje', issuetype: 'Aprobación', assignee: 'Ana', created: '2026-08-19T10:00:00Z' },
      { key: 'SUB-4', summary: 'Aprobar solicitud', issuetype: 'Aprobación', assignee: undefined, created: undefined },
    ] },
    { parentKey: 'PROD-2', count: 0, subtasks: [] },
  ]);
});

test('separates open subtask counts by production request', () => {
  assert.deepEqual(getSubtaskCountEntries(issues, 'Solicitud Paso a Producción', 'openSubtasks'), [
    { parentKey: 'PROD-1', count: 1, subtasks: [{ key: 'SUB-2', summary: 'Revisar evidencia', issuetype: 'Subtarea', assignee: undefined, created: undefined }] },
    { parentKey: 'PROD-2', count: 1, subtasks: [{ key: 'SUB-3', summary: 'Probar despliegue', issuetype: 'Prueba', assignee: undefined, created: undefined }] },
  ]);
});
