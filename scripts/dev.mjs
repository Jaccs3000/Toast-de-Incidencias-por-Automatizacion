import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const backendEntry = path.join(projectRoot, 'src', 'main', 'server.js');
const frontendHealthUrl = 'http://127.0.0.1:5174';
const backendUrl = 'http://127.0.0.1:3000/api/bootstrap-context';

function log(message, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.log(`[dev ${new Date().toISOString()}] ${message}${suffix}`);
}

if (!existsSync(viteEntry) || !existsSync(backendEntry)) {
  console.error('Dependencies or backend entry are missing. Run npm install first.');
  process.exit(1);
}

log('starting local services', `root=${projectRoot}`);

async function isReady(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
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

if (await isReady(frontendHealthUrl) && await isReady(backendUrl)) {
  process.exit(0);
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
vite.on('error', (error) => log('vite process error', error.message));
vite.on('spawn', () => log('vite process spawned'));
vite.on('exit', (code, signal) => log('vite process exited', `code=${code} signal=${signal ?? 'none'}`));

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (backend && !backend.killed) {
    backend.kill();
  }

  if (vite && !vite.killed) {
    vite.kill();
  }



  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

backend.on('exit', (code) => {
  shutdown(code ?? 0);
});

vite.on('exit', (code) => {
  shutdown(code ?? 0);
});

await once(backend, 'spawn');
await once(vite, 'spawn');
log('waiting for backend and frontend health checks');

if (await waitFor(frontendHealthUrl) && await isReady(backendUrl)) {
  log('backend and frontend are ready');
} else {
  console.error('The local services did not become ready on ports 3000 and 5174.');
  shutdown(1);
}
