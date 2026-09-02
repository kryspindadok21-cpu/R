import { getDb } from './client';
import { SCHEMA_SQL } from './schema';

let migrated: Promise<void> | null = null;

/** Rozbija DDL na pojedyncze instrukcje (bez komentarzy i pustych linii). */
function statements(sql: string): string[] {
  return sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function run(): Promise<void> {
  const db = await getDb();
  await db.batch(statements(SCHEMA_SQL).map((sql) => ({ sql })));
}

/**
 * Puszcza migrację raz na proces. Wołane z każdego wejścia do bazy,
 * więc świeży deploy na Netlify sam sobie zakłada tabele.
 */
export function ensureSchema(): Promise<void> {
  if (!migrated) {
    migrated = run().catch((err) => {
      migrated = null; // pozwól spróbować ponownie przy następnym żądaniu
      throw err;
    });
  }
  return migrated;
}
