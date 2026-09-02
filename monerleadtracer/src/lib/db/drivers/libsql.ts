import type { SqlClient, SqlResult, SqlStatement, SqlValue } from '../client';

/**
 * Sterownik produkcyjny (Turso / libSQL).
 * Wymaga TURSO_DATABASE_URL, a dla bazy zdalnej także TURSO_AUTH_TOKEN.
 */
export async function createLibsqlClient(): Promise<SqlClient> {
  const { createClient } = await import('@libsql/client');

  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DB_DRIVER=turso, ale brakuje TURSO_DATABASE_URL. Ustaw ją w .env.local albo w zmiennych Netlify.',
    );
  }

  const db = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });

  return {
    async execute<T>(sql: string, args: SqlValue[] = []): Promise<SqlResult<T>> {
      const res = await db.execute({ sql, args });
      return {
        rows: res.rows as unknown as T[],
        lastInsertRowid:
          res.lastInsertRowid === undefined ? null : Number(res.lastInsertRowid),
        rowsAffected: res.rowsAffected,
      };
    },
    async batch(statements: SqlStatement[]) {
      await db.batch(
        statements.map((s) => ({ sql: s.sql, args: s.args ?? [] })),
        'write',
      );
    },
    async close() {
      db.close();
    },
  };
}
