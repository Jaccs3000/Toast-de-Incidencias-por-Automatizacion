import fs from 'node:fs/promises';
import path from 'node:path';

const schemaPath = path.join(process.cwd(), 'src', 'shared', 'schemas', 'database-schema.sql');
const timeReportsSchemaPath = path.join(process.cwd(), 'src', 'shared', 'schemas', 'time-reports-schema.sql');

export async function loadDatabaseSchema() {
  const [schema, timeReportsSchema] = await Promise.all([
    fs.readFile(schemaPath, 'utf8'),
    fs.readFile(timeReportsSchemaPath, 'utf8'),
  ]);
  return `${schema}\n${timeReportsSchema}`;
}
