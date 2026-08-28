import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePage } from '@seo/parse'
import type { Capability, HttpFacts, PageInput, RuleContext, SiteInput } from './rule.js'
import { DEFAULT_THRESHOLDS } from './thresholds.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures')

export function readPageFixture(name: string): string {
  return readFileSync(join(FIXTURES, 'pages', name), 'utf8')
}

export const ALL_CAPABILITIES: readonly Capability[] = [
  'page-facts', 'http-response', 'render-diff', 'link-graph', 'complete-crawl', 'sitemap',
]

export function ctx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    capabilities: overrides.capabilities ?? new Set(ALL_CAPABILITIES),
    thresholds: overrides.thresholds ?? DEFAULT_THRESHOLDS,
  }
}

export function http(overrides: Partial<HttpFacts> = {}): HttpFacts {
  return {
    status: 200,
    contentType: 'text/html; charset=utf-8',
    bytes: 2048,
    durationMs: 120,
    redirectChain: [],
    error: null,
    ...overrides,
  }
}

/** Buduje stronę z surowego HTML — testy reguł piszą HTML wprost, nie strukturę. */
export function pageFromHtml(
  html: string,
  url = 'https://przyklad.test/strona',
  overrides: Partial<PageInput> = {},
): PageInput {
  return {
    url,
    depth: 1,
    http: http(),
    facts: parsePage(html, { url }),
    renderDiff: null,
    graph: null,
    inSitemap: true,
    ...overrides,
  }
}

export function pageFromFixture(
  fixture: string,
  url = 'https://przyklad.test/strona',
  overrides: Partial<PageInput> = {},
): PageInput {
  return pageFromHtml(readPageFixture(fixture), url, overrides)
}

export function site(pages: readonly PageInput[], overrides: Partial<SiteInput> = {}): SiteInput {
  return {
    siteUrl: 'https://przyklad.test/',
    pages,
    sitemapUrls: [],
    robotsBlockedUrls: [],
    ...overrides,
  }
}

/** Minimalna poprawna strona — baza dla testów ujemnych. */
export const HEALTHY_HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Poprawna strona testowa z sensownym tytułem</title>
  <meta name="description" content="Opis o długości mieszczącej się w przyjętych progach, wystarczająco konkretny, żeby nie wyglądał na wypełniacz.">
  <link rel="canonical" href="https://przyklad.test/strona">
  <meta property="og:title" content="Poprawna strona testowa">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"Poprawna strona testowa"}</script>
</head>
<body>
  <h1>Poprawna strona testowa</h1>
  <p>Pierwszy akapit odpowiada wprost na pytanie postawione w nagłówku, w jednym zdaniu i bez rozbiegu, dokładnie tak, jak potrzebuje tego model wycinający fragment.</p>
  <h2>Sekcja o kolejności sprawdzeń w audycie technicznym</h2>
  <p>${'Zdanie wypełniające treść, żeby strona nie została uznana za ubogą. '.repeat(12)}</p>
  <img src="/obraz.png" alt="Opis obrazu" width="640" height="480">
  <a href="/inna-strona">Przejdź do opisu metody pomiaru</a>
</body>
</html>`

/** Znajduje ustalenie danej reguły albo `undefined` — czytelniejsze niż filtrowanie w teście. */
export function findingOf(
  findings: readonly { readonly ruleId: string }[],
  ruleId: string,
): { readonly ruleId: string } | undefined {
  return findings.find((f) => f.ruleId === ruleId)
}
