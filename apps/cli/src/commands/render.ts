import type { TenantScope } from '@seo/core'
import type { CrawledPage } from '@seo/crawler'
import { type Db, crawlRepos } from '@seo/db'
import { diffRenderedFacts, parsePage } from '@seo/parse'
import type { RenderOptions, RenderProvider } from '@seo/providers'

/**
 * Renderowanie probki stron i porownanie z surowym HTML (D16).
 *
 * Chromium na 500 stronach to kilkadziesiat minut i pol giga pamieci. Probka
 * dziesieciu stron odpowiada na to samo pytanie — „czy ta strona wymaga JS,
 * zeby pokazac tresc" — za dwa procent kosztu. Zero budzetu obejmuje takze
 * budzet czasu i pamieci.
 */

export interface RenderCandidate {
  readonly url: string
  readonly depth: number
  readonly wordCount: number
  readonly scriptCount: number
  readonly textToHtmlRatio: number
}

/**
 * Podejrzliwosc: im mniej tekstu przypada na bajt dokumentu przy obecnych
 * skryptach, tym wieksza szansa, ze tresc dociaga JavaScript. Strona bez
 * skryptow nie ma jak byc zalezna od JS, wiec dostaje zero.
 */
export function suspicionOf(page: RenderCandidate): number {
  if (page.scriptCount === 0) return 0
  return 1 - Math.min(1, page.textToHtmlRatio)
}

/**
 * Wybiera strony do renderowania. Strona glowna zawsze wchodzi — jest wizytowka
 * i najczesciej cytowanym adresem. Reszta wg podejrzliwosci, przy remisie
 * alfabetycznie, zeby dwa przebiegi dawaly te sama probke.
 */
export function pagesToRender(
  pages: readonly RenderCandidate[],
  limit: number,
): RenderCandidate[] {
  if (limit <= 0) return []

  const home = pages.filter((p) => p.depth === 0)
  const rest = pages
    .filter((p) => p.depth !== 0)
    .sort((a, b) => {
      const bySuspicion = suspicionOf(b) - suspicionOf(a)
      if (bySuspicion !== 0) return bySuspicion
      return a.url < b.url ? -1 : a.url > b.url ? 1 : 0
    })

  return [...home, ...rest].slice(0, limit)
}

export interface RenderSampleDeps {
  readonly db: Db
  readonly scope: TenantScope
  readonly provider: RenderProvider
}

export interface RenderSampleResult {
  readonly rendered: number
  readonly failed: number
  readonly requiringJs: readonly string[]
  /** Powod ostatniego niepowodzenia — zeby nie kazac szukac go w bazie. */
  readonly lastError: string | null
}

export async function renderSample(
  deps: RenderSampleDeps,
  input: {
    readonly siteId: string
    readonly runId: string
    readonly pages: readonly CrawledPage[]
    readonly limit: number
    readonly options: RenderOptions
  },
): Promise<RenderSampleResult> {
  const candidates = input.pages
    .filter((page) => page.facts !== null && page.status === 200)
    .map((page) => ({
      url: page.url,
      depth: page.depth,
      wordCount: page.facts?.wordCount ?? 0,
      scriptCount: page.facts?.scriptCount ?? 0,
      textToHtmlRatio: page.facts?.textToHtmlRatio ?? 1,
    }))

  const chosen = pagesToRender(candidates, input.limit)
  const byUrl = new Map(input.pages.map((page) => [page.url, page]))
  const write = crawlRepos(deps.db, deps.scope).write

  let rendered = 0
  let failed = 0
  let lastError: string | null = null
  const requiringJs: string[] = []

  try {
    for (const candidate of chosen) {
      const raw = byUrl.get(candidate.url)?.facts
      if (!raw) continue

      const result = await deps.provider.renderPage(candidate.url, input.options)
      if (result.html === null) {
        failed += 1
        lastError = result.error ?? 'przegladarka nie zwrocila tresci'
        continue
      }

      const renderedFacts = parsePage(result.html, { url: result.finalUrl })
      const diff = diffRenderedFacts(raw, renderedFacts)
      write.setRenderDiff(input.siteId, input.runId, candidate.url, diff)
      rendered += 1
      if (diff.contentRequiresJs) requiringJs.push(candidate.url)
    }
  } finally {
    // Przegladarka trzyma proces przy zyciu — zamykamy takze po bledzie.
    await deps.provider.close()
  }

  write.markRenderSample(input.runId, rendered)
  return { rendered, failed, requiringJs, lastError }
}
