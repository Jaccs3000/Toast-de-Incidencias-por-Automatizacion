import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundlePath = path.join(projectRoot, 'node_modules', 'playwright-core', 'lib', 'coreBundle.js');
const existingLine = '    detached: process.platform !== "win32",\n    env: options.env,';
const patchedLine = '    detached: process.platform !== "win32",\n    windowsHide: process.platform === "win32",\n    env: options.env,';

let bundle;
try {
  bundle = await fs.readFile(bundlePath, 'utf8');
} catch (error) {
  if (error.code === 'ENOENT') {
    throw new Error('No se encontró el bundle de Playwright; no se pudo ocultar su consola en Windows.');
  }
  throw error;
}

if (bundle.includes(patchedLine)) {
  process.stdout.write('Playwright ya tiene windowsHide habilitado para Chromium.\n');
} else if (bundle.includes(existingLine)) {
  await fs.writeFile(bundlePath, bundle.replace(existingLine, patchedLine), 'utf8');
  process.stdout.write('Se habilitó windowsHide para el proceso de Chromium de Playwright.\n');
} else {
  throw new Error('La estructura del bundle de Playwright cambió; no se aplicó el ajuste windowsHide.');
}
