import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { WindowsSessionTask } from '../src/main/windowsSession/windowsSessionTask.js';

async function createTask({ ensureTask } = {}) {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'jira-windows-session-'));
  const scriptsDirectory = path.join(projectRoot, 'scripts');
  await fs.mkdir(scriptsDirectory, { recursive: true });
  await fs.writeFile(path.join(scriptsDirectory, 'update-windows-session.ps1'), '');
  await fs.writeFile(path.join(scriptsDirectory, 'update-windows-session-hidden.vbs'), '');

  const logs = { warnings: [], async warn(message, meta) { this.warnings.push({ message, meta }); } };
  const task = new WindowsSessionTask({ projectRoot, logs });
  task.ensureTask = ensureTask ?? (async () => 'existing');
  return { projectRoot, task, logs };
}

test('records unlocked only after both Windows session tasks are available', async (t) => {
  const { projectRoot, task } = await createTask();
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));

  const result = await task.initialize();
  const state = await task.readState();

  assert.equal(result.ok, true);
  assert.equal(state.state, 'unlocked');
  assert.equal(state.source, 'backend-startup');
  assert.equal(task.isMonitoringAvailable(), true);
});

test('fails safe to unknown when Windows session tasks cannot be enabled', async (t) => {
  const { projectRoot, task, logs } = await createTask({
    ensureTask: async () => { throw new Error('spawn EPERM'); },
  });
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));

  const result = await task.initialize();
  const state = await task.readState();

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'spawn EPERM');
  assert.equal(state.state, 'unknown');
  assert.equal(state.source, 'windows-session-task-unavailable');
  assert.match(state.reason, /spawn EPERM/);
  assert.equal(logs.warnings.length, 1);
  assert.equal(task.isMonitoringAvailable(), false);
});
