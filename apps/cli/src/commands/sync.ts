import { type TenantScope, computeReconciliation } from '@seo/core'
import { type Db, repos } from '@seo/db'
import type { PerformanceDimension, PerformanceRow, SiteMetricsProvider } from '@seo/providers'

export interface SyncDeps {
  readonly db: Db
  readonly scope: TenantScope
  readonly provider: SiteMetricsProvider
}

export interface SyncOptions {
  readonly siteUrl: string
  readonly from: string
  readonly to: string
  readonly pageSize: number
}

export interface SyncResult {
  readonly siteId: string
  readonly dailyRows: number
  readonly queryRows: number
  /** Wiersze per strona — wejscie do pomiaru roznica w roznicach (Faza 4). */
  readonly pageRows: number
  readonly reconciledDays: number
}

/** Paginuje po startRow az strona bedzie krotsza niz pageSize. */
async function fetchAllPages(
  provider: SiteMetricsProvider,
  options: SyncOptions,
  dimensions: readonly PerformanceDimension[],
): Promise<PerformanceRow[]> {
  const collected: PerformanceRow[] = []
  let startRow = 0
  for (;;) {
    const page = await provider.queryPerformance({
      siteUrl: options.siteUrl,
      startDate: options.from,
      endDate: options.to,
      dimensions,
      dataState: 'final',
      rowLimit: options.pageSize,
      startRow,
    })
    collected.push(...page.rows)
    if (page.rows.length < options.pageSize) return collected
    startRow += page.rows.length
  }
}

export async function runSync(deps: SyncDeps, options: SyncOptions): Promise<SyncResult> {
  const { write } = repos(deps.db, deps.scope)
  const propertyType = options.siteUrl.startsWith('sc-domain:') ? 'domain' : 'url_prefix'
  const site = write.upsertSite(propertyType, options.siteUrl)
  const runId = write.startSyncRun(
    site.id, options.from, options.to, 'final', 'date;date,query;date,page',
  )

  try {
    const dateRows = await fetchAllPages(deps.provider, options, ['date'])
    const queryRows = await fetchAllPages(deps.provider, options, ['date', 'query'])
    // Wymiar `page` doszedl w Fazie 4: roznica w roznicach porownuje strony
    // zmienione z kontrolnymi, wiec potrzebuje metryk dla pojedynczego adresu.
    const pageRows = await fetchAllPages(deps.provider, options, ['date', 'page'])

    /**
     * Wiersz o innej liczbie kluczy, niz zamowilismy, jest **pomijany z nazwa
     * wymiaru w bledzie**, a nie wstawiany z `undefined`. Wczesniej `keys[1]!`
     * przepuszczal taki wiersz do bazy i konczylo sie surowym bledem SQLite,
     * ktory nie mowil ani ktory wymiar, ani ktora odpowiedz zawinila.
     */
    const klucz = (r: PerformanceRow, i: number, wymiar: string): string => {
      const wartosc = r.keys[i]
      if (typeof wartosc !== 'string') {
        throw new Error(
          `Search Console zwrocilo wiersz bez klucza "${wymiar}" `
          + `(otrzymano ${r.keys.length} kluczy: ${JSON.stringify(r.keys)})`,
        )
      }
      return wartosc
    }

    // keys[0] to data — przepisywana doslownie, bez parsowania (D3, AC5).
    const daily = dateRows.map((r) => ({
      date: klucz(r, 0, 'date'),
      clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
    }))
    const byQuery = queryRows.map((r) => ({
      date: klucz(r, 0, 'date'), query: klucz(r, 1, 'query'), clicks: r.clicks,
      impressions: r.impressions, ctr: r.ctr, position: r.position,
    }))

    const byPage = pageRows.map((r) => ({
      date: klucz(r, 0, 'date'), page: klucz(r, 1, 'page'), clicks: r.clicks,
      impressions: r.impressions, ctr: r.ctr, position: r.position,
    }))

    write.upsertDaily(site.id, runId, daily)
    write.upsertQueryDaily(site.id, runId, byQuery)
    write.upsertPageDaily(site.id, runId, byPage)

    const reconciliation = computeReconciliation(daily, byQuery)
    for (const row of reconciliation) write.upsertReconciliation(site.id, row)

    write.finishSyncRun(runId, daily.length + byQuery.length + byPage.length, true)

    return {
      siteId: site.id,
      dailyRows: daily.length,
      queryRows: byQuery.length,
      pageRows: byPage.length,
      reconciledDays: reconciliation.length,
    }
  } catch (error) {
    write.finishSyncRun(runId, 0, false, error instanceof Error ? error.message : String(error))
    throw error
  }
}
