import type { TenantScope } from '@seo/core'
import { buildLinkGraph, statsFor } from '@seo/crawler'
import { type Db, crawlRepos, repos } from '@seo/db'
import type { PsiProvider, PsiStrategy } from '@seo/providers'
import { NoCrawlError } from './audit.js'
import { crawlStartUrl } from './crawl.js'

/**
 * `seo psi` — pomiar wydajnosci na probce stron (D21).
 *
 * Domyslnie dziesiec stron. Powod nie jest estetyczny: PSI bez klucza ma limit
 * rzedu jednostek zapytan na minute i potrafi mielic kilkanascie sekund na
 * strone. Setka stron to godzina czekania i odmowa w polowie.
 */

export const DEFAULT_PSI_LIMIT = 10

export interface PsiCandidate {
  readonly url: string
  readonly depth: number
  readonly inDegree: number
}

/**
 * Strona glowna zawsze, potem wg liczby linkow przychodzacych. Strona, do ktorej
 * prowadzi najwiecej linkow wewnetrznych, jest ta, na ktorej wolne ladowanie
 * kosztuje najwiecej — i to wlasnie o niej chcemy wiedziec najpierw.
 */
export function pagesToMeasure(
  pages: readonly PsiCandidate[],
  limit: number,
): PsiCandidate[] {
  if (limit <= 0) return []
  const home = pages.filter((p) => p.depth === 0)
  const rest = pages
    .filter((p) => p.depth !== 0)
    .sort((a, b) => b.inDegree - a.inDegree || (a.url < b.url ? -1 : a.url > b.url ? 1 : 0))
  return [...home, ...rest].slice(0, limit)
}

export interface PsiCommandOptions {
  readonly siteUrl: string
  readonly limit?: number | undefined
  readonly strategy?: PsiStrategy | undefined
}

export interface PsiCommandResult {
  readonly siteId: string
  readonly measured: number
  readonly failed: number
  readonly strategy: PsiStrategy
  readonly slowest: readonly { url: string; lcpMs: number }[]
  /**
   * Powod ostatniego niepowodzenia. Bez tego uzytkownik widzi samo „nieudane: 2"
   * i musi szukac przyczyny w bazie — a to jest ta sama cisza, ktora w regulach
   * audytu nazywamy falszywym poczuciem porzadku.
   */
  readonly lastError: string | null
}

export async function runPsi(
  db: Db,
  scope: TenantScope,
  provider: PsiProvider,
  options: PsiCommandOptions,
): Promise<PsiCommandResult> {
  const site = repos(db, scope).read.findSiteByUri(options.siteUrl)
  if (!site) throw new NoCrawlError(options.siteUrl)

  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)
  if (!run) throw new NoCrawlError(options.siteUrl)

  const pages = crawlRepo.read.listCrawlPages(run.id)
  const links = crawlRepo.read.listPageLinks(run.id)
  const graph = buildLinkGraph({
    pageUrls: pages.map((p) => p.url),
    edges: links.map((l) => ({
      fromUrl: l.fromUrl, toUrl: l.toUrl, rel: l.rel,
      anchorText: l.anchorText, isInternal: l.isInternal === 1,
    })),
    rootUrl: crawlStartUrl(site.propertyUri),
  })

  const candidates = pages
    // Mierzymy tylko strony, ktore da sie odwiedzic. Wynik dla 404 nic nie znaczy.
    .filter((page) => page.httpStatus === 200)
    .map((page) => ({
      url: page.url,
      depth: page.depth,
      inDegree: statsFor(graph, page.url)?.inDegree ?? 0,
    }))

  const strategy: PsiStrategy = options.strategy ?? 'mobile'
  const chosen = pagesToMeasure(candidates, options.limit ?? DEFAULT_PSI_LIMIT)

  let measured = 0
  let failed = 0
  let lastError: string | null = null
  const slowest: { url: string; lcpMs: number }[] = []

  for (const candidate of chosen) {
    const result = await provider.measure(candidate.url, strategy)
    if (result.error !== null || result.metrics.length === 0) {
      failed += 1
      lastError = result.error ?? 'odpowiedź bez metryk'
      continue
    }

    for (const metrics of result.metrics) {
      crawlRepo.write.upsertPsiMeasurement(site.id, {
        url: candidate.url,
        strategy,
        measuredAt: result.measuredAt,
        lcpMs: metrics.lcpMs,
        inpMs: metrics.inpMs,
        cls: metrics.cls,
        ttfbMs: metrics.ttfbMs,
        performanceScore: metrics.performanceScore,
        source: metrics.source,
      })
    }
    measured += 1

    // Do podsumowania bierzemy dane terenowe, gdy sa — to one licza sie w Core
    // Web Vitals. Laboratorium jest tylko przyblizeniem dla stron bez ruchu.
    const preferred = result.metrics.find((m) => m.source === 'field')
      ?? result.metrics.find((m) => m.source === 'lab')
    if (preferred?.lcpMs != null) slowest.push({ url: candidate.url, lcpMs: preferred.lcpMs })
  }

  slowest.sort((a, b) => b.lcpMs - a.lcpMs)
  return { siteId: site.id, measured, failed, strategy, slowest: slowest.slice(0, 5), lastError }
}
