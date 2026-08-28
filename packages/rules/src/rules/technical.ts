import { finding, type PageRule, type SiteRule } from '../rule.js'
import { htmlRule, indexByUrl, indexWithRedirects, pageRule, sameUrl, siteRule, urlKey } from '../helpers.js'

/** Format kodu jezyka wg BCP 47 w zakresie, ktorego uzywa hreflang: `pl`, `pl-PL`, `x-default`. */
const HREFLANG_PATTERN = /^(x-default|[a-z]{2,3}(-[A-Z][a-z]{3})?(-([A-Z]{2}|\d{3}))?)$/

const viewportMissing: PageRule = htmlRule(
  { id: 'viewport.missing', category: 'technical', severity: 'medium', title: 'Brak deklaracji viewport' },
  (facts, page) =>
    facts.viewport === null
      ? [finding(viewportMissing, page.url, { 'adres': page.url }, {
          kind: 'set-meta', name: 'viewport', value: 'width=device-width, initial-scale=1',
        })]
      : [],
)

const charsetMissing: PageRule = htmlRule(
  { id: 'charset.missing', category: 'technical', severity: 'low', title: 'Brak deklaracji kodowania znaków' },
  (facts, page) =>
    facts.charset === null
      ? [finding(charsetMissing, page.url, { 'adres': page.url })]
      : [],
)

const hreflangInvalidCode: PageRule = htmlRule(
  { id: 'hreflang.invalid-code', category: 'technical', severity: 'low', title: 'Nieprawidłowy kod języka w hreflang' },
  (facts, page) => {
    const invalid = facts.hreflang.filter((h) => !HREFLANG_PATTERN.test(h.lang))
    if (invalid.length === 0) return []
    return [finding(hreflangInvalidCode, page.url, {
      'liczba': invalid.length,
      'pierwszy kod': invalid[0]?.lang ?? '',
    })]
  },
)

const hreflangMissingReturn: SiteRule = siteRule(
  {
    id: 'hreflang.missing-return',
    category: 'technical',
    severity: 'medium',
    title: 'Hreflang bez odnośnika zwrotnego',
    requires: ['page-facts', 'complete-crawl'],
  },
  (site) => {
    const index = indexByUrl(site.pages)
    const out = []
    for (const page of site.pages) {
      for (const alternate of page.facts?.hreflang ?? []) {
        if (alternate.resolved === null || sameUrl(alternate.resolved, page.url)) continue
        const target = index.get(urlKey(alternate.resolved))
        // Strony, ktorej nie odwiedzilismy, nie oskarzamy o brak odnosnika zwrotnego.
        if (!target || target.facts === null) continue
        const returns = target.facts.hreflang.some((back) => sameUrl(back.resolved, page.url))
        if (returns) continue
        out.push(finding(hreflangMissingReturn, page.url, {
          'wskazuje na': alternate.resolved,
          'język': alternate.lang,
        }))
      }
    }
    return out
  },
)

const sitemapDeadUrl: SiteRule = siteRule(
  {
    id: 'sitemap.dead-url',
    category: 'technical',
    severity: 'medium',
    title: 'Mapa witryny wskazuje adres, który nie działa',
    requires: ['sitemap', 'http-response'],
  },
  (site) => {
    const index = indexWithRedirects(site.pages)
    const out = []
    for (const url of site.sitemapUrls) {
      const page = index.get(urlKey(url))
      if (!page) continue
      const status = page.http.status
      if (status === null) {
        out.push(finding(sitemapDeadUrl, url, { 'powód': page.http.error ?? 'brak odpowiedzi' }))
        continue
      }
      if (status >= 400) out.push(finding(sitemapDeadUrl, url, { 'status': status }))
    }
    return out
  },
)

const slowResponse: PageRule = pageRule(
  {
    id: 'page.slow-response',
    category: 'technical',
    severity: 'medium',
    title: 'Wolna odpowiedź serwera',
    requires: ['http-response'],
  },
  (page, ctx) =>
    page.http.durationMs > ctx.thresholds.slowResponseMs
      ? [finding(slowResponse, page.url, {
          'czas [ms]': page.http.durationMs,
          'próg [ms]': ctx.thresholds.slowResponseMs,
        })]
      : [],
)

const tooHeavy: PageRule = htmlRule(
  { id: 'page.too-heavy', category: 'technical', severity: 'low', title: 'Bardzo duży dokument HTML' },
  (facts, page, ctx) =>
    facts.htmlBytes > ctx.thresholds.heavyHtmlBytes
      ? [finding(tooHeavy, page.url, {
          'bajty': facts.htmlBytes,
          'próg': ctx.thresholds.heavyHtmlBytes,
        })]
      : [],
)

export const TECHNICAL_PAGE_RULES: readonly PageRule[] = [
  viewportMissing, charsetMissing, hreflangInvalidCode, slowResponse, tooHeavy,
]

export const TECHNICAL_SITE_RULES: readonly SiteRule[] = [hreflangMissingReturn, sitemapDeadUrl]
