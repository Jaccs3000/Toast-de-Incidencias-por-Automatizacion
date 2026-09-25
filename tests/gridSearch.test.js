import test from 'node:test';
import assert from 'node:assert/strict';
import { gridRowMatchesSearch } from '../src/shared/grids/gridSearch.js';

const columns = [
  { issueType: 'Testing', field: 'summary' },
  { issueType: 'Testing', field: 'status' },
  { issueType: null, field: 'estadoGeneral' },
];

test('searches visible grid values without case or accent sensitivity', () => {
  const row = {
    estadoGeneral: 'En Producción',
    'Testing::summary': 'Validación de integración',
    'Testing::status': 'En Pruebas',
  };

  assert.equal(gridRowMatchesSearch(row, columns, 'PRODUCCION'), true);
  assert.equal(gridRowMatchesSearch(row, columns, 'validación'), true);
  assert.equal(gridRowMatchesSearch(row, columns, 'pruebas'), true);
  assert.equal(gridRowMatchesSearch(row, columns, 'no existe'), false);
});

test('searches nested values from grouped grid fields', () => {
  const row = {
    'Solicitud::closedSubtasks': [{
      parentKey: 'AP-100',
      count: 1,
      subtasks: [{ key: 'AP-101', summary: 'Revisar permisos' }],
    }],
  };

  assert.equal(gridRowMatchesSearch(row, [{ issueType: 'Solicitud', field: 'closedSubtasks' }], 'AP-101'), true);
  assert.equal(gridRowMatchesSearch(row, [{ issueType: 'Solicitud', field: 'closedSubtasks' }], 'permisos'), true);
  assert.equal(gridRowMatchesSearch(row, [{ issueType: 'Solicitud', field: 'closedSubtasks' }], 'AP-999'), false);
});

