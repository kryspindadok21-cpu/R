import {
  MEASUREMENT_WINDOWS, actionTable, differenceInDifferences, gateFor,
  opportunityFromCluster, opportunityFromFinding, opportunityFromGeoGap,
  rankOpportunities, summarize, verdictSentence,
  type AgentTask, type BreakerInput, type BoardSummary, type Metric,
  type Opportunity, type PageObservation, type ScoredOpportunity,
} from '@seo/agent'
import type { TenantScope } from '@seo/core'
import {
  agentRepos, contentRepos, crawlRepos, geoRepos, repos, type Db,
} from '@seo/db'
import type { Keyword } from '@seo/keywords'
import { UnknownSiteError } from './content.js'

/**
 * Komendy Fazy 4 — sklejenie petli.
 *
 * Ta warstwa **nie decyduje o niczym**: zbiera dane z Faz 1-3, podaje je
 * silnikom z `@seo/agent` i zapisuje wynik. Kazda decyzja podjeta tutaj bylaby
 * decyzja poza polityka — a polityka jest jedynym zabezpieczeniem dzialajacym
 * niezaleznie od tego, co zrobi model (D46).
 */

/** Ile najlepszych okazji zamieniamy na zadania w jednym przebiegu. */
export const DEFAULT_PLAN_LIMIT = 10

/** Typ akcji dla kazdego rodzaju okazji. Tabela, nie zgadywanie z nazwy. */
const ACTION_FOR: Readonly<Record<ScoredOpportunity['kind'], string>> = {
  'fix-finding': 'rewrite-meta',
  'refresh-content': 'publish-article',
  'create-content': 'publish-article',
  'improve-geo': 'generate-brief',
}

function siteOf(db: Db, scope: TenantScope, siteUrl: string) {
  const site = repos(db, scope).read.findSiteByUri(siteUrl)
  if (!site) throw new UnknownSiteError(siteUrl)
  return site
}

/** Kliknięcia w dwoch ostatnich tygodniach — wejscie do hamulca regresji (D52). */
export function weeklyClicks(
  db: Db, scope: TenantScope, siteId: string, today: string,
): { thisWeek: number; lastWeek: number } {
  const przesun = (dni: number): string => {
    const [rok, miesiac, dzien] = today.split('-').map(Number) as [number, number, number]
    const ms = Date.UTC(rok, miesiac - 1, dzien) - dni * 24 * 60 * 60 * 1000
    return new Date(ms).toISOString().slice(0, 10)
  }

  const suma = (od: string, doo: string): number =>
    repos(db, scope).read.listDailyRange(siteId, od, doo)
      .reduce((acc, row) => acc + row.clicks, 0)

  return {
    thisWeek: suma(przesun(7), today),
    lastWeek: suma(przesun(14), przesun(8)),
  }
}

export interface PlanOptions {
  readonly siteUrl: string
  readonly limit?: number | undefined
  /** Data odniesienia dla hamulca regresji; domyslnie dzisiaj. */
  readonly today?: string | undefined
}

export interface PlannedTask {
  readonly taskId: string
  readonly title: string
  readonly score: number
  readonly actionKind: string
  readonly gate: string
  readonly gateReason: string
  readonly measuredFactors: number
}

export interface PlanResult {
  readonly siteId: string
  readonly opportunities: number
  readonly tasks: readonly PlannedTask[]
  readonly breakers: BreakerInput
  /** Wylaczniki, ktore zadzialaly — puste, gdy wszystko idzie normalnie. */
  readonly blocked: number
}

/**
 * Zbiera okazje ze wszystkich faz, liczy ranking i emituje **wnioski**.
 *
 * Nic tu nic nie wykonuje. Zadanie powstaje w stanie `proposed`, a bramka
 * mowi tylko, czy wolno je uruchomic samo, czy trzeba zapytac.
 */
export function runAgentPlan(
  db: Db,
  scope: TenantScope,
  options: PlanOptions,
): PlanResult {
  const site = siteOf(db, scope, options.siteUrl)
  const crawlRepo = crawlRepos(db, scope)
  const contentRepo = contentRepos(db, scope)
  const agentRepo = agentRepos(db, scope)

  const kandydaci: Opportunity[] = []

  // 1. Ustalenia audytu z ostatniego crawla (Faza 1).
  const run = crawlRepo.read.latestCrawlRun(site.id)
  let indexedPages = 0
  if (run !== undefined) {
    indexedPages = crawlRepo.read.listCrawlPages(run.id).filter((p) => p.indexable === 1).length
    for (const regula of crawlRepo.read.topFindingRules(run.id, 30)) {
      kandydaci.push(opportunityFromFinding({
        ruleId: regula.ruleId,
        severity: regula.severity,
        url: null,
        title: regula.title,
        affectedPages: regula.count,
        hasAutofix: false,
      }))
    }
  }

  // 2. Klastry fraz z decyzja refresh/create (Faza 3).
  const zestaw = contentRepo.read.latestClusterSet(site.id)
  if (zestaw !== undefined) {
    for (const klaster of contentRepo.read.listClusters(zestaw.id).slice(0, 30)) {
      const frazy = JSON.parse(klaster.keywords) as Keyword[]
      const pozycje = frazy.map((k) => k.position).filter((p) => p > 0)
      kandydaci.push(opportunityFromCluster({
        slug: klaster.slug,
        head: klaster.head,
        totalImpressions: klaster.totalImpressions,
        bestPosition: pozycje.length === 0 ? null : Math.min(...pozycje),
        // Bez briefu nie wiemy, czy strona pokrywa klaster — traktujemy jako
        // `create`, bo to ostrozniejsze zalozenie (wyzsze ryzyko, nizszy wynik).
        decision: 'create',
        targetUrl: null,
        method: zestaw.method,
      }))
    }
  }

  // 3. Luki widocznosci w modelach (Faza 2).
  const geoRepo = geoRepos(db, scope)
  const geoRun = geoRepo.read.latestGeoRun(site.id)
  if (geoRun !== undefined) {
    const wlasne = new Set(geoRepo.read.listEntities(site.id).filter((e) => e.isOwn).map((e) => e.id))
    const wzmianki = geoRepo.read.listMentions(geoRun.id)
    const nasze = new Set(wzmianki.filter((m) => wlasne.has(m.entityId)).map((m) => m.geoAnswerId))
    const cudze = new Set(wzmianki.filter((m) => !wlasne.has(m.entityId)).map((m) => m.geoAnswerId))

    const byPrompt = new Map<string, { nasze: number; cudze: number; razem: number }>()
    for (const odpowiedz of geoRepo.read.listAnswers(geoRun.id)) {
      if (odpowiedz.fetchError !== null) continue
      const bucket = byPrompt.get(odpowiedz.promptText) ?? { nasze: 0, cudze: 0, razem: 0 }
      bucket.razem += 1
      if (nasze.has(odpowiedz.id)) bucket.nasze += 1
      if (cudze.has(odpowiedz.id)) bucket.cudze += 1
      byPrompt.set(odpowiedz.promptText, bucket)
    }

    for (const [prompt, b] of byPrompt) {
      if (b.razem === 0) continue
      kandydaci.push(opportunityFromGeoGap({
        prompt,
        mentionRate: b.nasze / b.razem,
        competitorRate: b.cudze / b.razem,
        runs: b.razem,
      }))
    }
  }

  const ranking = rankOpportunities(kandydaci)
  const najlepsze = ranking.slice(0, options.limit ?? DEFAULT_PLAN_LIMIT)

  const ids = agentRepo.write.insertOpportunities(site.id, najlepsze.map((o) => ({
    slug: o.id, kind: o.kind, title: o.title, targetUrl: o.targetUrl,
    score: o.score,
    factors: {
      impact: o.impact, confidence: o.confidence, fit: o.fit,
      effort: o.effort, risk: o.risk,
    },
    measuredFactors: o.measuredFactors,
  })))

  const dzis = options.today ?? new Date().toISOString().slice(0, 10)
  const klikniecia = weeklyClicks(db, scope, site.id, dzis)
  const tempo = contentRepo.read.publicationRate(site.id, indexedPages, Date.now())

  const tabela = actionTable()
  const tasks: PlannedTask[] = []
  let blocked = 0

  for (const [i, okazja] of najlepsze.entries()) {
    const actionKind = ACTION_FOR[okazja.kind]
    const breakers: BreakerInput = {
      clicksThisWeek: klikniecia.thisWeek,
      clicksLastWeek: klikniecia.lastWeek,
      indexedPages,
      // Okazja dotyczaca jednej strony rusza jedna strone; serwisowa — wszystkie.
      affectedPages: okazja.targetUrl === null ? Math.max(indexedPages, 1) : 1,
      publicationRateAllowed: tempo.allowed,
      publicationRateReason: tempo.reason,
    }
    const bramka = gateFor(tabela, actionKind, breakers)
    if (bramka.kind === 'blocked') blocked += 1

    const taskId = agentRepo.write.proposeTask(site.id, {
      opportunityId: ids[i] as string, actionKind, gate: bramka,
    })

    tasks.push({
      taskId,
      title: okazja.title,
      score: okazja.score,
      actionKind,
      gate: bramka.kind,
      gateReason: bramka.kind === 'auto' ? '' : bramka.reason,
      measuredFactors: okazja.measuredFactors,
    })
  }

  return {
    siteId: site.id,
    opportunities: ranking.length,
    tasks,
    breakers: {
      clicksThisWeek: klikniecia.thisWeek,
      clicksLastWeek: klikniecia.lastWeek,
      indexedPages,
      affectedPages: 0,
      publicationRateAllowed: tempo.allowed,
      publicationRateReason: tempo.reason,
    },
    blocked,
  }
}

export interface BoardRow {
  readonly taskId: string
  readonly title: string
  readonly state: AgentTask['state']
  readonly actionKind: string
  readonly gate: string
  readonly gateReason: string
  readonly verdict: string | null
}

export interface BoardResult {
  readonly summary: BoardSummary
  readonly rows: readonly BoardRow[]
}

export function runAgentBoard(
  db: Db, scope: TenantScope, options: { readonly siteUrl: string; readonly limit?: number },
): BoardResult {
  const site = siteOf(db, scope, options.siteUrl)
  const agentRepo = agentRepos(db, scope)
  const zadania = agentRepo.read.listTasks(site.id, options.limit ?? 100)
  const okazje = new Map(
    agentRepo.read.listOpportunities(site.id, 500).map((o) => [o.id, o.title]),
  )

  const rows: BoardRow[] = zadania.map((z) => ({
    taskId: z.id,
    title: okazje.get(z.opportunityId) ?? z.actionKind,
    state: z.state,
    actionKind: z.actionKind,
    gate: z.gate,
    gateReason: z.gateReason,
    verdict: z.verdict,
  }))

  return {
    summary: summarize(zadania.map((z) => ({
      id: z.id, actionKind: z.actionKind, state: z.state,
      opportunityId: z.opportunityId, verdict: z.verdict,
    }))),
    rows,
  }
}

// --- seo agent measure ----------------------------------------------------------

/** Przesuwa date `YYYY-MM-DD` o `dni` — dosłownie, bez strefy (D3). */
export function przesunDate(data: string, dni: number): string {
  const [rok, miesiac, dzien] = data.split('-').map(Number) as [number, number, number]
  const ms = Date.UTC(rok, miesiac - 1, dzien) + dni * 24 * 60 * 60 * 1000
  return new Date(ms).toISOString().slice(0, 10)
}

export interface MeasureOptions {
  readonly siteUrl: string
  /** Data odniesienia; domyslnie dzisiaj. Okna liczone wstecz od zmiany. */
  readonly today?: string | undefined
  readonly metrics?: readonly Metric[] | undefined
  readonly seed?: number | undefined
}

export interface MeasuredWindow {
  readonly taskId: string
  readonly windowDays: number
  readonly metric: Metric
  readonly outcome: 'werdykt' | 'odmowa'
  readonly sentence: string
}

export interface MeasureResult {
  readonly experiments: number
  readonly windows: readonly MeasuredWindow[]
  readonly finished: number
  /** Eksperymenty, dla ktorych okno jeszcze nie doszlo do konca. */
  readonly pending: number
}

/**
 * Mierzy skutek zmian roznica w roznicach (D48–D51).
 *
 * Okno `n` dni po zmianie porownujemy z oknem **tej samej dlugosci** przed nia.
 * Trzy okna dają trzy osobne werdykty, nigdy jednej usrednionej liczby: 14 dni
 * lapie zmiany techniczne, 60 dni lapie tresc, ktora musi sie wypozycjonowac —
 * a usrednienie gubi wlasnie te roznice.
 */
export function runAgentMeasure(
  db: Db,
  scope: TenantScope,
  options: MeasureOptions,
): MeasureResult {
  const site = siteOf(db, scope, options.siteUrl)
  const agentRepo = agentRepos(db, scope)
  const baza = repos(db, scope)

  const dzis = options.today ?? new Date().toISOString().slice(0, 10)
  const metryki = options.metrics ?? (['clicks', 'ctr', 'position'] as const)

  const windows: MeasuredWindow[] = []
  let experiments = 0
  let finished = 0
  let pending = 0

  for (const zadanie of agentRepo.read.listTasks(site.id, 500)) {
    if (zadanie.state !== 'measuring' && zadanie.state !== 'in-flight') continue
    const eksperyment = agentRepo.read.getExperiment(zadanie.id)
    if (eksperyment === undefined) continue
    experiments += 1

    const zmienioneUrls = new Set(JSON.parse(eksperyment.treatmentUrls) as string[])
    const kontrolneUrls = new Set(JSON.parse(eksperyment.controlUrls) as string[])
    const zmiana = eksperyment.changedOn

    let ostatnieZdanie: string | null = null
    let cokolwiekZmierzone = false

    for (const okno of MEASUREMENT_WINDOWS) {
      const koniecPo = przesunDate(zmiana, okno)
      if (koniecPo > dzis) {
        // Okno jeszcze trwa. Liczenie go teraz dalo by wynik z niepelnego
        // okresu i nikt by sie nie dowiedzial, ze byl niepelny.
        pending += 1
        continue
      }

      const przed = baza.read.pageMetricsInRange(site.id, przesunDate(zmiana, -okno), zmiana)
      const po = baza.read.pageMetricsInRange(site.id, zmiana, koniecPo)

      const przedWg = new Map(przed.map((r) => [r.page, r]))
      const poWg = new Map(po.map((r) => [r.page, r]))
      const adresy = new Set([...przedWg.keys(), ...poWg.keys()])

      const obserwacje = (nalezy: ReadonlySet<string>): PageObservation[] =>
        [...adresy].filter((url) => nalezy.has(url)).map((url) => ({
          url,
          before: {
            clicks: przedWg.get(url)?.clicks ?? 0,
            impressions: przedWg.get(url)?.impressions ?? 0,
            position: przedWg.get(url)?.position ?? 0,
          },
          after: {
            clicks: poWg.get(url)?.clicks ?? 0,
            impressions: poWg.get(url)?.impressions ?? 0,
            position: poWg.get(url)?.position ?? 0,
          },
        }))

      for (const metric of metryki) {
        const wynik = differenceInDifferences(
          obserwacje(zmienioneUrls), obserwacje(kontrolneUrls),
          { metric, windowDays: okno, seed: options.seed ?? 20260831 },
        )
        const zdanie = verdictSentence(wynik)
        agentRepo.write.recordVerdict(eksperyment.id, wynik, zdanie)
        windows.push({
          taskId: zadanie.id, windowDays: okno, metric,
          outcome: wynik.kind === 'werdykt' ? 'werdykt' : 'odmowa',
          sentence: zdanie,
        })
        ostatnieZdanie = zdanie
        cokolwiekZmierzone = true
      }
    }

    // Zadanie konczy sie dopiero, gdy **najdluzsze** okno sie domknelo — inaczej
    // `done` znaczyloby „zmierzone czesciowo" (D53).
    const najdluzsze = MEASUREMENT_WINDOWS[MEASUREMENT_WINDOWS.length - 1] as number
    if (cokolwiekZmierzone && przesunDate(zmiana, najdluzsze) <= dzis && ostatnieZdanie !== null) {
      if (zadanie.state === 'in-flight') agentRepo.write.transition(zadanie.id, 'measuring')
      agentRepo.write.transition(zadanie.id, 'done', ostatnieZdanie)
      finished += 1
    } else if (zadanie.state === 'in-flight' && cokolwiekZmierzone) {
      agentRepo.write.transition(zadanie.id, 'measuring')
    }
  }

  return { experiments, windows, finished, pending }
}
