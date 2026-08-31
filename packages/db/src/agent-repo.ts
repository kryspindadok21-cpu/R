import { newId, type TenantScope } from '@seo/core'
import {
  canTransition, type AgentTask, type DidResult, type Gate, type ScoredOpportunity,
  type TaskState,
} from '@seo/agent'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from './connection.js'
import * as s from './schema.js'

/**
 * Repozytoria Fazy 4. Wszystko przez `TenantScope` (D5).
 *
 * Ta warstwa egzekwuje dwie rzeczy, ktorych typ nie moze upilnowac, bo do
 * repozytorium wchodzi sie z samym identyfikatorem: przejscia stanow zadania
 * i wymog werdyktu przed `done` (D53).
 */

export class IllegalTransitionError extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'IllegalTransitionError'
  }
}

export interface OpportunityRow {
  readonly slug: string
  readonly kind: ScoredOpportunity['kind']
  readonly title: string
  readonly targetUrl: string | null
  readonly score: number
  readonly factors: unknown
  readonly measuredFactors: number
}

export interface TaskInput {
  readonly opportunityId: string
  readonly actionKind: string
  readonly gate: Gate
}

export interface ExperimentInput {
  readonly taskId: string
  readonly treatmentUrls: readonly string[]
  readonly controlUrls: readonly string[]
  readonly shortfall: string | null
  /** Data zmiany doslownie, YYYY-MM-DD. Zakaz `new Date()` na tej wartosci (D3). */
  readonly changedOn: string
  readonly selectedAt: number
}

export function agentRepos(db: Db, scope: TenantScope) {
  const t = scope.tenantId

  const read = {
    listOpportunities: (siteId: string, limit: number) =>
      db.select().from(s.agentOpportunity)
        .where(and(eq(s.agentOpportunity.tenantId, t), eq(s.agentOpportunity.siteId, siteId)))
        .orderBy(desc(s.agentOpportunity.score), asc(s.agentOpportunity.slug))
        .limit(limit).all(),

    getTask: (taskId: string) =>
      db.select().from(s.agentTask)
        .where(and(eq(s.agentTask.tenantId, t), eq(s.agentTask.id, taskId))).get(),

    listTasks: (siteId: string, limit: number) =>
      db.select().from(s.agentTask)
        .where(and(eq(s.agentTask.tenantId, t), eq(s.agentTask.siteId, siteId)))
        .orderBy(desc(s.agentTask.createdAt)).limit(limit).all(),

    getExperiment: (taskId: string) =>
      db.select().from(s.agentExperiment)
        .where(and(eq(s.agentExperiment.tenantId, t), eq(s.agentExperiment.taskId, taskId))).get(),

    listVerdicts: (experimentId: string) =>
      db.select().from(s.agentVerdict)
        .where(and(
          eq(s.agentVerdict.tenantId, t),
          eq(s.agentVerdict.experimentId, experimentId),
        ))
        .orderBy(asc(s.agentVerdict.windowDays), asc(s.agentVerdict.metric)).all(),
  }

  const write = {
    insertOpportunities: (siteId: string, rows: readonly OpportunityRow[]): string[] => {
      const now = Date.now()
      const ids: string[] = []
      for (const row of rows) {
        const id = newId()
        db.insert(s.agentOpportunity).values({
          id, tenantId: t, siteId,
          slug: row.slug, kind: row.kind, title: row.title,
          targetUrl: row.targetUrl, score: row.score,
          factors: JSON.stringify(row.factors),
          measuredFactors: row.measuredFactors,
          createdAt: now,
        }).run()
        ids.push(id)
      }
      return ids
    },

    /**
     * Zadanie powstaje **zawsze** w stanie `proposed` (D46).
     *
     * Nie ma parametru pozwalajacego zaczac gdzie indziej. Planer emitujacy od
     * razu `in-flight` obchodzilby polityke, a to jest jedyne zabezpieczenie
     * dzialajace niezaleznie od zachowania modelu.
     */
    proposeTask: (siteId: string, input: TaskInput): string => {
      const id = newId()
      const now = Date.now()
      db.insert(s.agentTask).values({
        id, tenantId: t, siteId,
        opportunityId: input.opportunityId,
        actionKind: input.actionKind,
        state: 'proposed',
        gate: input.gate.kind,
        gateReason: input.gate.kind === 'auto' ? '' : input.gate.reason,
        verdict: null,
        createdAt: now, updatedAt: now,
      }).run()
      return id
    },

    /** Przejscie stanu przez ten sam automat, ktorego uzywa warstwa czysta. */
    transition: (taskId: string, to: TaskState, verdict?: string): void => {
      const row = db.select().from(s.agentTask)
        .where(and(eq(s.agentTask.tenantId, t), eq(s.agentTask.id, taskId))).get()
      if (row === undefined) throw new IllegalTransitionError(`nie znaleziono zadania ${taskId}`)

      const zadanie: AgentTask = {
        id: row.id,
        actionKind: row.actionKind,
        state: row.state,
        opportunityId: row.opportunityId,
        // Werdykt podany w tym wywolaniu liczy sie tak samo jak juz zapisany.
        verdict: verdict ?? row.verdict,
      }

      const wynik = canTransition(zadanie, to)
      if (!wynik.ok) throw new IllegalTransitionError(wynik.reason)

      db.update(s.agentTask)
        .set({
          state: to,
          verdict: verdict ?? row.verdict,
          updatedAt: Date.now(),
        })
        .where(and(eq(s.agentTask.tenantId, t), eq(s.agentTask.id, taskId))).run()
    },

    /**
     * Zapis eksperymentu. Grupy zapisuje sie **raz**, w chwili planowania (D49).
     * Kolejny zapis dla tego samego zadania jest bledem unikalnosci z bazy —
     * i to jest zamierzone.
     */
    recordExperiment: (siteId: string, input: ExperimentInput): string => {
      const id = newId()
      db.insert(s.agentExperiment).values({
        id, tenantId: t, siteId,
        taskId: input.taskId,
        treatmentUrls: JSON.stringify(input.treatmentUrls),
        controlUrls: JSON.stringify(input.controlUrls),
        shortfall: input.shortfall,
        changedOn: input.changedOn,
        selectedAt: input.selectedAt,
      }).run()
      return id
    },

    /** Zapisuje werdykt **takze odmowe** — inaczej nie wiadomo, ile pomiarow padlo. */
    recordVerdict: (experimentId: string, result: DidResult, sentence: string): string => {
      const id = newId()
      const wspolne = {
        id, tenantId: t, experimentId,
        windowDays: result.windowDays,
        metric: result.metric,
        sentence,
        measuredAt: Date.now(),
      }

      if (result.kind === 'odmowa') {
        db.insert(s.agentVerdict).values({
          ...wspolne,
          outcome: 'odmowa',
          effect: null, intervalLow: null, intervalHigh: null,
          significant: 0, direction: null,
          refusalReason: `${result.reason}: ${result.detail}`,
          treatmentPages: 0, controlPages: 0, seed: null,
        }).run()
        return id
      }

      db.insert(s.agentVerdict).values({
        ...wspolne,
        outcome: 'werdykt',
        effect: result.effect,
        intervalLow: result.interval.low,
        intervalHigh: result.interval.high,
        significant: result.significant ? 1 : 0,
        direction: result.direction,
        refusalReason: null,
        treatmentPages: result.treatmentPages,
        controlPages: result.controlPages,
        seed: result.seed,
      }).run()
      return id
    },
  }

  return { read, write }
}

export type AgentRepos = ReturnType<typeof agentRepos>
