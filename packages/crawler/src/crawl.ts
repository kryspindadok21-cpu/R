import { type PageFacts, parsePage } from '@seo/parse'
import { createFrontier } from './frontier.js'
import type { CrawlLimits } from './limits.js'
import { USER_AGENT } from './limits.js'
import { crawlDelayFor, isAllowed, pathWithQuery, type RobotsRules } from './robots.js'

/**
 * Przebieg crawla. Czysta orkiestracja (D12): zrodlo stron i zegar sa
 * wstrzykiwane, wiec caly ten plik da sie przetestowac bez sieci i bez czekania.
 */

export interface FetchOptions {
  readonly timeoutMs: number
  readonly maxBytes: number
  readonly maxRedirects: number
  readonly userAgent: string
}

export interface FetchedPage {
  /** Adres koncowy, po przekierowaniach. */
  readonly url: string
  readonly requestedUrl: string
  /** `null`, gdy pobranie w ogole sie nie udalo. */
  readonly status: number | null
  readonly contentType: string | null
  readonly body: string | null
  readonly bytes: number
  readonly durationMs: number
  /** Adresy posrednie, bez koncowego. */
  readonly redirectChain: readonly string[]
  readonly error: string | null
}

export interface PageSource {
  fetchPage(url: string, options: FetchOptions): Promise<FetchedPage>
}

/** Zegar wstrzykiwany — test mierzy odstepy bez faktycznego czekania (AC4). */
export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export type RobotsState = 'ok' | 'missing' | 'unreachable'

export interface CrawlOptions {
  readonly siteUrl: string
  readonly pageSource: PageSource
  readonly clock: Clock
  readonly limits: CrawlLimits
  readonly robots: RobotsRules
  readonly robotsState: RobotsState
  readonly userAgent?: string
  /** Adresy z mapy witryny — trafiaja do kolejki na glebokosci 0. */
  readonly sitemapUrls?: readonly string[]
}

export interface CrawledPage {
  readonly url: string
  readonly requestedUrl: string
  readonly depth: number
  readonly status: number | null
  readonly contentType: string | null
  readonly bytes: number
  readonly durationMs: number
  readonly redirectChain: readonly string[]
  readonly error: string | null
  readonly facts: PageFacts | null
  readonly inSitemap: boolean
}

export interface LinkEdge {
  readonly fromUrl: string
  readonly toUrl: string
  readonly rel: string
  readonly anchorText: string
  readonly isInternal: boolean
}

export type TruncationReason = 'max-pages' | 'time-budget' | null

export interface CrawlResult {
  readonly pages: readonly CrawledPage[]
  readonly links: readonly LinkEdge[]
  readonly blockedByRobots: readonly string[]
  /** Adresy na tym samym hoscie, ale poza katalogiem property — nie nasze. */
  readonly outOfScope: readonly string[]
  /** `true`, gdy crawl uciel limit — wtedy reguly serwisowe milkna (D17). */
  readonly truncated: boolean
  readonly truncationReason: TruncationReason
  readonly robotsState: RobotsState
  readonly requests: number
  readonly startedAt: number
  readonly finishedAt: number
  readonly userAgent: string
}

function isHtml(contentType: string | null): boolean {
  if (contentType === null) return false
  const lower = contentType.toLowerCase()
  return lower.includes('text/html') || lower.includes('application/xhtml+xml')
}

/**
 * Zakres crawla: ten sam host **i** ta sama sciezka bazowa co adres property.
 *
 * Sam host nie wystarczy. Darmowa poddomena (`uzytkownik.github.io/moj-projekt/`,
 * `konto.pages.dev`) to host wspoldzielony — obok naszych stron stoja cudze.
 * Crawler, ktory chodzi po calym hoscie, audytuje cudza strone i puka do niej
 * bez pytania. To samo dotyczy property typu „prefiks adresu" w Search Console:
 * wlasciciel potwierdzil wlasnosc katalogu, nie calej domeny.
 */
export function isInScope(url: string, siteUrl: string): boolean {
  try {
    const target = new URL(url)
    const base = new URL(siteUrl)
    if (target.host !== base.host) return false

    const prefix = base.pathname.replace(/\/+$/, '')
    if (prefix === '') return true
    // Granica na segmencie sciezki: `/projekt` obejmuje `/projekt/a`,
    // ale nie `/projekt-innego-czlowieka`.
    return target.pathname === prefix || target.pathname.startsWith(`${prefix}/`)
  } catch {
    return false
  }
}

/**
 * Odstep miedzy zadaniami: wieksza z dwoch wartosci — naszej i tej, o ktora
 * poprosil wlasciciel serwera w `robots.txt`. Nigdy mniejsza. Prosba o wolniej
 * jest wiazaca, prosba o szybciej nie istnieje.
 */
export function effectiveDelayMs(
  limits: CrawlLimits,
  robots: RobotsRules,
  userAgent: string,
): number {
  const fromRobots = crawlDelayFor(robots, userAgent)
  return fromRobots === null ? limits.delayMs : Math.max(limits.delayMs, fromRobots * 1000)
}

export async function runCrawl(options: CrawlOptions): Promise<CrawlResult> {
  const {
    siteUrl, pageSource, clock, limits, robots, robotsState,
    userAgent = USER_AGENT, sitemapUrls = [],
  } = options

  const startedAt = clock.now()

  // Nieosiagalny robots.txt = zakaz crawlowania (D14). Odwrotna wartosc domyslna
  // narazalaby cudzy serwer w dokladnie tej sytuacji, w ktorej ma klopot.
  if (robotsState === 'unreachable') {
    return {
      pages: [], links: [], blockedByRobots: [], outOfScope: [],
      truncated: false, truncationReason: null,
      robotsState, requests: 0, startedAt, finishedAt: startedAt, userAgent,
    }
  }

  const frontier = createFrontier(limits.maxDepth)
  frontier.add(siteUrl, 0)
  const sitemapSet = new Set<string>()
  const outOfScopeSeen = new Set<string>()
  for (const url of sitemapUrls) {
    if (!isInScope(url, siteUrl)) { outOfScopeSeen.add(url); continue }
    sitemapSet.add(url)
    frontier.add(url, 0)
  }

  const pages: CrawledPage[] = []
  const links: LinkEdge[] = []
  const blockedByRobots: string[] = []
  const delayMs = effectiveDelayMs(limits, robots, userAgent)
  const fetchOptions: FetchOptions = {
    timeoutMs: limits.requestTimeoutMs,
    maxBytes: limits.maxResponseBytes,
    maxRedirects: limits.maxRedirectHops,
    userAgent,
  }

  let requests = 0
  let lastRequestAt: number | null = null
  let truncationReason: TruncationReason = null

  for (;;) {
    if (pages.length >= limits.maxPages) { truncationReason = 'max-pages'; break }
    if (clock.now() - startedAt >= limits.totalBudgetMs) { truncationReason = 'time-budget'; break }

    const item = frontier.next()
    if (item === undefined) break

    if (!isAllowed(robots, userAgent, pathWithQuery(item.url))) {
      blockedByRobots.push(item.url)
      continue
    }

    if (lastRequestAt !== null) {
      const waited = clock.now() - lastRequestAt
      if (waited < delayMs) await clock.sleep(delayMs - waited)
    }

    lastRequestAt = clock.now()
    requests += 1
    const fetched = await pageSource.fetchPage(item.url, fetchOptions)

    const facts = fetched.body !== null && isHtml(fetched.contentType)
      ? parsePage(fetched.body, { url: fetched.url })
      : null

    pages.push({
      url: fetched.url,
      requestedUrl: fetched.requestedUrl,
      depth: item.depth,
      status: fetched.status,
      contentType: fetched.contentType,
      bytes: fetched.bytes,
      durationMs: fetched.durationMs,
      redirectChain: fetched.redirectChain,
      error: fetched.error,
      facts,
      inSitemap: sitemapSet.has(item.url) || sitemapSet.has(fetched.url),
    })

    if (facts === null) continue

    for (const link of facts.links) {
      if (link.resolved === null) continue
      links.push({
        fromUrl: fetched.url,
        toUrl: link.resolved,
        rel: link.rel,
        anchorText: link.anchorText,
        isInternal: link.isInternal,
      })
      if (!link.isInternal) continue
      // Ten sam host, ale cudzy katalog — zapisujemy fakt i zostawiamy w spokoju.
      if (!isInScope(link.resolved, siteUrl)) { outOfScopeSeen.add(link.resolved); continue }
      // Za linkiem idziemy tylko wtedy, gdy strona pozwala isc dalej.
      if (!facts.metaRobots.nofollow && link.rel === 'follow') {
        frontier.add(link.resolved, item.depth + 1)
      }
    }
  }

  return {
    pages,
    links,
    blockedByRobots,
    outOfScope: [...outOfScopeSeen].sort(),
    truncated: truncationReason !== null || frontier.pending > 0,
    truncationReason,
    robotsState,
    requests,
    startedAt,
    finishedAt: clock.now(),
    userAgent,
  }
}
