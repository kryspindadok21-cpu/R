import { tenantScope } from '@seo/core'
import { parsePage } from '@seo/parse'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDatabase } from './connection.js'
import { crawlRepos, factsOf, noindexReasonOf, redirectChainOf } from './crawl-repo.js'
import { migrate } from './migrate.js'
import { CRAWL_READ_METHOD_ARGS } from './read-fixtures.js'
import { repos } from './repo.js'

const A = tenantScope('tenant-a')
const B = tenantScope('tenant-b')
const OBCY = 'obcy-marker-crawl'

function htmlFor(marker: string): string {
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">`
    + `<title>Strona ${marker}</title></head><body><h1>${marker}</h1>`
    + `<p>Treść strony ${marker}.</p><a href="/druga">Druga strona</a></body></html>`
}

/** Zaklada pelny crawl dla obu tenantow, kazdy ze swoim markerem w tresci. */
function seeded() {
  const db = openDatabase(':memory:')
  migrate(db)

  const runIds = new Map<string, { siteId: string; runId: string }>()

  for (const [scope, marker, host] of [[A, 'marker-a', 'a'], [B, OBCY, 'b']] as const) {
    const base = repos(db, scope)
    base.write.ensureTenant(scope.tenantId)
    const site = base.write.upsertSite('url_prefix', `https://${host}.example/`)

    const r = crawlRepos(db, scope)
    const runId = r.write.startCrawlRun(site.id, {
      maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
      robotsState: 'ok', userAgent: `agent-${marker}`, sitemapUrls: [`https://${host}.example/sitemap.xml`],
    })

    const pageUrl = `https://${host}.example/`
    r.write.insertCrawlPages(site.id, runId, [
      {
        url: pageUrl, depth: 0, httpStatus: 200, contentType: 'text/html',
        bytes: 500, durationMs: 100, redirectChain: [`https://${host}.example/stara`],
        fetchError: null, facts: parsePage(htmlFor(marker), { url: pageUrl }),
        renderDiff: null, inSitemap: true,
      },
      {
        url: `https://${host}.example/osierocona`, depth: 1, httpStatus: 200,
        contentType: 'text/html', bytes: 300, durationMs: 90, redirectChain: [],
        fetchError: null, facts: parsePage(htmlFor(marker), { url: `https://${host}.example/osierocona` }),
        renderDiff: null, inSitemap: false,
      },
    ])

    r.write.insertPageLinks(site.id, runId, [
      {
        fromUrl: pageUrl, toUrl: `https://${host}.example/druga`,
        rel: 'follow', anchorText: marker, isInternal: true,
      },
      {
        fromUrl: pageUrl, toUrl: `https://obca-${marker}.test/x`,
        rel: 'nofollow', anchorText: marker, isInternal: false,
      },
    ])

    r.write.insertFindings(site.id, runId, [
      {
        ruleId: 'title.too-long', severity: 'low', category: 'content',
        url: pageUrl, title: 'Tytuł prawdopodobnie ucięty',
        evidence: { 'tytuł': `Strona ${marker}` },
      },
    ])
    r.write.insertSkippedRules(runId, [{ ruleId: 'page.orphan', missing: [marker] }])
    r.write.upsertPsiMeasurement(site.id, {
      url: pageUrl, strategy: 'mobile', measuredAt: 1000,
      lcpMs: 2100, inpMs: 120, cls: 0.02, ttfbMs: 300,
      performanceScore: 0.85, source: 'lab',
    })
    r.write.finishCrawlRun(runId, {
      pagesFetched: 2, pagesFailed: 0, ok: true, truncated: false,
    })

    runIds.set(scope.tenantId, { siteId: site.id, runId })
  }

  return { db, runIds }
}

describe('izolacja tenantow w repozytoriach crawla', () => {
  let db: ReturnType<typeof openDatabase>
  let runIds: Map<string, { siteId: string; runId: string }>

  beforeEach(() => { ({ db, runIds } = seeded()) })

  it('kazda metoda odczytu ma wpis w rejestrze argumentow', () => {
    const declared = Object.keys(crawlRepos(db, A).read).sort()
    expect(declared).toEqual(Object.keys(CRAWL_READ_METHOD_ARGS).sort())
  })

  it.each(Object.keys(CRAWL_READ_METHOD_ARGS))('%s nie zwraca danych obcego tenanta', (name) => {
    const foreign = runIds.get('tenant-b')
    if (!foreign) throw new Error('brak danych tenanta B')
    const read = crawlRepos(db, A).read as Record<string, (...a: unknown[]) => unknown>
    const args = CRAWL_READ_METHOD_ARGS[name]!({
      marker: OBCY, siteId: foreign.siteId, date: '2026-03-01', runId: foreign.runId,
    })
    const json = JSON.stringify(read[name]!(...args) ?? null)

    expect(json).not.toContain('tenant-b')
    expect(json).not.toContain(OBCY)
    expect(json).not.toContain(foreign.siteId)
    expect(json).not.toContain(foreign.runId)
  })
})

describe('zapis i odczyt crawla', () => {
  let db: ReturnType<typeof openDatabase>
  let own: { siteId: string; runId: string }

  beforeEach(() => {
    const seed = seeded()
    db = seed.db
    const mine = seed.runIds.get('tenant-a')
    if (!mine) throw new Error('brak danych tenanta A')
    own = mine
  })

  it('zapisuje strony razem z faktami i odczytuje je z walidacja', () => {
    const pages = crawlRepos(db, A).read.listCrawlPages(own.runId)
    expect(pages).toHaveLength(2)
    expect(pages[0]?.title).toBe('Strona marker-a')
    expect(factsOf(pages[0]!)?.h1Count).toBe(1)
  })

  it('odczytuje lancuch przekierowan jako liste', () => {
    const pages = crawlRepos(db, A).read.listCrawlPages(own.runId)
    expect(redirectChainOf(pages[0]!)).toEqual(['https://a.example/stara'])
  })

  it('nie duplikuje strony przy powtornym zapisie w tym samym przebiegu', () => {
    const r = crawlRepos(db, A)
    r.write.insertCrawlPages(own.siteId, own.runId, [{
      url: 'https://a.example/', depth: 0, httpStatus: 200, contentType: 'text/html',
      bytes: 1, durationMs: 1, redirectChain: [], fetchError: null,
      facts: null, renderDiff: null, inSitemap: false,
    }])
    expect(r.read.listCrawlPages(own.runId)).toHaveLength(2)
  })

  it('link zewnetrzny nie dostaje wiersza url, wewnetrzny dostaje', () => {
    const links = crawlRepos(db, A).read.listPageLinks(own.runId)
    const external = links.find((l) => l.isInternal === 0)
    const internal = links.find((l) => l.isInternal === 1)
    expect(external?.toUrlId).toBeNull()
    expect(internal?.toUrlId).not.toBeNull()
  })

  it('znajduje strony, do ktorych nie prowadzi zaden link wewnetrzny', () => {
    const orphans = crawlRepos(db, A).read.orphanPages(own.runId)
    expect(orphans.map((o) => o.url)).toEqual(['https://a.example/', 'https://a.example/osierocona'])
  })

  it('liczy ustalenia wg wagi', () => {
    expect(crawlRepos(db, A).read.findingCountsBySeverity(own.runId))
      .toEqual([{ severity: 'low', count: 1 }])
  })

  it('zapisuje reguly pominiete, zeby cisza byla widoczna', () => {
    const skipped = crawlRepos(db, A).read.listSkippedRules(own.runId)
    expect(skipped.map((s) => s.ruleId)).toEqual(['page.orphan'])
  })

  it('powtorny audyt zastepuje poprzedni zamiast go dublowac', () => {
    const r = crawlRepos(db, A)
    r.write.clearAudit(own.runId)
    expect(r.read.listFindings(own.runId)).toEqual([])
    expect(r.read.listSkippedRules(own.runId)).toEqual([])
  })

  it('zapisuje pomiar PageSpeed', () => {
    const rows = crawlRepos(db, A).read.listPsiMeasurements(own.siteId, 0, Number.MAX_SAFE_INTEGER)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.lcpMs).toBe(2100)
  })

  it('domyka przebieg crawla', () => {
    const run = crawlRepos(db, A).read.latestCrawlRun(own.siteId)
    expect(run?.ok).toBe(1)
    expect(run?.pagesFetched).toBe(2)
    expect(run?.truncated).toBe(0)
  })

  it('ten sam adres w dwoch przebiegach to jeden wiersz url', () => {
    const r = crawlRepos(db, A)
    const drugi = r.write.startCrawlRun(own.siteId, {
      maxPages: 10, maxDepth: 2, delayMs: 1000, renderSample: 0,
      robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
    })
    r.write.insertCrawlPages(own.siteId, drugi, [{
      url: 'https://a.example/', depth: 0, httpStatus: 200, contentType: 'text/html',
      bytes: 1, durationMs: 1, redirectChain: [], fetchError: null,
      facts: null, renderDiff: null, inSitemap: false,
    }])
    const pierwszy = r.read.listCrawlPages(own.runId).find((p) => p.url === 'https://a.example/')
    const drugiPage = r.read.listCrawlPages(drugi)[0]
    expect(drugiPage?.urlId).toBe(pierwszy?.urlId)
  })
})

describe('noindexReasonOf', () => {
  const base = {
    url: 'https://a.example/', depth: 0, contentType: 'text/html', bytes: 1,
    durationMs: 1, redirectChain: [], fetchError: null, renderDiff: null, inSitemap: false,
  }
  const facts = parsePage(htmlFor('x'), { url: 'https://a.example/' })

  it('strona 200 z HTML-em bez noindex jest indeksowalna', () => {
    expect(noindexReasonOf({ ...base, httpStatus: 200, facts })).toBeNull()
  })

  it('brak odpowiedzi wyklucza z indeksu', () => {
    expect(noindexReasonOf({ ...base, httpStatus: null, facts: null })).toBe('brak odpowiedzi')
  })

  it('status 404 wyklucza z indeksu', () => {
    expect(noindexReasonOf({ ...base, httpStatus: 404, facts })).toBe('status 404')
  })

  it('odpowiedz nie-HTML wyklucza z indeksu', () => {
    expect(noindexReasonOf({ ...base, httpStatus: 200, facts: null }))
      .toBe('odpowiedź nie jest HTML-em')
  })

  it('meta robots noindex wyklucza z indeksu', () => {
    const noindex = parsePage(
      '<html><head><meta name="robots" content="noindex"><title>x</title></head><body></body></html>',
      { url: 'https://a.example/' },
    )
    expect(noindexReasonOf({ ...base, httpStatus: 200, facts: noindex })).toBe('meta robots: noindex')
  })
})
