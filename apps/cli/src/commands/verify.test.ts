import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import { describe, expect, it } from 'vitest'
import { runVerify } from './verify.js'

const SCOPE = tenantScope('local')

function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)
  const r = repos(db, SCOPE)
  r.write.ensureTenant('local')
  const site = r.write.upsertSite('domain', 'sc-domain:x.pl')
  const run = r.write.startSyncRun(site.id, '2026-03-07', '2026-03-07', 'final', 'date')
  r.write.upsertDaily(site.id, run, [
    { date: '2026-03-07', clicks: 142, impressions: 4310, ctr: 0.033, position: 8.1 },
  ])
  r.write.upsertReconciliation(site.id, {
    date: '2026-03-07', totalClicks: 142, querySumClicks: 118,
    totalImpressions: 4310, querySumImpressions: 3900,
  })
  return db
}

describe('runVerify', () => {
  it('zwraca liczby do porownania z Search Console', () => {
    expect(runVerify(seeded(), SCOPE, 'sc-domain:x.pl', '2026-03-07')).toEqual({
      date: '2026-03-07',
      clicksInDatabase: 142,
      impressionsInDatabase: 4310,
      querySumClicks: 118,
      anonymizedDeltaClicks: 24,
    })
  })

  it('mowi, co zrobic, gdy strony nie ma w bazie', () => {
    expect(() => runVerify(seeded(), SCOPE, 'sc-domain:inna.pl', '2026-03-07')).toThrow(/seo gsc sync/)
  })

  it('mowi, ze dzien jest poza zakresem synchronizacji', () => {
    expect(() => runVerify(seeded(), SCOPE, 'sc-domain:x.pl', '2020-01-01')).toThrow(/dziennych/)
  })

  it('bez uzgodnienia traktuje caly dzien jako ukryty', () => {
    const db = openDatabase(':memory:')
    migrate(db)
    const r = repos(db, SCOPE)
    r.write.ensureTenant('local')
    const site = r.write.upsertSite('domain', 'sc-domain:x.pl')
    const run = r.write.startSyncRun(site.id, '2026-03-07', '2026-03-07', 'final', 'date')
    r.write.upsertDaily(site.id, run, [
      { date: '2026-03-07', clicks: 10, impressions: 100, ctr: 0.1, position: 3 },
    ])
    expect(runVerify(db, SCOPE, 'sc-domain:x.pl', '2026-03-07')).toMatchObject({
      querySumClicks: 0, anonymizedDeltaClicks: 10,
    })
  })
})
