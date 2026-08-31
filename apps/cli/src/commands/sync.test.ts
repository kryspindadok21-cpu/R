import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import type { PerformanceQuery, PerformanceRows, SiteMetricsProvider } from '@seo/providers'
import { describe, expect, it, vi } from 'vitest'
import { runSync } from './sync.js'

const SCOPE = tenantScope('local')

function fakeProvider(pages: Record<string, PerformanceRows[]>): SiteMetricsProvider {
  const cursor: Record<string, number> = {}
  return {
    id: 'gsc',
    capabilities: ['performance.byDate', 'performance.byQuery'],
    estimateQuota: (qs) => qs.length,
    queryPerformance: vi.fn(async (q: PerformanceQuery) => {
      const key = q.dimensions.join(',')
      const i = cursor[key] ?? 0
      cursor[key] = i + 1
      // Wymiar bez fikstury zwraca pustke, a nie wybucha: atrapa, ktora pada na
      // nowym wymiarze, testuje ksztalt fikstury, a nie zachowanie kodu.
      return pages[key]?.[i] ?? { rows: [], sourceTimezone: 'America/Los_Angeles' }
    }),
  }
}

function freshDb() {
  const db = openDatabase(':memory:')
  migrate(db)
  repos(db, SCOPE).write.ensureTenant('local')
  return db
}

const rows = (r: unknown[]) => ({ rows: r, sourceTimezone: 'America/Los_Angeles' }) as PerformanceRows

describe('runSync', () => {
  it('zapisuje wiersze dzienne i po haslach', async () => {
    const db = freshDb()
    const provider = fakeProvider({
      date: [rows([{ keys: ['2026-03-10'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }])],
      'date,query': [rows([{ keys: ['2026-03-10', 'buty'], clicks: 90, impressions: 900, ctr: 0.1, position: 5 }])],
      'date,page': [rows([{ keys: ['2026-03-10', 'https://a.test/buty'], clicks: 80, impressions: 800, ctr: 0.1, position: 4 }])],
    })
    const result = await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })
    expect(result.dailyRows).toBe(1)
    expect(result.queryRows).toBe(1)
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.listDailyRange(site.id, '2026-03-10', '2026-03-10')[0]!.date).toBe('2026-03-10')
  })

  it('paginuje az strona bedzie krotsza niz pageSize', async () => {
    const db = freshDb()
    const provider = fakeProvider({
      date: [
        rows([
          { keys: ['2026-03-10'], clicks: 1, impressions: 10, ctr: 0.1, position: 5 },
          { keys: ['2026-03-11'], clicks: 2, impressions: 20, ctr: 0.1, position: 5 },
        ]),
        rows([{ keys: ['2026-03-12'], clicks: 3, impressions: 30, ctr: 0.1, position: 5 }]),
      ],
      'date,query': [rows([])],
    })
    const result = await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-12', pageSize: 2,
    })
    expect(result.dailyRows).toBe(3)
    // 2 strony dat + 1 pusta hasel + 1 pusta stron (wymiar `page` z Fazy 4)
    expect(provider.queryPerformance).toHaveBeenCalledTimes(4)
  })

  it('jest idempotentny — dwa przebiegi nie tworza duplikatow', async () => {
    const db = freshDb()
    const make = () => fakeProvider({
      date: [rows([{ keys: ['2026-03-10'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }])],
      'date,query': [rows([])],
    })
    const opts = { siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2 }
    await runSync({ db, scope: SCOPE, provider: make() }, opts)
    await runSync({ db, scope: SCOPE, provider: make() }, opts)
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.listDailyRange(site.id, '2026-03-10', '2026-03-10')).toHaveLength(1)
  })

  it('zapisuje uzgodnienie z roznica anonimizacji', async () => {
    const db = freshDb()
    const provider = fakeProvider({
      date: [rows([{ keys: ['2026-03-10'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5 }])],
      'date,query': [rows([{ keys: ['2026-03-10', 'buty'], clicks: 90, impressions: 900, ctr: 0.1, position: 5 }])],
    })
    await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.getReconciliation(site.id, '2026-03-10')).toMatchObject({
      totalClicks: 100, querySumClicks: 90, anonymizedDeltaClicks: 10,
    })
  })

  it('zamyka przebieg jako nieudany, gdy dostawca rzuci', async () => {
    const db = freshDb()
    const provider: SiteMetricsProvider = {
      id: 'gsc', capabilities: ['performance.byDate'], estimateQuota: () => 1,
      queryPerformance: async () => { throw new Error('403') },
    }
    await expect(runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'sc-domain:x.pl', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })).rejects.toThrow()
    const site = repos(db, SCOPE).read.findSiteByUri('sc-domain:x.pl')!
    expect(repos(db, SCOPE).read.latestSyncRun(site.id)).toMatchObject({ ok: 0 })
  })

  it('rozpoznaje property typu url_prefix po braku prefiksu sc-domain', async () => {
    const db = freshDb()
    const provider = fakeProvider({ date: [rows([])], 'date,query': [rows([])] })
    await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: 'https://example.pl/', from: '2026-03-10', to: '2026-03-10', pageSize: 2,
    })
    expect(repos(db, SCOPE).read.findSiteByUri('https://example.pl/')!.propertyType).toBe('url_prefix')
  })
})
