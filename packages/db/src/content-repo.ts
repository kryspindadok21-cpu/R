import { newId, type TenantScope } from '@seo/core'
import type { Brief, GateFailure } from '@seo/content'
import type { Cluster, ClusteringMethod } from '@seo/keywords'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { Db } from './connection.js'
import * as s from './schema.js'

/**
 * Repozytoria Fazy 3. Wszystko przez `TenantScope`, zero dostepu do surowego
 * uchwytu (D5).
 *
 * Dwie rzeczy, ktore ta warstwa wymusza, a nie tylko zapisuje:
 * mieszanie metod klastrowania w jednym zestawie (D33) i limit tempa publikacji
 * (D43). Obie sa wylacznikami, ktore maja zadzialac wtedy, gdy wszystko inne
 * zawiedzie — wiec nie moga zalezec od tego, czy ktos pamietal je wywolac.
 */

export class MixedClusterMethodError extends Error {
  constructor(setMethod: ClusteringMethod, clusterMethod: ClusteringMethod) {
    super(
      `Zestaw ma metode ${setMethod}, a klaster ${clusterMethod}. `
      + 'Overlap SERP mierzy opinie wyszukiwarki, a podobienstwo leksykalne tylko '
      + 'nasza hipoteze — w jednej tabeli wygladaja identycznie i to jest problem (D33).',
    )
    this.name = 'MixedClusterMethodError'
  }
}

export class UnapprovedDraftError extends Error {
  constructor(draftId: string) {
    super(
      `Draft ${draftId} nie przeszedl bramek i nie moze zostac opublikowany. `
      + 'Powody sa zapisane w kolumnie gate_failures.',
    )
    this.name = 'UnapprovedDraftError'
  }
}

/** Doba w milisekundach — okno dziennego limitu publikacji. */
export const DAY_MS = 24 * 60 * 60 * 1000

/** Okno miesiecznego limitu. Trzydziesci dni, nie „miesiac kalendarzowy". */
export const MONTH_MS = 30 * DAY_MS

/** Ile publikacji dziennie wolno bez wzgledu na rozmiar serwisu (D43). */
export const DAILY_PUBLICATION_FLOOR = 3

/** Jaka czesc zaindeksowanych stron wolno dolozyc w miesiacu (D43). */
export const MONTHLY_SITE_SHARE = 0.1

export interface ClusterSetInput {
  readonly method: ClusteringMethod
  readonly fromDate: string
  readonly toDate: string
}

export interface BriefInput {
  readonly clusterId: string
  readonly brief: Brief
  readonly markdown: string
}

export interface DraftInput {
  readonly briefId: string
  readonly title: string
  readonly markdown: string
  readonly authorName: string
  readonly authorSameAs: string
  readonly uniqueAssets: readonly unknown[]
  readonly engine: string
  readonly modelVersion: string
  readonly promptId: string
  readonly approved: boolean
  readonly gateFailures: readonly GateFailure[]
  readonly originality: unknown
}

export interface PublicationInput {
  readonly draftId: string
  readonly branch: string
  readonly filePath: string
}

export interface RateLimitStatus {
  readonly allowed: boolean
  readonly publishedToday: number
  readonly publishedThisMonth: number
  readonly dailyLimit: number
  readonly monthlyLimit: number
  readonly reason: string
}

export function contentRepos(db: Db, scope: TenantScope) {
  const t = scope.tenantId

  const read = {
    latestClusterSet: (siteId: string) =>
      db.select().from(s.keywordClusterSet)
        .where(and(eq(s.keywordClusterSet.tenantId, t), eq(s.keywordClusterSet.siteId, siteId)))
        .orderBy(desc(s.keywordClusterSet.createdAt)).limit(1).get(),

    listClusterSets: (siteId: string, limit: number) =>
      db.select().from(s.keywordClusterSet)
        .where(and(eq(s.keywordClusterSet.tenantId, t), eq(s.keywordClusterSet.siteId, siteId)))
        .orderBy(desc(s.keywordClusterSet.createdAt)).limit(limit).all(),

    listClusters: (clusterSetId: string) =>
      db.select().from(s.keywordCluster)
        .where(and(
          eq(s.keywordCluster.tenantId, t),
          eq(s.keywordCluster.clusterSetId, clusterSetId),
        ))
        .orderBy(desc(s.keywordCluster.totalImpressions), asc(s.keywordCluster.slug)).all(),

    getBrief: (briefId: string) =>
      db.select().from(s.contentBrief)
        .where(and(eq(s.contentBrief.tenantId, t), eq(s.contentBrief.id, briefId))).get(),

    listBriefs: (siteId: string, limit: number) =>
      db.select().from(s.contentBrief)
        .where(and(eq(s.contentBrief.tenantId, t), eq(s.contentBrief.siteId, siteId)))
        .orderBy(desc(s.contentBrief.createdAt)).limit(limit).all(),

    getDraft: (draftId: string) =>
      db.select().from(s.contentDraft)
        .where(and(eq(s.contentDraft.tenantId, t), eq(s.contentDraft.id, draftId))).get(),

    listDrafts: (briefId: string) =>
      db.select().from(s.contentDraft)
        .where(and(eq(s.contentDraft.tenantId, t), eq(s.contentDraft.briefId, briefId)))
        .orderBy(desc(s.contentDraft.createdAt)).all(),

    getPublication: (draftId: string) =>
      db.select().from(s.contentPublication)
        .where(and(
          eq(s.contentPublication.tenantId, t),
          eq(s.contentPublication.draftId, draftId),
        )).get(),

    listPublications: (siteId: string, limit: number) =>
      db.select().from(s.contentPublication)
        .where(and(eq(s.contentPublication.tenantId, t), eq(s.contentPublication.siteId, siteId)))
        .orderBy(desc(s.contentPublication.createdAt)).limit(limit).all(),

    /**
     * Licznik tempa publikacji (D43).
     *
     * Liczony **z tabeli publikacji**, a nie z osobnego licznika. Osobny licznik
     * moze sie rozjechac z rzeczywistoscia; zapytanie o wiersze nie moze.
     */
    publicationRate: (siteId: string, indexedPages: number, now: number): RateLimitStatus => {
      const policz = (od: number): number =>
        db.select({ n: sql<number>`count(*)` }).from(s.contentPublication)
          .where(and(
            eq(s.contentPublication.tenantId, t),
            eq(s.contentPublication.siteId, siteId),
            sql`${s.contentPublication.createdAt} >= ${od}`,
          )).get()?.n ?? 0

      const publishedToday = policz(now - DAY_MS)
      const publishedThisMonth = policz(now - MONTH_MS)

      // Formula z analizy: max(3 dziennie, 10% zaindeksowanych stron miesiecznie).
      const monthlyLimit = Math.max(
        DAILY_PUBLICATION_FLOOR * 30,
        Math.floor(indexedPages * MONTHLY_SITE_SHARE),
      )
      const dailyLimit = DAILY_PUBLICATION_FLOOR

      if (publishedToday >= dailyLimit) {
        return {
          allowed: false, publishedToday, publishedThisMonth, dailyLimit, monthlyLimit,
          reason: `limit dzienny wyczerpany (${publishedToday}/${dailyLimit}); `
            + 'kolejna publikacja najwczesniej po 24 godzinach od najstarszej z dzisiaj',
        }
      }
      if (publishedThisMonth >= monthlyLimit) {
        return {
          allowed: false, publishedToday, publishedThisMonth, dailyLimit, monthlyLimit,
          reason: `limit miesieczny wyczerpany (${publishedThisMonth}/${monthlyLimit} `
            + `przy ${indexedPages} zaindeksowanych stronach)`,
        }
      }
      return {
        allowed: true, publishedToday, publishedThisMonth, dailyLimit, monthlyLimit,
        reason: `dzis ${publishedToday}/${dailyLimit}, w 30 dniach ${publishedThisMonth}/${monthlyLimit}`,
      }
    },
  }

  const write = {
    createClusterSet: (siteId: string, input: ClusterSetInput): string => {
      const id = newId()
      db.insert(s.keywordClusterSet).values({
        id, tenantId: t, siteId,
        method: input.method,
        fromDate: input.fromDate,
        toDate: input.toDate,
        createdAt: Date.now(),
      }).run()
      return id
    },

    /**
     * Klaster o innej metodzie niz zestaw jest **bledem**, nie ostrzezeniem.
     * Ta sama zasada, co odmowa w `clusterSet` z `@seo/keywords` — tylko tutaj
     * broni bazy, a tam raportu.
     */
    insertClusters: (clusterSetId: string, clusters: readonly Cluster[]): string[] => {
      const set = db.select({ method: s.keywordClusterSet.method }).from(s.keywordClusterSet)
        .where(and(
          eq(s.keywordClusterSet.tenantId, t),
          eq(s.keywordClusterSet.id, clusterSetId),
        )).get()

      const ids: string[] = []
      for (const cluster of clusters) {
        if (set !== undefined && cluster.method !== set.method) {
          throw new MixedClusterMethodError(set.method, cluster.method)
        }
        const id = newId()
        db.insert(s.keywordCluster).values({
          id, tenantId: t, clusterSetId,
          slug: cluster.id,
          head: cluster.head,
          totalImpressions: cluster.totalImpressions,
          totalClicks: cluster.totalClicks,
          sharedUrls: cluster.sharedUrls,
          keywords: JSON.stringify(cluster.keywords),
        }).run()
        ids.push(id)
      }
      return ids
    },

    insertBrief: (siteId: string, input: BriefInput): string => {
      const id = newId()
      db.insert(s.contentBrief).values({
        id, tenantId: t, siteId,
        clusterId: input.clusterId,
        decision: input.brief.decision,
        targetUrl: input.brief.targetUrl,
        decisionReason: input.brief.decisionReason,
        markdown: input.markdown,
        payload: JSON.stringify(input.brief),
        createdAt: Date.now(),
      }).run()
      return id
    },

    /**
     * Zapisuje draft **takze odrzucony**.
     *
     * Bez tego nie da sie odpowiedziec na pytanie „ile draftow odpadlo i na
     * ktorej bramce" — a to jest jedyny sposob, zeby zobaczyc, ze generator
     * zaczal produkowac slop, zanim cokolwiek wyjdzie na zewnatrz.
     */
    insertDraft: (siteId: string, input: DraftInput): string => {
      const id = newId()
      db.insert(s.contentDraft).values({
        id, tenantId: t, siteId,
        briefId: input.briefId,
        title: input.title,
        markdown: input.markdown,
        authorName: input.authorName,
        authorSameAs: input.authorSameAs,
        uniqueAssets: JSON.stringify(input.uniqueAssets),
        engine: input.engine,
        modelVersion: input.modelVersion,
        promptId: input.promptId,
        approved: input.approved ? 1 : 0,
        gateFailures: JSON.stringify(input.gateFailures),
        originality: JSON.stringify(input.originality),
        createdAt: Date.now(),
      }).run()
      return id
    },

    /**
     * Publikacja draftu, ktory nie przeszedl bramek, jest **niemozliwa**.
     *
     * Typ `ApprovedDraft` broni tego w kodzie czystym; tutaj broni tego baza,
     * bo do repozytorium mozna wejsc z samym identyfikatorem.
     */
    createPublication: (siteId: string, input: PublicationInput): string => {
      const draft = db.select({ approved: s.contentDraft.approved }).from(s.contentDraft)
        .where(and(eq(s.contentDraft.tenantId, t), eq(s.contentDraft.id, input.draftId))).get()
      if (draft === undefined || draft.approved !== 1) {
        throw new UnapprovedDraftError(input.draftId)
      }

      const id = newId()
      const now = Date.now()
      db.insert(s.contentPublication).values({
        id, tenantId: t, siteId,
        draftId: input.draftId,
        adapter: 'git-pr',
        branch: input.branch,
        filePath: input.filePath,
        prUrl: null,
        state: 'prepared',
        createdAt: now,
        updatedAt: now,
      }).run()
      return id
    },

    markPublicationOpened: (publicationId: string, prUrl: string): void => {
      db.update(s.contentPublication)
        .set({ state: 'opened', prUrl, updatedAt: Date.now() })
        .where(and(
          eq(s.contentPublication.tenantId, t),
          eq(s.contentPublication.id, publicationId),
        )).run()
    },

    /** `merged` i `closed` ustawia czlowiek — pull request jest bramka (D35). */
    setPublicationState: (publicationId: string, state: 'merged' | 'closed'): void => {
      db.update(s.contentPublication)
        .set({ state, updatedAt: Date.now() })
        .where(and(
          eq(s.contentPublication.tenantId, t),
          eq(s.contentPublication.id, publicationId),
        )).run()
    },
  }

  return { read, write }
}

export type ContentRepos = ReturnType<typeof contentRepos>
