import { tenantScope } from '@seo/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './connection.js'
import { migrate } from './migrate.js'
import { FOREIGN_FIXTURE, READ_METHOD_ARGS } from './read-fixtures.js'
import { repos } from './repo.js'

const A = tenantScope('tenant-a')
const B = tenantScope('tenant-b')

function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  for (const [scope, marker] of [[A, 'marker-a'], [B, FOREIGN_FIXTURE.marker]] as const) {
    const r = repos(db, scope)
    r.write.ensureTenant(scope.tenantId)
    const site = r.write.upsertSite('domain', `sc-domain:${marker}.example`)
    const run = r.write.startSyncRun(site.id, '2026-03-01', '2026-03-02', 'final', 'date')
    r.write.upsertDaily(site.id, run, [
      { date: '2026-03-01', clicks: 7, impressions: 70, ctr: 0.1, position: 4 },
    ])
    r.write.upsertQueryDaily(site.id, run, [
      { date: '2026-03-01', query: marker, clicks: 7, impressions: 70, ctr: 0.1, position: 4 },
    ])
    r.write.upsertReconciliation(site.id, {
      date: '2026-03-01', totalClicks: 7, querySumClicks: 7, totalImpressions: 70, querySumImpressions: 70,
    })
    r.write.recordProviderCall({
      providerId: 'gsc', capability: 'performance.byDate', startedAt: 1, durationMs: 2,
      ok: true, httpStatus: 200, quotaUnits: 1, costMicros: 0, requestFingerprint: marker,
    })
  }
  return db
}

describe('izolacja tenantow (AC6)', () => {
  let db: ReturnType<typeof openDatabase>
  beforeEach(() => { db = seeded() })

  it('kazda metoda odczytu ma wpis w rejestrze argumentow', () => {
    const declared = Object.keys(repos(db, A).read).sort()
    expect(declared).toEqual(Object.keys(READ_METHOD_ARGS).sort())
  })

  it.each(Object.keys(READ_METHOD_ARGS))('%s nie zwraca danych obcego tenanta', (name) => {
    const read = repos(db, A).read as Record<string, (...a: unknown[]) => unknown>
    const foreignSiteId = repos(db, B).read.listSites()[0]!.id
    const args = READ_METHOD_ARGS[name]!({ ...FOREIGN_FIXTURE, siteId: foreignSiteId })
    const json = JSON.stringify(read[name]!(...args) ?? null)
    expect(json).not.toContain('tenant-b')
    expect(json).not.toContain(FOREIGN_FIXTURE.marker)
    expect(json).not.toContain(foreignSiteId)
  })

  it('zapis pod scope A nie tworzy wierszy widocznych dla B', () => {
    repos(db, A).write.upsertSite('url_prefix', 'https://wspolny.example/')
    repos(db, B).write.upsertSite('url_prefix', 'https://wspolny.example/')
    expect(repos(db, A).read.listSites()).toHaveLength(2)
    expect(repos(db, B).read.listSites()).toHaveLength(2)
    expect(repos(db, A).read.listSites().every((s) => s.tenantId === 'tenant-a')).toBe(true)
  })

  it('upsertSite jest idempotentny w obrebie tenanta', () => {
    const r = repos(db, A)
    const first = r.write.upsertSite('domain', 'sc-domain:idem.example')
    const second = r.write.upsertSite('domain', 'sc-domain:idem.example')
    expect(second.id).toBe(first.id)
  })

  it('upsertDaily nadpisuje wiersz tego samego dnia zamiast go duplikowac', () => {
    const r = repos(db, A)
    const site = r.read.listSites()[0]!
    const run = r.write.startSyncRun(site.id, '2026-03-01', '2026-03-01', 'final', 'date')
    r.write.upsertDaily(site.id, run, [
      { date: '2026-03-01', clicks: 99, impressions: 990, ctr: 0.1, position: 2 },
    ])
    const rows = r.read.listDailyRange(site.id, '2026-03-01', '2026-03-01')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.clicks).toBe(99)
  })

  it('finishSyncRun zamyka przebieg biezacego tenanta', () => {
    const r = repos(db, A)
    const site = r.read.listSites()[0]!
    const run = r.write.startSyncRun(site.id, '2026-03-01', '2026-03-01', 'final', 'date')
    r.write.finishSyncRun(run, 5, true)
    const latest = r.read.latestSyncRun(site.id)!
    expect(latest.id).toBe(run)
    expect(latest.ok).toBe(1)
    expect(latest.rowsFetched).toBe(5)
  })

  it('providerCallSummary sumuje tylko wywolania biezacego tenanta', () => {
    const summary = repos(db, A).read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)
    expect(summary).toHaveLength(1)
    expect(summary[0]!.calls).toBe(1)
  })
})
