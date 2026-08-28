import { EMPTY_ROBOTS, parseRobotsTxt, type RobotsRules } from '@seo/crawler'
import type { SiteFetchOptions, SiteFetchProvider } from './types.js'

export type RobotsState = 'ok' | 'missing' | 'unreachable'

export interface RobotsFetchResult {
  readonly state: RobotsState
  readonly rules: RobotsRules
  readonly sitemaps: readonly string[]
  readonly url: string
}

/**
 * Pobiera i interpretuje `robots.txt` (D14).
 *
 * Rozroznienie, ktore tu zapada, jest calym sednem: **404 znaczy zgode**
 * (tak stanowi RFC 9309), a **5xx, timeout i blad sieci znacza zakaz**.
 * Odwrotna wartosc domyslna naraza cudzy serwer dokladnie w chwili, w ktorej
 * ma klopot — i tak wlasnie wyglada atak, nie audyt.
 */
export async function fetchRobots(
  provider: SiteFetchProvider,
  siteUrl: string,
  options: SiteFetchOptions,
): Promise<RobotsFetchResult> {
  const url = new URL('/robots.txt', siteUrl).toString()
  const response = await provider.fetchText(url, 'crawl:robots', options)

  if (response.status === null) {
    return { state: 'unreachable', rules: EMPTY_ROBOTS, sitemaps: [], url }
  }
  if (response.status >= 500) {
    return { state: 'unreachable', rules: EMPTY_ROBOTS, sitemaps: [], url }
  }
  if (response.status === 404 || response.status === 410) {
    return { state: 'missing', rules: EMPTY_ROBOTS, sitemaps: [], url }
  }
  if (response.status >= 400 || response.body === null) {
    // 401/403 na robots.txt znaczy, ze wlasciciel zamknal plik. Nie zgadujemy.
    return { state: 'unreachable', rules: EMPTY_ROBOTS, sitemaps: [], url }
  }

  const rules = parseRobotsTxt(response.body)
  return { state: 'ok', rules, sitemaps: rules.sitemaps, url }
}
