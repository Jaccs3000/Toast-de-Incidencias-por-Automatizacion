import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const TASK_PREFIX = 'Jira Notifications - Windows Session';
const WSCRIPT_PATH = process.env.SystemRoot
  ? path.join(process.env.SystemRoot, 'System32', 'wscript.exe')
  : 'wscript.exe';

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function getCurrentUser() {
  return process.env.USERDOMAIN && process.env.USERNAME
    ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}`
    : process.env.USERNAME;
}

function getBogotaTimestamp() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now).reduce((values, part) => {
    if (part.type !== 'literal') values[part.type] = part.value;
    return values;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-05:00`;
}

function runSchtasks(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = spawn('schtasks.exe', args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        reject(new Error('La operacion de Task Scheduler excedio el tiempo limite.'));
      }
    }, timeoutMs);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('error', (error) => {
      clearTimeout(timeout);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }

      const details = (stderr || stdout || `codigo=${code}`).trim();
      reject(new Error(`Task Scheduler devolvio codigo ${code}: ${details}`));
    });
  });
}

function isTaskNotFound(error) {
  return /not found|no se encuentra|no existe|no puede encontrar|archivo especificado|cannot find|does not exist/i.test(error.message);
}

function taskXml({ userId, actionScript, state }) {
  const actionArguments = `"${actionScript}" ${state}`;
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Actualiza el estado de bloqueo de sesion para Jira Notifications.</Description>
  </RegistrationInfo>
  <Triggers>
    <SessionStateChangeTrigger>
      <Enabled>true</Enabled>
      <UserId>${escapeXml(userId)}</UserId>
      <StateChange>${state === 'locked' ? 'SessionLock' : 'SessionUnlock'}</StateChange>
    </SessionStateChangeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${escapeXml(userId)}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT1M</ExecutionTimeLimit>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${escapeXml(WSCRIPT_PATH)}</Command>
      <Arguments>${escapeXml(actionArguments)}</Arguments>
      <WorkingDirectory>${escapeXml(path.dirname(actionScript))}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>`;
}

export class WindowsSessionTask {
  constructor({ projectRoot = process.cwd(), logs } = {}) {
    this.projectRoot = projectRoot;
    this.logs = logs;
    this.sessionDirectory = path.join(projectRoot, 'data', 'windows-session');
    this.statePath = path.join(this.sessionDirectory, 'session-state.json');
    this.historyPath = path.join(this.sessionDirectory, 'session-state-history.jsonl');
    this.updateScriptPath = path.join(projectRoot, 'scripts', 'update-windows-session.ps1');
    this.hiddenScriptPath = path.join(projectRoot, 'scripts', 'update-windows-session-hidden.vbs');
    this.taskNames = {
      locked: `${TASK_PREFIX} Lock`,
      unlocked: `${TASK_PREFIX} Unlock`,
    };
  }

  async writeStartupState() {
    await fs.mkdir(this.sessionDirectory, { recursive: true });
    const payload = {
      state: 'unlocked',
      updatedAt: getBogotaTimestamp(),
      source: 'backend-startup',
    };
    await fs.writeFile(this.statePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  async readState() {
    try {
      const content = await Promise.race([
        fs.readFile(this.statePath, 'utf8'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Lectura de estado de Windows excedio el limite.')), 1000)),
      ]);
      const payload = JSON.parse(String(content).replace(/^\uFEFF/, ''));
      const normalized = String(payload?.state ?? '').toLowerCase();
      const state = ['locked', 'unlocked', 'unknown'].includes(normalized) ? normalized : 'unknown';
      const updatedAt = new Date(payload?.updatedAt ?? '').getTime();
      return {
        state,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : null,
        source: payload?.source ?? null,
      };
    } catch (error) {
      return { state: 'unknown', updatedAt: null, source: 'read-error', error: error.message };
    }
  }

  async markManualSyncUnlocked() {
    await fs.mkdir(this.sessionDirectory, { recursive: true });
    const payload = {
      state: 'unlocked',
      updatedAt: getBogotaTimestamp(),
      source: 'manual-sync',
    };
    await fs.writeFile(this.statePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return this.readState();
  }

  async registerTask(state) {
    const userId = getCurrentUser();
    if (!userId) {
      throw new Error('No fue posible identificar el usuario actual de Windows.');
    }

    const tempXmlPath = path.join(this.sessionDirectory, `task-${state}.xml`);
    const xml = taskXml({
      userId,
      actionScript: this.hiddenScriptPath,
      state,
    });

    await fs.writeFile(tempXmlPath, `\ufeff${xml}`, 'utf16le');
    try {
      await runSchtasks([
        '/Create',
        '/TN', this.taskNames[state],
        '/XML', tempXmlPath,
        '/F',
      ]);
    } finally {
      await fs.rm(tempXmlPath, { force: true });
    }
  }

  async ensureTask(state) {
    const taskName = this.taskNames[state];
    try {
      const result = await runSchtasks(['/Query', '/TN', taskName, '/XML']);
      if (!/<Enabled>true<\/Enabled>/i.test(result.stdout)) {
        await runSchtasks(['/Change', '/TN', taskName, '/ENABLE']);
        await this.logs?.info?.('Windows session task enabled', { taskName });
      }
      return 'existing';
    } catch (error) {
      if (!isTaskNotFound(error)) {
        throw error;
      }

      await this.registerTask(state);
      return 'created';
    }
  }

  async initialize() {
    await this.writeStartupState();

    if (process.platform !== 'win32') {
      await this.logs?.warn?.('Windows session task skipped: unsupported platform');
      return { ok: false, reason: 'unsupported-platform' };
    }

    try {
      await fs.access(this.updateScriptPath);
      await fs.access(this.hiddenScriptPath);
      const lockedStatus = await this.ensureTask('locked');
      const unlockedStatus = await this.ensureTask('unlocked');
      await this.logs?.info?.('Windows session tasks registered', {
        lockedTask: this.taskNames.locked,
        unlockedTask: this.taskNames.unlocked,
        lockedStatus,
        unlockedStatus,
        statePath: this.statePath,
        historyPath: this.historyPath,
      });
      return { ok: true };
    } catch (error) {
      await this.logs?.warn?.('Windows session tasks could not be registered', {
        error: error.message,
      });
      return { ok: false, reason: error.message };
    }
  }

  async disableTasks() {
    if (process.platform !== 'win32') {
      return { ok: true, disabled: 0 };
    }

    const disabled = [];
    const errors = [];
    for (const taskName of Object.values(this.taskNames)) {
      try {
        await runSchtasks(['/Change', '/TN', taskName, '/DISABLE']);
        disabled.push(taskName);
      } catch (error) {
        if (!isTaskNotFound(error)) {
          errors.push({ taskName, error: error.message });
        }
      }
    }

    if (errors.length > 0) {
      await this.logs?.warn?.('Windows session tasks disable incomplete', { disabled, errors });
      return { ok: false, disabled, errors };
    }

    await this.logs?.info?.('Windows session tasks disabled', { disabled });
    return { ok: true, disabled };
  }
}
