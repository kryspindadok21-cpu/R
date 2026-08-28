import type { TenantScope } from '@seo/core'
import {
  type Clock, type CrawlLimits, type LimitAdjustment, USER_AGENT,
  clampLimits, parseSitemap, runCrawl,
} from '@seo/crawler'
import { type Db, crawlRepos, repos } from '@seo/db'
import { type SiteFetchOptions, type SiteFetchProvider, fetchRobots } from '@seo/providers'

/**
 * `seo crawl` — sklejenie warstw. Cala logika decyzyjna siedzi w @seo/crawler,
 * cale wejscie/wyjscie w @seo/providers i @seo/db. Ten plik ma byc nudny.
 */

/** Ile map witryny pobieramy z indeksu. Wiecej to zwykle mapy generowane maszynowo. */
export const MAX_SITEMAPS = 10

export interface CrawlDeps {
  readonly db: Db
  readonly scope: TenantScope
  readonly provider: SiteFetchProvider
  readonly clock: Clock
}

export interface CrawlCommandOptions {
  readonly siteUrl: string
  readonly limits?: Partial<CrawlLimits> | undefined
  /** Sprawdza robots.txt i mapy, ale nie pobiera ani jednej strony. */
  readonly dryRun?: boolean | undefined
}

export interface CrawlCommandResult {
  readonly siteId: string
  readonly runId: string | null
  readonly startUrl: string
  readonly pagesFetched: number
  readonly pagesFailed: number
  readonly blockedByRobots: number
  readonly robotsState: 'ok' | 'missing' | 'unreachable'
  readonly sitemapUrls: readonly string[]
  readonly truncated: boolean
  readonly truncationReason: string | null
  readonly requests: number
  readonly durationMs: number
  readonly adjustments: readonly LimitAdjustment[]
  readonly limits: CrawlLimits
}

/**
 * Adres, od ktorego zaczyna crawl. Property z Search Console bywa zapisane jako
 * `sc-domain:example.com` — to nie jest adres, tylko identyfikator wlasnosci.
 */
export function crawlStartUrl(propertyUri: string): string {
  if (propertyUri.startsWith('sc-domain:')) {
    return `https://${propertyUri.slice('sc-domain:'.length)}/`
  }
  return propertyUri.endsWith('/') ? propertyUri : `${propertyUri}/`
}

function fetchOptionsFrom(limits: CrawlLimits): SiteFetchOptions {
  return {
    timeoutMs: limits.requestTimeoutMs,
    maxBytes: limits.maxResponseBytes,
    maxRedirects: limits.maxRedirectHops,
    userAgent: USER_AGENT,
  }
}

/**
 * Pobiera mapy witryny, rozwijajac indeksy o jeden poziom. Adresy sa **zrodlem
 * kandydatow, nie prawda** (D22) — kazdy i tak sprawdzamy pobraniem.
 */
async function collectSitemapUrls(
  provider: SiteFetchProvider,
  roots: readonly string[],
  options: SiteFetchOptions,
): Promise<string[]> {
  const collected = new Set<string>()
  const queue = [...roots].slice(0, MAX_SITEMAPS)
  let fetched = 0

  while (queue.length > 0 && fetched < MAX_SITEMAPS) {
    const url = queue.shift()
    if (url === undefined) continue
    fetched += 1

    const response = await provider.fetchText(url, 'crawl:sitemap', options)
    if (response.body === null || response.status === null || response.status >= 400) continue

    const parsed = parseSitemap(response.body)
    for (const entry of parsed.entries) {
      if (parsed.kind === 'sitemapindex') {
        if (fetched + queue.length < MAX_SITEMAPS) queue.push(entry.loc)
      } else {
        collected.add(entry.loc)
      }
    }
  }

  return [...collected]
}

export async function runCrawlCommand(
  deps: CrawlDeps,
  options: CrawlCommandOptions,
): Promise<CrawlCommandResult> {
  const { db, scope, provider, clock } = deps
  const { limits, adjustments } = clampLimits(options.limits ?? {})
  const fetchOptions = fetchOptionsFrom(limits)

  const propertyType = options.siteUrl.startsWith('sc-domain:') ? 'domain' : 'url_prefix'
  const site = repos(db, scope).write.upsertSite(propertyType, options.siteUrl)
  const startUrl = crawlStartUrl(options.siteUrl)

  const robots = await fetchRobots(provider, startUrl, fetchOptions)
  const sitemapRoots = robots.sitemaps.length > 0
    ? robots.sitemaps
    : [new URL('/sitemap.xml', startUrl).toString()]
  const sitemapUrls = await collectSitemapUrls(provider, sitemapRoots, fetchOptions)

  if (options.dryRun === true) {
    return {
      siteId: site.id, runId: null, startUrl,
      pagesFetched: 0, pagesFailed: 0, blockedByRobots: 0,
      robotsState: robots.state, sitemapUrls,
      truncated: false, truncationReason: null, requests: 0, durationMs: 0,
      adjustments, limits,
    }
  }

  const crawlRepo = crawlRepos(db, scope)
  const runId = crawlRepo.write.startCrawlRun(site.id, {
    maxPages: limits.maxPages,
    maxDepth: limits.maxDepth,
    delayMs: limits.delayMs,
    renderSample: 0,
    robotsState: robots.state,
    userAgent: USER_AGENT,
    sitemapUrls,
  })

  try {
    const result = await runCrawl({
      siteUrl: startUrl,
      pageSource: provider,
      clock,
      limits,
      robots: robots.rules,
      robotsState: robots.state,
      userAgent: USER_AGENT,
      sitemapUrls,
    })

    crawlRepo.write.insertCrawlPages(site.id, runId, result.pages.map((page) => ({
      url: page.url,
      depth: page.depth,
      httpStatus: page.status,
      contentType: page.contentType,
      bytes: page.bytes,
      durationMs: page.durationMs,
      redirectChain: page.redirectChain,
      fetchError: page.error,
      facts: page.facts,
      renderDiff: null,
      inSitemap: page.inSitemap,
    })))

    crawlRepo.write.insertPageLinks(site.id, runId, result.links.map((link) => ({
      fromUrl: link.fromUrl,
      toUrl: link.toUrl,
      rel: link.rel as 'follow' | 'nofollow' | 'sponsored' | 'ugc',
      anchorText: link.anchorText,
      isInternal: link.isInternal,
    })))

    const pagesFailed = result.pages.filter((p) => p.status === null).length
    crawlRepo.write.finishCrawlRun(runId, {
      pagesFetched: result.pages.length,
      pagesFailed,
      ok: true,
      truncated: result.truncated,
      truncationReason: result.truncationReason ?? undefined,
    })

    return {
      siteId: site.id,
      runId,
      startUrl,
      pagesFetched: result.pages.length,
      pagesFailed,
      blockedByRobots: result.blockedByRobots.length,
      robotsState: result.robotsState,
      sitemapUrls,
      truncated: result.truncated,
      truncationReason: result.truncationReason,
      requests: result.requests,
      durationMs: result.finishedAt - result.startedAt,
      adjustments,
      limits,
    }
  } catch (error) {
    // Przerwany crawl zostaje w bazie oznaczony jako nieudany. Wiersz bez `ok`
    // wygladalby jak przebieg w toku i mylil nastepna sesje.
    crawlRepo.write.finishCrawlRun(runId, {
      pagesFetched: 0,
      pagesFailed: 0,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      truncated: true,
    })
    throw error
  }
}

/** Zegar produkcyjny. W testach podmieniany na sterowany recznie (D12). */
export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) }),
}
