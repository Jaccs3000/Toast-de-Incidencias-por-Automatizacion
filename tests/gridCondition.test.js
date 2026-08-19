import test from 'node:test';
import assert from 'node:assert/strict';
import { gridConditionMatches } from '../src/shared/grids/gridCondition.js';

test('matches abbreviated assignee names without accents or casing', () => {
  assert.equal(
    gridConditionMatches('Jesús Antonio Clavijo Castellar', '=', 'jesus clavijo', 'assignee'),
    true,
  );
});

test('matches abbreviated reporter names with words in their original order', () => {
  assert.equal(
    gridConditionMatches('María del Carmen Pérez Gómez', '=', 'MARIA PEREZ', 'reporter'),
    true,
  );
});

test('keeps exact equality for non-person fields', () => {
  assert.equal(gridConditionMatches('En Progreso', '=', 'progreso', 'status'), false);
});

test('negates abbreviated person matching for distinto de', () => {
  assert.equal(
    gridConditionMatches('Jesús Antonio Clavijo Castellar', '<>', 'jesus clavijo', 'assignee'),
    false,
  );
});
