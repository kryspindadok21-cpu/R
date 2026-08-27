import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { TenantScope } from '@seo/core'
import { type Db, repos } from '@seo/db'
import { renderReport } from '@seo/report'

/** Ile hasel pokazac w tabeli. Raport ma byc czytelny, nie kompletny. */
const TOP_QUERY_LIMIT = 50

export interface ReportOptions {
  readonly siteUrl: string
  readonly from: string
  readonly to: string
  readonly outPath: string
  readonly generatedAt: string
}

export interface ReportResult {
  readonly outPath: string
  readonly days: number
  readonly queries: number
}

export function runReport(db: Db, scope: TenantScope, options: ReportOptions): ReportResult {
  const { read } = repos(db, scope)
  const site = read.findSiteByUri(options.siteUrl)
  if (!site) {
    throw new Error(
      `Brak strony ${options.siteUrl} w bazie. Uruchom najpierw: seo gsc sync --site ${options.siteUrl}`,
    )
  }

  const daily = read.listDailyRange(site.id, options.from, options.to)
  const topQueries = read.topQueries(site.id, options.from, options.to, TOP_QUERY_LIMIT)
  const reconciliation = read.listReconciliations(site.id, options.from, options.to)
  const providerCalls = read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)

  const html = renderReport({
    siteUri: site.propertyUri,
    generatedAt: options.generatedAt,
    daily: daily.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions })),
    topQueries: topQueries.map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions })),
    reconciliation,
    providerCalls,
  })

  mkdirSync(dirname(options.outPath), { recursive: true })
  writeFileSync(options.outPath, html, 'utf8')
  return { outPath: options.outPath, days: daily.length, queries: topQueries.length }
}
