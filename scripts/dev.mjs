import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const backendEntry = path.join(projectRoot, 'src', 'main', 'server.js');
const frontendHealthUrl = 'http://127.0.0.1:5174';
const backendUrl = 'http://127.0.0.1:3000/api/bootstrap-context';
const servicePidPath = path.join(projectRoot, 'data', 'runtime-services.json');

function log(message, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.log(`[dev ${new Date().toISOString()}] ${message}${suffix}`);
}

if (!existsSync(viteEntry) || !existsSync(backendEntry)) {
  console.error('Dependencies or backend entry are missing. Run npm install first.');
  process.exit(1);
}

log('starting local services', `root=${projectRoot}`);

async function getHealth(url) {
  return new Promise((resolve) => {
    let body = '';
    const request = http.get(url, (response) => {
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.once('end', () => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 400,
        statusCode: response.statusCode,
        body,
      }));
    });
    request.once('error', () => resolve({ ok: false, statusCode: 0, body: '' }));
  });
}

async function isReady(url) {
  return (await getHealth(url)).ok;
}

async function isJiraNotificationsRunning() {
  const frontend = await getHealth(frontendHealthUrl);
  const backend = await getHealth(backendUrl);
  return frontend.ok
    && frontend.body.includes('Jira Notifications')
    && backend.ok
    && backend.body.includes('"appState"');
}

function stopKnownServices() {
  if (!existsSync(servicePidPath)) {
    return false;
  }

  const stored = JSON.parse(readFileSync(servicePidPath, 'utf8').replace(/^\uFEFF/, ''));
  if (stored.root && path.resolve(stored.root) !== projectRoot) {
    throw new Error('El archivo de servicios no pertenece a este proyecto.');
  }

  const pids = new Set([stored.backendPid, stored.vitePid]
    .map(Number)
    .filter((pid) => pid > 0 && pid !== process.pid));

  for (const pid of pids) {
    let processList = '';
    try {
      processList = execFileSync('tasklist.exe', [
        '/FI', `PID eq ${pid}`,
        '/FO', 'CSV',
        '/NH',
      ], { encoding: 'utf8', windowsHide: true });
    } catch {
      processList = '';
    }

    // Only terminate node processes whose PID was registered by this app.
    if (!/"node\.exe"/i.test(processList)) {
      log('registered service PID is no longer a Node process', `pid=${pid}`);
      continue;
    }

    log('stopping known local service', `pid=${pid}`);
    try {
      process.kill(pid);
    } catch (error) {
      log('local service was already stopped', `pid=${pid}`);
    }
  }

  unlinkSync(servicePidPath);
  return true;
}

async function waitFor(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isReady(url)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

const frontendReady = await isReady(frontendHealthUrl);
const backendReady = await isReady(backendUrl);
if (await isJiraNotificationsRunning()) {
  log('local services already running; no restart required');
  process.exit(0);
}

const hasRegisteredServices = existsSync(servicePidPath);
if (hasRegisteredServices || frontendReady || backendReady) {
  log('partial local service state detected; restarting required-port processes');
  const stopped = stopKnownServices();
  if (!stopped && (frontendReady || backendReady)) {
    throw new Error('Hay un servicio parcial sin registro propio; no se detiene automaticamente.');
  }
}

const backend = spawn(process.execPath, [backendEntry], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    PORT: '3000',
  },
});
backend.on('error', (error) => log('backend process error', error.message));
backend.on('spawn', () => log('backend process spawned'));
backend.on('exit', (code, signal) => log('backend process exited', `code=${code} signal=${signal ?? 'none'}`));

const vite = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '5174', '--configLoader', 'native'], {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: false,
});
mkdirSync(path.dirname(servicePidPath), { recursive: true });
writeFileSync(servicePidPath, JSON.stringify({
  root: projectRoot,
  backendPid: backend.pid,
  vitePid: vite.pid,
  createdAt: new Date().toISOString(),
}), 'utf8');
vite.on('error', (error) => log('vite process error', error.message));
vite.on('spawn', () => log('vite process spawned'));
vite.on('exit', (code, signal) => log('vite process exited', `code=${code} signal=${signal ?? 'none'}`));

let shuttingDown = false;

function requestBackendShutdown() {
  return new Promise((resolve) => {
    const request = http.request('http://127.0.0.1:3000/api/shutdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 2000,
    }, (response) => {
      response.resume();
      response.once('end', resolve);
    });
    request.once('error', resolve);
    request.once('timeout', () => {
      request.destroy();
      resolve();
    });
    request.end('{}');
  });
}

async function shutdown(code = 0, { backendAlreadyExited = false } = {}) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  log('stopping local services');

  if (!backendAlreadyExited) {
    await requestBackendShutdown();
  }

  if (backend && !backend.killed) {
    backend.kill();
  }

  if (vite && !vite.killed) {
    vite.kill();
  }

  if (existsSync(servicePidPath)) {
    unlinkSync(servicePidPath);
  }

  process.exit(code);
}

process.on('SIGINT', () => { void shutdown(0); });
process.on('SIGTERM', () => { void shutdown(0); });

backend.on('exit', (code) => {
  void shutdown(code ?? 0, { backendAlreadyExited: true });
});

vite.on('exit', (code) => {
  void shutdown(code ?? 0);
});

await once(backend, 'spawn');
await once(vite, 'spawn');
log('waiting for backend and frontend health checks');

if (await waitFor(frontendHealthUrl) && await isReady(backendUrl)) {
  log('backend and frontend are ready');
} else {
  console.error('The local services did not become ready on ports 3000 and 5174.');
  await shutdown(1);
}
