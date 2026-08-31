import { getTableColumns, getTableName, is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { openDatabase, rawHandle } from './connection.js'
import { migrate } from './migrate.js'
import * as schema from './schema.js'

const tables = Object.values(schema).filter((v) => is(v, SQLiteTable)) as SQLiteTable[]

function migrated() {
  const db = openDatabase(':memory:')
  migrate(db)
  return db
}

function columnsInDatabase(table: string): string[] {
  return rawHandle(migrated())
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => (r as { name: string }).name)
    .sort()
}

/** Tabele, ktore naprawde powstaja po wszystkich migracjach. */
function tablesInDatabase(): string[] {
  return rawHandle(migrated())
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .all()
    .map((r) => (r as { name: string }).name)
    .filter((name) => name !== 'schema_migration')
    .sort()
}

describe('schema', () => {
  /**
   * Wlasnosc, nie lista. Wpisana na sztywno lista tabel psula sie przy kazdej
   * nowej migracji i uczyla, ze test sie „poprawia" zamiast cos wykrywac.
   * Porownanie z faktyczna zawartoscia bazy lapie oba kierunki rozjazdu:
   * tabele bez modelu drizzle i model bez tabeli.
   */
  it('opisuje dokladnie te tabele, ktore tworza migracje', () => {
    expect(tables.map(getTableName).sort()).toEqual(tablesInDatabase())
  })

  it.each(tables.map((t) => [getTableName(t), t] as const))(
    'kolumny %s zgadzaja sie z migracja SQL',
    (name, table) => {
      const declared = Object.values(getTableColumns(table)).map((c) => c.name).sort()
      expect(declared).toEqual(columnsInDatabase(name))
    },
  )

  it.each(tables.filter((t) => getTableName(t) !== 'tenant').map((t) => [getTableName(t), t] as const))(
    '%s ma kolumne tenant_id',
    (_name, table) => {
      const declared = Object.values(getTableColumns(table)).map((c) => c.name)
      expect(declared).toContain('tenant_id')
    },
  )
})
