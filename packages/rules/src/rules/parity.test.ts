import { describe, expect, it } from 'vitest'
import { auditSite } from '../audit.js'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, http, pageFromHtml, site } from '../support.test-helper.js'
import { CONTENT_SITE_RULES } from './content.js'
import { INDEXATION_PAGE_RULES, INDEXATION_SITE_RULES } from './indexation.js'
import { TECHNICAL_PAGE_RULES, TECHNICAL_SITE_RULES } from './technical.js'

/**
 * Reguly dopisane pod kryterium odbioru Fazy 1 z `analiza-seo-geo-i-plan-budowy.md`:
 * „nasze findings powinny pokrywac audyt Screaming Frog w >=80%".
 */

const URL_STRONY = 'https://przyklad.test/strona'

function indexationIds(html: string, url = URL_STRONY, overrides = {}): string[] {
  return runRules(INDEXATION_PAGE_RULES, pageFromHtml(html, url, overrides), ctx())
    .findings.map((f) => f.ruleId)
}

function technicalIds(html: string, url = URL_STRONY, overrides = {}): string[] {
  return runRules(TECHNICAL_PAGE_RULES, pageFromHtml(html, url, overrides), ctx())
    .findings.map((f) => f.ruleId)
}

describe('canonical.multiple', () => {
  it('zgłasza dwa znaczniki kanoniczne', () => {
    const html = HEALTHY_HTML.replace(
      '<link rel="canonical" href="https://przyklad.test/strona">',
      '<link rel="canonical" href="https://przyklad.test/strona">'
      + '<link rel="canonical" href="https://przyklad.test/inna">',
    )
    expect(indexationIds(html)).toContain('canonical.multiple')
  })

  it('nie zgłasza pojedynczego canonicala', () => {
    expect(indexationIds(HEALTHY_HTML)).not.toContain('canonical.multiple')
  })
})

describe('redirect.meta-refresh', () => {
  it('zgłasza przekierowanie ukryte w meta refresh', () => {
    const html = HEALTHY_HTML.replace(
      '<meta charset="utf-8">',
      '<meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/gdzie-indziej">',
    )
    expect(indexationIds(html)).toContain('redirect.meta-refresh')
  })

  it('nie zgłasza strony bez meta refresh', () => {
    expect(indexationIds(HEALTHY_HTML)).not.toContain('redirect.meta-refresh')
  })
})

describe('canonical.to-non-indexable', () => {
  const zrodlo = pageFromHtml(
    HEALTHY_HTML.replace('href="https://przyklad.test/strona"', 'href="https://przyklad.test/cel"'),
    'https://przyklad.test/zrodlo',
  )
  const SITE_ONLY = { page: [], site: INDEXATION_SITE_RULES }

  it('zgłasza canonical wskazujący stronę z noindex', () => {
    const cel = pageFromHtml(
      HEALTHY_HTML.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex">'),
      'https://przyklad.test/cel',
    )
    const result = auditSite(site([zrodlo, cel]), ctx(), SITE_ONLY)
    const found = result.findings.find((f) => f.ruleId === 'canonical.to-non-indexable')
    expect(found?.url).toBe('https://przyklad.test/zrodlo')
    expect(found?.evidence['powód']).toBe('cel ma noindex')
  })

  it('zgłasza canonical wskazujący stronę 404', () => {
    const cel = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/cel', { http: http({ status: 404 }) })
    const result = auditSite(site([zrodlo, cel]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).toContain('canonical.to-non-indexable')
  })

  it('nie zgłasza canonicala wskazującego stronę zdrową', () => {
    const cel = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/cel')
    const result = auditSite(site([zrodlo, cel]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).not.toContain('canonical.to-non-indexable')
  })

  it('nie oskarża, gdy celu nie było w crawlu', () => {
    const result = auditSite(site([zrodlo]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).not.toContain('canonical.to-non-indexable')
  })
})

describe('security.mixed-content', () => {
  it('zgłasza zasób po http na stronie po https', () => {
    const html = HEALTHY_HTML.replace('</head>', '<script src="http://przyklad.test/a.js"></script></head>')
    const findings = runRules(TECHNICAL_PAGE_RULES, pageFromHtml(html), ctx()).findings
    const found = findings.find((f) => f.ruleId === 'security.mixed-content')
    expect(found?.evidence['rodzaje']).toBe('script')
    expect(found?.evidence['liczba zasobów']).toBe(1)
  })

  it('nie zgłasza zasobów po https', () => {
    expect(technicalIds(HEALTHY_HTML)).not.toContain('security.mixed-content')
  })

  it('nie oskarża strony serwowanej po http — tam nie ma treści mieszanej', () => {
    const html = HEALTHY_HTML.replace('</head>', '<script src="http://przyklad.test/a.js"></script></head>')
    expect(technicalIds(html, 'http://przyklad.test/strona')).not.toContain('security.mixed-content')
  })
})

describe('hreflang.missing-self', () => {
  it('zgłasza zestaw bez odnośnika do siebie', () => {
    const html = HEALTHY_HTML.replace(
      '</head>',
      '<link rel="alternate" hreflang="en" href="https://przyklad.test/en"></head>',
    )
    expect(technicalIds(html)).toContain('hreflang.missing-self')
  })

  it('nie zgłasza zestawu z odnośnikiem do siebie', () => {
    const html = HEALTHY_HTML.replace(
      '</head>',
      '<link rel="alternate" hreflang="en" href="https://przyklad.test/en">'
      + '<link rel="alternate" hreflang="pl" href="https://przyklad.test/strona"></head>',
    )
    expect(technicalIds(html)).not.toContain('hreflang.missing-self')
  })

  it('strona bez hreflang nie generuje ustalenia', () => {
    expect(technicalIds(HEALTHY_HTML)).not.toContain('hreflang.missing-self')
  })
})

describe('url.problematic', () => {
  it('zgłasza wielkie litery w adresie', () => {
    const findings = runRules(
      TECHNICAL_PAGE_RULES,
      pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/Oferta'),
      ctx(),
    ).findings
    expect(findings.find((f) => f.ruleId === 'url.problematic')?.evidence['problemy'])
      .toBe('wielkie litery')
  })

  it('zgłasza podkreślenia', () => {
    expect(technicalIds(HEALTHY_HTML, 'https://przyklad.test/moja_strona'))
      .toContain('url.problematic')
  })

  it('zgłasza spację zakodowaną w adresie', () => {
    expect(technicalIds(HEALTHY_HTML, 'https://przyklad.test/moja%20strona'))
      .toContain('url.problematic')
  })

  it('zgłasza bardzo długą ścieżkę', () => {
    expect(technicalIds(HEALTHY_HTML, `https://przyklad.test/${'a'.repeat(200)}`))
      .toContain('url.problematic')
  })

  it('nie zgłasza adresu poprawnego', () => {
    expect(technicalIds(HEALTHY_HTML, 'https://przyklad.test/moja-strona'))
      .not.toContain('url.problematic')
  })
})

describe('sitemap.missing-page i sitemap.non-indexable-url', () => {
  const SITE_ONLY = { page: [], site: TECHNICAL_SITE_RULES }
  const w_mapie = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/w-mapie')
  const poza_mapa = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/poza-mapa')

  it('zgłasza indeksowalne strony spoza mapy, jednym ustaleniem zbiorczym', () => {
    const result = auditSite(
      site([w_mapie, poza_mapa], { sitemapUrls: ['https://przyklad.test/w-mapie'] }),
      ctx(),
      SITE_ONLY,
    )
    const found = result.findings.filter((f) => f.ruleId === 'sitemap.missing-page')
    expect(found).toHaveLength(1)
    expect(found[0]?.evidence['liczba stron']).toBe(1)
    expect(found[0]?.evidence['przykłady']).toBe('https://przyklad.test/poza-mapa')
  })

  it('nie zgłasza nic, gdy mapa obejmuje wszystkie strony', () => {
    const result = auditSite(
      site([w_mapie], { sitemapUrls: ['https://przyklad.test/w-mapie'] }),
      ctx(),
      SITE_ONLY,
    )
    expect(result.findings.map((f) => f.ruleId)).not.toContain('sitemap.missing-page')
  })

  it('zgłasza adres z mapy wykluczony z indeksu', () => {
    const noindex = pageFromHtml(
      HEALTHY_HTML.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex">'),
      'https://przyklad.test/ukryta',
    )
    const result = auditSite(
      site([noindex], { sitemapUrls: ['https://przyklad.test/ukryta'] }),
      ctx(),
      SITE_ONLY,
    )
    expect(result.findings.filter((f) => f.ruleId === 'sitemap.non-indexable-url').map((f) => f.url))
      .toEqual(['https://przyklad.test/ukryta'])
  })

  it('milczy, gdy mapy nie odczytano', () => {
    const bezMapy = ctx({ capabilities: new Set(['page-facts', 'http-response', 'complete-crawl']) })
    const result = auditSite(site([poza_mapa]), bezMapy, SITE_ONLY)
    expect(result.skipped.map((s) => s.ruleId)).toContain('sitemap.missing-page')
  })
})

describe('content.duplicate', () => {
  const SITE_ONLY = { page: [], site: CONTENT_SITE_RULES }

  it('zgłasza dwie strony o identycznej treści', () => {
    const a = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/a')
    const b = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/b')
    const result = auditSite(site([a, b]), ctx(), SITE_ONLY)
    const found = result.findings.find((f) => f.ruleId === 'content.duplicate')
    expect(found?.evidence['liczba stron']).toBe(2)
    expect(found?.evidence['przykłady']).toBe('https://przyklad.test/a, https://przyklad.test/b')
  })

  it('nie zgłasza stron o różnej treści', () => {
    const a = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/a')
    const b = pageFromHtml(
      HEALTHY_HTML.replace(/Zdanie wypełniające treść[^<]*/, 'Inna treść tej strony. '.repeat(60)),
      'https://przyklad.test/b',
    )
    const result = auditSite(site([a, b]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).not.toContain('content.duplicate')
  })

  it('nie uznaje dwóch pustych stron za duplikat treści — to inny problem', () => {
    const pusta = '<html lang="pl"><head><title>Pusta strona testowa</title></head><body><h1>X</h1></body></html>'
    const a = pageFromHtml(pusta, 'https://przyklad.test/a')
    const b = pageFromHtml(pusta, 'https://przyklad.test/b')
    const result = auditSite(site([a, b]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).not.toContain('content.duplicate')
  })
})
