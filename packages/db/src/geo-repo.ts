import { newId, type TenantScope } from '@seo/core'
import type { Citation, EntityDefinition, Mention } from '@seo/geo'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from './connection.js'
import * as s from './schema.js'

/**
 * Repozytoria Fazy 2. Ta sama zasada, co wczesniej: wszystko przez `TenantScope`,
 * zero dostepu do surowego uchwytu (D5).
 *
 * Dwie rzeczy sa tu wymuszane przez kod, a nie przez dobre chęci:
 * zamrozenie zestawu promptow (D25) i wersjonowanie definicji encji (D29).
 * Obie decyduja o tym, czy porownanie dwoch tygodni w ogole ma sens.
 */

export class FrozenPromptSetError extends Error {
  constructor(readonly promptSetId: string) {
    super(
      `Zestaw promptow ${promptSetId} byl juz uzyty w pomiarze i jego skladu nie wolno zmieniac. ` +
      'Zmiana skladu uniewaznia porownywalnosc wstecz (D25) — zaloz nowa wersje zestawu.',
    )
    this.name = 'FrozenPromptSetError'
  }
}

export interface PromptSetInput {
  readonly name: string
  readonly version?: number
  readonly supersedesId?: string | null
}

export interface PromptInput {
  readonly text: string
  readonly locale: string
}

export interface BrandEntityInput {
  readonly name: string
  readonly variants: readonly string[]
  readonly exclusions: readonly string[]
  readonly version?: number
  readonly isOwn: boolean
}

export interface GeoRunInput {
  readonly promptSetId: string
  readonly engine: string
  readonly modelVersion: string
  readonly accessMode: 'api' | 'api_grounded'
  readonly entityVersion: number
  readonly runsPerPrompt: number
}

export interface GeoRunFinish {
  readonly ok: boolean
  readonly error?: string | undefined
  readonly answersOk: number
  readonly answersFailed: number
}

export interface GeoAnswerInput {
  readonly promptId: string
  readonly runIndex: number
  readonly text: string
  /** Odmowa modelu jest **danymi**, nie bledem przebiegu. */
  readonly refusalReason: string | null
  readonly fetchError: string | null
  readonly latencyMs: number
}

export function geoRepos(db: Db, scope: TenantScope) {
  const t = scope.tenantId

  function assertNotFrozen(promptSetId: string): void {
    const row = db.select({ frozenAt: s.promptSet.frozenAt }).from(s.promptSet)
      .where(and(eq(s.promptSet.tenantId, t), eq(s.promptSet.id, promptSetId))).get()
    if (row?.frozenAt !== null && row?.frozenAt !== undefined) {
      throw new FrozenPromptSetError(promptSetId)
    }
  }

  const read = {
    getPromptSet: (promptSetId: string) =>
      db.select().from(s.promptSet)
        .where(and(eq(s.promptSet.tenantId, t), eq(s.promptSet.id, promptSetId))).get(),

    listPromptSets: (siteId: string) =>
      db.select().from(s.promptSet)
        .where(and(eq(s.promptSet.tenantId, t), eq(s.promptSet.siteId, siteId)))
        .orderBy(asc(s.promptSet.name), asc(s.promptSet.version)).all(),

    listPrompts: (promptSetId: string) =>
      db.select().from(s.prompt)
        .where(and(eq(s.prompt.tenantId, t), eq(s.prompt.promptSetId, promptSetId)))
        .orderBy(asc(s.prompt.createdAt), asc(s.prompt.id)).all(),

    /** Encje w najnowszej wersji — definicja starsza zostaje dla porownan wstecz. */
    listEntities: (siteId: string): EntityDefinition[] =>
      db.select().from(s.brandEntity)
        .where(and(eq(s.brandEntity.tenantId, t), eq(s.brandEntity.siteId, siteId)))
        .orderBy(desc(s.brandEntity.isOwn), asc(s.brandEntity.name)).all()
        .map((row) => ({
          id: row.id,
          name: row.name,
          variants: JSON.parse(row.variants) as string[],
          exclusions: JSON.parse(row.exclusions) as string[],
          version: row.version,
        })),

    latestGeoRun: (siteId: string) =>
      db.select().from(s.geoRun)
        .where(and(eq(s.geoRun.tenantId, t), eq(s.geoRun.siteId, siteId)))
        .orderBy(desc(s.geoRun.startedAt)).limit(1).get(),

    getGeoRun: (runId: string) =>
      db.select().from(s.geoRun)
        .where(and(eq(s.geoRun.tenantId, t), eq(s.geoRun.id, runId))).get(),

    listGeoRuns: (siteId: string, limit: number) =>
      db.select().from(s.geoRun)
        .where(and(eq(s.geoRun.tenantId, t), eq(s.geoRun.siteId, siteId)))
        .orderBy(desc(s.geoRun.startedAt)).limit(limit).all(),

    listAnswers: (runId: string) =>
      db.select({
        id: s.geoAnswer.id,
        promptId: s.geoAnswer.promptId,
        promptText: s.prompt.text,
        runIndex: s.geoAnswer.runIndex,
        text: s.geoAnswer.text,
        refusalReason: s.geoAnswer.refusalReason,
        fetchError: s.geoAnswer.fetchError,
        latencyMs: s.geoAnswer.latencyMs,
      }).from(s.geoAnswer)
        .innerJoin(s.prompt, eq(s.prompt.id, s.geoAnswer.promptId))
        .where(and(eq(s.geoAnswer.tenantId, t), eq(s.geoAnswer.geoRunId, runId)))
        .orderBy(asc(s.geoAnswer.promptId), asc(s.geoAnswer.runIndex)).all(),

    listMentions: (runId: string) =>
      db.select().from(s.geoMention)
        .where(and(eq(s.geoMention.tenantId, t), eq(s.geoMention.geoRunId, runId)))
        .orderBy(asc(s.geoMention.geoAnswerId), asc(s.geoMention.startOffset)).all(),

    /**
     * Cytowania jednego zrodla. Zrodlo jest **wymaganym** argumentem, wiec nie da
     * sie przez pomylke odczytac obu naraz i policzyc ich razem (D32).
     */
    listCitations: (runId: string, source: 'grounding' | 'inline') =>
      db.select().from(s.geoCitation)
        .where(and(
          eq(s.geoCitation.tenantId, t),
          eq(s.geoCitation.geoRunId, runId),
          eq(s.geoCitation.source, source),
        ))
        .orderBy(asc(s.geoCitation.geoAnswerId), asc(s.geoCitation.rawUrl)).all(),
  }

  const write = {
    createPromptSet: (siteId: string, input: PromptSetInput): string => {
      const id = newId()
      db.insert(s.promptSet).values({
        id, tenantId: t, siteId,
        name: input.name,
        version: input.version ?? 1,
        supersedesId: input.supersedesId ?? null,
        createdAt: Date.now(),
        frozenAt: null,
      }).run()
      return id
    },

    addPrompts: (promptSetId: string, prompts: readonly PromptInput[]): string[] => {
      assertNotFrozen(promptSetId)
      const ids: string[] = []
      for (const p of prompts) {
        const id = newId()
        db.insert(s.prompt).values({
          id, tenantId: t, promptSetId, text: p.text, locale: p.locale, createdAt: Date.now(),
        }).run()
        ids.push(id)
      }
      return ids
    },

    upsertEntity: (siteId: string, input: BrandEntityInput): string => {
      const id = newId()
      db.insert(s.brandEntity).values({
        id, tenantId: t, siteId,
        name: input.name,
        variants: JSON.stringify(input.variants),
        exclusions: JSON.stringify(input.exclusions),
        version: input.version ?? 1,
        isOwn: input.isOwn ? 1 : 0,
        createdAt: Date.now(),
      }).run()
      return id
    },

    /**
     * Rozpoczecie przebiegu **zamraza** zestaw promptow. Od tej chwili dopisanie
     * promptu jest bledem, a nie wygoda: porownanie tydzien do tygodnia liczy
     * roznice sparowane i milczaco zmieniony sklad zestawu psuje je bez sladu.
     */
    startGeoRun: (siteId: string, input: GeoRunInput): string => {
      const id = newId()
      db.insert(s.geoRun).values({
        id, tenantId: t, siteId,
        promptSetId: input.promptSetId,
        engine: input.engine,
        modelVersion: input.modelVersion,
        accessMode: input.accessMode,
        entityVersion: input.entityVersion,
        runsPerPrompt: input.runsPerPrompt,
        startedAt: Date.now(),
        answersOk: 0, answersFailed: 0,
      }).run()
      db.update(s.promptSet).set({ frozenAt: Date.now() })
        .where(and(
          eq(s.promptSet.tenantId, t),
          eq(s.promptSet.id, input.promptSetId),
        )).run()
      return id
    },

    finishGeoRun: (runId: string, finish: GeoRunFinish): void => {
      db.update(s.geoRun).set({
        finishedAt: Date.now(),
        ok: finish.ok ? 1 : 0,
        error: finish.error ?? null,
        answersOk: finish.answersOk,
        answersFailed: finish.answersFailed,
      }).where(and(eq(s.geoRun.tenantId, t), eq(s.geoRun.id, runId))).run()
    },

    insertAnswer: (runId: string, input: GeoAnswerInput): string => {
      const id = newId()
      db.insert(s.geoAnswer).values({
        id, tenantId: t, geoRunId: runId,
        promptId: input.promptId,
        runIndex: input.runIndex,
        text: input.text,
        refusalReason: input.refusalReason,
        fetchError: input.fetchError,
        latencyMs: input.latencyMs,
        createdAt: Date.now(),
      }).run()
      return id
    },

    insertMentions: (runId: string, answerId: string, mentions: readonly Mention[]): void => {
      for (const m of mentions) {
        db.insert(s.geoMention).values({
          id: newId(), tenantId: t, geoRunId: runId, geoAnswerId: answerId,
          entityId: m.entityId,
          matched: m.matched,
          startOffset: m.start,
          positionShare: m.positionShare,
          paragraph: m.paragraph,
        }).run()
      }
    },

    insertCitations: (runId: string, answerId: string, citations: readonly Citation[]): void => {
      for (const c of citations) {
        db.insert(s.geoCitation).values({
          id: newId(), tenantId: t, geoRunId: runId, geoAnswerId: answerId,
          source: c.source,
          rawUrl: c.rawUrl,
          urlNormalized: c.normalized,
          urlHash: c.hash,
          host: c.host,
          positionShare: c.positionShare,
          ours: c.ours ? 1 : 0,
        }).run()
      }
    },
  }

  return { read, write }
}

export type GeoRepos = ReturnType<typeof geoRepos>
