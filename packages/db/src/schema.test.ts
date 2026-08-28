import { getTableColumns, getTableName, is } from 'drizzle-orm'
import { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'
import { openDatabase, rawHandle } from './connection.js'
import { migrate } from './migrate.js'
import * as schema from './schema.js'

const tables = Object.values(schema).filter((v) => is(v, SQLiteTable)) as SQLiteTable[]

function columnsInDatabase(table: string): string[] {
  const db = openDatabase(':memory:')
  migrate(db)
  return rawHandle(db)
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((r) => (r as { name: string }).name)
    .sort()
}

describe('schema', () => {
  it('opisuje wszystkie tabele domenowe', () => {
    expect(tables.map(getTableName).sort()).toEqual([
      'audit_finding', 'audit_skipped_rule', 'crawl_page', 'crawl_run',
      'gsc_daily', 'gsc_query_daily', 'gsc_reconciliation', 'gsc_sync_run',
      'page_link', 'provider_call', 'psi_measurement', 'site', 'tenant', 'url',
    ])
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
