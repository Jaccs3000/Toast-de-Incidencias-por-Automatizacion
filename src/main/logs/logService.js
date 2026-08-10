import fs from 'node:fs/promises';
import path from 'node:path';

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDateParts(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-');
}

function formatTimestamp(date) {
  return `${formatDateParts(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export class LogService {
  constructor({
    logDir = path.join(process.cwd(), 'logs'),
    retentionDays = 7,
  } = {}) {
    this.logDir = logDir;
    this.retentionDays = retentionDays;
    this.currentDateKey = null;
    this.currentFilePath = null;
  }

  async initialize() {
    await fs.mkdir(this.logDir, { recursive: true });
    await this.cleanupOldFiles();
  }

  async cleanupOldFiles() {
    const entries = await fs.readdir(this.logDir, { withFileTypes: true });
    const limit = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;

    await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.log'))
        .map(async (entry) => {
          const filePath = path.join(this.logDir, entry.name);
          const stat = await fs.stat(filePath);

          if (stat.mtimeMs < limit) {
            await fs.unlink(filePath);
          }
        }),
    );
  }

  async ensureFile() {
    const todayKey = formatDateParts(new Date());

    if (this.currentDateKey === todayKey && this.currentFilePath) {
      return this.currentFilePath;
    }

    this.currentDateKey = todayKey;
    this.currentFilePath = path.join(this.logDir, `${todayKey}.log`);

    await fs.mkdir(this.logDir, { recursive: true });
    await fs.appendFile(this.currentFilePath, '');

    return this.currentFilePath;
  }

  async write(level, message, meta = null) {
    const filePath = await this.ensureFile();
    const entry = {
      timestamp: formatTimestamp(new Date()),
      level,
      message,
      meta,
    };
    const line = `${JSON.stringify(entry)}\n`;

    await fs.appendFile(filePath, line, 'utf8');
  }

  info(message, meta = null) {
    return this.write('info', message, meta);
  }

  warn(message, meta = null) {
    return this.write('warn', message, meta);
  }

  error(message, meta = null) {
    return this.write('error', message, meta);
  }
}
