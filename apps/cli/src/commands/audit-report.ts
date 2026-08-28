import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { TenantScope } from '@seo/core'
import { buildLinkGraph, statsFor } from '@seo/crawler'
import { type Db, crawlRepos, redirectChainOf, repos } from '@seo/db'
import { type AuditReportData, type Severity, renderAuditReport } from '@seo/report'
import { NoCrawlError } from './audit.js'
import { crawlStartUrl } from './crawl.js'

/**
 * `seo report --audit` — raport techniczny z zapisanego crawla i audytu.
 * Kamien milowy Fazy 1: plik, w ktorym da sie wskazac palcem konkretny adres
 * i konkretna wade.
 */

/** Ile najglebszych stron pokazac. Raport ma byc czytelny, nie kompletny. */
const DEEPEST_LIMIT = 15

/** Ile ustalen wypisac. Powyzej tego raport przestaje byc do przeczytania. */
const FINDINGS_LIMIT = 500

export interface AuditReportOptions {
  readonly siteUrl: string
  readonly outPath: string
  readonly generatedAt: string
  readonly runId?: string | undefined
}

export interface AuditReportResult {
  readonly outPath: string
  readonly runId: string
  readonly findings: number
  readonly truncatedList: boolean
}

function formatMoment(ms: number): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms))
}

/** `null` w statusie znaczy, ze pobranie sie nie udalo — to inna informacja niz 5xx. */
function statusLabel(status: number | null): string {
  return status === null ? 'brak odpowiedzi' : String(status)
}

function parseEvidence(json: string): Record<string, string | number | boolean> {
  try {
    const parsed: unknown = JSON.parse(json)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string | number | boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        out[key] = value
      }
    }
    return out
  } catch {
    return {}
  }
}

function parseMissing(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function runAuditReport(
  db: Db,
  scope: TenantScope,
  options: AuditReportOptions,
): AuditReportResult {
  const site = repos(db, scope).read.findSiteByUri(options.siteUrl)
  if (!site) throw new NoCrawlError(options.siteUrl)

  const crawlRepo = crawlRepos(db, scope)
  const run = options.runId === undefined
    ? crawlRepo.read.latestCrawlRun(site.id)
    : crawlRepo.read.getCrawlRun(options.runId)
  if (!run) throw new NoCrawlError(options.siteUrl)

  const pages = crawlRepo.read.listCrawlPages(run.id)
  const links = crawlRepo.read.listPageLinks(run.id)
  const findings = crawlRepo.read.listFindings(run.id)
  const skipped = crawlRepo.read.listSkippedRules(run.id)

  const graph = buildLinkGraph({
    pageUrls: pages.map((p) => p.url),
    edges: links.map((l) => ({
      fromUrl: l.fromUrl, toUrl: l.toUrl, rel: l.rel,
      anchorText: l.anchorText, isInternal: l.isInternal === 1,
    })),
    rootUrl: crawlStartUrl(site.propertyUri),
  })

  const statusCounts = new Map<string, number>()
  for (const page of pages) {
    const label = statusLabel(page.httpStatus)
    statusCounts.set(label, (statusCounts.get(label) ?? 0) + 1)
  }

  const deepestPages = pages
    .map((page) => ({ url: page.url, clickDepth: statsFor(graph, page.url)?.clickDepth ?? null }))
    .filter((p): p is { url: string; clickDepth: number } => p.clickDepth !== null)
    .sort((a, b) => b.clickDepth - a.clickDepth || (a.url < b.url ? -1 : 1))
    .slice(0, DEEPEST_LIMIT)

  // Strona zapisana jest pod adresem koncowym; lancuch trzyma adresy posrednie.
  const redirects = pages
    .map((page) => ({ page, chain: redirectChainOf(page) }))
    .filter((entry) => entry.chain.length > 0)
    .map((entry) => ({
      from: entry.chain[0] ?? entry.page.url,
      to: entry.page.url,
      hops: entry.chain.length,
    }))
    .sort((a, b) => b.hops - a.hops || (a.from < b.from ? -1 : 1))

  const countsBySeverity: Record<Severity, number> = {
    blocker: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of findings) countsBySeverity[f.severity] += 1

  const data: AuditReportData = {
    siteUri: site.propertyUri,
    generatedAt: options.generatedAt,
    crawlStartedAt: formatMoment(run.startedAt),
    userAgent: run.userAgent,
    robotsState: run.robotsState,
    pagesCrawled: pages.length,
    pagesFailed: pages.filter((p) => p.httpStatus === null).length,
    truncated: run.truncated === 1,
    truncationReason: run.truncationReason,
    countsBySeverity,
    findings: findings.slice(0, FINDINGS_LIMIT).map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      url: f.url,
      title: f.title,
      evidence: parseEvidence(f.evidence),
    })),
    topRules: crawlRepo.read.topFindingRules(run.id, 10),
    statusCounts: [...statusCounts]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    orphans: graph.orphans,
    deepestPages,
    redirects,
    skipped: skipped.map((s) => ({ ruleId: s.ruleId, missing: parseMissing(s.missing) })),
  }

  const html = renderAuditReport(data)
  mkdirSync(dirname(options.outPath), { recursive: true })
  writeFileSync(options.outPath, html, 'utf8')

  return {
    outPath: options.outPath,
    runId: run.id,
    findings: findings.length,
    truncatedList: findings.length > FINDINGS_LIMIT,
  }
}
