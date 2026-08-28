import { finding, type PageRule, type SiteRule } from '../rule.js'
import { htmlRule, indexByUrl, isIndexable, pageRule, sameUrl, siteRule, urlKey } from '../helpers.js'

/**
 * Reguly indeksacji. Pierwsze w kolejnosci nie z gustu, tylko dlatego, ze reszta
 * audytu jest bez znaczenia dla strony, ktora nie ma prawa trafic do wynikow.
 */

const noindexPresent: PageRule = htmlRule(
  {
    id: 'noindex.present',
    category: 'indexation',
    severity: 'high',
    title: 'Strona wyklucza się z indeksu',
  },
  (facts, page) =>
    facts.metaRobots.noindex
      ? [finding(noindexPresent, page.url, {
          'dyrektywa': facts.metaRobots.raw ?? 'noindex',
        }, { kind: 'manual', hint: 'Usuń noindex, jeśli strona ma być widoczna w wynikach.' })]
      : [],
)

const canonicalMissing: PageRule = htmlRule(
  {
    id: 'canonical.missing',
    category: 'indexation',
    severity: 'medium',
    title: 'Brak adresu kanonicznego',
  },
  (facts, page) =>
    facts.canonicalResolved === null && isIndexable(page)
      ? [finding(canonicalMissing, page.url, { 'adres': page.url }, {
          kind: 'manual',
          hint: 'Dodaj <link rel="canonical"> wskazujący na ten sam adres.',
        })]
      : [],
)

const canonicalPointsElsewhere: PageRule = htmlRule(
  {
    id: 'canonical.points-elsewhere',
    category: 'indexation',
    severity: 'medium',
    title: 'Adres kanoniczny wskazuje inną stronę',
  },
  (facts, page) => {
    if (facts.canonicalResolved === null) return []
    if (sameUrl(facts.canonicalResolved, page.url)) return []
    return [finding(canonicalPointsElsewhere, page.url, {
      'kanoniczny': facts.canonicalResolved,
      'adres strony': page.url,
    })]
  },
)

const canonicalChain: SiteRule = siteRule(
  {
    id: 'canonical.chain',
    category: 'indexation',
    severity: 'high',
    title: 'Łańcuch adresów kanonicznych',
    requires: ['page-facts', 'complete-crawl'],
  },
  (site) => {
    const index = indexByUrl(site.pages)
    const out = []
    for (const page of site.pages) {
      const target = page.facts?.canonicalResolved
      if (!target || sameUrl(target, page.url)) continue
      const targetPage = index.get(urlKey(target))
      const secondHop = targetPage?.facts?.canonicalResolved
      if (!secondHop || sameUrl(secondHop, target)) continue
      out.push(finding(canonicalChain, page.url, {
        'pierwszy skok': target,
        'drugi skok': secondHop,
      }))
    }
    return out
  },
)

const robotsBlockedButLinked: SiteRule = siteRule(
  {
    id: 'robots.blocked-but-linked',
    category: 'indexation',
    severity: 'medium',
    title: 'Strona zablokowana w robots.txt, a linkowana wewnętrznie',
    requires: ['page-facts', 'link-graph'],
  },
  (site) => {
    const blocked = new Set(site.robotsBlockedUrls.map(urlKey))
    if (blocked.size === 0) return []

    const linkedFrom = new Map<string, string>()
    for (const page of site.pages) {
      for (const link of page.facts?.links ?? []) {
        if (!link.isInternal || link.resolved === null) continue
        const key = urlKey(link.resolved)
        if (blocked.has(key) && !linkedFrom.has(key)) linkedFrom.set(key, page.url)
      }
    }

    return [...linkedFrom].map(([key, from]) =>
      finding(robotsBlockedButLinked, site.robotsBlockedUrls.find((u) => urlKey(u) === key) ?? null, {
        'linkowana z': from,
      }))
  },
)

const status4xx: PageRule = pageRule(
  {
    id: 'http.status-4xx',
    category: 'indexation',
    severity: 'high',
    title: 'Strona odpowiada błędem 4xx',
    requires: ['http-response'],
  },
  (page) => {
    const status = page.http.status
    if (status === null || status < 400 || status >= 500) return []
    return [finding(status4xx, page.url, { 'status': status })]
  },
)

const status5xx: PageRule = pageRule(
  {
    id: 'http.status-5xx',
    category: 'indexation',
    severity: 'blocker',
    title: 'Strona odpowiada błędem serwera',
    requires: ['http-response'],
  },
  (page) => {
    const status = page.http.status
    if (status === null || status < 500) return []
    return [finding(status5xx, page.url, { 'status': status })]
  },
)

const fetchFailed: PageRule = pageRule(
  {
    id: 'http.fetch-failed',
    category: 'indexation',
    severity: 'blocker',
    title: 'Strony nie udało się pobrać',
    requires: ['http-response'],
  },
  (page) =>
    page.http.status === null
      ? [finding(fetchFailed, page.url, { 'powód': page.http.error ?? 'nieznany' })]
      : [],
)

const redirectChainTooLong: PageRule = pageRule(
  {
    id: 'redirect.chain-too-long',
    category: 'indexation',
    severity: 'medium',
    title: 'Za długi łańcuch przekierowań',
    requires: ['http-response'],
  },
  (page, ctx) => {
    const hops = page.http.redirectChain.length
    if (hops <= ctx.thresholds.maxRedirectHops) return []
    return [finding(redirectChainTooLong, page.url, {
      'liczba przeskoków': hops,
      'próg': ctx.thresholds.maxRedirectHops,
      'łańcuch': page.http.redirectChain.join(' → '),
    })]
  },
)

const redirectLoop: PageRule = pageRule(
  {
    id: 'redirect.loop',
    category: 'indexation',
    severity: 'high',
    title: 'Pętla przekierowań',
    requires: ['http-response'],
  },
  (page) => {
    const seen = new Set<string>()
    for (const hop of page.http.redirectChain) {
      const key = urlKey(hop)
      if (seen.has(key)) {
        return [finding(redirectLoop, page.url, { 'powtórzony adres': hop })]
      }
      seen.add(key)
    }
    return []
  },
)

// --- Uzupelnienie do parytetu z audytem Screaming Frog ------------------------

const canonicalMultiple: PageRule = htmlRule(
  {
    id: 'canonical.multiple',
    category: 'indexation',
    severity: 'high',
    title: 'Więcej niż jeden adres kanoniczny',
  },
  (facts, page) =>
    facts.canonicalCount > 1
      ? [finding(canonicalMultiple, page.url, {
          'liczba znaczników': facts.canonicalCount,
          'pierwszy': facts.canonicalResolved ?? facts.canonicalRaw ?? '',
        }, {
          kind: 'manual',
          hint: 'Zostaw jeden <link rel="canonical">. Przy dwóch Google ignoruje oba.',
        })]
      : [],
)

const metaRefreshPresent: PageRule = htmlRule(
  {
    id: 'redirect.meta-refresh',
    category: 'indexation',
    severity: 'medium',
    title: 'Przekierowanie przez meta refresh',
  },
  (facts, page) =>
    facts.metaRefresh === null
      ? []
      : [finding(metaRefreshPresent, page.url, { 'zawartość': facts.metaRefresh }, {
          kind: 'manual',
          hint: 'Zamień na przekierowanie 301 po stronie serwera — meta refresh nie przenosi sygnałów.',
        })],
)

const canonicalToNonIndexable: SiteRule = siteRule(
  {
    id: 'canonical.to-non-indexable',
    category: 'indexation',
    severity: 'high',
    title: 'Adres kanoniczny wskazuje stronę, która nie może być zaindeksowana',
    requires: ['page-facts', 'http-response', 'complete-crawl'],
  },
  (site) => {
    const index = indexByUrl(site.pages)
    const out = []
    for (const page of site.pages) {
      const target = page.facts?.canonicalResolved
      if (!target || sameUrl(target, page.url)) continue
      const targetPage = index.get(urlKey(target))
      if (!targetPage) continue

      const status = targetPage.http.status
      const noindex = targetPage.facts?.metaRobots.noindex === true
      if (status !== null && status < 400 && !noindex) continue

      out.push(finding(canonicalToNonIndexable, page.url, {
        'kanoniczny': target,
        'powód': noindex ? 'cel ma noindex' : `cel zwraca status ${status ?? 'brak odpowiedzi'}`,
      }))
    }
    return out
  },
)

export const INDEXATION_PAGE_RULES: readonly PageRule[] = [
  noindexPresent, canonicalMissing, canonicalPointsElsewhere, canonicalMultiple,
  metaRefreshPresent,
  status4xx, status5xx, fetchFailed, redirectChainTooLong, redirectLoop,
]

export const INDEXATION_SITE_RULES: readonly SiteRule[] = [
  canonicalChain, canonicalToNonIndexable, robotsBlockedButLinked,
]
