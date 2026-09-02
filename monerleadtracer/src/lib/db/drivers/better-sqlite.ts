import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { SqlClient, SqlResult, SqlStatement, SqlValue } from '../client';

const DEFAULT_PATH = './data/monerleadtracer.db';

/**
 * Sterownik lokalny. better-sqlite3 jest synchroniczny — opakowujemy go w Promise,
 * żeby pasował do wspólnego interfejsu.
 */
export async function createBetterSqliteClient(): Promise<SqlClient> {
  const { default: Database } = await import('better-sqlite3');

  const file = resolve(process.env.DB_PATH?.trim() || DEFAULT_PATH);
  mkdirSync(dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const run = <T>(sql: string, args: SqlValue[] = []): SqlResult<T> => {
    const stmt = db.prepare(sql);
    if (stmt.reader) {
      return {
        rows: stmt.all(...args) as T[],
        lastInsertRowid: null,
        rowsAffected: 0,
      };
    }
    const info = stmt.run(...args);
    return {
      rows: [],
      lastInsertRowid: Number(info.lastInsertRowid),
      rowsAffected: info.changes,
    };
  };

  return {
    async execute<T>(sql: string, args: SqlValue[] = []) {
      return run<T>(sql, args);
    },
    async batch(statements: SqlStatement[]) {
      const tx = db.transaction((items: SqlStatement[]) => {
        for (const item of items) run(item.sql, item.args ?? []);
      });
      tx(statements);
    },
    async close() {
      db.close();
    },
  };
}
