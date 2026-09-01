import type { TenantScope } from '@seo/core'
import { buildLinkGraph, statsFor } from '@seo/crawler'
import {
  type Db, crawlRepos, factsOf, redirectChainOf, renderDiffOf, repos, sitemapUrlsOf,
} from '@seo/db'
import {
  ALL_RULES, DEFAULT_THRESHOLDS, type Capability, type PageInput, type Severity,
  auditSite,
} from '@seo/rules'
import { crawlStartUrl } from './crawl.js'

/**
 * `seo audit` — przepuszcza zapisany crawl przez reguly i zapisuje ustalenia.
 *
 * Audyt czyta wylacznie z bazy: nie dotyka sieci. Dzieki temu da sie go powtorzyc
 * po zmianie regul albo progow bez ponownego obciazania cudzego serwera.
 */

export interface AuditCommandOptions {
  readonly siteUrl: string
  /** Domyslnie ostatni przebieg crawla. */
  readonly runId?: string | undefined
}

export interface AuditCommandResult {
  readonly siteId: string
  readonly runId: string
  readonly pagesAudited: number
  readonly countsBySeverity: Readonly<Record<Severity, number>>
  readonly topRules: readonly { ruleId: string; title: string; severity: Severity; count: number }[]
  readonly skipped: readonly { ruleId: string; missing: readonly string[] }[]
  readonly capabilities: readonly Capability[]
  readonly totalFindings: number
}

export class NoCrawlError extends Error {
  constructor(siteUrl: string) {
    super(
      `Brak crawla dla ${siteUrl}. Uruchom najpierw: seo crawl --site ${siteUrl}`,
    )
    this.name = 'NoCrawlError'
  }
}

/**
 * Ustala, o czym reguly maja prawo sie wypowiadac (D17).
 *
 * Najwazniejsza linia to `complete-crawl`: przy crawlu urwanym limitem „strona
 * osierocona" i „zepsuty link wewnetrzny" znaczyloby „nie doszlismy", a nie
 * „jest zle". Taka regula musi zamilknac, a nie zgadywac.
 */
export function capabilitiesFor(input: {
  readonly truncated: boolean
  readonly hasRenderDiff: boolean
  readonly hasSitemap: boolean
}): Set<Capability> {
  const capabilities = new Set<Capability>(['page-facts', 'http-response', 'link-graph'])
  if (!input.truncated) capabilities.add('complete-crawl')
  if (input.hasRenderDiff) capabilities.add('render-diff')
  if (input.hasSitemap) capabilities.add('sitemap')
  return capabilities
}

export function runAudit(
  db: Db,
  scope: TenantScope,
  options: AuditCommandOptions,
): AuditCommandResult {
  const site = repos(db, scope).read.findSiteByUri(options.siteUrl)
  if (!site) throw new NoCrawlError(options.siteUrl)

  const crawlRepo = crawlRepos(db, scope)
  const run = options.runId === undefined
    ? crawlRepo.read.latestCrawlRun(site.id)
    : crawlRepo.read.getCrawlRun(options.runId)
  if (!run) throw new NoCrawlError(options.siteUrl)

  const pageRows = crawlRepo.read.listCrawlPages(run.id)
  const linkRows = crawlRepo.read.listPageLinks(run.id)
  const sitemapUrls = sitemapUrlsOf(run)
  const rootUrl = crawlStartUrl(site.propertyUri)

  const graph = buildLinkGraph({
    pageUrls: pageRows.map((p) => p.url),
    edges: linkRows.map((l) => ({
      fromUrl: l.fromUrl,
      toUrl: l.toUrl,
      rel: l.rel,
      anchorText: l.anchorText,
      isInternal: l.isInternal === 1,
    })),
    rootUrl,
  })

  const pages: PageInput[] = pageRows.map((row) => {
    const stats = statsFor(graph, row.url)
    return {
      url: row.url,
      depth: row.depth,
      http: {
        status: row.httpStatus,
        contentType: row.contentType,
        bytes: row.bytes,
        durationMs: row.durationMs,
        redirectChain: redirectChainOf(row),
        error: row.fetchError,
      },
      facts: factsOf(row),
      renderDiff: renderDiffOf(row),
      graph: stats === undefined
        ? null
        : { inDegree: stats.inDegree, outDegree: stats.outDegree, clickDepth: stats.clickDepth },
      inSitemap: row.inSitemap === 1,
    }
  })

  const capabilities = capabilitiesFor({
    truncated: run.truncated === 1,
    hasRenderDiff: pages.some((p) => p.renderDiff !== null),
    hasSitemap: sitemapUrls.length > 0,
  })

  const result = auditSite(
    {
      siteUrl: rootUrl,
      pages,
      sitemapUrls,
      // Adresy zablokowane przez robots.txt nie sa zapisywane jako strony,
      // wiec regula `robots.blocked-but-linked` dostaje pusta liste i milczy.
      robotsBlockedUrls: [],
      robotsState: run.robotsState,
    },
    { capabilities, thresholds: DEFAULT_THRESHOLDS },
    ALL_RULES,
  )

  // Audyt jest powtarzalny: poprzednie ustalenia tego crawla znikaja, zeby
  // powtorzenie po zmianie progow nie dublowalo wierszy.
  crawlRepo.write.clearAudit(run.id)
  crawlRepo.write.insertFindings(site.id, run.id, result.findings.map((f) => ({
    ruleId: f.ruleId,
    severity: f.severity,
    category: f.category,
    url: f.url,
    title: f.title,
    evidence: f.evidence,
    ...(f.autofix === undefined ? {} : { autofix: f.autofix }),
  })))
  crawlRepo.write.insertSkippedRules(run.id, result.skipped.map((entry) => ({
    ruleId: entry.ruleId,
    missing: entry.missing,
  })))

  return {
    siteId: site.id,
    runId: run.id,
    pagesAudited: result.pagesAudited,
    countsBySeverity: result.countsBySeverity,
    topRules: result.topRules.slice(0, 10),
    skipped: result.skipped,
    capabilities: [...capabilities],
    totalFindings: result.findings.length,
  }
}
