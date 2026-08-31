import { GSC_SOURCE_TIMEZONE, type TenantScope, newId } from '@seo/core'
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm'
import type { Db } from './connection.js'
import * as s from './schema.js'

// Daty sa tekstem YYYY-MM-DD — porzadek leksykograficzny jest tozsamy
// z chronologicznym, wiec gte/lte na tekscie sa poprawne (D3).

export interface DailyInput {
  date: string; clicks: number; impressions: number; ctr: number; position: number
}
export interface QueryDailyInput extends DailyInput { query: string }
export interface PageDailyInput extends DailyInput { page: string }
export interface ReconciliationInput {
  date: string; totalClicks: number; querySumClicks: number
  totalImpressions: number; querySumImpressions: number
}
export interface ProviderCallInput {
  providerId: string; capability: string; startedAt: number; durationMs: number
  ok: boolean; httpStatus?: number | undefined; errorCode?: string | undefined
  quotaUnits: number; costMicros: number; requestFingerprint: string
}

export function repos(db: Db, scope: TenantScope) {
  const t = scope.tenantId

  const read = {
    listSites: () =>
      db.select().from(s.site).where(eq(s.site.tenantId, t)).orderBy(asc(s.site.propertyUri)).all(),

    findSiteByUri: (propertyUri: string) =>
      db.select().from(s.site)
        .where(and(eq(s.site.tenantId, t), eq(s.site.propertyUri, propertyUri))).get(),

    listDailyRange: (siteId: string, from: string, to: string) =>
      db.select().from(s.gscDaily)
        .where(and(
          eq(s.gscDaily.tenantId, t), eq(s.gscDaily.siteId, siteId),
          eq(s.gscDaily.dataState, 'final'),
          gte(s.gscDaily.date, from), lte(s.gscDaily.date, to),
        ))
        .orderBy(asc(s.gscDaily.date)).all(),

    /**
     * Frazy z pozycja — wejscie do klastrowania i briefow (Faza 3).
     *
     * Pozycja to srednia **wazona wyswietleniami**, bo tak liczy ja samo Search
     * Console. Zwykla srednia arytmetyczna z dni dalaby temu samemu dniowi
     * z dwoma wyswietleniami taka sama wage, co dniowi z dwoma tysiacami.
     */
    queriesWithPosition: (siteId: string, from: string, to: string, limit: number) =>
      db.select({
        query: s.gscQueryDaily.query,
        clicks: sql<number>`sum(${s.gscQueryDaily.clicks})`.as('clicks'),
        impressions: sql<number>`sum(${s.gscQueryDaily.impressions})`.as('impressions'),
        position: sql<number>`
          case when sum(${s.gscQueryDaily.impressions}) = 0 then 0
          else sum(${s.gscQueryDaily.position} * ${s.gscQueryDaily.impressions})
               / sum(${s.gscQueryDaily.impressions}) end
        `.as('position'),
      }).from(s.gscQueryDaily)
        .where(and(
          eq(s.gscQueryDaily.tenantId, t), eq(s.gscQueryDaily.siteId, siteId),
          eq(s.gscQueryDaily.dataState, 'final'),
          gte(s.gscQueryDaily.date, from), lte(s.gscQueryDaily.date, to),
        ))
        .groupBy(s.gscQueryDaily.query)
        .orderBy(desc(sql`sum(${s.gscQueryDaily.impressions})`))
        .limit(limit).all(),

    /**
     * Metryki per strona w zakresie dat — wejscie do roznicy w roznicach (D48).
     *
     * Pozycja jest srednia **wazona wyswietleniami**, tak jak liczy ja Search
     * Console; zwykla srednia z dni dalaby dniowi z dwoma wyswietleniami taka
     * sama wage, co dniowi z dwoma tysiacami.
     */
    pageMetricsInRange: (siteId: string, from: string, to: string) =>
      db.select({
        page: s.gscPageDaily.page,
        clicks: sql<number>`sum(${s.gscPageDaily.clicks})`.as('clicks'),
        impressions: sql<number>`sum(${s.gscPageDaily.impressions})`.as('impressions'),
        position: sql<number>`
          case when sum(${s.gscPageDaily.impressions}) = 0 then 0
          else sum(${s.gscPageDaily.position} * ${s.gscPageDaily.impressions})
               / sum(${s.gscPageDaily.impressions}) end
        `.as('position'),
      }).from(s.gscPageDaily)
        .where(and(
          eq(s.gscPageDaily.tenantId, t), eq(s.gscPageDaily.siteId, siteId),
          eq(s.gscPageDaily.dataState, 'final'),
          gte(s.gscPageDaily.date, from), lte(s.gscPageDaily.date, to),
        ))
        .groupBy(s.gscPageDaily.page).all(),

    topQueries: (siteId: string, from: string, to: string, limit: number) =>
      db.select({
        query: s.gscQueryDaily.query,
        clicks: sql<number>`sum(${s.gscQueryDaily.clicks})`.as('clicks'),
        impressions: sql<number>`sum(${s.gscQueryDaily.impressions})`.as('impressions'),
      }).from(s.gscQueryDaily)
        .where(and(
          eq(s.gscQueryDaily.tenantId, t), eq(s.gscQueryDaily.siteId, siteId),
          eq(s.gscQueryDaily.dataState, 'final'),
          gte(s.gscQueryDaily.date, from), lte(s.gscQueryDaily.date, to),
        ))
        .groupBy(s.gscQueryDaily.query)
        .orderBy(desc(sql`sum(${s.gscQueryDaily.clicks})`))
        .limit(limit).all(),

    listReconciliations: (siteId: string, from: string, to: string) =>
      db.select().from(s.gscReconciliation)
        .where(and(
          eq(s.gscReconciliation.tenantId, t), eq(s.gscReconciliation.siteId, siteId),
          gte(s.gscReconciliation.date, from), lte(s.gscReconciliation.date, to),
        ))
        .orderBy(asc(s.gscReconciliation.date)).all(),

    getReconciliation: (siteId: string, date: string) =>
      db.select().from(s.gscReconciliation)
        .where(and(
          eq(s.gscReconciliation.tenantId, t), eq(s.gscReconciliation.siteId, siteId),
          eq(s.gscReconciliation.date, date),
        )).get(),

    providerCallSummary: (fromMs: number, toMs: number) =>
      db.select({
        providerId: s.providerCall.providerId,
        capability: s.providerCall.capability,
        calls: sql<number>`count(*)`.as('calls'),
        quotaUnits: sql<number>`sum(${s.providerCall.quotaUnits})`.as('quota_units'),
        costMicros: sql<number>`sum(${s.providerCall.costMicros})`.as('cost_micros'),
        failures: sql<number>`sum(case when ${s.providerCall.ok} = 0 then 1 else 0 end)`.as('failures'),
      }).from(s.providerCall)
        .where(and(
          eq(s.providerCall.tenantId, t),
          gte(s.providerCall.startedAt, fromMs), lte(s.providerCall.startedAt, toMs),
        ))
        .groupBy(s.providerCall.providerId, s.providerCall.capability).all(),

    latestSyncRun: (siteId: string) =>
      db.select().from(s.gscSyncRun)
        .where(and(eq(s.gscSyncRun.tenantId, t), eq(s.gscSyncRun.siteId, siteId)))
        .orderBy(desc(s.gscSyncRun.startedAt)).limit(1).get(),
  }

  const write = {
    ensureTenant: (name: string) => {
      db.insert(s.tenant).values({ id: t, name, createdAt: Date.now() })
        .onConflictDoNothing().run()
    },

    upsertSite: (propertyType: 'domain' | 'url_prefix', propertyUri: string) => {
      const existing = read.findSiteByUri(propertyUri)
      if (existing) return existing
      const row = { id: newId(), tenantId: t, propertyType, propertyUri, createdAt: Date.now() }
      db.insert(s.site).values(row).run()
      return row
    },

    startSyncRun: (
      siteId: string, dateFrom: string, dateTo: string,
      dataState: 'final' | 'all', dimensions: string,
    ) => {
      const id = newId()
      db.insert(s.gscSyncRun).values({
        id, tenantId: t, siteId, startedAt: Date.now(),
        dateFrom, dateTo, dataState, dimensions, rowsFetched: 0,
      }).run()
      return id
    },

    finishSyncRun: (runId: string, rowsFetched: number, ok: boolean, error?: string) => {
      db.update(s.gscSyncRun)
        .set({ finishedAt: Date.now(), rowsFetched, ok: ok ? 1 : 0, error: error ?? null })
        .where(and(eq(s.gscSyncRun.tenantId, t), eq(s.gscSyncRun.id, runId))).run()
    },

    upsertDaily: (siteId: string, syncRunId: string, rows: readonly DailyInput[]) => {
      for (const r of rows) {
        db.insert(s.gscDaily).values({
          id: newId(), tenantId: t, siteId, date: r.date,
          sourceTimezone: GSC_SOURCE_TIMEZONE, clicks: r.clicks, impressions: r.impressions,
          ctr: r.ctr, position: r.position, dataState: 'final', syncRunId,
        }).onConflictDoUpdate({
          target: [s.gscDaily.tenantId, s.gscDaily.siteId, s.gscDaily.date, s.gscDaily.dataState],
          set: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, syncRunId },
        }).run()
      }
    },

    upsertPageDaily: (siteId: string, syncRunId: string, rows: readonly PageDailyInput[]) => {
      for (const r of rows) {
        db.insert(s.gscPageDaily).values({
          id: newId(), tenantId: t, siteId, date: r.date, sourceTimezone: GSC_SOURCE_TIMEZONE,
          page: r.page, clicks: r.clicks, impressions: r.impressions,
          ctr: r.ctr, position: r.position, dataState: 'final', syncRunId,
        }).onConflictDoUpdate({
          target: [s.gscPageDaily.tenantId, s.gscPageDaily.siteId, s.gscPageDaily.date,
                   s.gscPageDaily.page, s.gscPageDaily.dataState],
          set: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, syncRunId },
        }).run()
      }
    },

    upsertQueryDaily: (siteId: string, syncRunId: string, rows: readonly QueryDailyInput[]) => {
      for (const r of rows) {
        db.insert(s.gscQueryDaily).values({
          id: newId(), tenantId: t, siteId, date: r.date, sourceTimezone: GSC_SOURCE_TIMEZONE,
          query: r.query, clicks: r.clicks, impressions: r.impressions,
          ctr: r.ctr, position: r.position, dataState: 'final', syncRunId,
        }).onConflictDoUpdate({
          target: [s.gscQueryDaily.tenantId, s.gscQueryDaily.siteId, s.gscQueryDaily.date,
                   s.gscQueryDaily.query, s.gscQueryDaily.dataState],
          set: { clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position, syncRunId },
        }).run()
      }
    },

    upsertReconciliation: (siteId: string, r: ReconciliationInput) => {
      const values = {
        id: newId(), tenantId: t, siteId, date: r.date,
        totalClicks: r.totalClicks, querySumClicks: r.querySumClicks,
        anonymizedDeltaClicks: r.totalClicks - r.querySumClicks,
        totalImpressions: r.totalImpressions, querySumImpressions: r.querySumImpressions,
        anonymizedDeltaImpressions: r.totalImpressions - r.querySumImpressions,
        checkedAt: Date.now(),
      }
      db.insert(s.gscReconciliation).values(values).onConflictDoUpdate({
        target: [s.gscReconciliation.tenantId, s.gscReconciliation.siteId, s.gscReconciliation.date],
        set: values,
      }).run()
    },

    recordProviderCall: (c: ProviderCallInput) => {
      db.insert(s.providerCall).values({
        id: newId(), tenantId: t, providerId: c.providerId, capability: c.capability,
        startedAt: c.startedAt, durationMs: c.durationMs, ok: c.ok ? 1 : 0,
        httpStatus: c.httpStatus ?? null, errorCode: c.errorCode ?? null,
        quotaUnits: c.quotaUnits, costMicros: c.costMicros, requestFingerprint: c.requestFingerprint,
      }).run()
    },
  }

  return { read, write }
}

export type Repos = ReturnType<typeof repos>
