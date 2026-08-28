import { describe, expect, it } from 'vitest'
import { openDatabase, rawHandle } from './connection.js'
import { migrate } from './migrate.js'

const TABLES_FAZA_0 = [
  'tenant', 'site', 'url', 'gsc_sync_run', 'gsc_daily',
  'gsc_query_daily', 'gsc_reconciliation', 'provider_call',
]

const TABLES_FAZA_1 = [
  'crawl_run', 'crawl_page', 'page_link', 'audit_finding',
  'audit_skipped_rule', 'psi_measurement',
]

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  return rawHandle(db)
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => (r as { name: string }).name)
}

describe('migrate', () => {
  it('tworzy wszystkie tabele Fazy 0', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    for (const t of TABLES_FAZA_0) expect(tableNames(db)).toContain(t)
  })

  it('tworzy wszystkie tabele Fazy 1', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    for (const t of TABLES_FAZA_1) expect(tableNames(db)).toContain(t)
  })

  // Lista migracji nie jest wpisana na sztywno: test sprawdza wlasnosc migratora
  // (kolejnosc i idempotentnosc), a nie zawartosc katalogu, ktory bedzie rosl.
  it('stosuje migracje po kolei i tylko raz', () => {
    const db = openDatabase(':memory:')
    const applied = migrate(db)

    expect(applied).toEqual([...applied].sort())
    expect(applied).toContain('0001_init.sql')
    expect(applied).toContain('0002_crawl.sql')
    expect(migrate(db)).toEqual([])
  })

  it('wlacza klucze obce', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const row = rawHandle(db).prepare('PRAGMA foreign_keys').get() as { foreign_keys: number }
    expect(row.foreign_keys).toBe(1)
  })

  it('egzekwuje CHECK na property_type', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const h = rawHandle(db)
    h.prepare('INSERT INTO tenant VALUES (?,?,?)').run('local', 'Local', 1)
    expect(() =>
      h.prepare('INSERT INTO site VALUES (?,?,?,?,?)').run('id1', 'local', 'zle', 'https://x/', 1),
    ).toThrow()
  })

  it('egzekwuje unikalnosc gsc_daily po tenancie', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const h = rawHandle(db)
    h.prepare('INSERT INTO tenant VALUES (?,?,?)').run('local', 'Local', 1)
    h.prepare('INSERT INTO site VALUES (?,?,?,?,?)').run('s1', 'local', 'domain', 'sc-domain:x.pl', 1)
    h.prepare('INSERT INTO gsc_sync_run (id,tenant_id,site_id,started_at,date_from,date_to,data_state,dimensions) VALUES (?,?,?,?,?,?,?,?)')
      .run('r1', 'local', 's1', 1, '2026-01-01', '2026-01-02', 'final', 'date')
    const ins = h.prepare('INSERT INTO gsc_daily VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    ins.run('d1', 'local', 's1', '2026-01-01', 'America/Los_Angeles', 5, 100, 0.05, 3.2, 'final', 'r1')
    expect(() =>
      ins.run('d2', 'local', 's1', '2026-01-01', 'America/Los_Angeles', 6, 100, 0.06, 3.2, 'final', 'r1'),
    ).toThrow()
  })

  it('odrzuca klucz obcy do nieistniejacego tenanta', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    expect(() =>
      rawHandle(db)
        .prepare('INSERT INTO site VALUES (?,?,?,?,?)')
        .run('s1', 'brak-tenanta', 'domain', 'sc-domain:x.pl', 1),
    ).toThrow()
  })

  it('rawHandle odrzuca obiekt spoza openDatabase', () => {
    expect(() => rawHandle({} as ReturnType<typeof openDatabase>)).toThrow()
  })
})
