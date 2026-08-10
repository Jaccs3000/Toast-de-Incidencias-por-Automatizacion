import fs from 'node:fs/promises';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'src', 'shared', 'schemas', 'database-schema.sql');

export async function loadDatabaseSchema() {
  return fs.readFile(schemaPath, 'utf8');
}
