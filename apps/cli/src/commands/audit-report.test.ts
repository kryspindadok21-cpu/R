import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, closeDatabase, crawlRepos, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runAuditReport } from './audit-report.js'
import { openInitialized } from './init.js'

/**
 * Raport audytu budowany z bazy, bez sieci i bez crawla — po to, zeby dalo sie
 * go powtorzyc po zmianie regul, nie obciazajac niczyjego serwera.
 */

const scope = tenantScope('local')
const BASE = 'https://przyklad.test/'

function strona(tytul: string, body: string): string {
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">`
    + `<title>${tytul}</title></head><body>${body}</body></html>`
}

let dir: string
let db: Db
let siteId: string
let runId: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-raport-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db

  const site = repos(db, scope).write.upsertSite('url_prefix', BASE)
  siteId = site.id

  const crawlRepo = crawlRepos(db, scope)
  runId = crawlRepo.write.startCrawlRun(siteId, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'mentiometry-crawler/0.1',
    sitemapUrls: [`${BASE}nowa`],
  })

  crawlRepo.write.insertCrawlPages(siteId, runId, [
    {
      url: BASE, depth: 0, httpStatus: 200, contentType: 'text/html',
      bytes: 500, durationMs: 100, redirectChain: [], fetchError: null,
      facts: parsePage(strona('Start', '<h1>Start</h1><a href="/nowa">Nowa</a>'), { url: BASE }),
      renderDiff: null, inSitemap: false,
    },
    {
      url: `${BASE}nowa`, depth: 1, httpStatus: 200, contentType: 'text/html',
      bytes: 400, durationMs: 90, redirectChain: [`${BASE}stara`], fetchError: null,
      facts: parsePage(strona('Nowa', '<h1>Nowa</h1>'), { url: `${BASE}nowa` }),
      renderDiff: null, inSitemap: true,
    },
    {
      url: `${BASE}osierocona`, depth: 1, httpStatus: 200, contentType: 'text/html',
      bytes: 300, durationMs: 80, redirectChain: [], fetchError: null,
      facts: parsePage(strona('Osierocona', '<h1>Osierocona</h1>'), { url: `${BASE}osierocona` }),
      renderDiff: null, inSitemap: false,
    },
    {
      url: `${BASE}martwa`, depth: 1, httpStatus: null, contentType: null,
      bytes: 0, durationMs: 15_000, redirectChain: [], fetchError: 'przekroczony czas',
      facts: null, renderDiff: null, inSitemap: false,
    },
  ])

  crawlRepo.write.insertPageLinks(siteId, runId, [
    { fromUrl: BASE, toUrl: `${BASE}nowa`, rel: 'follow', anchorText: 'Nowa', isInternal: true },
  ])

  crawlRepo.write.insertFindings(siteId, runId, [
    {
      ruleId: 'http.fetch-failed', severity: 'blocker', category: 'indexation',
      url: `${BASE}martwa`, title: 'Strony nie udało się pobrać',
      evidence: { 'powód': 'przekroczony czas' },
    },
    {
      ruleId: 'title.duplicate', severity: 'medium', category: 'content',
      url: null, title: 'Ten sam tytuł na wielu stronach',
      evidence: { 'liczba stron': 2 },
    },
  ])
  crawlRepo.write.insertSkippedRules(runId, [
    { ruleId: 'ai.js-required-for-content', missing: ['render-diff'] },
  ])
  crawlRepo.write.finishCrawlRun(runId, {
    pagesFetched: 4, pagesFailed: 1, ok: true, truncated: false,
  })
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

function generate(overrides: Record<string, unknown> = {}) {
  const outPath = join(dir, 'raport-audyt.html')
  const result = runAuditReport(db, scope, {
    siteUrl: BASE, outPath, generatedAt: '2026-08-28 12:00', ...overrides,
  })
  return { result, html: readFileSync(result.outPath, 'utf8') }
}

describe('runAuditReport', () => {
  it('zapisuje plik i zwraca liczbę ustaleń', () => {
    const { result } = generate()
    expect(result.findings).toBe(2)
    expect(result.runId).toBe(runId)
    expect(result.truncatedList).toBe(false)
  })

  it('nie pobiera niczego z sieci (AC10)', () => {
    const { html } = generate()
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    expect(html).not.toContain('<script')
  })

  it('pokazuje ustalenie z adresem i dowodem', () => {
    const { html } = generate()
    expect(html).toContain(`${BASE}martwa`)
    expect(html).toContain('powód: przekroczony czas')
  })

  it('ustalenie serwisowe nie udaje ustalenia o stronie', () => {
    const { html } = generate()
    expect(html).toContain('cały serwis')
  })

  it('liczy odpowiedzi serwera, oddzielając brak odpowiedzi od statusu', () => {
    const { html } = generate()
    expect(html).toContain('brak odpowiedzi')
    expect(html).toContain('Odpowiedzi serwera')
  })

  it('wykrywa strony osierocone z grafu, nie z tabeli ustaleń', () => {
    const { html } = generate()
    expect(html).toContain(`${BASE}osierocona`)
  })

  it('pokazuje łańcuch przekierowań z adresu żądanego na docelowy', () => {
    const { html } = generate()
    expect(html).toContain(`${BASE}stara`)
    expect(html).toContain('Przekierowania')
  })

  it('pokazuje reguły pominięte razem z powodem', () => {
    const { html } = generate()
    expect(html).toContain('ai.js-required-for-content')
    expect(html).toContain('render-diff')
  })

  it('nie zawiera żadnej oceny zbiorczej (D18)', () => {
    const { html } = generate()
    expect(html).toContain('nie podaje oceny w skali 0–100')
    expect(html).not.toMatch(/\b\d{1,3}\s*\/\s*100\b/)
  })

  it('bez crawla mówi wprost, czego brakuje', () => {
    expect(() => runAuditReport(db, scope, {
      siteUrl: 'https://nigdy-nie-crawlowana.test/',
      outPath: join(dir, 'x.html'),
      generatedAt: '2026-08-28 12:00',
    })).toThrow(/Uruchom najpierw: seo crawl/)
  })

  it('przyjmuje wskazany przebieg crawla zamiast ostatniego', () => {
    const drugi = crawlRepos(db, scope).write.startCrawlRun(siteId, {
      maxPages: 10, maxDepth: 2, delayMs: 1000, renderSample: 0,
      robotsState: 'missing', userAgent: 'agent', sitemapUrls: [],
    })
    const { result, html } = generate({ runId })
    expect(result.runId).toBe(runId)
    expect(html).toContain('odczytany')
    expect(drugi).not.toBe(runId)
  })
})
