import { NORMALIZER_VERSION, newId, normalizeUrl, type TenantScope } from '@seo/core'
import { parsePageFactsJson, parseRenderDiffJson, type PageFacts, type RenderDiff } from '@seo/parse'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from './connection.js'
import * as s from './schema.js'

/**
 * Repozytoria Fazy 1. Ta sama zasada, co w Fazie 0: wszystko przez `TenantScope`,
 * zero dostepu do surowego uchwytu (D5).
 *
 * Tozsamosc strony to `url_hash` z `normalizeUrl` (D19) — crawler nie ma wlasnego
 * pojecia „strona", zeby graf linkow, dane z Search Console i przyszle cytowania
 * AI mowily o tej samej rzeczy.
 */

export interface CrawlRunInput {
  readonly maxPages: number
  readonly maxDepth: number
  readonly delayMs: number
  readonly renderSample: number
  readonly robotsState: 'ok' | 'missing' | 'unreachable'
  readonly userAgent: string
  readonly sitemapUrls: readonly string[]
}

export interface CrawlRunFinish {
  readonly pagesFetched: number
  readonly pagesFailed: number
  readonly ok: boolean
  readonly error?: string | undefined
  readonly truncated: boolean
  readonly truncationReason?: string | undefined
}

export interface CrawlPageInput {
  readonly url: string
  readonly depth: number
  readonly httpStatus: number | null
  readonly contentType: string | null
  readonly bytes: number
  readonly durationMs: number
  readonly redirectChain: readonly string[]
  readonly fetchError: string | null
  readonly facts: PageFacts | null
  readonly renderDiff: RenderDiff | null
  readonly inSitemap: boolean
}

export interface PageLinkInput {
  readonly fromUrl: string
  readonly toUrl: string
  readonly rel: 'follow' | 'nofollow' | 'sponsored' | 'ugc'
  readonly anchorText: string
  readonly isInternal: boolean
}

export interface FindingInput {
  readonly ruleId: string
  readonly severity: 'blocker' | 'high' | 'medium' | 'low' | 'info'
  readonly category: string
  readonly url: string | null
  readonly title: string
  readonly evidence: Readonly<Record<string, string | number | boolean>>
  readonly autofix?: unknown
}

export interface SkippedRuleInput {
  readonly ruleId: string
  readonly missing: readonly string[]
}

export interface PsiMeasurementInput {
  readonly url: string
  readonly strategy: 'mobile' | 'desktop'
  readonly measuredAt: number
  readonly lcpMs: number | null
  readonly inpMs: number | null
  readonly cls: number | null
  readonly ttfbMs: number | null
  readonly performanceScore: number | null
  readonly source: 'lab' | 'field'
}

/** Powod, dla ktorego strona nie moze trafic do indeksu — albo `null`, gdy moze. */
export function noindexReasonOf(page: CrawlPageInput): string | null {
  if (page.httpStatus === null) return 'brak odpowiedzi'
  if (page.httpStatus >= 400) return `status ${page.httpStatus}`
  if (page.facts === null) return 'odpowiedź nie jest HTML-em'
  if (page.facts.metaRobots.noindex) return 'meta robots: noindex'
  return null
}

export function crawlRepos(db: Db, scope: TenantScope) {
  const t = scope.tenantId
  // Pamiec podreczna adres → id w obrebie jednej instancji repozytoriow.
  // Crawl 500 stron to kilka tysiecy linkow do tych samych adresow.
  const urlIds = new Map<string, string>()

  function upsertUrl(siteId: string, raw: string): string {
    const normalized = normalizeUrl(raw)
    const cacheKey = `${siteId}|${normalized.hash}`
    const cached = urlIds.get(cacheKey)
    if (cached !== undefined) return cached

    const existing = db.select({ id: s.url.id }).from(s.url)
      .where(and(
        eq(s.url.tenantId, t),
        eq(s.url.urlHash, normalized.hash),
        eq(s.url.normalizerVersion, normalized.normalizerVersion),
      )).get()

    if (existing) {
      urlIds.set(cacheKey, existing.id)
      return existing.id
    }

    const id = newId()
    db.insert(s.url).values({
      id, tenantId: t, siteId,
      urlRaw: normalized.raw,
      urlNormalized: normalized.normalized,
      urlHash: normalized.hash,
      normalizerVersion: NORMALIZER_VERSION,
      firstSeenAt: Date.now(),
    }).run()
    urlIds.set(cacheKey, id)
    return id
  }

  const read = {
    latestCrawlRun: (siteId: string) =>
      db.select().from(s.crawlRun)
        .where(and(eq(s.crawlRun.tenantId, t), eq(s.crawlRun.siteId, siteId)))
        .orderBy(desc(s.crawlRun.startedAt)).limit(1).get(),

    getCrawlRun: (runId: string) =>
      db.select().from(s.crawlRun)
        .where(and(eq(s.crawlRun.tenantId, t), eq(s.crawlRun.id, runId))).get(),

    listCrawlRuns: (siteId: string, limit: number) =>
      db.select().from(s.crawlRun)
        .where(and(eq(s.crawlRun.tenantId, t), eq(s.crawlRun.siteId, siteId)))
        .orderBy(desc(s.crawlRun.startedAt)).limit(limit).all(),

    listCrawlPages: (runId: string) =>
      db.select({
        id: s.crawlPage.id,
        url: s.url.urlRaw,
        urlId: s.crawlPage.urlId,
        depth: s.crawlPage.depth,
        httpStatus: s.crawlPage.httpStatus,
        contentType: s.crawlPage.contentType,
        bytes: s.crawlPage.bytes,
        durationMs: s.crawlPage.durationMs,
        redirectChain: s.crawlPage.redirectChain,
        fetchError: s.crawlPage.fetchError,
        title: s.crawlPage.title,
        metaDescription: s.crawlPage.metaDescription,
        h1Count: s.crawlPage.h1Count,
        wordCount: s.crawlPage.wordCount,
        indexable: s.crawlPage.indexable,
        noindexReason: s.crawlPage.noindexReason,
        canonicalUrl: s.crawlPage.canonicalUrl,
        inSitemap: s.crawlPage.inSitemap,
        facts: s.crawlPage.facts,
        renderDiff: s.crawlPage.renderDiff,
      }).from(s.crawlPage)
        .innerJoin(s.url, eq(s.url.id, s.crawlPage.urlId))
        .where(and(eq(s.crawlPage.tenantId, t), eq(s.crawlPage.crawlRunId, runId)))
        .orderBy(asc(s.crawlPage.depth), asc(s.url.urlNormalized)).all(),

    listPageLinks: (runId: string) =>
      db.select({
        id: s.pageLink.id,
        fromUrl: s.url.urlRaw,
        fromUrlId: s.pageLink.fromUrlId,
        toUrlId: s.pageLink.toUrlId,
        toUrl: s.pageLink.toUrl,
        rel: s.pageLink.rel,
        anchorText: s.pageLink.anchorText,
        isInternal: s.pageLink.isInternal,
      }).from(s.pageLink)
        .innerJoin(s.url, eq(s.url.id, s.pageLink.fromUrlId))
        .where(and(eq(s.pageLink.tenantId, t), eq(s.pageLink.crawlRunId, runId)))
        .orderBy(asc(s.pageLink.id)).all(),

    listFindings: (runId: string) =>
      db.select().from(s.auditFinding)
        .where(and(eq(s.auditFinding.tenantId, t), eq(s.auditFinding.crawlRunId, runId)))
        .orderBy(asc(s.auditFinding.severity), asc(s.auditFinding.ruleId)).all(),

    findingCountsBySeverity: (runId: string) =>
      db.select({
        severity: s.auditFinding.severity,
        count: sql<number>`count(*)`.as('count'),
      }).from(s.auditFinding)
        .where(and(eq(s.auditFinding.tenantId, t), eq(s.auditFinding.crawlRunId, runId)))
        .groupBy(s.auditFinding.severity).all(),

    topFindingRules: (runId: string, limit: number) =>
      db.select({
        ruleId: s.auditFinding.ruleId,
        severity: s.auditFinding.severity,
        title: s.auditFinding.title,
        count: sql<number>`count(*)`.as('count'),
      }).from(s.auditFinding)
        .where(and(eq(s.auditFinding.tenantId, t), eq(s.auditFinding.crawlRunId, runId)))
        .groupBy(s.auditFinding.ruleId, s.auditFinding.severity, s.auditFinding.title)
        .orderBy(desc(sql`count(*)`)).limit(limit).all(),

    listSkippedRules: (runId: string) =>
      db.select().from(s.auditSkippedRule)
        .where(and(eq(s.auditSkippedRule.tenantId, t), eq(s.auditSkippedRule.crawlRunId, runId)))
        .orderBy(asc(s.auditSkippedRule.ruleId)).all(),

    /** Adresy z crawla, do ktorych nie prowadzi zaden link wewnetrzny. */
    orphanPages: (runId: string) =>
      db.select({ url: s.url.urlRaw, urlId: s.crawlPage.urlId })
        .from(s.crawlPage)
        .innerJoin(s.url, eq(s.url.id, s.crawlPage.urlId))
        .leftJoin(s.pageLink, and(
          eq(s.pageLink.tenantId, t),
          eq(s.pageLink.crawlRunId, runId),
          eq(s.pageLink.toUrlId, s.crawlPage.urlId),
          eq(s.pageLink.isInternal, 1),
        ))
        .where(and(
          eq(s.crawlPage.tenantId, t),
          eq(s.crawlPage.crawlRunId, runId),
          isNull(s.pageLink.id),
        ))
        .orderBy(asc(s.url.urlNormalized)).all(),

    listPsiMeasurements: (siteId: string, fromMs: number, toMs: number) =>
      db.select({
        url: s.url.urlRaw,
        strategy: s.psiMeasurement.strategy,
        measuredAt: s.psiMeasurement.measuredAt,
        lcpMs: s.psiMeasurement.lcpMs,
        inpMs: s.psiMeasurement.inpMs,
        cls: s.psiMeasurement.cls,
        ttfbMs: s.psiMeasurement.ttfbMs,
        performanceScore: s.psiMeasurement.performanceScore,
        source: s.psiMeasurement.source,
      }).from(s.psiMeasurement)
        .innerJoin(s.url, eq(s.url.id, s.psiMeasurement.urlId))
        .where(and(
          eq(s.psiMeasurement.tenantId, t),
          eq(s.psiMeasurement.siteId, siteId),
          sql`${s.psiMeasurement.measuredAt} >= ${fromMs}`,
          sql`${s.psiMeasurement.measuredAt} <= ${toMs}`,
        ))
        .orderBy(desc(s.psiMeasurement.measuredAt)).all(),
  }

  const write = {
    startCrawlRun: (siteId: string, input: CrawlRunInput): string => {
      const id = newId()
      db.insert(s.crawlRun).values({
        id, tenantId: t, siteId, startedAt: Date.now(),
        pagesFetched: 0, pagesFailed: 0,
        maxPages: input.maxPages, maxDepth: input.maxDepth, delayMs: input.delayMs,
        renderSample: input.renderSample, robotsState: input.robotsState,
        truncated: 0, userAgent: input.userAgent,
        sitemapUrls: JSON.stringify(input.sitemapUrls),
      }).run()
      return id
    },

    finishCrawlRun: (runId: string, finish: CrawlRunFinish): void => {
      db.update(s.crawlRun).set({
        finishedAt: Date.now(),
        pagesFetched: finish.pagesFetched,
        pagesFailed: finish.pagesFailed,
        ok: finish.ok ? 1 : 0,
        error: finish.error ?? null,
        truncated: finish.truncated ? 1 : 0,
        truncationReason: finish.truncationReason ?? null,
      }).where(and(eq(s.crawlRun.tenantId, t), eq(s.crawlRun.id, runId))).run()
    },

    insertCrawlPages: (siteId: string, runId: string, pages: readonly CrawlPageInput[]): void => {
      for (const page of pages) {
        const urlId = upsertUrl(siteId, page.url)
        const reason = noindexReasonOf(page)
        db.insert(s.crawlPage).values({
          id: newId(), tenantId: t, siteId, crawlRunId: runId, urlId,
          depth: page.depth,
          httpStatus: page.httpStatus,
          contentType: page.contentType,
          bytes: page.bytes,
          durationMs: page.durationMs,
          fetchedAt: Date.now(),
          redirectChain: JSON.stringify(page.redirectChain),
          fetchError: page.fetchError,
          title: page.facts?.title ?? null,
          metaDescription: page.facts?.metaDescription ?? null,
          h1Count: page.facts?.h1Count ?? 0,
          wordCount: page.facts?.wordCount ?? 0,
          indexable: reason === null ? 1 : 0,
          noindexReason: reason,
          canonicalUrl: page.facts?.canonicalResolved ?? null,
          inSitemap: page.inSitemap ? 1 : 0,
          facts: page.facts === null ? null : JSON.stringify(page.facts),
          rendered: page.renderDiff === null ? 0 : 1,
          renderDiff: page.renderDiff === null ? null : JSON.stringify(page.renderDiff),
        }).onConflictDoNothing().run()
      }
    },

    insertPageLinks: (siteId: string, runId: string, links: readonly PageLinkInput[]): void => {
      for (const link of links) {
        // Adres zewnetrzny nie dostaje wiersza `url` — nie zakladamy tozsamosci
        // dla cudzej domeny, bo nie my nia zarzadzamy.
        const toUrlId = link.isInternal ? upsertUrl(siteId, link.toUrl) : null
        db.insert(s.pageLink).values({
          id: newId(), tenantId: t, crawlRunId: runId,
          fromUrlId: upsertUrl(siteId, link.fromUrl),
          toUrlId,
          toUrl: link.toUrl,
          rel: link.rel,
          anchorText: link.anchorText,
          isInternal: link.isInternal ? 1 : 0,
        }).run()
      }
    },

    insertFindings: (siteId: string, runId: string, findings: readonly FindingInput[]): void => {
      for (const f of findings) {
        db.insert(s.auditFinding).values({
          id: newId(), tenantId: t, siteId, crawlRunId: runId,
          ruleId: f.ruleId, severity: f.severity, category: f.category,
          urlId: f.url === null ? null : upsertUrl(siteId, f.url),
          url: f.url,
          title: f.title,
          evidence: JSON.stringify(f.evidence),
          autofix: f.autofix === undefined ? null : JSON.stringify(f.autofix),
          createdAt: Date.now(),
        }).run()
      }
    },

    insertSkippedRules: (runId: string, skipped: readonly SkippedRuleInput[]): void => {
      for (const entry of skipped) {
        db.insert(s.auditSkippedRule).values({
          id: newId(), tenantId: t, crawlRunId: runId,
          ruleId: entry.ruleId, missing: JSON.stringify(entry.missing),
        }).onConflictDoNothing().run()
      }
    },

    /** Kasuje ustalenia poprzedniego audytu tego crawla — audyt jest powtarzalny. */
    clearAudit: (runId: string): void => {
      db.delete(s.auditFinding)
        .where(and(eq(s.auditFinding.tenantId, t), eq(s.auditFinding.crawlRunId, runId))).run()
      db.delete(s.auditSkippedRule)
        .where(and(eq(s.auditSkippedRule.tenantId, t), eq(s.auditSkippedRule.crawlRunId, runId))).run()
    },

    upsertPsiMeasurement: (siteId: string, m: PsiMeasurementInput): void => {
      db.insert(s.psiMeasurement).values({
        id: newId(), tenantId: t, siteId,
        urlId: upsertUrl(siteId, m.url),
        strategy: m.strategy, measuredAt: m.measuredAt,
        lcpMs: m.lcpMs, inpMs: m.inpMs, cls: m.cls, ttfbMs: m.ttfbMs,
        performanceScore: m.performanceScore, source: m.source,
      }).onConflictDoNothing().run()
    },

    upsertUrl: (siteId: string, raw: string): string => upsertUrl(siteId, raw),
  }

  return { read, write }
}

export type CrawlRepos = ReturnType<typeof crawlRepos>

/** Odczyt kolumn JSON z walidacja (D1). Uszkodzony wiersz daje `null`, nie wyjatek. */
export function factsOf(row: { readonly facts: string | null }): PageFacts | null {
  return parsePageFactsJson(row.facts)
}

export function renderDiffOf(row: { readonly renderDiff: string | null }): RenderDiff | null {
  return parseRenderDiffJson(row.renderDiff)
}

/** Lista adresow z mapy witryny zapisana przy przebiegu crawla. */
export function sitemapUrlsOf(row: { readonly sitemapUrls: string }): string[] {
  return parseStringArray(row.sitemapUrls)
}

export function redirectChainOf(row: { readonly redirectChain: string }): string[] {
  return parseStringArray(row.redirectChain)
}

function parseStringArray(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}
