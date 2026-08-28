import { normalizeUrl } from '@seo/core'
import type { PageFacts } from '@seo/parse'
import type {
  Capability, Finding, PageInput, PageRule, RuleCategory, RuleContext, Severity, SiteInput, SiteRule,
} from './rule.js'

/**
 * Wieksza czesc regul stronowych ma sens wylacznie dla odpowiedzi, ktora byla
 * HTML-em i dala sie sparsowac. Zamiast powtarzac ten warunek czterdziesci razy,
 * fabryka odsiewa strony bez faktow i przekazuje regule juz gotowa strukture.
 */
export function htmlRule(
  definition: {
    id: string
    category: RuleCategory
    severity: Severity
    title: string
    requires?: readonly Capability[]
  },
  evaluate: (facts: PageFacts, page: PageInput, ctx: RuleContext) => readonly Finding[],
): PageRule {
  return {
    id: definition.id,
    category: definition.category,
    severity: definition.severity,
    title: definition.title,
    requires: definition.requires ?? ['page-facts'],
    evaluate: (page, ctx) => (page.facts === null ? [] : evaluate(page.facts, page, ctx)),
  }
}

export function pageRule(
  definition: {
    id: string
    category: RuleCategory
    severity: Severity
    title: string
    requires: readonly Capability[]
  },
  evaluate: (page: PageInput, ctx: RuleContext) => readonly Finding[],
): PageRule {
  return { ...definition, evaluate }
}

export function siteRule(
  definition: {
    id: string
    category: RuleCategory
    severity: Severity
    title: string
    requires: readonly Capability[]
  },
  evaluate: (site: SiteInput, ctx: RuleContext) => readonly Finding[],
): SiteRule {
  return { ...definition, evaluate }
}

/**
 * Porownanie adresow przez `url_hash` z Fazy 0 (D19). Bezposrednie porownanie
 * tekstow uznaloby `/oferta` i `/oferta/` za rozne strony, a caly sens
 * normalizacji polega na tym, zeby tego nie robic.
 */
export function sameUrl(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b
  try {
    return normalizeUrl(a).hash === normalizeUrl(b).hash
  } catch {
    return a === b
  }
}

export function urlKey(url: string): string {
  try {
    return normalizeUrl(url).hash
  } catch {
    return url
  }
}

/** Mapa `url_hash` → strona. Uzywana przez reguly serwisowe zamiast wyszukiwania liniowego. */
export function indexByUrl(pages: readonly PageInput[]): Map<string, PageInput> {
  const index = new Map<string, PageInput>()
  for (const page of pages) index.set(urlKey(page.url), page)
  return index
}

/**
 * Ta sama mapa, ale odnajduje strone takze po adresie, z ktorego przyszlo
 * przekierowanie. Crawler zapisuje strone pod adresem koncowym, wiec bez tego
 * link do `/stara` nie trafilby w wiersz zapisany jako `/nowa` — a to jest
 * dokladnie ten link, o ktorym chcemy powiedziec, ze idzie przez przeskok.
 */
export function indexWithRedirects(pages: readonly PageInput[]): Map<string, PageInput> {
  const index = indexByUrl(pages)
  for (const page of pages) {
    for (const source of page.http.redirectChain) {
      const key = urlKey(source)
      // Adres koncowy ma pierwszenstwo — nie nadpisujemy go wpisem posrednim.
      if (!index.has(key)) index.set(key, page)
    }
  }
  return index
}

/** Grupuje strony po wartosci tekstowej — podstawa regul o duplikatach. */
export function groupBy(
  pages: readonly PageInput[],
  valueOf: (page: PageInput) => string | null,
): Map<string, PageInput[]> {
  const groups = new Map<string, PageInput[]>()
  for (const page of pages) {
    const value = valueOf(page)
    if (value === null || value.length === 0) continue
    const bucket = groups.get(value)
    if (bucket) bucket.push(page)
    else groups.set(value, [page])
  }
  return groups
}

export function isHtml(page: PageInput): boolean {
  return page.facts !== null
}

/** Strona, ktora Google ma prawo zaindeksowac — inaczej wiekszosc regul jest bez znaczenia. */
export function isIndexable(page: PageInput): boolean {
  if (page.facts === null) return false
  if (page.facts.metaRobots.noindex) return false
  return page.http.status === 200
}
