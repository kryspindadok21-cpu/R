import {
  actionTable, gateFor, opportunityFromCluster, opportunityFromFinding, opportunityFromGeoGap,
  rankOpportunities, summarize,
  type AgentTask, type BreakerInput, type BoardSummary, type Opportunity,
  type ScoredOpportunity,
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
