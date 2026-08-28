import type { PageFacts } from './facts.js'

/**
 * Roznica miedzy surowym HTML a HTML po wykonaniu JavaScriptu (D16).
 *
 * Powod istnienia: czesc crawlerow, z ktorych korzystaja silniki AI, nie wykonuje
 * JavaScriptu. Strona moze rankowac w Google i byc calkowicie nieobecna
 * w odpowiedziach modeli. Ta funkcja jest czysta — renderowaniem zajmuje sie
 * provider, tutaj tylko porownujemy dwa gotowe zestawy faktow.
 */
export interface RenderDiff {
  readonly titleChanged: boolean
  readonly rawTitle: string | null
  readonly renderedTitle: string | null
  readonly descriptionChanged: boolean
  readonly rawWordCount: number
  readonly renderedWordCount: number
  /** Udzial tresci widocznej dopiero po wykonaniu JS. 1 = strona pusta bez JS. */
  readonly jsRequiredContentRatio: number
  readonly rawLinkCount: number
  readonly renderedLinkCount: number
  readonly linksOnlyInRendered: readonly string[]
  readonly linksOnlyInRaw: readonly string[]
  readonly jsonLdOnlyInRendered: number
  readonly h1OnlyInRendered: boolean
  /** Rekomendacja dla reguly: czy tresc strony wymaga JavaScriptu, zeby istniec. */
  readonly contentRequiresJs: boolean
}

/**
 * Prog, powyzej ktorego uznajemy, ze tresc wymaga JavaScriptu. Strona, ktora bez JS
 * pokazuje mniej niz jedna czwarta swojej tresci, jest dla crawlera bez JS pusta
 * w kazdym praktycznym sensie.
 */
export const JS_REQUIRED_CONTENT_THRESHOLD = 0.75

function resolvedLinks(facts: PageFacts): Set<string> {
  const out = new Set<string>()
  for (const link of facts.links) if (link.resolved !== null) out.add(link.resolved)
  return out
}

function difference(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  const out: string[] = []
  for (const value of a) if (!b.has(value)) out.push(value)
  return out.sort()
}

export function diffRenderedFacts(raw: PageFacts, rendered: PageFacts): RenderDiff {
  const rawLinks = resolvedLinks(raw)
  const renderedLinks = resolvedLinks(rendered)

  // Gdy renderowanie nic nie dodalo, udzial tresci wymagajacej JS wynosi zero —
  // takze wtedy, gdy obie wersje sa puste. Pusta strona to inny problem i inna regula.
  const gained = Math.max(0, rendered.wordCount - raw.wordCount)
  const jsRequiredContentRatio = rendered.wordCount === 0 ? 0 : gained / rendered.wordCount

  return {
    titleChanged: raw.title !== rendered.title,
    rawTitle: raw.title,
    renderedTitle: rendered.title,
    descriptionChanged: raw.metaDescription !== rendered.metaDescription,
    rawWordCount: raw.wordCount,
    renderedWordCount: rendered.wordCount,
    jsRequiredContentRatio,
    rawLinkCount: rawLinks.size,
    renderedLinkCount: renderedLinks.size,
    linksOnlyInRendered: difference(renderedLinks, rawLinks),
    linksOnlyInRaw: difference(rawLinks, renderedLinks),
    jsonLdOnlyInRendered: Math.max(0, rendered.jsonLd.length - raw.jsonLd.length),
    h1OnlyInRendered: raw.h1Count === 0 && rendered.h1Count > 0,
    contentRequiresJs:
      rendered.wordCount > 0 && jsRequiredContentRatio >= JS_REQUIRED_CONTENT_THRESHOLD,
  }
}
