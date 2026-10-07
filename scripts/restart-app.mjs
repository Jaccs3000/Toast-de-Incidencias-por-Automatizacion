import { spawn } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverEntry = path.join(projectRoot, 'src', 'main', 'server.js');
const logDirectory = path.join(projectRoot, 'logs');
const restartLogPath = path.join(logDirectory, 'restart.log');
const backendLogPath = path.join(logDirectory, 'pwa-backend.log');
const bootstrapUrl = 'http://127.0.0.1:3000/api/bootstrap-context';

mkdirSync(logDirectory, { recursive: true });

function log(message) {
  appendFileSync(restartLogPath, `${new Date().toISOString()} | ${message}\n`, 'utf8');
}

function getBootstrapResponse() {
  return new Promise((resolve) => {
    const request = http.get(bootstrapUrl, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.setTimeout(1000, () => request.destroy());
    request.once('error', () => resolve(false));
  });
}

async function waitForBackendToStop(timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (!await getBootstrapResponse()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function waitForBackendToStart(processHandle, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (processHandle.exitCode !== null) return false;
    if (await getBootstrapResponse()) return true;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

try {
  if (!existsSync(serverEntry)) throw new Error('No se encontró el servidor de la aplicación.');
  if (!await waitForBackendToStop()) {
    throw new Error('El backend anterior no liberó el puerto 3000 a tiempo.');
  }

  const backendLogFd = openSync(backendLogPath, 'a');
  const backend = spawn(process.execPath, [serverEntry], {
    cwd: projectRoot,
    env: { ...process.env, PORT: '3000' },
    detached: true,
    stdio: ['ignore', backendLogFd, backendLogFd],
    windowsHide: true,
  });
  closeSync(backendLogFd);
  backend.unref();
  backend.once('error', (error) => log(`No se pudo iniciar el backend: ${error.message}`));
  log(`servidor de producción iniciado pid=${backend.pid}`);

  if (!await waitForBackendToStart(backend)) {
    throw new Error('El backend nuevo no respondió correctamente.');
  }

  log('backend disponible; la ventana actual puede recargar el frontend.');
} catch (error) {
  log(`No se pudo reiniciar la aplicación: ${error.message}`);
  process.exitCode = 1;
}
