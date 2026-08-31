import type { TenantScope } from '@seo/core'
import { type Db, FrozenPromptSetError, geoRepos, repos } from '@seo/db'
import {
  collectCitations, detectInAnswers, measurePrompts, proportion,
  type EntityDefinition, type Proportion,
} from '@seo/geo'
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
