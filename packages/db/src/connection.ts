import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema.js'

export type Db = BetterSQLite3Database<typeof schema>

const HANDLES = new WeakMap<object, Database.Database>()

export function openDatabase(path: string): Db {
  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  HANDLES.set(db, sqlite)
  return db
}

/** Surowy uchwyt — wylacznie dla migratora i testow wewnatrz @seo/db. */
export function rawHandle(db: Db): Database.Database {
  const handle = HANDLES.get(db)
  if (!handle) throw new Error('Baza nie zostala otwarta przez openDatabase')
  return handle
}

/** Zamyka polaczenie. Po zamknieciu uchwyt pozostaje w rejestrze, ale jest nieuzywalny. */
export function closeDatabase(db: Db): void {
  rawHandle(db).close()
}
