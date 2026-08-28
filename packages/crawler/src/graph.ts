import { normalizeUrl } from '@seo/core'
import type { LinkEdge } from './crawl.js'

/**
 * Graf linkow wewnetrznych (D20). Swiadomie **bez PageRank**: liczba wychodzaca
 * z algorytmu iteracyjnego na niepelnym grafie jest efektowna i nieweryfikowalna.
 *
 * „Do tej strony nie prowadzi zaden link wewnetrzny, a ma 1240 wyswietlen
 * w Search Console" to ustalenie, ktore wlasciciel strony moze sprawdzic
 * i naprawic w piec minut. I to jest cala wartosc tego pliku.
 */

export interface NodeStats {
  readonly url: string
  readonly inDegree: number
  readonly outDegree: number
  /** Liczba klikniec od strony glownej; `null`, gdy strona nieosiagalna z linkow. */
  readonly clickDepth: number | null
}

export interface LinkGraph {
  readonly nodes: ReadonlyMap<string, NodeStats>
  readonly orphans: readonly string[]
  readonly deadEnds: readonly string[]
  /** Strony obecne w crawlu, do ktorych nie da sie dojsc z korzenia. */
  readonly unreachable: readonly string[]
}

function keyOf(url: string): string {
  try {
    return normalizeUrl(url).hash
  } catch {
    return url
  }
}

export interface BuildGraphInput {
  /** Adresy stron, ktore crawler faktycznie odwiedzil. */
  readonly pageUrls: readonly string[]
  readonly edges: readonly LinkEdge[]
  readonly rootUrl: string
}

export function buildLinkGraph(input: BuildGraphInput): LinkGraph {
  const { pageUrls, edges, rootUrl } = input

  const urlByKey = new Map<string, string>()
  for (const url of pageUrls) urlByKey.set(keyOf(url), url)

  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  for (const key of urlByKey.keys()) {
    outgoing.set(key, new Set())
    incoming.set(key, new Set())
  }

  for (const edge of edges) {
    if (!edge.isInternal) continue
    const from = keyOf(edge.fromUrl)
    const to = keyOf(edge.toUrl)
    // Link do samego siebie nie jest linkiem przychodzacym — inaczej kazda strona
    // z odnosnikiem do siebie przestalaby byc osierocona.
    if (from === to) continue
    if (!urlByKey.has(from) || !urlByKey.has(to)) continue
    outgoing.get(from)?.add(to)
    incoming.get(to)?.add(from)
  }

  const rootKey = keyOf(rootUrl)
  const clickDepth = new Map<string, number>()
  if (urlByKey.has(rootKey)) {
    clickDepth.set(rootKey, 0)
    let level = [rootKey]
    let depth = 0
    while (level.length > 0) {
      depth += 1
      const nextLevel: string[] = []
      for (const key of level) {
        for (const target of outgoing.get(key) ?? []) {
          if (clickDepth.has(target)) continue
          clickDepth.set(target, depth)
          nextLevel.push(target)
        }
      }
      level = nextLevel
    }
  }

  const nodes = new Map<string, NodeStats>()
  const orphans: string[] = []
  const deadEnds: string[] = []
  const unreachable: string[] = []

  for (const [key, url] of urlByKey) {
    const inDegree = incoming.get(key)?.size ?? 0
    const outDegree = outgoing.get(key)?.size ?? 0
    const depth = clickDepth.has(key) ? (clickDepth.get(key) as number) : null
    nodes.set(key, { url, inDegree, outDegree, clickDepth: depth })
    if (inDegree === 0 && key !== rootKey) orphans.push(url)
    if (outDegree === 0) deadEnds.push(url)
    if (depth === null && key !== rootKey) unreachable.push(url)
  }

  return {
    nodes,
    orphans: orphans.sort(),
    deadEnds: deadEnds.sort(),
    unreachable: unreachable.sort(),
  }
}

/** Odczyt statystyk dla adresu — po `url_hash`, nie po tekscie (D19). */
export function statsFor(graph: LinkGraph, url: string): NodeStats | undefined {
  return graph.nodes.get(keyOf(url))
}

export interface RedirectChainProblem {
  readonly startUrl: string
  readonly chain: readonly string[]
  readonly kind: 'loop' | 'too-long'
}

/**
 * Znajduje petle i zbyt dlugie lancuchy przekierowan na podstawie tego, co
 * crawler zapisal przy kazdej stronie.
 */
export function redirectProblems(
  pages: readonly { readonly url: string; readonly redirectChain: readonly string[] }[],
  maxHops: number,
): RedirectChainProblem[] {
  const problems: RedirectChainProblem[] = []
  for (const page of pages) {
    if (page.redirectChain.length === 0) continue
    const full = [...page.redirectChain, page.url]
    const seen = new Set<string>()
    let looped = false
    for (const hop of full) {
      const key = keyOf(hop)
      if (seen.has(key)) { looped = true; break }
      seen.add(key)
    }
    const start = page.redirectChain[0] ?? page.url
    if (looped) problems.push({ startUrl: start, chain: full, kind: 'loop' })
    else if (page.redirectChain.length > maxHops) {
      problems.push({ startUrl: start, chain: full, kind: 'too-long' })
    }
  }
  return problems
}
