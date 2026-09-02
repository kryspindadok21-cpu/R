/**
 * Cienka warstwa nad SQLite.
 *
 * Dwa sterowniki, jeden interfejs:
 *   - better-sqlite3  → lokalnie, plik na dysku, szybko i synchronicznie pod spodem
 *   - @libsql/client  → produkcja (Turso), ten sam silnik SQLite, tylko po sieci
 *
 * Powód istnienia tej abstrakcji: na Netlify dysk funkcji serverless jest efemeryczny,
 * więc plik SQLite kasowałby się przy każdym cold starcie. Interfejs jest asynchroniczny,
 * bo zdalny sterownik inaczej nie potrafi — dzięki temu zapytania piszemy raz.
 */

export type SqlValue = string | number | null;

export interface SqlStatement {
  sql: string;
  args?: SqlValue[];
}

export interface SqlResult<T = Record<string, SqlValue>> {
  rows: T[];
  /** id ostatnio wstawionego wiersza (INSERT). */
  lastInsertRowid: number | null;
  rowsAffected: number;
}

export interface SqlClient {
  execute<T = Record<string, SqlValue>>(
    sql: string,
    args?: SqlValue[],
  ): Promise<SqlResult<T>>;
  /** Wykonuje instrukcje w jednej transakcji. */
  batch(statements: SqlStatement[]): Promise<void>;
  close(): Promise<void>;
}

export type DbDriver = 'sqlite' | 'turso';

function resolveDriver(): DbDriver {
  const raw = process.env.DB_DRIVER?.trim().toLowerCase();
  if (raw === 'turso' || raw === 'libsql') return 'turso';
  if (raw === 'sqlite' || raw === 'better-sqlite3') return 'sqlite';
  // Bez jawnego ustawienia: jeśli podano URL Turso, korzystamy z niego.
  return process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite';
}

let clientPromise: Promise<SqlClient> | null = null;

async function createClient(): Promise<SqlClient> {
  const driver = resolveDriver();
  if (driver === 'turso') {
    const { createLibsqlClient } = await import('./drivers/libsql');
    return createLibsqlClient();
  }
  const { createBetterSqliteClient } = await import('./drivers/better-sqlite');
  return createBetterSqliteClient();
}

/** Singleton — jedno połączenie na proces. */
export function getDb(): Promise<SqlClient> {
  if (!clientPromise) clientPromise = createClient();
  return clientPromise;
}

/** Do testów i skryptów: zamyka i kasuje singleton. */
export async function resetDb(): Promise<void> {
  if (!clientPromise) return;
  const client = await clientPromise;
  await client.close();
  clientPromise = null;
}

export function activeDriver(): DbDriver {
  return resolveDriver();
}
