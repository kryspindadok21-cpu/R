import type { Cluster } from '@seo/keywords'
import { contentTokens } from '@seo/keywords'

/**
 * Sugestie linkowania wewnetrznego (D42).
 *
 * Adresy pochodza z **prawdziwego grafu** zbudowanego w Fazie 1, a nie z modelu.
 * Model proszony o linki wewnetrzne zmysla adresy — nie dlatego, ze jest zly,
 * tylko dlatego, ze generuje tekst. Model ma wybrac miejsce w akapicie; adres
 * ma przyjsc z bazy.
 */

/** Limit z tabeli bezpiecznikow: tyle linkow wolno wstawic bez pytania. */
export const MAX_INTERNAL_LINKS = 3

/** Ponizej tego pokrycia link jest naciagany i lepiej go nie wstawiac. */
export const MIN_LINK_RELEVANCE = 0.15

export interface LinkCandidate {
  readonly url: string
  readonly title: string | null
  readonly text: string
  /** Ile linkow wewnetrznych prowadzi do tej strony dzisiaj. */
  readonly inDegree: number
  /** Odleglosc od strony glownej w klikach; `null` znaczy „nieosiagalna". */
  readonly clickDepth: number | null
}

export interface LinkSuggestion {
  readonly url: string
  readonly anchorText: string
  readonly relevance: number
  readonly reason: string
}

function humanize(url: string): string {
  try {
    const segment = new URL(url).pathname.split('/').filter((s) => s !== '').pop()
    if (segment === undefined) return url
    return segment.replace(/[-_]+/g, ' ').replace(/\.\w+$/, '')
  } catch {
    return url
  }
}

/** Pokrycie slow klastra w tresci strony — udzial, nie liczba trafien. */
function relevanceOf(clusterTokens: ReadonlySet<string>, candidate: LinkCandidate): number {
  if (clusterTokens.size === 0) return 0
  const pageTokens = new Set(contentTokens(`${candidate.title ?? ''} ${candidate.text}`))
  let wspolne = 0
  for (const token of clusterTokens) if (pageTokens.has(token)) wspolne += 1
  return wspolne / clusterTokens.size
}

/**
 * Wybiera do trzech stron, do ktorych nowy artykul powinien linkowac.
 *
 * Przy zblizonym dopasowaniu wygrywa strona o **mniejszej** liczbie linkow
 * przychodzacych. Link do strony glownej, ktora i tak ma ich setki, nie zmienia
 * nic; link do strony z dwoma linkami przychodzacymi zmienia jej pozycje w grafie.
 * To jest jedyny powod, dla ktorego warto wstawiac linki automatycznie.
 */
export function suggestInternalLinks(
  cluster: Cluster,
  candidates: readonly LinkCandidate[],
  options: {
    readonly max?: number
    readonly excludeUrls?: readonly string[]
    readonly minRelevance?: number
  } = {},
): LinkSuggestion[] {
  const max = options.max ?? MAX_INTERNAL_LINKS
  const minRelevance = options.minRelevance ?? MIN_LINK_RELEVANCE
  const wykluczone = new Set(options.excludeUrls ?? [])

  const clusterTokens = new Set(cluster.keywords.flatMap((k) => contentTokens(k.query)))

  return candidates
    .filter((candidate) => !wykluczone.has(candidate.url))
    .map((candidate) => ({ candidate, relevance: relevanceOf(clusterTokens, candidate) }))
    .filter((row) => row.relevance >= minRelevance)
    .sort((a, b) =>
      b.relevance - a.relevance
      || a.candidate.inDegree - b.candidate.inDegree
      || a.candidate.url.localeCompare(b.candidate.url))
    .slice(0, max)
    .map(({ candidate, relevance }) => ({
      url: candidate.url,
      anchorText: candidate.title?.trim() !== undefined && candidate.title.trim() !== ''
        ? candidate.title.trim()
        : humanize(candidate.url),
      relevance,
      reason: `pokrywa ${(relevance * 100).toFixed(0)}% slow klastra; `
        + `${candidate.inDegree} linkow przychodzacych`
        + (candidate.clickDepth === null
          ? ', strona nieosiagalna z nawigacji'
          : `, glebokosc ${candidate.clickDepth}`),
    }))
}
