import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const restartLogPath = path.join(projectRoot, 'logs', 'restart.log');
const runVbsPath = path.join(projectRoot, 'run.vbs');
const wscriptPath = process.platform === 'win32' && process.env.SystemRoot
  ? path.join(process.env.SystemRoot, 'System32', 'wscript.exe')
  : 'wscript.exe';
const serviceUrls = ['http://127.0.0.1:3000', 'http://127.0.0.1:5174'];

function log(message) {
  mkdirSync(path.dirname(restartLogPath), { recursive: true });
  appendFileSync(restartLogPath, `${new Date().toISOString()} | ${message}\n`, 'utf8');
}

function isServiceListening(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(true);
    });
    request.once('error', () => resolve(false));
    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServicesToStop(timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const activeServices = await Promise.all(serviceUrls.map(isServiceListening));
    if (activeServices.every((active) => !active)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

try {
  if (!existsSync(runVbsPath)) {
    throw new Error('run.vbs no existe.');
  }
  if (!await waitForServicesToStop()) {
    throw new Error('Los servicios anteriores no liberaron los puertos a tiempo.');
  }

  const launcher = spawn(wscriptPath, [runVbsPath], {
    cwd: projectRoot,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  launcher.unref();
  log('run.vbs iniciado para reiniciar la aplicacion.');
} catch (error) {
  log(`No se pudo reiniciar la aplicacion: ${error.message}`);
  process.exitCode = 1;
}
