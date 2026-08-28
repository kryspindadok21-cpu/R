import { finding, type PageRule, type SiteRule } from '../rule.js'
import { htmlRule, indexWithRedirects, isIndexable, pageRule, sameUrl, siteRule, urlKey } from '../helpers.js'

/**
 * Reguly linkowania wewnetrznego. Bez `link-graph` i `complete-crawl` wiekszosc
 * z nich milczy — „nikt tu nie linkuje" przy crawlu urwanym limitem znaczy
 * „nie doszlismy", a nie „strona jest osierocona" (D17).
 */

/** Kotwice, ktore nie niosa zadnej informacji o celu. Lista celowo krotka i konkretna. */
const GENERIC_ANCHORS = new Set([
  'tutaj', 'tu', 'kliknij', 'kliknij tutaj', 'kliknij tu', 'więcej', 'wiecej',
  'czytaj więcej', 'czytaj wiecej', 'zobacz', 'zobacz więcej', 'link', 'ten link',
  'strona', 'ta strona', 'here', 'click here', 'read more', 'more', 'learn more',
  'this page', 'link here',
])

const brokenInternal: SiteRule = siteRule(
  {
    id: 'link.broken-internal',
    category: 'links',
    severity: 'high',
    title: 'Link wewnętrzny prowadzi do błędu',
    requires: ['page-facts', 'http-response', 'complete-crawl'],
  },
  (site) => {
    const index = indexWithRedirects(site.pages)
    const out = []
    const reported = new Set<string>()

    for (const page of site.pages) {
      for (const link of page.facts?.links ?? []) {
        if (!link.isInternal || link.resolved === null) continue
        const target = index.get(urlKey(link.resolved))
        const status = target?.http.status
        if (status === undefined || status === null || status < 400) continue
        const key = `${urlKey(page.url)}|${urlKey(link.resolved)}`
        if (reported.has(key)) continue
        reported.add(key)
        out.push(finding(brokenInternal, page.url, {
          'cel': link.resolved,
          'status celu': status,
          'kotwica': link.anchorText || '(brak tekstu)',
        }))
      }
    }
    return out
  },
)

const linkToRedirect: SiteRule = siteRule(
  {
    id: 'link.to-redirect',
    category: 'links',
    severity: 'low',
    title: 'Link wewnętrzny prowadzi przez przekierowanie',
    requires: ['page-facts', 'http-response', 'complete-crawl'],
  },
  (site) => {
    const index = indexWithRedirects(site.pages)
    const out = []
    const reported = new Set<string>()

    for (const page of site.pages) {
      for (const link of page.facts?.links ?? []) {
        if (!link.isInternal || link.resolved === null) continue
        const target = index.get(urlKey(link.resolved))
        // Link trafia w adres koncowy — nie ma przeskoku do oszczedzenia.
        if (!target || sameUrl(target.url, link.resolved)) continue
        const key = `${urlKey(page.url)}|${urlKey(link.resolved)}`
        if (reported.has(key)) continue
        reported.add(key)
        out.push(finding(linkToRedirect, page.url, {
          'link prowadzi do': link.resolved,
          'adres docelowy': target.url,
        }, { kind: 'manual', hint: 'Podmień link na adres docelowy, żeby oszczędzić przeskok.' }))
      }
    }
    return out
  },
)

const nofollowInternal: PageRule = htmlRule(
  { id: 'link.nofollow-internal', category: 'links', severity: 'low', title: 'Link wewnętrzny z rel=nofollow' },
  (facts, page) => {
    const blocked = facts.links.filter((l) => l.isInternal && l.rel !== 'follow')
    if (blocked.length === 0) return []
    return [finding(nofollowInternal, page.url, {
      'liczba linków': blocked.length,
      'pierwszy cel': blocked[0]?.resolved ?? blocked[0]?.href ?? '',
    })]
  },
)

const emptyAnchor: PageRule = htmlRule(
  { id: 'link.empty-anchor', category: 'links', severity: 'low', title: 'Link bez tekstu kotwicy' },
  (facts, page) => {
    // Link owijajacy obraz ma dostepna nazwe w atrybucie alt — to nie jest ten blad.
    const empty = facts.links.filter(
      (l) => l.resolved !== null && l.anchorText.length === 0 && !l.wrapsImage,
    )
    if (empty.length === 0) return []
    return [finding(emptyAnchor, page.url, {
      'liczba linków': empty.length,
      'pierwszy cel': empty[0]?.resolved ?? '',
    })]
  },
)

const genericAnchor: PageRule = htmlRule(
  { id: 'link.generic-anchor', category: 'links', severity: 'info', title: 'Kotwica nie mówi, dokąd prowadzi' },
  (facts, page) => {
    const generic = facts.links.filter(
      (l) => l.resolved !== null && GENERIC_ANCHORS.has(l.anchorText.toLowerCase()),
    )
    if (generic.length === 0) return []
    return [finding(genericAnchor, page.url, {
      'liczba linków': generic.length,
      'przykład': generic[0]?.anchorText ?? '',
    })]
  },
)

const orphan: SiteRule = siteRule(
  {
    id: 'page.orphan',
    category: 'links',
    severity: 'medium',
    title: 'Strona osierocona — nie prowadzi do niej żaden link wewnętrzny',
    requires: ['link-graph', 'complete-crawl'],
  },
  (site) => {
    const out = []
    for (const page of site.pages) {
      if (page.graph === null || page.graph.inDegree > 0) continue
      if (sameUrl(page.url, site.siteUrl)) continue
      if (!isIndexable(page)) continue
      out.push(finding(orphan, page.url, {
        'linki przychodzące': 0,
        'w mapie witryny': page.inSitemap,
      }, { kind: 'manual', hint: 'Dodaj link z powiązanej tematycznie strony.' }))
    }
    return out
  },
)

const deadEnd: PageRule = pageRule(
  {
    id: 'page.dead-end',
    category: 'links',
    severity: 'low',
    title: 'Strona bez żadnego linku wychodzącego',
    requires: ['page-facts', 'link-graph'],
  },
  (page) =>
    page.graph !== null && page.graph.outDegree === 0 && isIndexable(page)
      ? [finding(deadEnd, page.url, { 'linki wychodzące': 0 })]
      : [],
)

const tooDeep: PageRule = pageRule(
  {
    id: 'page.too-deep',
    category: 'links',
    severity: 'low',
    title: 'Strona zbyt głęboko w strukturze',
    requires: ['link-graph', 'complete-crawl'],
  },
  (page, ctx) => {
    const depth = page.graph?.clickDepth
    if (depth === undefined || depth === null || depth <= ctx.thresholds.maxClickDepth) return []
    return [finding(tooDeep, page.url, {
      'kliknięć od strony głównej': depth,
      'próg': ctx.thresholds.maxClickDepth,
    })]
  },
)

export const LINK_PAGE_RULES: readonly PageRule[] = [
  nofollowInternal, emptyAnchor, genericAnchor, deadEnd, tooDeep,
]

export const LINK_SITE_RULES: readonly SiteRule[] = [brokenInternal, linkToRedirect, orphan]
