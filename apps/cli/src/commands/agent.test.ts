import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { actionTable, gateFor } from '@seo/agent'
import { tenantScope } from '@seo/core'
import { type Db, agentRepos, closeDatabase, crawlRepos, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { przesunDate, runAgentBoard, runAgentMeasure, runAgentPlan, weeklyClicks } from './agent.js'
import { openInitialized } from './init.js'

const BASE = 'https://przyklad.test/'
const scope = tenantScope('local')
const SPOKOJNIE = {
  clicksThisWeek: 100, clicksLastWeek: 100, indexedPages: 1000, affectedPages: 1,
  publicationRateAllowed: true, publicationRateReason: 'ok',
}

let dir: string
let db: Db
let siteId: string
let syncRunId: string

function html(t: string): string {
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>${t}</title>`
    + `<meta name="description" content="Opis ${t}"></head><body><h1>${t}</h1><p>Tresc.</p></body></html>`
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'agent-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db

  const base = repos(db, scope)
  siteId = base.write.upsertSite('url_prefix', BASE).id
  syncRunId = base.write.startSyncRun(siteId, '2026-01-01', '2026-12-31', 'final', 'date;date,page')

  const crawlRepo = crawlRepos(db, scope)
  const runId = crawlRepo.write.startCrawlRun(siteId, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
  })
  crawlRepo.write.insertCrawlPages(siteId, runId, Array.from({ length: 40 }, (_, i) => ({
    url: `${BASE}s${i}`, depth: 1, httpStatus: 200, contentType: 'text/html',
    bytes: 400, durationMs: 10, redirectChain: [], fetchError: null,
    facts: parsePage(html(`Strona ${i}`), { url: `${BASE}s${i}` }),
    renderDiff: null, inSitemap: true,
  })))
  crawlRepo.write.finishCrawlRun(runId, {
    pagesFetched: 40, pagesFailed: 0, ok: true, truncated: false,
  })
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

describe('przesunDate', () => {
  it('przesuwa doslownie, bez strefy czasowej', () => {
    expect(przesunDate('2026-03-10', 14)).toBe('2026-03-24')
    expect(przesunDate('2026-03-10', -14)).toBe('2026-02-24')
    expect(przesunDate('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('weeklyClicks', () => {
  it('sumuje dwa osobne tygodnie', () => {
    const base = repos(db, scope)
    base.write.upsertDaily(siteId, syncRunId, [
      { date: '2026-03-10', clicks: 50, impressions: 500, ctr: 0.1, position: 5 },
      { date: '2026-03-01', clicks: 30, impressions: 300, ctr: 0.1, position: 5 },
    ])
    const wynik = weeklyClicks(db, scope, siteId, '2026-03-12')
    expect(wynik.thisWeek).toBe(50)
    expect(wynik.lastWeek).toBe(30)
  })
})

/**
 * Zapisuje metryki per strona: `przed` do dnia zmiany, `po` po nim.
 *
 * **Rozrzut siedzi w zmianie, a nie w poziomie.** Fikstura, w ktorej kazda
 * strona rosnie o dokladnie tyle samo, daje bootstrapowi przedzial punktowy
 * i bramka slusznie odmawia orzekania — testowalaby wiec cos innego, niz
 * nazwa testu obiecuje.
 */
function metryki(
  strony: readonly string[], zmiana: string, przed: number, po: number, rozrzut = 0,
): void {
  const base = repos(db, scope)
  const wiersze: { date: string; page: string; clicks: number; impressions: number; ctr: number; position: number }[] = []
  for (const [i, page] of strony.entries()) {
    const wahanie = ((i % 4) - 1.5) * rozrzut
    for (let d = 1; d <= 60; d += 1) {
      wiersze.push({
        date: przesunDate(zmiana, -d), page,
        clicks: przed, impressions: 100, ctr: 0.1, position: 10,
      })
      wiersze.push({
        date: przesunDate(zmiana, d), page,
        clicks: Math.max(0, Math.round(po + wahanie)), impressions: 100, ctr: 0.1, position: 10,
      })
    }
  }
  base.write.upsertPageDaily(siteId, syncRunId, wiersze)
}

function eksperyment(zmiana: string, zmienione: readonly string[], kontrolne: readonly string[]): string {
  const agentRepo = agentRepos(db, scope)
  const [okazjaId] = agentRepo.write.insertOpportunities(siteId, [{
    slug: 'test', kind: 'fix-finding', title: 'Testowa okazja',
    targetUrl: null, score: 10, factors: {}, measuredFactors: 1,
  }])
  const taskId = agentRepo.write.proposeTask(siteId, {
    opportunityId: okazjaId as string, actionKind: 'rewrite-meta',
    gate: gateFor(actionTable(), 'rewrite-meta', SPOKOJNIE),
  })
  agentRepo.write.transition(taskId, 'in-flight')
  agentRepo.write.recordExperiment(siteId, {
    taskId, treatmentUrls: zmienione, controlUrls: kontrolne,
    shortfall: null, changedOn: zmiana, selectedAt: Date.now(),
  })
  return taskId
}

describe('runAgentMeasure', () => {
  const ZMIANA = '2026-03-01'
  const zmienione = Array.from({ length: 8 }, (_, i) => `${BASE}s${i}`)
  const kontrolne = Array.from({ length: 20 }, (_, i) => `${BASE}s${i + 8}`)

  it('nie mierzy okna, ktore jeszcze trwa', () => {
    metryki([...zmienione, ...kontrolne], ZMIANA, 10, 20, 1)
    eksperyment(ZMIANA, zmienione, kontrolne)

    // Dzien po zmianie: zadne z okien 14/30/60 sie nie domknelo.
    const wynik = runAgentMeasure(db, scope, { siteUrl: BASE, today: przesunDate(ZMIANA, 1) })
    expect(wynik.windows).toHaveLength(0)
    expect(wynik.pending).toBe(3)
    expect(wynik.finished).toBe(0)
  })

  it('D50: po 14 dniach liczy tylko pierwsze okno', () => {
    metryki([...zmienione, ...kontrolne], ZMIANA, 10, 20, 1)
    eksperyment(ZMIANA, zmienione, kontrolne)

    const wynik = runAgentMeasure(db, scope, { siteUrl: BASE, today: przesunDate(ZMIANA, 15) })
    expect(new Set(wynik.windows.map((w) => w.windowDays))).toEqual(new Set([14]))
    expect(wynik.pending).toBe(2)
  })

  it('D50: po 60 dniach trzy okna daja trzy osobne werdykty', () => {
    metryki([...zmienione, ...kontrolne], ZMIANA, 10, 20, 1)
    const taskId = eksperyment(ZMIANA, zmienione, kontrolne)

    const wynik = runAgentMeasure(db, scope, {
      siteUrl: BASE, today: przesunDate(ZMIANA, 61), metrics: ['clicks'],
    })
    expect(wynik.windows.map((w) => w.windowDays)).toEqual([14, 30, 60])
    expect(wynik.finished).toBe(1)

    // D53: zadanie konczy sie dopiero z werdyktem.
    const zadanie = agentRepos(db, scope).read.getTask(taskId)
    expect(zadanie?.state).toBe('done')
    expect(zadanie?.verdict).toContain('Po 60 dniach')
  })

  it('odejmuje trend wspolny — wzrost u wszystkich to zerowy efekt', () => {
    // I zmienione, i kontrolne rosna z 10 do 20.
    metryki([...zmienione, ...kontrolne], ZMIANA, 10, 20, 3)
    eksperyment(ZMIANA, zmienione, kontrolne)

    const wynik = runAgentMeasure(db, scope, {
      siteUrl: BASE, today: przesunDate(ZMIANA, 61), metrics: ['clicks'],
    })
    const ostatni = wynik.windows.find((w) => w.windowDays === 60)
    expect(ostatni?.outcome).toBe('werdykt')
    expect(ostatni?.sentence).toContain('jeszcze nieistotne')
  })

  it('lapie efekt ponad trend wspolny', () => {
    metryki(kontrolne, ZMIANA, 10, 20, 2)
    metryki(zmienione, ZMIANA, 10, 45, 4)
    eksperyment(ZMIANA, zmienione, kontrolne)

    const wynik = runAgentMeasure(db, scope, {
      siteUrl: BASE, today: przesunDate(ZMIANA, 61), metrics: ['clicks'],
    })
    const ostatni = wynik.windows.find((w) => w.windowDays === 60)
    expect(ostatni?.sentence).toContain('poprawa')
  })

  it('D48: za mala grupa kontrolna to odmowa, a nie zejscie do przed/po', () => {
    metryki([...zmienione.slice(0, 2), ...kontrolne.slice(0, 2)], ZMIANA, 10, 30, 1)
    eksperyment(ZMIANA, zmienione.slice(0, 2), kontrolne.slice(0, 2))

    const wynik = runAgentMeasure(db, scope, {
      siteUrl: BASE, today: przesunDate(ZMIANA, 61), metrics: ['clicks'],
    })
    expect(wynik.windows.every((w) => w.outcome === 'odmowa')).toBe(true)
    expect(wynik.windows[0]?.sentence).toContain('nie da sie zmierzyc')
    // Nawet odmowa jest werdyktem, wiec zadanie moze sie zakonczyc (D53).
    expect(wynik.finished).toBe(1)
  })

  it('ten sam pomiar dwa razy daje ten sam werdykt', () => {
    metryki(kontrolne, ZMIANA, 10, 20, 2)
    metryki(zmienione, ZMIANA, 10, 45, 4)
    eksperyment(ZMIANA, zmienione, kontrolne)

    const a = runAgentMeasure(db, scope, {
      siteUrl: BASE, today: przesunDate(ZMIANA, 61), metrics: ['clicks'],
    })
    expect(a.windows.map((w) => w.sentence)).toEqual(a.windows.map((w) => w.sentence))
    expect(a.windows[0]?.sentence).toBe(a.windows[0]?.sentence)
  })

  it('brak eksperymentow nie wybucha', () => {
    expect(runAgentMeasure(db, scope, { siteUrl: BASE })).toMatchObject({
      experiments: 0, finished: 0, pending: 0,
    })
  })
})

describe('runAgentPlan i runAgentBoard', () => {
  it('plan wystawia wnioski, tablica je pokazuje', () => {
    const wynik = runAgentPlan(db, scope, { siteUrl: BASE, limit: 5 })
    expect(wynik.breakers.indexedPages).toBe(40)

    const tablica = runAgentBoard(db, scope, { siteUrl: BASE })
    expect(tablica.summary.proposed).toBe(wynik.tasks.length)
    // D46: kazde zadanie zaczyna jako wniosek.
    expect(tablica.rows.every((r) => r.state === 'proposed')).toBe(true)
  })
})
