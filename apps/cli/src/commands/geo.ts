import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { TenantScope } from '@seo/core'
import { type Db, FrozenPromptSetError, geoRepos, repos } from '@seo/db'
import {
  collectCitations, compareMeasurements, detectInAnswers, detectableDifference,
  measurePrompts, proportion,
  type EntityDefinition, type MeasurementSet, type Proportion,
} from '@seo/geo'
import {
  renderGeoReport,
  type GeoComparisonRow, type GeoEngineRow, type GeoReportData,
  type GeoVoiceRow, type ShareRow,
} from '@seo/report'
import type { AccessMode, EngineId, LlmEngineProvider, SkippedEngine } from '@seo/providers'

/**
 * `seo geo` — tracker widocznosci w AI (Faza 2).
 *
 * Sklejenie warstw: prompty i encje z bazy, silniki z warstwy providerow,
 * wykrywanie wzmianek i statystyka z czystego `@seo/geo`. Ta warstwa nie liczy
 * niczego sama — jej jedynym zadaniem jest nie zgubic po drodze kontekstu,
 * ktory decyduje o porownywalnosci (D27, D29).
 */

export const DEFAULT_RUNS_PER_PROMPT = 3

export class NoPromptSetError extends Error {
  constructor(siteUrl: string) {
    super(
      `Brak zestawu promptow dla ${siteUrl}. Dodaj pierwszy prompt: ` +
      `seo geo prompts --site ${siteUrl} --add "tresc pytania"`,
    )
    this.name = 'NoPromptSetError'
  }
}

export class NoEntityError extends Error {
  constructor(siteUrl: string) {
    super(
      `Brak zdefiniowanej marki dla ${siteUrl}. Zdefiniuj ja: ` +
      `seo geo entity --site ${siteUrl} --name "Nazwa" --own`,
    )
    this.name = 'NoEntityError'
  }
}

export class UnknownSiteError extends Error {
  constructor(siteUrl: string) {
    super(`Nieznana strona ${siteUrl}. Dodaj ja najpierw: seo crawl --site ${siteUrl}`)
    this.name = 'UnknownSiteError'
  }
}

function siteOf(db: Db, scope: TenantScope, siteUrl: string) {
  const site = repos(db, scope).read.findSiteByUri(siteUrl)
  if (!site) throw new UnknownSiteError(siteUrl)
  return site
}

/**
 * Aktywny zestaw promptow: najnowsza wersja o danej nazwie. Zestaw zamrozony
 * zostaje aktywny — pomiar ma isc dalej na tym samym skladzie (D25).
 */
export function activePromptSet(
  sets: readonly { id: string; name: string; version: number }[],
  name?: string,
): { id: string; name: string; version: number } | undefined {
  const kandydaci = name === undefined ? sets : sets.filter((s) => s.name === name)
  return [...kandydaci].sort((a, b) => b.version - a.version || (a.id < b.id ? 1 : -1))[0]
}

// --- seo geo prompts -----------------------------------------------------------

export interface PromptsOptions {
  readonly siteUrl: string
  readonly add: readonly string[]
  readonly locale?: string | undefined
  readonly setName?: string | undefined
}

export interface PromptsResult {
  readonly promptSetId: string
  readonly setName: string
  readonly version: number
  readonly added: number
  readonly total: number
  readonly frozen: boolean
}

export function runGeoPrompts(
  db: Db,
  scope: TenantScope,
  options: PromptsOptions,
): PromptsResult {
  const site = siteOf(db, scope, options.siteUrl)
  const g = geoRepos(db, scope)
  const setName = options.setName ?? 'domyslny'

  let set = activePromptSet(g.read.listPromptSets(site.id), setName)
  if (set === undefined) {
    const id = g.write.createPromptSet(site.id, { name: setName })
    set = { id, name: setName, version: 1 }
  }

  // Zamrozony zestaw nie przyjmuje promptow, wiec zmiana skladu zaklada nowa
  // wersje. To jedyna droga: edycja w miejscu uniewaznilaby porownania wstecz
  // bez zadnego sladu (D25).
  if (options.add.length > 0) {
    const frozenNow = g.read.getPromptSet(set.id)?.frozenAt !== null
    if (frozenNow) {
      const id = g.write.createPromptSet(site.id, {
        name: setName, version: set.version + 1, supersedesId: set.id,
      })
      const existing = g.read.listPrompts(set.id)
      g.write.addPrompts(id, existing.map((p) => ({ text: p.text, locale: p.locale })))
      set = { id, name: setName, version: set.version + 1 }
    }
    g.write.addPrompts(set.id, options.add.map((text) => ({
      text, locale: options.locale ?? 'pl',
    })))
  }

  const stored = g.read.getPromptSet(set.id)
  return {
    promptSetId: set.id,
    setName,
    version: set.version,
    added: options.add.length,
    total: g.read.listPrompts(set.id).length,
    frozen: stored?.frozenAt !== null && stored?.frozenAt !== undefined,
  }
}

// --- seo geo entity ------------------------------------------------------------

export interface EntityOptions {
  readonly siteUrl: string
  readonly name: string
  readonly variants: readonly string[]
  readonly exclusions: readonly string[]
  readonly isOwn: boolean
}

export interface EntityResult {
  readonly entityId: string
  readonly name: string
  readonly version: number
  readonly supersededVersion: number | null
}

/**
 * Zmiana wariantow zaklada **nowa wersje** encji, a nie nadpisuje starej.
 * Stara definicja zostaje, bo bez niej nie da sie odtworzyc, jak liczylismy
 * wzmianki w poprzednich tygodniach (D29).
 */
export function runGeoEntity(db: Db, scope: TenantScope, options: EntityOptions): EntityResult {
  const site = siteOf(db, scope, options.siteUrl)
  const g = geoRepos(db, scope)
  const previous = g.read.listEntities(site.id).filter((e) => e.name === options.name)
  const highest = previous.reduce((max, e) => Math.max(max, e.version), 0)

  const id = g.write.upsertEntity(site.id, {
    name: options.name,
    variants: options.variants,
    exclusions: options.exclusions,
    version: highest + 1,
    isOwn: options.isOwn,
  })

  return {
    entityId: id,
    name: options.name,
    version: highest + 1,
    supersededVersion: highest === 0 ? null : highest,
  }
}

// --- seo geo run ---------------------------------------------------------------

export interface GeoRunOptions {
  readonly siteUrl: string
  readonly runsPerPrompt?: number | undefined
  readonly setName?: string | undefined
}

export interface EngineOutcome {
  readonly engine: EngineId
  readonly modelVersion: string
  readonly accessMode: AccessMode
  readonly runId: string
  readonly answersOk: number
  readonly answersFailed: number
  readonly refusals: number
  /** Widocznosc wlasnej marki w tym przebiegu, z przedzialem ufnosci. */
  readonly visibility: Proportion
  readonly lastError: string | null
}

export interface GeoRunResult {
  readonly siteId: string
  readonly promptSetId: string
  readonly prompts: number
  readonly runsPerPrompt: number
  readonly entityVersion: number
  readonly outcomes: readonly EngineOutcome[]
  /** Silniki pominiete z powodem — cisza tutaj bylaby falszywym porzadkiem (D17). */
  readonly skipped: readonly SkippedEngine[]
}

export async function runGeoRun(
  db: Db,
  scope: TenantScope,
  engines: readonly LlmEngineProvider[],
  skipped: readonly SkippedEngine[],
  options: GeoRunOptions,
): Promise<GeoRunResult> {
  const site = siteOf(db, scope, options.siteUrl)
  const g = geoRepos(db, scope)

  const set = activePromptSet(g.read.listPromptSets(site.id), options.setName)
  if (set === undefined) throw new NoPromptSetError(options.siteUrl)

  const prompts = g.read.listPrompts(set.id)
  if (prompts.length === 0) throw new NoPromptSetError(options.siteUrl)

  const entities = latestEntityVersions(g.read.listEntities(site.id))
  const own = entities.find((e) => e.isOwn)
  if (own === undefined) throw new NoEntityError(options.siteUrl)

  const entityVersion = entities.reduce((max, e) => Math.max(max, e.version), 0)
  const runsPerPrompt = options.runsPerPrompt ?? DEFAULT_RUNS_PER_PROMPT
  const ourHosts = [new URL(site.propertyUri.replace(/^sc-domain:/, 'https://')).host]

  const outcomes: EngineOutcome[] = []

  for (const engine of engines) {
    const runId = g.write.startGeoRun(site.id, {
      promptSetId: set.id,
      engine: engine.id,
      modelVersion: engine.modelVersion,
      accessMode: engine.accessMode,
      entityVersion,
      runsPerPrompt,
    })

    let answersOk = 0
    let answersFailed = 0
    let refusals = 0
    let lastError: string | null = null
    const zebrane: { promptId: string; runIndex: number; text: string }[] = []

    for (const prompt of prompts) {
      for (let runIndex = 0; runIndex < runsPerPrompt; runIndex += 1) {
        const answer = await engine.ask(
          { promptId: prompt.id, text: prompt.text, locale: prompt.locale },
          runIndex,
        )

        const answerId = g.write.insertAnswer(runId, {
          promptId: prompt.id,
          runIndex,
          text: answer.text,
          refusalReason: answer.refusalReason,
          fetchError: answer.fetchError,
          latencyMs: answer.latencyMs,
        })

        if (answer.fetchError !== null) {
          answersFailed += 1
          lastError = answer.fetchError
          continue
        }
        answersOk += 1
        if (answer.refusalReason !== null) refusals += 1

        // Odmowa i pusta odpowiedz przechodza przez detekcje tak samo jak reszta:
        // zero wzmianek w odmowie to prawdziwe zero, a nie brak pomiaru.
        const { mentions } = detectInAnswers(
          [{ promptId: prompt.id, runIndex, text: answer.text }], entities,
        )[0] ?? { mentions: [] }
        g.write.insertMentions(runId, answerId, mentions)

        const cytowania = collectCitations(
          { text: answer.text, groundingUris: answer.groundingUris }, ourHosts,
        )
        g.write.insertCitations(runId, answerId, [...cytowania.grounding, ...cytowania.inline])

        zebrane.push({ promptId: prompt.id, runIndex, text: answer.text })
      }
    }

    g.write.finishGeoRun(runId, {
      ok: answersFailed === 0,
      error: lastError ?? undefined,
      answersOk,
      answersFailed,
    })

    const measured = measurePrompts(detectInAnswers(zebrane, entities), own.id)
    const hits = measured.reduce((sum, m) => sum + m.hits, 0)
    const trials = measured.reduce((sum, m) => sum + m.trials, 0)

    outcomes.push({
      engine: engine.id,
      modelVersion: engine.modelVersion,
      accessMode: engine.accessMode,
      runId,
      answersOk,
      answersFailed,
      refusals,
      visibility: proportion(hits, trials),
      lastError,
    })
  }

  return {
    siteId: site.id,
    promptSetId: set.id,
    prompts: prompts.length,
    runsPerPrompt,
    entityVersion,
    outcomes,
    skipped,
  }
}

/**
 * Najnowsza wersja kazdej encji po nazwie. Starsze wersje zostaja w bazie —
 * pomiar sprzed zmiany wariantow liczyl sie wedlug **tamtej** definicji i tylko
 * ona pozwala go odtworzyc (D29).
 */
export function latestEntityVersions<T extends EntityDefinition>(all: readonly T[]): T[] {
  const byName = new Map<string, T>()
  for (const entity of all) {
    const current = byName.get(entity.name)
    if (current === undefined || entity.version > current.version) byName.set(entity.name, entity)
  }
  return [...byName.values()]
}

// --- seo geo report ------------------------------------------------------------

/**
 * Zestawienie pomiaru w dane raportu.
 *
 * Cala trudnosc jest w porownaniu z poprzednim tygodniem: wolno je policzyc
 * **wylacznie** w obrebie tej samej trojki silnik/wersja/tryb (D27), tego samego
 * zestawu promptow (D25) i tej samej wersji definicji encji (D29). Gdy ktorykolwiek
 * z tych warunkow nie jest spelniony, raport pokazuje odmowe z powodem — a nie
 * pusta komorke i nie policzona mimo wszystko roznice.
 */
export function buildGeoReport(
  db: Db,
  scope: TenantScope,
  siteUrl: string,
  clock: () => Date = () => new Date(),
): GeoReportData {
  const site = siteOf(db, scope, siteUrl)
  const g = geoRepos(db, scope)

  const wszystkieEncje = g.read.listEntities(site.id)
  const own = latestEntityVersions(wszystkieEncje).find((e) => e.isOwn)
  if (own === undefined) throw new NoEntityError(siteUrl)
  const ownIds = new Set(wszystkieEncje.filter((e) => e.isOwn).map((e) => e.id))

  const runs = g.read.listGeoRuns(site.id, 200)
  if (runs.length === 0) throw new NoGeoRunError(siteUrl)

  // Najnowszy przebieg per trojka kontekstu — kazda trojka to osobna linia trendu.
  const najnowsze = new Map<string, (typeof runs)[number]>()
  const poprzednie = new Map<string, (typeof runs)[number]>()
  for (const run of runs) {
    const key = `${run.engine}|${run.modelVersion}|${run.accessMode}`
    if (!najnowsze.has(key)) najnowsze.set(key, run)
    else if (!poprzednie.has(key)) poprzednie.set(key, run)
  }

  const engines: GeoEngineRow[] = []
  const comparisons: GeoComparisonRow[] = []
  const wszystkieOdpowiedzi: { answerId: string; entityIds: string[] }[] = []
  let citationsGrounding = 0
  let citationsInline = 0
  const hosts = new Map<string, Map<string, number>>()

  for (const [key, run] of najnowsze) {
    const answers = g.read.listAnswers(run.id)
    const mentions = g.read.listMentions(run.id)
    const byAnswer = new Map<string, string[]>()
    for (const m of mentions) {
      byAnswer.set(m.geoAnswerId, [...(byAnswer.get(m.geoAnswerId) ?? []), m.entityId])
    }

    const udane = answers.filter((a) => a.fetchError === null)
    const trafienia = udane.filter((a) =>
      (byAnswer.get(a.id) ?? []).some((id) => ownIds.has(id))).length

    engines.push({
      engine: run.engine,
      modelVersion: run.modelVersion,
      accessMode: run.accessMode,
      answersOk: run.answersOk,
      answersFailed: run.answersFailed,
      refusals: answers.filter((a) => a.refusalReason !== null).length,
      visibility: shareOf(proportion(trafienia, udane.length)),
    })

    for (const a of udane) {
      wszystkieOdpowiedzi.push({ answerId: a.id, entityIds: byAnswer.get(a.id) ?? [] })
    }

    for (const source of ['grounding', 'inline'] as const) {
      const rows = g.read.listCitations(run.id, source)
      const naszeOdpowiedzi = new Set(rows.filter((r) => r.ours === 1).map((r) => r.geoAnswerId))
      if (source === 'grounding') citationsGrounding += naszeOdpowiedzi.size
      else citationsInline += naszeOdpowiedzi.size

      const licznik = hosts.get(source) ?? new Map<string, number>()
      for (const row of rows) {
        if (row.host === null) continue
        licznik.set(row.host, (licznik.get(row.host) ?? 0) + 1)
      }
      hosts.set(source, licznik)
    }

    const previous = poprzednie.get(key)
    if (previous !== undefined) {
      comparisons.push(compareRuns(g, run, previous, ownIds))
    }
  }

  const odpowiedziRazem = wszystkieOdpowiedzi.length
  const voice: GeoVoiceRow[] = latestEntityVersions(wszystkieEncje).map((entity) => {
    const ids = new Set(wszystkieEncje.filter((e) => e.name === entity.name).map((e) => e.id))
    const zeWzmianka = wszystkieOdpowiedzi
      .filter((a) => a.entityIds.some((id) => ids.has(id))).length
    return {
      name: entity.name,
      isOwn: entity.isOwn,
      answersWithMention: zeWzmianka,
      share: shareOf(proportion(zeWzmianka, odpowiedziRazem)),
      // Mediane pozycji liczymy w warstwie czystej; tu wystarczy jej brak,
      // gdy encji w ogole nie bylo — zmyslona liczba bylaby gorsza od kreski.
      medianFirstPosition: zeWzmianka === 0 ? null : medianPosition(g, najnowsze, ids),
    }
  })

  const pierwszy = [...najnowsze.values()][0]
  const promptSet = pierwszy === undefined ? undefined : g.read.getPromptSet(pierwszy.promptSetId)
  const prompts = pierwszy === undefined ? 0 : g.read.listPrompts(pierwszy.promptSetId).length
  const runsPerPrompt = pierwszy?.runsPerPrompt ?? 0

  return {
    siteUri: site.propertyUri,
    generatedAt: formatMoment(clock()),
    runStartedAt: pierwszy === undefined ? '—' : formatMoment(new Date(pierwszy.startedAt)),
    ownBrand: own.name,
    promptSetName: promptSet?.name ?? '—',
    promptSetVersion: promptSet?.version ?? 0,
    prompts,
    runsPerPrompt,
    entityVersion: pierwszy?.entityVersion ?? own.version,
    detectableDifference: detectableDifference(prompts, runsPerPrompt),
    engines,
    skipped: [],
    voice,
    citations: [
      {
        source: 'grounding',
        ourRate: shareOf(proportion(citationsGrounding, odpowiedziRazem)),
        topHosts: topHosts(hosts.get('grounding')),
      },
      {
        source: 'inline',
        ourRate: shareOf(proportion(citationsInline, odpowiedziRazem)),
        topHosts: topHosts(hosts.get('inline')),
      },
    ],
    comparisons,
  }
}

export class NoGeoRunError extends Error {
  constructor(siteUrl: string) {
    super(`Brak pomiaru GEO dla ${siteUrl}. Uruchom najpierw: seo geo run --site ${siteUrl}`)
    this.name = 'NoGeoRunError'
  }
}

function shareOf(p: Proportion): ShareRow {
  return { rate: p.rate, low: p.interval.low, high: p.interval.high }
}

function topHosts(licznik: Map<string, number> | undefined): { host: string; count: number }[] {
  return [...(licznik ?? new Map<string, number>()).entries()]
    .map(([host, count]) => ({ host, count }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host))
    .slice(0, 5)
}

function medianPosition(
  g: ReturnType<typeof geoRepos>,
  runs: ReadonlyMap<string, { id: string }>,
  entityIds: ReadonlySet<string>,
): number | null {
  const pozycje: number[] = []
  for (const run of runs.values()) {
    const pierwszeWOdpowiedzi = new Map<string, number>()
    for (const m of g.read.listMentions(run.id)) {
      if (!entityIds.has(m.entityId)) continue
      const dotychczas = pierwszeWOdpowiedzi.get(m.geoAnswerId)
      if (dotychczas === undefined || m.positionShare < dotychczas) {
        pierwszeWOdpowiedzi.set(m.geoAnswerId, m.positionShare)
      }
    }
    pozycje.push(...pierwszeWOdpowiedzi.values())
  }
  if (pozycje.length === 0) return null
  pozycje.sort((a, b) => a - b)
  const srodek = Math.floor(pozycje.length / 2)
  return pozycje.length % 2 === 1
    ? (pozycje[srodek] as number)
    : ((pozycje[srodek - 1] as number) + (pozycje[srodek] as number)) / 2
}

function measurementOf(
  g: ReturnType<typeof geoRepos>,
  run: {
    id: string; promptSetId: string; entityVersion: number
    engine: string; modelVersion: string; accessMode: AccessMode
  },
  ownIds: ReadonlySet<string>,
): MeasurementSet {
  const answers = g.read.listAnswers(run.id).filter((a) => a.fetchError === null)
  const zeWzmianka = new Set(
    g.read.listMentions(run.id).filter((m) => ownIds.has(m.entityId)).map((m) => m.geoAnswerId),
  )
  const byPrompt = new Map<string, { hits: number; trials: number }>()
  for (const a of answers) {
    const bucket = byPrompt.get(a.promptId) ?? { hits: 0, trials: 0 }
    bucket.trials += 1
    if (zeWzmianka.has(a.id)) bucket.hits += 1
    byPrompt.set(a.promptId, bucket)
  }

  return {
    context: { engine: run.engine, modelVersion: run.modelVersion, accessMode: run.accessMode },
    promptSetId: run.promptSetId,
    entityVersion: run.entityVersion,
    measurements: [...byPrompt.entries()].map(([promptId, b]) => ({ promptId, ...b })),
  }
}

/** Ziarno wyprowadzone z pary przebiegow — ten sam raport zawsze da ten sam przedzial. */
function seedFor(a: string, b: string): number {
  let hash = 2166136261
  for (const ch of `${a}|${b}`) {
    hash ^= ch.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function compareRuns(
  g: ReturnType<typeof geoRepos>,
  latest: Parameters<typeof measurementOf>[1],
  previous: Parameters<typeof measurementOf>[1],
  ownIds: ReadonlySet<string>,
): GeoComparisonRow {
  const wynik = compareMeasurements(
    measurementOf(g, previous, ownIds),
    measurementOf(g, latest, ownIds),
    { seed: seedFor(previous.id, latest.id) },
  )

  if (wynik.kind === 'odmowa') {
    return {
      kind: 'odmowa', engine: latest.engine,
      reason: wynik.reason.replace(/-/g, ' '),
      detail: wynik.detail,
    }
  }
  return {
    kind: 'porownanie', engine: latest.engine,
    meanDifference: wynik.comparison.meanDifference,
    low: wynik.comparison.interval.low,
    high: wynik.comparison.interval.high,
    significant: wynik.comparison.significant,
  }
}

function formatMoment(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export interface GeoReportOptions {
  readonly siteUrl: string
  readonly outPath: string
}

export interface GeoReportResult {
  readonly outPath: string
  readonly engines: number
  readonly comparisons: number
  readonly refused: number
}

export function runGeoReport(
  db: Db,
  scope: TenantScope,
  options: GeoReportOptions,
): GeoReportResult {
  const data = buildGeoReport(db, scope, options.siteUrl)
  mkdirSync(dirname(options.outPath), { recursive: true })
  writeFileSync(options.outPath, renderGeoReport(data), 'utf8')
  return {
    outPath: options.outPath,
    engines: data.engines.length,
    comparisons: data.comparisons.length,
    refused: data.comparisons.filter((c) => c.kind === 'odmowa').length,
  }
}
