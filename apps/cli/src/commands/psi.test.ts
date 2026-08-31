import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, closeDatabase, crawlRepos, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import type { PsiProvider, PsiResult } from '@seo/providers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { openInitialized } from './init.js'
import { pagesToMeasure, runPsi, type PsiCandidate } from './psi.js'

const kandydat = (o: Partial<PsiCandidate> & { url: string }): PsiCandidate =>
  ({ depth: 1, inDegree: 0, ...o })

describe('pagesToMeasure', () => {
  it('strona główna wchodzi zawsze', () => {
    const wybor = pagesToMeasure([
      kandydat({ url: 'https://a.test/', depth: 0, inDegree: 0 }),
      kandydat({ url: 'https://a.test/popularna', inDegree: 99 }),
    ], 1)
    expect(wybor.map((p) => p.url)).toEqual(['https://a.test/'])
  })

  it('reszta według liczby linków przychodzących', () => {
    const wybor = pagesToMeasure([
      kandydat({ url: 'https://a.test/rzadka', inDegree: 1 }),
      kandydat({ url: 'https://a.test/popularna', inDegree: 9 }),
    ], 2)
    expect(wybor.map((p) => p.url))
      .toEqual(['https://a.test/popularna', 'https://a.test/rzadka'])
  })

  it('przy remisie sortuje alfabetycznie — próbka jest powtarzalna', () => {
    const strony = [
      kandydat({ url: 'https://a.test/b', inDegree: 3 }),
      kandydat({ url: 'https://a.test/a', inDegree: 3 }),
    ]
    expect(pagesToMeasure(strony, 2).map((p) => p.url))
      .toEqual(pagesToMeasure([...strony].reverse(), 2).map((p) => p.url))
  })

  it('nie przekracza limitu i szanuje limit zero', () => {
    const strony = Array.from({ length: 30 }, (_, i) => kandydat({ url: `https://a.test/${i}` }))
    expect(pagesToMeasure(strony, 10)).toHaveLength(10)
    expect(pagesToMeasure(strony, 0)).toEqual([])
  })
})

// --- runPsi na atrapie dostawcy -------------------------------------------------

const BASE = 'https://przyklad.test/'
const scope = tenantScope('local')

function fakePsi(
  wyniki: Readonly<Record<string, PsiResult | 'blad'>>,
): PsiProvider & { readonly measured: readonly string[] } {
  const measured: string[] = []
  return {
    id: 'psi',
    measured,
    async measure(url, strategy) {
      measured.push(url)
      const wynik = wyniki[url]
      if (wynik === undefined || wynik === 'blad') {
        return { url, strategy, measuredAt: 1000, metrics: [], error: 'atrapa: limit' }
      }
      return wynik
    },
  }
}

function wynik(url: string, lcpField: number | null, lcpLab: number): PsiResult {
  const metrics = [
    ...(lcpField === null ? [] : [{
      source: 'field' as const, lcpMs: lcpField, inpMs: 150, cls: 0.05,
      ttfbMs: 500, performanceScore: null,
    }]),
    {
      source: 'lab' as const, lcpMs: lcpLab, inpMs: null, cls: 0.03,
      ttfbMs: 300, performanceScore: 0.8,
    },
  ]
  return { url, strategy: 'mobile', measuredAt: 1000, metrics, error: null }
}

let dir: string
let db: Db

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-psi-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db

  const siteId = repos(db, scope).write.upsertSite('url_prefix', BASE).id
  const crawlRepo = crawlRepos(db, scope)
  const runId = crawlRepo.write.startCrawlRun(siteId, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
  })

  const strona = (t: string) => `<html lang="pl"><head><title>${t}</title></head><body><h1>${t}</h1></body></html>`
  crawlRepo.write.insertCrawlPages(siteId, runId, [
    {
      url: BASE, depth: 0, httpStatus: 200, contentType: 'text/html', bytes: 100,
      durationMs: 50, redirectChain: [], fetchError: null,
      facts: parsePage(strona('Start'), { url: BASE }), renderDiff: null, inSitemap: false,
    },
    {
      url: `${BASE}popularna`, depth: 1, httpStatus: 200, contentType: 'text/html', bytes: 100,
      durationMs: 50, redirectChain: [], fetchError: null,
      facts: parsePage(strona('Popularna'), { url: `${BASE}popularna` }), renderDiff: null, inSitemap: false,
    },
    {
      url: `${BASE}martwa`, depth: 1, httpStatus: 404, contentType: 'text/html', bytes: 100,
      durationMs: 50, redirectChain: [], fetchError: null,
      facts: parsePage(strona('404'), { url: `${BASE}martwa` }), renderDiff: null, inSitemap: false,
    },
  ])
  crawlRepo.write.insertPageLinks(siteId, runId, [
    { fromUrl: BASE, toUrl: `${BASE}popularna`, rel: 'follow', anchorText: 'x', isInternal: true },
  ])
  crawlRepo.write.finishCrawlRun(runId, { pagesFetched: 3, pagesFailed: 0, ok: true, truncated: false })
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

describe('runPsi', () => {
  it('mierzy strony i zapisuje osobno dane terenowe i laboratoryjne', async () => {
    const provider = fakePsi({
      [BASE]: wynik(BASE, 2400, 2100),
      [`${BASE}popularna`]: wynik(`${BASE}popularna`, 3300, 3000),
    })
    const result = await runPsi(db, scope, provider, { siteUrl: BASE })

    expect(result.measured).toBe(2)
    const zapisy = crawlRepos(db, scope).read.listPsiMeasurements(result.siteId, 0, Number.MAX_SAFE_INTEGER)
    expect(zapisy).toHaveLength(4)
    expect(zapisy.map((z) => z.source).sort()).toEqual(['field', 'field', 'lab', 'lab'])
  })

  it('nie mierzy stron, które nie odpowiadają statusem 200', async () => {
    const provider = fakePsi({ [BASE]: wynik(BASE, 2400, 2100) })
    await runPsi(db, scope, provider, { siteUrl: BASE })
    expect(provider.measured).not.toContain(`${BASE}martwa`)
  })

  it('do podsumowania bierze dane terenowe, nie laboratoryjne', async () => {
    const provider = fakePsi({
      [BASE]: wynik(BASE, 5000, 1000),
      [`${BASE}popularna`]: wynik(`${BASE}popularna`, 2000, 9000),
    })
    const result = await runPsi(db, scope, provider, { siteUrl: BASE })
    expect(result.slowest[0]).toEqual({ url: BASE, lcpMs: 5000 })
  })

  it('dla strony bez ruchu spada na dane laboratoryjne', async () => {
    const provider = fakePsi({ [BASE]: wynik(BASE, null, 4200) })
    const result = await runPsi(db, scope, provider, { siteUrl: BASE, limit: 1 })
    expect(result.slowest[0]).toEqual({ url: BASE, lcpMs: 4200 })
  })

  it('podaje powód ostatniego niepowodzenia, zamiast kazać szukać w bazie', async () => {
    const provider = fakePsi({ [BASE]: 'blad' })
    const result = await runPsi(db, scope, provider, { siteUrl: BASE, limit: 1 })
    expect(result.failed).toBe(1)
    expect(result.lastError).toContain('limit')
  })

  it('przy samych sukcesach nie ma powodu do zgłoszenia', async () => {
    const provider = fakePsi({ [BASE]: wynik(BASE, 2400, 2100) })
    const result = await runPsi(db, scope, provider, { siteUrl: BASE, limit: 1 })
    expect(result.lastError).toBeNull()
  })

  it('nieudany pomiar jest liczony, ale nie przerywa reszty', async () => {
    const provider = fakePsi({
      [BASE]: 'blad',
      [`${BASE}popularna`]: wynik(`${BASE}popularna`, 2000, 1800),
    })
    const result = await runPsi(db, scope, provider, { siteUrl: BASE })
    expect(result.failed).toBe(1)
    expect(result.measured).toBe(1)
  })

  it('szanuje limit stron', async () => {
    const provider = fakePsi({ [BASE]: wynik(BASE, 2400, 2100) })
    await runPsi(db, scope, provider, { siteUrl: BASE, limit: 1 })
    expect(provider.measured).toEqual([BASE])
  })

  it('bez crawla mówi wprost, czego brakuje', async () => {
    await expect(runPsi(db, scope, fakePsi({}), { siteUrl: 'https://obca.test/' }))
      .rejects.toThrow(/Uruchom najpierw: seo crawl/)
  })
})
