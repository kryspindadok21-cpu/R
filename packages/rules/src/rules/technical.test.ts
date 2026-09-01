import { describe, expect, it } from 'vitest'
import { auditSite } from '../audit.js'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, http, pageFromHtml, site } from '../support.test-helper.js'
import { TECHNICAL_PAGE_RULES, TECHNICAL_SITE_RULES } from './technical.js'

function idsFor(html: string, overrides = {}): string[] {
  return runRules(TECHNICAL_PAGE_RULES, pageFromHtml(html, 'https://przyklad.test/strona', overrides), ctx())
    .findings.map((f) => f.ruleId)
}

const SITE_ONLY = { page: [], site: TECHNICAL_SITE_RULES }

describe('reguły techniczne — strona poprawna', () => {
  it('nie zgłasza niczego', () => {
    expect(idsFor(HEALTHY_HTML)).toEqual([])
  })
})

describe('viewport i charset', () => {
  it('zgłasza brak viewport', () => {
    expect(idsFor(HEALTHY_HTML.replace(/<meta name="viewport"[^>]*>/, ''))).toContain('viewport.missing')
  })

  it('zgłasza brak deklaracji kodowania', () => {
    expect(idsFor(HEALTHY_HTML.replace('<meta charset="utf-8">', ''))).toContain('charset.missing')
  })

  it('uznaje kodowanie podane przez http-equiv', () => {
    const html = HEALTHY_HTML.replace(
      '<meta charset="utf-8">',
      '<meta http-equiv="content-type" content="text/html; charset=utf-8">',
    )
    expect(idsFor(html)).not.toContain('charset.missing')
  })
})

describe('hreflang.invalid-code', () => {
  it('zgłasza kod, który nie jest kodem języka', () => {
    const html = HEALTHY_HTML.replace('</head>', '<link rel="alternate" hreflang="polski" href="/pl"></head>')
    expect(idsFor(html)).toContain('hreflang.invalid-code')
  })

  it('przyjmuje pl, pl-PL i x-default', () => {
    const links = ['pl', 'pl-PL', 'x-default']
      .map((code) => `<link rel="alternate" hreflang="${code}" href="/${code}">`).join('')
    expect(idsFor(HEALTHY_HTML.replace('</head>', `${links}</head>`)))
      .not.toContain('hreflang.invalid-code')
  })
})

describe('page.slow-response i page.too-heavy', () => {
  it('zgłasza wolną odpowiedź', () => {
    expect(idsFor(HEALTHY_HTML, { http: http({ durationMs: 4000 }) })).toContain('page.slow-response')
  })

  it('nie zgłasza szybkiej odpowiedzi', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('page.slow-response')
  })

  it('zgłasza bardzo duży dokument', () => {
    const heavy = HEALTHY_HTML.replace('</body>', `<div>${'x'.repeat(600_000)}</div></body>`)
    expect(idsFor(heavy)).toContain('page.too-heavy')
  })

  it('nie zgłasza dokumentu normalnej wielkości', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('page.too-heavy')
  })
})

describe('hreflang.missing-return', () => {
  const pl = pageFromHtml(
    HEALTHY_HTML.replace('</head>', '<link rel="alternate" hreflang="en" href="https://przyklad.test/en"></head>'),
    'https://przyklad.test/pl',
  )
  const enBezPowrotu = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/en')
  const enZPowrotem = pageFromHtml(
    HEALTHY_HTML.replace('</head>', '<link rel="alternate" hreflang="pl" href="https://przyklad.test/pl"></head>'),
    'https://przyklad.test/en',
  )

  it('zgłasza brak odnośnika zwrotnego', () => {
    const result = auditSite(site([pl, enBezPowrotu]), ctx(), SITE_ONLY)
    const found = result.findings.find((f) => f.ruleId === 'hreflang.missing-return')
    expect(found?.url).toBe('https://przyklad.test/pl')
    expect(found?.evidence['wskazuje na']).toBe('https://przyklad.test/en')
  })

  it('nie zgłasza pary wskazującej na siebie wzajemnie', () => {
    const result = auditSite(site([pl, enZPowrotem]), ctx(), SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'hreflang.missing-return')).toEqual([])
  })

  it('nie oskarża o brak powrotu strony, której nie odwiedziliśmy', () => {
    const result = auditSite(site([pl]), ctx(), SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'hreflang.missing-return')).toEqual([])
  })
})

describe('sitemap.dead-url', () => {
  it('zgłasza adres z mapy, który zwraca 404', () => {
    const dead = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/usunieta', { http: http({ status: 404 }) })
    const result = auditSite(
      site([dead], { sitemapUrls: ['https://przyklad.test/usunieta'] }),
      ctx(),
      SITE_ONLY,
    )
    const found = result.findings.find((f) => f.ruleId === 'sitemap.dead-url')
    expect(found?.url).toBe('https://przyklad.test/usunieta')
    expect(found?.evidence['status']).toBe(404)
  })

  it('nie zgłasza adresu z mapy, który działa', () => {
    const alive = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/zywa')
    const result = auditSite(
      site([alive], { sitemapUrls: ['https://przyklad.test/zywa'] }),
      ctx(),
      SITE_ONLY,
    )
    expect(result.findings.filter((f) => f.ruleId === 'sitemap.dead-url')).toEqual([])
  })

  it('milczy, gdy mapy w ogóle nie odczytano', () => {
    const dead = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/usunieta', { http: http({ status: 404 }) })
    const bezMapy = ctx({ capabilities: new Set(['page-facts', 'http-response', 'complete-crawl']) })
    const result = auditSite(site([dead], { sitemapUrls: [] }), bezMapy, SITE_ONLY)
    expect(result.skipped.map((s) => s.ruleId)).toContain('sitemap.dead-url')
  })
})

describe('sitemap.not-discoverable', () => {
  const zbadaj = (robotsState: 'ok' | 'missing' | 'unreachable', siteUrl: string) =>
    auditSite(
      site([], { siteUrl, sitemapUrls: [`${siteUrl}a/`, `${siteUrl}b/`], robotsState }),
      ctx(),
      SITE_ONLY,
    )

  const ustalenie = (w: ReturnType<typeof zbadaj>) =>
    w.findings.find((f) => f.ruleId === 'sitemap.not-discoverable')

  it('milczy, gdy robots.txt stoi pod korzeniem hosta', () => {
    expect(ustalenie(zbadaj('ok', 'https://przyklad.test/'))).toBeUndefined()
  })

  /**
   * Sedno: plik istnieje i otwiera sie w przegladarce, wiec nic nie wyglada
   * na zepsute — a linijka `Sitemap:` w nim jest martwa.
   */
  it('łapie witrynę w podkatalogu, gdzie robots.txt hosta nie istnieje', () => {
    const f = ustalenie(zbadaj('missing', 'https://kto.github.io/repo/'))
    expect(f).toBeDefined()
    expect(f?.severity).toBe('medium')
    expect(f?.url).toBeNull()
    expect(String(f?.evidence['robots.txt pod korzeniem hosta']))
      .toBe('https://kto.github.io/robots.txt — nie istnieje')
    expect(f?.evidence['witryna w podkatalogu']).toBe(true)
    expect(f?.evidence['adresów w mapie']).toBe(2)
    expect(String(f?.evidence['co zrobić'])).toContain('zgłoś mapę ręcznie')
  })

  it('przy witrynie pod korzeniem radzi dodać robots.txt, a nie zgłaszać ręcznie', () => {
    const f = ustalenie(zbadaj('missing', 'https://przyklad.test/'))
    expect(f?.evidence['witryna w podkatalogu']).toBe(false)
    expect(String(f?.evidence['co zrobić'])).toContain('dodaj robots.txt')
  })

  it('nieosiągalny robots.txt to inny powód niż brak', () => {
    const f = ustalenie(zbadaj('unreachable', 'https://przyklad.test/'))
    expect(String(f?.evidence['robots.txt pod korzeniem hosta'])).toContain('nieosiągalny')
  })

  /** Bez mapy nie ma czego nie odkryć — reguła melduje się jako pominięta (D17). */
  it('bez mapy witryny melduje się jako pominięta, a nie milczy po cichu', () => {
    const wynik = auditSite(
      site([], { robotsState: 'missing' }),
      ctx({ capabilities: new Set(['page-facts', 'http-response', 'link-graph', 'complete-crawl']) }),
      SITE_ONLY,
    )
    expect(wynik.findings.map((f) => f.ruleId)).not.toContain('sitemap.not-discoverable')
    expect(wynik.skipped.map((s) => s.ruleId)).toContain('sitemap.not-discoverable')
  })
})
