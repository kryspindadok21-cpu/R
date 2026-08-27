import type { TenantScope } from '@seo/core'
import { type Db, repos } from '@seo/db'

export interface VerifyResult {
  readonly date: string
  readonly clicksInDatabase: number
  readonly impressionsInDatabase: number
  readonly querySumClicks: number
  readonly anonymizedDeltaClicks: number
}

/**
 * Drukuje liczby do recznego porownania z interfejsem Search Console.
 * Kryterium AC3: clicksInDatabase musi zgadzac sie co do jednego kliknięcia
 * dla dnia starszego niz GSC_FRESHNESS_LAG_DAYS.
 */
export function runVerify(db: Db, scope: TenantScope, siteUrl: string, date: string): VerifyResult {
  const { read } = repos(db, scope)
  const site = read.findSiteByUri(siteUrl)
  if (!site) throw new Error(`Brak strony ${siteUrl} w bazie. Uruchom najpierw: seo gsc sync --site ${siteUrl}`)

  const daily = read.listDailyRange(site.id, date, date)[0]
  if (!daily) throw new Error(`Brak danych dziennych dla ${date}. Czy zakres synchronizacji obejmowal ten dzien?`)

  const reconciliation = read.getReconciliation(site.id, date)
  return {
    date,
    clicksInDatabase: daily.clicks,
    impressionsInDatabase: daily.impressions,
    querySumClicks: reconciliation?.querySumClicks ?? 0,
    anonymizedDeltaClicks: reconciliation?.anonymizedDeltaClicks ?? daily.clicks,
  }
}
