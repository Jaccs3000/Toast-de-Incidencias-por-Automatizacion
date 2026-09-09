import { createRequire } from 'node:module';
import { access, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const duckdb = require('duckdb');
const defaultDatabasePath = path.resolve(process.cwd(), 'data', 'jira-notifications.duckdb');
const defaultMinimumBytes = 64 * 1024 * 1024;

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function isBusyDatabaseError(error) {
  const message = String(error?.message ?? '');
  return /could not set lock|being used by another process|used by another process|proceso no tiene acceso/i.test(message);
}

function openDatabase(databasePath) {
  return new Promise((resolve, reject) => {
    const database = new duckdb.Database(databasePath, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(database);
    });
  });
}

function execute(database, sql) {
  return new Promise((resolve, reject) => {
    database.exec(sql, (error) => (error ? reject(error) : resolve()));
  });
}

function query(database, sql) {
  return new Promise((resolve, reject) => {
    database.all(sql, (error, rows) => (error ? reject(error) : resolve(rows ?? [])));
  });
}

function closeDatabase(database) {
  if (!database) return Promise.resolve();
  return new Promise((resolve) => database.close(() => resolve()));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retryFileOperation(operation, attempts = 8) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(error?.code) || attempt === attempts - 1) {
        throw error;
      }
      await delay(100 * (attempt + 1));
    }
  }
  throw lastError;
}

async function tableCounts(database, catalog) {
  const tables = await query(database, `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_catalog = '${escapeSqlLiteral(catalog)}'
      AND table_schema = 'main'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const counts = new Map();
  for (const { table_name: tableName } of tables) {
    const rows = await query(database, `SELECT COUNT(*) AS total FROM ${catalog}.main.${quoteIdentifier(tableName)}`);
    counts.set(tableName, String(rows[0]?.total ?? 0));
  }
  return counts;
}

function countsMatch(left, right) {
  if (left.size !== right.size) return false;
  return [...left].every(([tableName, total]) => right.get(tableName) === total);
}

async function checkpoint(databasePath) {
  const database = await openDatabase(databasePath);
  try {
    await execute(database, 'CHECKPOINT');
  } finally {
    await closeDatabase(database);
  }
}

export async function compactDatabaseIfNeeded({
  databasePath = defaultDatabasePath,
  minimumBytes = defaultMinimumBytes,
  force = false,
} = {}) {
  const resolvedPath = path.resolve(databasePath);
  try {
    await access(resolvedPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { status: 'skipped_missing', databasePath: resolvedPath };
    }
    throw error;
  }

  const beforeBytes = (await stat(resolvedPath)).size;
  if (!force && beforeBytes < minimumBytes) {
    return { status: 'skipped_below_threshold', databasePath: resolvedPath, beforeBytes };
  }

  try {
    await checkpoint(resolvedPath);
  } catch (error) {
    if (isBusyDatabaseError(error)) {
      return { status: 'skipped_busy', databasePath: resolvedPath, beforeBytes };
    }
    throw error;
  }

  const token = `${process.pid}-${Date.now()}`;
  const compactPath = `${resolvedPath}.compact-${token}`;
  const backupPath = `${resolvedPath}.backup-${token}`;
  let database = null;
  let sourceMoved = false;
  let compactMoved = false;

  try {
    database = await openDatabase(':memory:');
    await execute(database, `ATTACH '${escapeSqlLiteral(resolvedPath)}' AS source_db (READ_ONLY)`);
    await execute(database, `ATTACH '${escapeSqlLiteral(compactPath)}' AS compact_db`);
    const sourceCounts = await tableCounts(database, 'source_db');
    await execute(database, 'COPY FROM DATABASE source_db TO compact_db');
    const compactCounts = await tableCounts(database, 'compact_db');
    if (!countsMatch(sourceCounts, compactCounts)) {
      throw new Error('La verificacion de filas de la base compactada no coincide con la original.');
    }
    await execute(database, 'DETACH compact_db');
    await execute(database, 'DETACH source_db');
    await closeDatabase(database);
    database = null;

    await checkpoint(compactPath);
    const afterBytes = (await stat(compactPath)).size;
    if (!force && afterBytes >= beforeBytes) {
      await retryFileOperation(() => rm(compactPath, { force: true }));
      return { status: 'skipped_no_savings', databasePath: resolvedPath, beforeBytes, afterBytes };
    }

    await retryFileOperation(() => rename(resolvedPath, backupPath));
    sourceMoved = true;
    await retryFileOperation(() => rename(compactPath, resolvedPath));
    compactMoved = true;

    // The complete row-count validation happens while both databases are attached.
    // Reopening the replacement on Windows can keep a native DuckDB handle locked
    // until this maintenance process exits, preventing a safe rollback.
    await retryFileOperation(() => rm(backupPath, { force: true })).catch(() => {});
    return {
      status: 'compacted',
      databasePath: resolvedPath,
      beforeBytes,
      afterBytes,
      savedBytes: beforeBytes - afterBytes,
    };
  } catch (error) {
    if (sourceMoved) {
      try {
        if (compactMoved) {
          await retryFileOperation(() => rm(resolvedPath, { force: true }));
        }
        await retryFileOperation(() => rename(backupPath, resolvedPath));
      } catch (restoreError) {
        error.restoreError = restoreError;
      }
    }
    throw error;
  } finally {
    await closeDatabase(database);
    await retryFileOperation(() => rm(compactPath, { force: true })).catch(() => {});
    if (!sourceMoved) {
      await retryFileOperation(() => rm(backupPath, { force: true })).catch(() => {});
    }
  }
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  const force = process.argv.includes('--force');
  const databaseArgument = process.argv.find((argument) => argument.startsWith('--database='));
  const databasePath = databaseArgument
    ? databaseArgument.slice('--database='.length)
    : defaultDatabasePath;
  compactDatabaseIfNeeded({ databasePath, force })
    .then((result) => {
      console.log(`[database] ${result.status}`, result);
    })
    .catch((error) => {
      console.error('[database] No se pudo compactar la base:', error.message);
      process.exitCode = 1;
    });
}
