import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerSource = fs.readFileSync(path.join(projectRoot, 'public', 'notification-worker.js'), 'utf8');
const rendererSource = fs.readFileSync(path.join(projectRoot, 'src', 'renderer', 'App.jsx'), 'utf8');

test('alert notification clicks do not activate or open the application', () => {
  assert.match(workerSource, /event\.preventDefault\(\)/);
  assert.doesNotMatch(workerSource, /window\.focus\(\)|clients\.openWindow\(|clients\.matchAll\(/);
  assert.match(rendererSource, /notification\.onclick = \(event\) => \{/);
  assert.match(rendererSource, /if \(preventFocus\) \{\s*event\.preventDefault\(\);/s);
  assert.match(rendererSource, /\{ preventFocus: true \}/);
});
