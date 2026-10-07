import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, appendFileSync, openSync, closeSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const serverEntry = path.join(projectRoot, 'src', 'main', 'server.js');
const rendererIndex = path.join(projectRoot, 'dist', 'renderer', 'index.html');
const logDir = path.join(projectRoot, 'logs');
const logPath = path.join(logDir, 'pwa-launcher.log');
const backendLogPath = path.join(logDir, 'pwa-backend.log');
mkdirSync(logDir, { recursive: true });

function log(message) {
  appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, 'utf8');
}

function request(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.setTimeout(1500, () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);
  return candidates.find(existsSync) ?? null;
}

if (!existsSync(rendererIndex)) {
  log('ERROR: frontend build is missing; run npm run build first');
  process.exit(1);
}

const existingServer = await request('http://127.0.0.1:3000/api/bootstrap-context');
if (existingServer) {
  log('ERROR: port 3000 is already serving a response; stop the existing server before launching');
  process.exit(1);
}

const chromePath = await findChrome();
if (!chromePath) {
  log('ERROR: Chrome was not found; set CHROME_PATH to chrome.exe');
  process.exit(1);
}

const backendLogFd = openSync(backendLogPath, 'a');
const backend = spawn(process.execPath, [serverEntry], {
  cwd: projectRoot,
  env: { ...process.env, PORT: '3000', APP_WINDOW_LIFECYCLE: 'managed' },
  stdio: ['ignore', backendLogFd, backendLogFd],
  detached: true,
  windowsHide: true,
});
closeSync(backendLogFd);
backend.unref();
backend.once('error', (error) => log(`ERROR: backend could not start: ${error.message}`));
log(`started backend pid=${backend.pid}`);

let ready = false;
for (let attempt = 0; attempt < 80; attempt += 1) {
  const response = await request('http://127.0.0.1:3000/api/bootstrap-context');
  if (response?.status === 200 && response.body.includes('appState')) {
    ready = true;
    break;
  }
  if (backend.exitCode !== null) break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

if (!ready) {
  log('ERROR: backend did not become ready; stopping the process');
  try { backend.kill(); } catch { /* process may have exited */ }
  process.exit(1);
}

const appWindow = spawn(chromePath, ['--app=http://localhost:3000'], {
  cwd: projectRoot,
  stdio: 'ignore',
  detached: true,
  windowsHide: true,
});
appWindow.unref();
appWindow.once('error', (error) => log(`ERROR: app window could not open: ${error.message}`));
log(`opened app window with Chrome pid=${appWindow.pid}`);
