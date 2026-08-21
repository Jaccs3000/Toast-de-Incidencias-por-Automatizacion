import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-chromium';

const VALIDATION_PATH = '/rest/api/3/myself';

function log(message, details = '') {
  const suffix = details ? ` ${details}` : '';
  console.log(`[auth ${new Date().toISOString()}] ${message}${suffix}`);
}

function normalizePath(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaseUrl(value) {
  return normalizePath(value).replace(/\/$/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cookiesToHeader(cookies) {
  return cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

function getSessionRoot() {
  return path.join(process.cwd(), 'data', 'session');
}

function getStorageStatePath() {
  return path.join(getSessionRoot(), 'jira-storage-state.json');
}

async function ensureSessionDirectory() {
  await fs.mkdir(getSessionRoot(), { recursive: true });
}

async function removeSessionFiles() {
  const sessionRoot = getSessionRoot();

  try {
    const entries = await fs.readdir(sessionRoot, { withFileTypes: true });

    await Promise.all(entries.map(async (entry) => {
      if (!entry.isFile()) {
        return;
      }

      await fs.rm(path.join(sessionRoot, entry.name), { force: true });
    }));
  } catch {
    return;
  }
}

async function readStorageState() {
  const storageStatePath = getStorageStatePath();

  try {
    const raw = await fs.readFile(storageStatePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeStorageState(storageState) {
  await ensureSessionDirectory();
  await removeSessionFiles();
  await fs.writeFile(getStorageStatePath(), JSON.stringify(storageState, null, 2), 'utf8');
}

export class AuthService {
  constructor(configuration = {}, { logs = null } = {}) {
    this.configuration = configuration;
    this.logs = logs;
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async trace(level, message, meta = null) {
    const details = meta ? JSON.stringify(meta) : '';
    log(message, details);

    try {
      if (typeof this.logs?.[level] === 'function') {
        await this.logs[level](`Auth: ${message}`, meta);
      }
    } catch (error) {
      log('authentication trace could not be persisted', error.message);
    }
  }

  getAppConfig() {
    return this.configuration?.app ?? {};
  }

  getBaseUrl() {
    return normalizeBaseUrl(this.getAppConfig().jiraBaseUrl);
  }

  async loadStoredSession() {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) {
      return { ok: false, reason: 'Jira base URL is not configured.' };
    }

    const storageState = await readStorageState();
    if (!storageState) {
      log('stored session not found', getStorageStatePath());
      return { ok: false, reason: 'Jira storage state not found.' };
    }

    const cookies = Array.isArray(storageState.cookies) ? storageState.cookies : [];
    return this.validateWithCookies(baseUrl, cookies);
  }

  async validateWithCookies(baseUrl, cookies) {
    if (!baseUrl) {
      return {
        ok: false,
        reason: 'Jira base URL is not configured.',
      };
    }

    const cookieHeader = cookiesToHeader(cookies);
    if (!cookieHeader) {
      return {
        ok: false,
        reason: 'Jira session is not valid.',
      };
    }

    try {
      const response = await fetch(`${baseUrl}${VALIDATION_PATH}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          Cookie: cookieHeader,
        },
      });

      if (!response.ok) {
        return {
          ok: false,
          reason: 'Jira session is not valid.',
          details: {
            status: response.status,
          },
        };
      }

      let account = null;
      try {
        account = await response.json();
      } catch {
        account = null;
      }

      return {
        ok: true,
        baseUrl,
        headers: {
          Cookie: cookieHeader,
        },
        cookies,
        account,
      };
    } catch (error) {
      return {
        ok: false,
        reason: 'Jira session is not valid.',
        details: {
          message: error.message,
        },
      };
    }
  }

  async validateSession() {
    const baseUrl = this.getBaseUrl();

    if (!baseUrl) {
      return {
        ok: false,
        reason: 'Jira base URL is not configured.',
      };
    }

    const storedSession = await this.loadStoredSession();
    if (storedSession.ok) {
      return storedSession;
    }

    return {
      ok: false,
      reason: storedSession.reason ?? 'Jira session is not valid.',
      details: storedSession.details ?? null,
    };
  }

  async tryHeadlessContinue({ timeoutMs = 15000, intervalMs = 1000, signal = null } = {}) {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return null;

    const throwIfCanceled = () => {
      if (signal?.aborted) {
        throw new DOMException('Headless login continuation canceled.', 'AbortError');
      }
    };

    let browser = null;
    let context = null;
    let page = null;

    try {
      const storageState = await readStorageState();
      await this.trace('info', 'Headless login attempt started', {
        storageStatePresent: Boolean(storageState),
      });
      throwIfCanceled();
      browser = await chromium.launch({ headless: true });
      await this.trace('info', 'Headless browser launched');
      context = await browser.newContext(storageState ? { storageState } : {});
      page = await context.newPage();
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      throwIfCanceled();

      const continueButton = page.getByRole('button', { name: /^continuar$/i }).first();
      if (await continueButton.count() === 0) {
        await this.trace('info', 'Headless continuation button not found; using visible login');
        return null;
      }

      await this.trace('info', 'Headless continuation button found; clicking');
      await continueButton.click({ timeout: 5000 });
      const startedAt = Date.now();

      while (Date.now() - startedAt < timeoutMs) {
        throwIfCanceled();
        const cookies = await context.cookies(baseUrl);
        const validated = await this.validateWithCookies(baseUrl, cookies);

        if (validated.ok) {
          await writeStorageState(await context.storageState());
          await this.trace('info', 'Headless Jira login validated and storage state saved');
          return validated;
        }

        await sleep(intervalMs);
      }

      await this.trace('warn', 'Headless Jira continuation did not produce a valid session');
      return null;
    } catch (error) {
      if (signal?.aborted) {
        throw error;
      }
      await this.trace('warn', 'Headless Jira continuation failed; using visible login', {
        message: error.message,
      });
      return null;
    } finally {
      try {
        if (page && !page.isClosed()) await page.close();
      } catch {
        // ignore cleanup errors
      }
      try {
        if (context) await context.close();
      } catch {
        // ignore cleanup errors
      }
      try {
        if (browser) await browser.close();
      } catch {
        // ignore cleanup errors
      }
    }
  }

  async openLoginWindow() {
    const baseUrl = this.getBaseUrl();

    if (!baseUrl) {
      return {
        ok: false,
        reason: 'Jira base URL is not configured.',
      };
    }

    const browserClosed = this.browser && !this.browser.isConnected();
    const pageClosed = this.page?.isClosed();
    let contextClosed = false;
    try {
      contextClosed = Boolean(this.context && this.context.pages().length === 0);
    } catch {
      contextClosed = true;
    }

    if (browserClosed || pageClosed || contextClosed) {
      log('cleaning closed login browser state');
      await this.closeLoginWindow();
    }

    if (this.context && this.page && !this.page.isClosed()) {
      await this.page.bringToFront();
      return {
        ok: true,
        reopened: true,
      };
    }

    log('opening Playwright browser', `url=${baseUrl}`);
    try {
      this.browser = await chromium.launch({
        headless: false,
      });
    } catch (error) {
      log('Playwright browser launch failed', error.stack ?? error.message);
      throw error;
    }
    const storageState = await readStorageState();
    this.context = await this.browser.newContext(storageState ? { storageState } : {});
    this.page = await this.context.newPage();
    await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await this.page.bringToFront();
    log('Playwright browser ready');

    return {
      ok: true,
      opened: true,
    };
  }

  async closeLoginWindow() {
    log('closing Playwright browser');
    try {
      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }
    } catch {
      // ignore
    }

    try {
      if (this.context) {
        await this.context.close();
      }
    } catch {
      // ignore
    }

    try {
      if (this.browser) {
        await this.browser.close();
      }
    } catch {
      // ignore
    }

    this.page = null;
    this.context = null;
    this.browser = null;

  }

  async waitForValidSession({ timeoutMs = 0, intervalMs = 2000 } = {}) {
    const start = Date.now();
    const baseUrl = this.getBaseUrl();

    while (true) {
      const result = await this.validateSession();
      if (result.ok) {
        return result;
      }

      if (this.browser && !this.browser.isConnected()) {
        log('login browser disconnected');
        return {
          ok: false,
          reason: 'La ventana de inicio de sesion fue cerrada.',
        };
      }

      if (this.page?.isClosed() || (this.context && this.context.pages().length === 0)) {
        log('login page closed');
        return {
          ok: false,
          reason: 'La ventana de inicio de sesion fue cerrada.',
        };
      }

      if (this.context) {
        try {
          const cookies = await this.context.cookies(baseUrl);
          const validated = await this.validateWithCookies(baseUrl, cookies);

          if (validated.ok) {
            log('valid Jira session detected; saving storage state');
            await writeStorageState(await this.context.storageState());
            return validated;
          }
        } catch {
          // keep polling
        }
      }

      if (timeoutMs > 0 && Date.now() - start >= timeoutMs) {
        return result;
      }

      await sleep(intervalMs);
    }
  }

  async loginAndValidate() {
    await this.trace('info', 'Login flow started');
    const headlessSession = await this.tryHeadlessContinue();
    if (headlessSession?.ok) {
      await this.trace('info', 'Login completed through headless continuation');
      return headlessSession;
    }

    await this.trace('info', 'Opening visible login fallback');
    await this.openLoginWindow();
    const session = await this.waitForValidSession();

    if (session.ok && this.context) {
      await writeStorageState(await this.context.storageState());
      await this.closeLoginWindow();
      await this.trace('info', 'Login completed through visible browser');
      return session;
    }

    await this.trace('warn', 'Login flow finished without a valid session', {
      reason: session.reason ?? 'unknown',
    });
    return session;
  }
}
