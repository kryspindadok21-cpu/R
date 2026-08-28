import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import type { Clock } from '@seo/crawler'
import { type Db, closeDatabase, crawlRepos, repos } from '@seo/db'
import { RenderUnavailableError, createSiteFetchProvider } from '@seo/providers'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { dbLedger } from '../ledger.js'
import { runAudit } from './audit.js'
import { crawlStartUrl, runCrawlCommand } from './crawl.js'
import { openInitialized } from './init.js'

/**
 * Odbior Fazy 1 w miniaturze: prawdziwy serwer HTTP na petli zwrotnej,
 * prawdziwy `fetch`, prawdziwa baza SQLite w katalogu tymczasowym.
 * Sieci zewnetrznej nie ma i byc nie moze (AC11).
 */

let server: Server
let base: string

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">`
    + `<meta name="viewport" content="width=device-width, initial-scale=1">`
    + `<title>${title}</title></head><body>${body}</body></html>`
}

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '/'
    const html = (status: number, content: string): void => {
      response.writeHead(status, { 'content-type': 'text/html; charset=utf-8' })
      response.end(content)
    }

    if (url === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end(`User-agent: *\nDisallow: /panel\nSitemap: ${base}/sitemap.xml\n`)
      return
    }
    if (url === '/sitemap.xml') {
      response.writeHead(200, { 'content-type': 'application/xml' })
      response.end(
        '<?xml version="1.0" encoding="UTF-8"?>'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        + `<url><loc>${base}/</loc></url>`
        + `<url><loc>${base}/osierocona</loc></url>`
        + `<url><loc>${base}/usunieta</loc></url>`
        + '</urlset>',
      )
      return
    }
    if (url === '/') {
      html(200, page('Strona główna sklepu z butami trekkingowymi', [
        '<h1>Buty trekkingowe</h1>',
        '<p>Sprzedajemy buty na szlak: modele skórzane i syntetyczne, w rozmiarach od 36 do 48, z opisem przeznaczenia terenowego dla każdego modelu.</p>',
        '<h2>Jak dobrać rozmiar buta trekkingowego</h2>',
        `<p>${'Rozmiar dobiera się z zapasem jednego numeru, bo stopa puchnie na szlaku. '.repeat(10)}</p>`,
        '<a href="/oferta">Zobacz pełną ofertę butów</a>',
        '<a href="/panel">Panel administracyjny</a>',
        '<img src="/foto.png">',
      ].join('')))
      return
    }
    if (url === '/oferta') {
      html(200, page('Oferta butów trekkingowych', [
        '<h1>Oferta</h1>',
        `<p>${'Pełna lista modeli dostępnych w magazynie wraz z opisem podeszwy. '.repeat(10)}</p>`,
        '<a href="/">Strona główna</a>',
        '<a href="/martwa">Nieistniejąca strona</a>',
      ].join('')))
      return
    }
    if (url === '/osierocona') {
      html(200, page('Strona bez linków przychodzących', [
        '<h1>Osierocona</h1>',
        `<p>${'Nic do tej strony nie prowadzi, choć jest w mapie witryny. '.repeat(10)}</p>`,
      ].join('')))
      return
    }
    if (url === '/panel') { html(200, page('Panel', '<h1>Panel</h1>')); return }
    html(404, page('404', '<h1>Nie ma</h1>'))
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('serwer nie wystartował')
  base = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

/** Zegar bez czekania — inaczej test odstalby sekunde na kazda strone. */
const instantClock: Clock = { now: () => Date.now(), sleep: async () => {} }

const scope = tenantScope('local')
let dir: string
let db: Db

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-crawl-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

function providerFor() {
  return createSiteFetchProvider({
    fetchFn: globalThis.fetch,
    ledger: dbLedger(db, scope),
    now: () => Date.now(),
  })
}

function crawl(overrides: Record<string, unknown> = {}) {
  return runCrawlCommand(
    { db, scope, provider: providerFor(), clock: instantClock },
    { siteUrl: base, limits: { delayMs: 500 }, ...overrides },
  )
}

/** Kazdy przebieg konczy sie identyfikatorem — brak znaczy blad testu, nie kodu. */
function runIdOf(result: { runId: string | null }): string {
  if (result.runId === null) throw new Error('przebieg nie został zapisany')
  return result.runId
}

describe('crawlStartUrl', () => {
  it('zamienia property domenowe na adres', () => {
    expect(crawlStartUrl('sc-domain:przyklad.test')).toBe('https://przyklad.test/')
  })

  it('domyka ukośnik w property prefiksowym', () => {
    expect(crawlStartUrl('https://przyklad.test')).toBe('https://przyklad.test/')
  })

  it('nie dubluje ukośnika', () => {
    expect(crawlStartUrl('https://przyklad.test/')).toBe('https://przyklad.test/')
  })
})

describe('seo crawl — na prawdziwym serwerze', () => {
  it('pobiera strony i zapisuje przebieg', async () => {
    const result = await crawl()
    expect(result.robotsState).toBe('ok')
    expect(result.pagesFetched).toBeGreaterThanOrEqual(4)
    expect(result.truncated).toBe(false)
    expect(crawlRepos(db, scope).read.getCrawlRun(runIdOf(result))?.ok).toBe(1)
  })

  it('respektuje Disallow — panel nie zostaje pobrany', async () => {
    const result = await crawl()
    const pages = crawlRepos(db, scope).read.listCrawlPages(runIdOf(result))
    expect(pages.map((p) => p.url)).not.toContain(`${base}/panel`)
    expect(result.blockedByRobots).toBe(1)
  })

  it('bierze adresy z mapy witryny, także te bez linków przychodzących', async () => {
    const result = await crawl()
    const pages = crawlRepos(db, scope).read.listCrawlPages(runIdOf(result))
    expect(result.sitemapUrls).toHaveLength(3)
    expect(pages.map((p) => p.url)).toContain(`${base}/osierocona`)
  })

  it('zapisuje wiersz w rejestrze wywołań dla każdego żądania (AC5)', async () => {
    const result = await crawl()
    const summary = repos(db, scope).read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)
    const crawlCalls = summary.filter((row) => row.providerId === 'site')
    const totalCalls = crawlCalls.reduce((sum, row) => sum + row.calls, 0)

    // Zadania stron plus robots.txt plus mapa witryny — kazde ma swoj wiersz.
    expect(totalCalls).toBe(result.requests + 2)
    expect(crawlCalls.map((r) => r.capability).sort())
      .toEqual(['crawl:fetch', 'crawl:robots', 'crawl:sitemap'])
  })

  it('crawl własnej strony nic nie kosztuje', async () => {
    await crawl()
    const summary = repos(db, scope).read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)
    expect(summary.every((row) => row.costMicros === 0)).toBe(true)
  })

  it('zapisuje graf linków', async () => {
    const result = await crawl()
    const links = crawlRepos(db, scope).read.listPageLinks(runIdOf(result))
    expect(links.length).toBeGreaterThan(0)
    expect(links.every((l) => l.fromUrl.startsWith(base))).toBe(true)
  })

  it('przycina limit ponad sufitem i melduje przycięcie', async () => {
    const result = await crawl({ limits: { maxPages: 999_999, delayMs: 500 } })
    expect(result.adjustments.map((a) => a.limit)).toEqual(['maxPages'])
    expect(result.limits.maxPages).toBe(10_000)
  })

  it('limit stron ucina crawl i zostaje to zapisane', async () => {
    const result = await crawl({ limits: { maxPages: 2, delayMs: 500 } })
    expect(result.truncated).toBe(true)
    expect(crawlRepos(db, scope).read.getCrawlRun(runIdOf(result))?.truncated).toBe(1)
  })

  it('próba na sucho czyta robots i mapę, ale nie pobiera stron', async () => {
    const result = await crawl({ dryRun: true })
    expect(result.runId).toBeNull()
    expect(result.sitemapUrls).toHaveLength(3)
    expect(result.pagesFetched).toBe(0)
  })

  it('nieosiągalny robots.txt zatrzymuje crawl bez pobierania stron', async () => {
    const provider = providerFor()
    const withFailingRobots = {
      ...provider,
      fetchText: async (
        url: string,
        capability: 'crawl:robots' | 'crawl:sitemap',
        options: Parameters<typeof provider.fetchText>[2],
      ) =>
        capability === 'crawl:robots'
          ? {
              url, requestedUrl: url, status: 503, contentType: null, body: null,
              bytes: 0, durationMs: 1, redirectChain: [], error: null, etag: null,
              lastModified: null, httpRequests: 1, truncated: false,
            }
          : provider.fetchText(url, capability, options),
    }

    const result = await runCrawlCommand(
      { db, scope, provider: withFailingRobots, clock: instantClock },
      { siteUrl: base, limits: { delayMs: 500 } },
    )

    expect(result.robotsState).toBe('unreachable')
    expect(result.pagesFetched).toBe(0)
  })
})

describe('seo crawl — renderowanie niedostępne', () => {
  it('brak przeglądarki nie unieważnia udanego crawla', async () => {
    const result = await runCrawlCommand(
      {
        db, scope, provider: providerFor(), clock: instantClock,
        renderProvider: () => ({
          id: 'render' as const,
          renderPage: async () => { throw new RenderUnavailableError('atrapa: brak przeglądarki') },
          close: async () => {},
        }),
      },
      { siteUrl: base, limits: { delayMs: 500 }, renderSample: 3 },
    )

    // Strony sa w bazie, przebieg jest udany i nieuciety — mimo braku przegladarki.
    expect(result.pagesFetched).toBeGreaterThanOrEqual(4)
    expect(result.truncated).toBe(false)
    expect(result.rendered).toBe(0)
    expect(result.renderUnavailable).toContain('Renderowanie jest niedostepne')

    const run = crawlRepos(db, scope).read.getCrawlRun(runIdOf(result))
    expect(run?.ok).toBe(1)
    expect(run?.truncated).toBe(0)
  })

  it('audyt po takim crawlu nadal widzi cały serwis', async () => {
    await runCrawlCommand(
      {
        db, scope, provider: providerFor(), clock: instantClock,
        renderProvider: () => ({
          id: 'render' as const,
          renderPage: async () => { throw new RenderUnavailableError('atrapa') },
          close: async () => {},
        }),
      },
      { siteUrl: base, limits: { delayMs: 500 }, renderSample: 3 },
    )
    const audyt = runAudit(db, scope, { siteUrl: base })
    expect(audyt.capabilities).toContain('complete-crawl')
  })

  it('bez flagi --render przeglądarka nie jest w ogóle dotykana', async () => {
    let utworzona = false
    const result = await runCrawlCommand(
      {
        db, scope, provider: providerFor(), clock: instantClock,
        renderProvider: () => { utworzona = true; throw new Error('nie powinno się wydarzyć') },
      },
      { siteUrl: base, limits: { delayMs: 500 } },
    )
    expect(utworzona).toBe(false)
    expect(result.renderUnavailable).toBeNull()
  })
})

describe('seo audit — na zapisanym crawlu', () => {
  it('produkuje ustalenia z dowodem', async () => {
    await crawl()
    const result = runAudit(db, scope, { siteUrl: base })
    expect(result.pagesAudited).toBeGreaterThanOrEqual(4)
    expect(result.totalFindings).toBeGreaterThan(0)

    const findings = crawlRepos(db, scope).read.listFindings(result.runId)
    const missingAlt = findings.find((f) => f.ruleId === 'image.missing-alt')
    expect(missingAlt?.url).toBe(`${base}/`)
    expect(JSON.parse(missingAlt?.evidence ?? '{}')).toHaveProperty('liczba obrazów', 1)
  })

  it('wykrywa stronę osieroconą, bo crawl był kompletny', async () => {
    await crawl()
    const result = runAudit(db, scope, { siteUrl: base })
    const findings = crawlRepos(db, scope).read.listFindings(result.runId)

    expect(result.capabilities).toContain('complete-crawl')
    expect(findings.filter((f) => f.ruleId === 'page.orphan').map((f) => f.url))
      .toEqual([`${base}/osierocona`])
  })

  it('wykrywa zepsuty link wewnętrzny', async () => {
    await crawl()
    const result = runAudit(db, scope, { siteUrl: base })
    const broken = crawlRepos(db, scope).read.listFindings(result.runId)
      .find((f) => f.ruleId === 'link.broken-internal')

    expect(broken?.url).toBe(`${base}/oferta`)
    expect(JSON.parse(broken?.evidence ?? '{}')['status celu']).toBe(404)
  })

  it('wykrywa martwy adres w mapie witryny', async () => {
    await crawl()
    const result = runAudit(db, scope, { siteUrl: base })
    expect(crawlRepos(db, scope).read.listFindings(result.runId)
      .filter((f) => f.ruleId === 'sitemap.dead-url').map((f) => f.url))
      .toEqual([`${base}/usunieta`])
  })

  it('przy crawlu uciętym limitem reguły serwisowe milkną (D17)', async () => {
    await crawl({ limits: { maxPages: 2, delayMs: 500 } })
    const result = runAudit(db, scope, { siteUrl: base })

    expect(result.capabilities).not.toContain('complete-crawl')
    expect(result.skipped.map((s) => s.ruleId)).toContain('page.orphan')
    expect(crawlRepos(db, scope).read.listFindings(result.runId).map((f) => f.ruleId))
      .not.toContain('page.orphan')
  })

  it('zapisuje reguły pominięte, żeby cisza była widoczna', async () => {
    await crawl()
    const result = runAudit(db, scope, { siteUrl: base })
    const skipped = crawlRepos(db, scope).read.listSkippedRules(result.runId)

    // Renderowania nie bylo, wiec regula gotowosci dla AI nie ma prawa glosu.
    expect(skipped.map((s) => s.ruleId)).toContain('ai.js-required-for-content')
  })

  it('powtórzony audyt nie dubluje ustaleń', async () => {
    await crawl()
    const first = runAudit(db, scope, { siteUrl: base })
    const second = runAudit(db, scope, { siteUrl: base })

    expect(second.totalFindings).toBe(first.totalFindings)
    expect(crawlRepos(db, scope).read.listFindings(second.runId))
      .toHaveLength(second.totalFindings)
  })

  it('audyt bez crawla mówi wprost, czego brakuje', () => {
    expect(() => runAudit(db, scope, { siteUrl: 'https://nigdy-nie-crawlowana.test/' }))
      .toThrow(/Uruchom najpierw: seo crawl/)
  })
})
