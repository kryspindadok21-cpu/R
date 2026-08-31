import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import type { CrawledPage } from '@seo/crawler'
import { type Db, closeDatabase, crawlRepos, renderDiffOf, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import type { RenderProvider, RenderedPage } from '@seo/providers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openInitialized } from './init.js'
import { pagesToRender, renderSample, suspicionOf, type RenderCandidate } from './render.js'

/**
 * Testy renderowania chodza po **atrapie przegladarki**. Chromium w calej suchej
 * bylby nie do przyjecia: testy maja przechodzic bez sieci i bez przegladarki
 * (AC11), a Chromium na kazdym uruchomieniu to minuty zamiast sekund.
 */

const kandydat = (o: Partial<RenderCandidate> & { url: string }): RenderCandidate => ({
  depth: 1, wordCount: 200, scriptCount: 0, textToHtmlRatio: 0.3, ...o,
})

describe('suspicionOf', () => {
  it('strona bez skryptów nie może zależeć od JavaScriptu', () => {
    expect(suspicionOf(kandydat({ url: '/a', scriptCount: 0, textToHtmlRatio: 0.01 }))).toBe(0)
  })

  it('im mniej tekstu na bajt dokumentu przy skryptach, tym większa podejrzliwość', () => {
    const uboga = kandydat({ url: '/a', scriptCount: 3, textToHtmlRatio: 0.01 })
    const bogata = kandydat({ url: '/b', scriptCount: 3, textToHtmlRatio: 0.5 })
    expect(suspicionOf(uboga)).toBeGreaterThan(suspicionOf(bogata))
  })
})

describe('pagesToRender', () => {
  it('strona główna wchodzi zawsze, niezależnie od podejrzliwości', () => {
    const wybor = pagesToRender([
      kandydat({ url: 'https://a.test/', depth: 0, scriptCount: 0 }),
      kandydat({ url: 'https://a.test/x', scriptCount: 5, textToHtmlRatio: 0.01 }),
    ], 1)
    expect(wybor.map((p) => p.url)).toEqual(['https://a.test/'])
  })

  it('reszta idzie według podejrzliwości, malejąco', () => {
    const wybor = pagesToRender([
      kandydat({ url: 'https://a.test/spokojna', scriptCount: 1, textToHtmlRatio: 0.4 }),
      kandydat({ url: 'https://a.test/podejrzana', scriptCount: 4, textToHtmlRatio: 0.02 }),
    ], 2)
    expect(wybor.map((p) => p.url))
      .toEqual(['https://a.test/podejrzana', 'https://a.test/spokojna'])
  })

  it('przy remisie sortuje alfabetycznie — dwa przebiegi dają tę samą próbkę', () => {
    const strony = [
      kandydat({ url: 'https://a.test/b', scriptCount: 2, textToHtmlRatio: 0.1 }),
      kandydat({ url: 'https://a.test/a', scriptCount: 2, textToHtmlRatio: 0.1 }),
    ]
    expect(pagesToRender(strony, 2).map((p) => p.url))
      .toEqual(pagesToRender([...strony].reverse(), 2).map((p) => p.url))
  })

  it('nie przekracza limitu', () => {
    const strony = Array.from({ length: 20 }, (_, i) => kandydat({ url: `https://a.test/${i}` }))
    expect(pagesToRender(strony, 5)).toHaveLength(5)
  })

  it('limit zero znaczy brak renderowania', () => {
    expect(pagesToRender([kandydat({ url: 'https://a.test/', depth: 0 })], 0)).toEqual([])
  })
})

// --- renderSample na atrapie przegladarki --------------------------------------

const BASE = 'https://przyklad.test/'
const SUROWY = '<!DOCTYPE html><html lang="pl"><head><title>Sklep</title></head>'
  + '<body><div id="app"></div><script src="/b.js"></script></body></html>'
const WYRENDEROWANY = '<!DOCTYPE html><html lang="pl"><head><title>Sklep — buty</title></head>'
  + '<body><div id="app"><h1>Buty</h1><p>Opis butów trekkingowych w wielu rozmiarach '
  + 'i wariantach kolorystycznych, z podeszwą przystosowaną do kamienistego terenu.</p>'
  + '<a href="/buty/skorzane">Skórzane</a></div><script src="/b.js"></script></body></html>'

function fakeRenderProvider(
  html: Readonly<Record<string, string | null>>,
): RenderProvider & { readonly rendered: readonly string[]; readonly closed: () => boolean } {
  const rendered: string[] = []
  let closed = false
  return {
    id: 'render',
    rendered,
    closed: () => closed,
    async renderPage(url: string): Promise<RenderedPage> {
      rendered.push(url)
      const content = html[url]
      return content === undefined || content === null
        ? { url, finalUrl: url, status: null, html: null, durationMs: 5, error: 'atrapa: brak strony' }
        : { url, finalUrl: url, status: 200, html: content, durationMs: 5, error: null }
    },
    async close(): Promise<void> { closed = true },
  }
}

function crawledPage(url: string, html: string, depth = 0): CrawledPage {
  return {
    url, requestedUrl: url, depth, status: 200, contentType: 'text/html',
    bytes: html.length, durationMs: 50, redirectChain: [], error: null,
    facts: parsePage(html, { url }), inSitemap: false,
  }
}

const scope = tenantScope('local')
let dir: string
let db: Db
let siteId: string
let runId: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-render-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db
  siteId = repos(db, scope).write.upsertSite('url_prefix', BASE).id
  runId = crawlRepos(db, scope).write.startCrawlRun(siteId, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
  })
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

const OPTIONS = { timeoutMs: 5000, userAgent: 'agent', settleMs: 0 }

describe('renderSample', () => {
  it('wykrywa treść istniejącą dopiero po wykonaniu JavaScriptu', async () => {
    const pages = [crawledPage(BASE, SUROWY)]
    crawlRepos(db, scope).write.insertCrawlPages(siteId, runId, pages.map((p) => ({
      url: p.url, depth: p.depth, httpStatus: p.status, contentType: p.contentType,
      bytes: p.bytes, durationMs: p.durationMs, redirectChain: p.redirectChain,
      fetchError: p.error, facts: p.facts, renderDiff: null, inSitemap: false,
    })))

    const provider = fakeRenderProvider({ [BASE]: WYRENDEROWANY })
    const result = await renderSample({ db, scope, provider }, {
      siteId, runId, pages, limit: 5, options: OPTIONS,
    })

    expect(result.rendered).toBe(1)
    expect(result.failed).toBe(0)
    expect(result.requiringJs).toEqual([BASE])
  })

  it('zapisuje porównanie w bazie, gotowe do odczytu z walidacją', async () => {
    const pages = [crawledPage(BASE, SUROWY)]
    crawlRepos(db, scope).write.insertCrawlPages(siteId, runId, pages.map((p) => ({
      url: p.url, depth: p.depth, httpStatus: p.status, contentType: p.contentType,
      bytes: p.bytes, durationMs: p.durationMs, redirectChain: p.redirectChain,
      fetchError: p.error, facts: p.facts, renderDiff: null, inSitemap: false,
    })))

    await renderSample({ db, scope, provider: fakeRenderProvider({ [BASE]: WYRENDEROWANY }) }, {
      siteId, runId, pages, limit: 5, options: OPTIONS,
    })

    const zapisana = crawlRepos(db, scope).read.listCrawlPages(runId)[0]
    const diff = renderDiffOf(zapisana!)
    expect(diff?.contentRequiresJs).toBe(true)
    expect(diff?.linksOnlyInRendered).toEqual(['https://przyklad.test/buty/skorzane'])
    expect(crawlRepos(db, scope).read.getCrawlRun(runId)?.renderSample).toBe(1)
  })

  it('strona serwerowa nie zostaje oskarżona o wymaganie JavaScriptu', async () => {
    const pelny = '<!DOCTYPE html><html lang="pl"><head><title>Sklep</title></head>'
      + '<body><h1>Buty</h1><p>Pełny opis dostępny bez JavaScriptu, wystarczająco '
      + 'długi, żeby nie być uznanym za pustą stronę.</p></body></html>'
    const pages = [crawledPage(BASE, pelny)]
    crawlRepos(db, scope).write.insertCrawlPages(siteId, runId, pages.map((p) => ({
      url: p.url, depth: p.depth, httpStatus: p.status, contentType: p.contentType,
      bytes: p.bytes, durationMs: p.durationMs, redirectChain: p.redirectChain,
      fetchError: p.error, facts: p.facts, renderDiff: null, inSitemap: false,
    })))

    const result = await renderSample({ db, scope, provider: fakeRenderProvider({ [BASE]: pelny }) }, {
      siteId, runId, pages, limit: 5, options: OPTIONS,
    })
    expect(result.requiringJs).toEqual([])
  })

  it('nieudane renderowanie jest liczone, ale nie przerywa próbki', async () => {
    const pages = [crawledPage(BASE, SUROWY), crawledPage(`${BASE}druga`, SUROWY, 1)]
    const provider = fakeRenderProvider({ [BASE]: null, [`${BASE}druga`]: WYRENDEROWANY })
    crawlRepos(db, scope).write.insertCrawlPages(siteId, runId, pages.map((p) => ({
      url: p.url, depth: p.depth, httpStatus: p.status, contentType: p.contentType,
      bytes: p.bytes, durationMs: p.durationMs, redirectChain: p.redirectChain,
      fetchError: p.error, facts: p.facts, renderDiff: null, inSitemap: false,
    })))

    const result = await renderSample({ db, scope, provider }, {
      siteId, runId, pages, limit: 5, options: OPTIONS,
    })
    expect(result.failed).toBe(1)
    expect(result.rendered).toBe(1)
  })

  it('podaje powód nieudanego renderowania, zamiast kazać szukać w bazie', async () => {
    const pages = [crawledPage(BASE, SUROWY)]
    crawlRepos(db, scope).write.insertCrawlPages(siteId, runId, pages.map((p) => ({
      url: p.url, depth: p.depth, httpStatus: p.status, contentType: p.contentType,
      bytes: p.bytes, durationMs: p.durationMs, redirectChain: p.redirectChain,
      fetchError: p.error, facts: p.facts, renderDiff: null, inSitemap: false,
    })))
    const result = await renderSample({ db, scope, provider: fakeRenderProvider({ [BASE]: null }) }, {
      siteId, runId, pages, limit: 1, options: OPTIONS,
    })
    expect(result.failed).toBe(1)
    expect(result.lastError).toContain('atrapa')
  })

  it('przy samych sukcesach nie ma powodu do zgłoszenia', async () => {
    const pages = [crawledPage(BASE, SUROWY)]
    crawlRepos(db, scope).write.insertCrawlPages(siteId, runId, pages.map((p) => ({
      url: p.url, depth: p.depth, httpStatus: p.status, contentType: p.contentType,
      bytes: p.bytes, durationMs: p.durationMs, redirectChain: p.redirectChain,
      fetchError: p.error, facts: p.facts, renderDiff: null, inSitemap: false,
    })))
    const result = await renderSample({ db, scope, provider: fakeRenderProvider({ [BASE]: WYRENDEROWANY }) }, {
      siteId, runId, pages, limit: 1, options: OPTIONS,
    })
    expect(result.lastError).toBeNull()
  })

  it('zamyka przeglądarkę zawsze — inaczej proces nie kończy się nigdy', async () => {
    const provider = fakeRenderProvider({})
    await renderSample({ db, scope, provider }, {
      siteId, runId, pages: [], limit: 5, options: OPTIONS,
    })
    expect(provider.closed()).toBe(true)
  })

  it('nie renderuje stron, których nie udało się pobrać', async () => {
    const martwa: CrawledPage = {
      url: `${BASE}martwa`, requestedUrl: `${BASE}martwa`, depth: 1, status: null,
      contentType: null, bytes: 0, durationMs: 15_000, redirectChain: [],
      error: 'timeout', facts: null, inSitemap: false,
    }
    const provider = fakeRenderProvider({})
    await renderSample({ db, scope, provider }, {
      siteId, runId, pages: [martwa], limit: 5, options: OPTIONS,
    })
    expect(provider.rendered).toEqual([])
  })
})
