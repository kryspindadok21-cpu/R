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

// --- Uzupelnienie do parytetu z audytem Screaming Frog ------------------------

const mixedContent: PageRule = htmlRule(
  {
    id: 'security.mixed-content',
    category: 'technical',
    severity: 'high',
    title: 'Strona po HTTPS ładuje zasoby po HTTP',
  },
  (facts, page) => {
    if (!page.url.startsWith('https://')) return []
    const insecure = facts.resources.filter((r) => r.resolved?.startsWith('http://') === true)
    if (insecure.length === 0) return []
    return [finding(mixedContent, page.url, {
      'liczba zasobów': insecure.length,
      'rodzaje': [...new Set(insecure.map((r) => r.kind))].sort().join(', '),
      'pierwszy': insecure[0]?.resolved ?? '',
    }, {
      kind: 'manual',
      hint: 'Podmień adresy zasobów na https. Przeglądarki blokują skrypty i style po http.',
    })]
  },
)

const hreflangMissingSelf: PageRule = htmlRule(
  {
    id: 'hreflang.missing-self',
    category: 'technical',
    severity: 'low',
    title: 'Zestaw hreflang bez odnośnika do siebie samego',
  },
  (facts, page) => {
    if (facts.hreflang.length === 0) return []
    const pointsToSelf = facts.hreflang.some((h) => sameUrl(h.resolved, page.url))
    if (pointsToSelf) return []
    return [finding(hreflangMissingSelf, page.url, {
      'wersji językowych': facts.hreflang.length,
      'kody': facts.hreflang.map((h) => h.lang).join(', '),
    })]
  },
)

/**
 * Higiena adresu. Kazdy z tych problemow jest drobny osobno, ale razem robia
 * adresy, ktorych nie da sie wkleic w rozmowie ani porownac miedzy soba.
 */
const urlProblematic: PageRule = pageRule(
  {
    id: 'url.problematic',
    category: 'technical',
    severity: 'low',
    title: 'Adres strony utrudnia udostępnianie i porównywanie',
    requires: ['http-response'],
  },
  (page, ctx) => {
    let path: string
    try {
      path = decodeURI(new URL(page.url).pathname)
    } catch {
      return []
    }

    const problems: string[] = []
    if (/[A-Z]/.test(path)) problems.push('wielkie litery')
    if (path.includes('_')) problems.push('podkreślenia zamiast myślników')
    if (/\s/.test(path)) problems.push('spacje')
    if (path.length > ctx.thresholds.urlMaxLength) problems.push(`ścieżka dłuższa niż ${ctx.thresholds.urlMaxLength} znaków`)

    if (problems.length === 0) return []
    return [finding(urlProblematic, page.url, {
      'problemy': problems.join(', '),
      'długość ścieżki': path.length,
    })]
  },
)

const sitemapMissingPage: SiteRule = siteRule(
  {
    id: 'sitemap.missing-page',
    category: 'technical',
    severity: 'low',
    title: 'Strony indeksowalne spoza mapy witryny',
    requires: ['sitemap', 'complete-crawl'],
  },
  (site) => {
    const inSitemap = new Set(site.sitemapUrls.map(urlKey))
    const missing = site.pages.filter(
      (page) => page.http.status === 200
        && page.facts !== null
        && !page.facts.metaRobots.noindex
        && !inSitemap.has(urlKey(page.url)),
    )
    if (missing.length === 0) return []
    // Jedno ustalenie zbiorcze, nie jedno na strone: przy 300 stronach lista
    // per strona zasypalaby raport i schowala rzeczy wazniejsze.
    return [finding(sitemapMissingPage, null, {
      'liczba stron': missing.length,
      'przykłady': missing.slice(0, 3).map((p) => p.url).join(', '),
    })]
  },
)

/**
 * Mapa witryny, ktorej nikt nie znajdzie.
 *
 * Znalezione na wlasnej stronie projektu i **dlatego ta regula istnieje**.
 * Witryna na GitHub Pages stoi pod `https://uzytkownik.github.io/repo/`, wiec
 * `robots.txt` z repozytorium laduje pod `/repo/robots.txt`. Tam **nikt go nie
 * czyta**: `robots.txt` jest plikiem poziomu hosta i wyszukiwarki pytaja
 * wylacznie o `https://uzytkownik.github.io/robots.txt`.
 *
 * Skutek jest podstepny, bo nic nie wyglada na zepsute. Plik istnieje, otwiera
 * sie w przegladarce, ma w srodku poprawna linijke `Sitemap:` — i ta linijka
 * nie dziala. Mapa witryny nie zostanie odkryta, bo jedyne dwa miejsca, w ktore
 * wyszukiwarka zaglada, to `robots.txt` pod korzeniem hosta i `/sitemap.xml`
 * pod korzeniem hosta. Oba nalezą do kogos innego.
 *
 * To samo dotyczy kazdej witryny serwowanej z podkatalogu: sklepu pod `/shop/`,
 * bloga pod `/blog/` na cudzym hostingu, dokumentacji pod `/docs/`.
 *
 * Waga `medium`, nie `high`: strony nadal da sie odkryc przez linki, a mape
 * mozna zglosic recznie w Search Console. Ale dla nowej witryny bez linkow
 * przychodzacych mapa jest **jedyna** droga i wtedy to jest roznica miedzy
 * indeksacja w tydzien a w kwartal.
 */
const sitemapNotDiscoverable: SiteRule = siteRule(
  {
    id: 'sitemap.not-discoverable',
    category: 'technical',
    severity: 'medium',
    title: 'Mapa witryny jest nie do odkrycia dla wyszukiwarek',
    requires: ['sitemap'],
  },
  (site) => {
    if (site.robotsState === 'ok') return []

    const start = new URL(site.siteUrl)
    const korzenHosta = new URL('/', start).toString()

    return [finding(sitemapNotDiscoverable, null, {
      'robots.txt pod korzeniem hosta': `${korzenHosta}robots.txt — ${
        site.robotsState === 'missing' ? 'nie istnieje' : 'nieosiągalny'}`,
      'adresów w mapie': site.sitemapUrls.length,
      'witryna w podkatalogu': start.pathname !== '/',
      'co zrobić': start.pathname === '/'
        ? 'dodaj robots.txt pod korzeniem hosta z linią Sitemap:'
        : 'zgłoś mapę ręcznie w Search Console — pliku robots.txt pod '
          + 'korzeniem hosta nie kontrolujesz',
    })]
  },
)

const sitemapNonIndexableUrl: SiteRule = siteRule(
  {
    id: 'sitemap.non-indexable-url',
    category: 'technical',
    severity: 'medium',
    title: 'Mapa witryny wskazuje stronę wykluczoną z indeksu',
    requires: ['sitemap', 'page-facts'],
  },
  (site) => {
    const index = indexWithRedirects(site.pages)
    const out = []
    for (const url of site.sitemapUrls) {
      const page = index.get(urlKey(url))
      if (!page?.facts?.metaRobots.noindex) continue
      out.push(finding(sitemapNonIndexableUrl, url, {
        'dyrektywa': page.facts.metaRobots.raw ?? 'noindex',
      }))
    }
    return out
  },
)

export const TECHNICAL_PAGE_RULES: readonly PageRule[] = [
  viewportMissing, charsetMissing, hreflangInvalidCode, hreflangMissingSelf,
  mixedContent, urlProblematic, slowResponse, tooHeavy,
]

export const TECHNICAL_SITE_RULES: readonly SiteRule[] = [
  hreflangMissingReturn, sitemapDeadUrl, sitemapMissingPage, sitemapNonIndexableUrl,
  sitemapNotDiscoverable,
]
