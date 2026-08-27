import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import { afterEach, describe, expect, it } from 'vitest'
import { runReport } from './report.js'

const SCOPE = tenantScope('local')

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  const r = repos(db, SCOPE)
  r.write.ensureTenant('local')
  const site = r.write.upsertSite('domain', 'sc-domain:x.pl')
  const run = r.write.startSyncRun(site.id, '2026-03-10', '2026-03-10', 'final', 'date')
  r.write.upsertDaily(site.id, run, [
    { date: '2026-03-10', clicks: 100, impressions: 1000, ctr: 0.1, position: 5 },
  ])
  r.write.upsertQueryDaily(site.id, run, [
    { date: '2026-03-10', query: 'buty', clicks: 90, impressions: 900, ctr: 0.1, position: 5 },
  ])
  r.write.upsertReconciliation(site.id, {
    date: '2026-03-10', totalClicks: 100, querySumClicks: 90,
    totalImpressions: 1000, querySumImpressions: 900,
  })
  r.write.recordProviderCall({
    providerId: 'gsc', capability: 'performance.byDate', startedAt: 1, durationMs: 2,
    ok: true, httpStatus: 200, quotaUnits: 1, costMicros: 0, requestFingerprint: 'x',
  })
  return db
}

describe('runReport', () => {
  it('zapisuje samowystarczalny plik HTML z danymi z bazy', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const out = join(dir, 'raport.html')
    const result = runReport(seeded(), SCOPE, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-01', to: '2026-03-31', outPath: out,
      generatedAt: '2026-03-14 09:00',
    })
    expect(result.outPath).toBe(out)
    const html = readFileSync(out, 'utf8')
    expect(html).toContain('sc-domain:x.pl')
    expect(html).toContain('buty')
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
  })

  it('mowi, co zrobic, gdy strony nie ma w bazie', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    expect(() => runReport(seeded(), SCOPE, {
      siteUrl: 'sc-domain:inna.pl', from: '2026-03-01', to: '2026-03-31',
      outPath: join(dir, 'r.html'), generatedAt: '2026-03-14 09:00',
    })).toThrow(/seo gsc sync/)
  })

  it('tworzy raport takze bez danych w zakresie', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const out = join(dir, 'raport.html')
    runReport(seeded(), SCOPE, {
      siteUrl: 'sc-domain:x.pl', from: '2020-01-01', to: '2020-01-02', outPath: out,
      generatedAt: '2026-03-14 09:00',
    })
    expect(readFileSync(out, 'utf8')).toContain('Brak danych')
  })
})
