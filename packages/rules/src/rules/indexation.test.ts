import { describe, expect, it } from 'vitest'
import { auditSite } from '../audit.js'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, http, pageFromHtml, site } from '../support.test-helper.js'
import { INDEXATION_PAGE_RULES, INDEXATION_SITE_RULES } from './indexation.js'

function idsFor(html: string, overrides = {}, url = 'https://przyklad.test/strona'): string[] {
  const page = pageFromHtml(html, url, overrides)
  return runRules(INDEXATION_PAGE_RULES, page, ctx()).findings.map((f) => f.ruleId)
}

const NO_RULES = { page: [], site: INDEXATION_SITE_RULES }

describe('reguły indeksacji — strona poprawna', () => {
  it('nie zgłasza niczego dla zdrowej strony', () => {
    expect(idsFor(HEALTHY_HTML)).toEqual([])
  })
})

describe('noindex.present', () => {
  it('zgłasza stronę wykluczającą się z indeksu', () => {
    const html = HEALTHY_HTML.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta name="robots" content="noindex, follow">')
    expect(idsFor(html)).toContain('noindex.present')
  })

  it('nie zgłasza strony bez dyrektywy robots', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('noindex.present')
  })
})

describe('canonical.missing', () => {
  it('zgłasza brak adresu kanonicznego na stronie indeksowalnej', () => {
    const html = HEALTHY_HTML.replace('<link rel="canonical" href="https://przyklad.test/strona">', '')
    expect(idsFor(html)).toContain('canonical.missing')
  })

  it('nie zgłasza braku na stronie z błędem 404 — tam canonical niczego nie zmienia', () => {
    const html = HEALTHY_HTML.replace('<link rel="canonical" href="https://przyklad.test/strona">', '')
    expect(idsFor(html, { http: http({ status: 404 }) })).not.toContain('canonical.missing')
  })
})

describe('canonical.points-elsewhere', () => {
  it('zgłasza canonical wskazujący inną stronę', () => {
    const html = HEALTHY_HTML.replace('href="https://przyklad.test/strona"', 'href="https://przyklad.test/inna"')
    expect(idsFor(html)).toContain('canonical.points-elsewhere')
  })

  it('nie zgłasza różnicy w parametrze śledzącym — normalizacja go usuwa', () => {
    const html = HEALTHY_HTML.replace(
      'href="https://przyklad.test/strona"',
      'href="https://przyklad.test/strona?utm_source=newsletter"',
    )
    expect(idsFor(html)).not.toContain('canonical.points-elsewhere')
  })

  // D4 Fazy 0 celowo trzyma `/strona` i `/strona/` jako osobne adresy „do czasu, aż
  // crawler wykaże przekierowanie". Zgłoszenie jest tu poprawne: albo canonical jest
  // zły, albo brakuje przekierowania — jedno i drugie warto zobaczyć.
  it('zgłasza różnicę w ukośniku końcowym, zgodnie z D4', () => {
    const html = HEALTHY_HTML.replace('href="https://przyklad.test/strona"', 'href="https://przyklad.test/strona/"')
    expect(idsFor(html)).toContain('canonical.points-elsewhere')
  })
})

describe('http.status-4xx i 5xx', () => {
  it('zgłasza 404 jako błąd wysokiej wagi', () => {
    expect(idsFor(HEALTHY_HTML, { http: http({ status: 404 }) })).toContain('http.status-4xx')
  })

  it('zgłasza 503 jako blokadę', () => {
    expect(idsFor(HEALTHY_HTML, { http: http({ status: 503 }) })).toContain('http.status-5xx')
  })

  it('nie myli 4xx z 5xx', () => {
    const ids = idsFor(HEALTHY_HTML, { http: http({ status: 404 }) })
    expect(ids).not.toContain('http.status-5xx')
  })

  it('status 200 nie daje żadnego ustalenia o statusie', () => {
    const ids = idsFor(HEALTHY_HTML)
    expect(ids).not.toContain('http.status-4xx')
    expect(ids).not.toContain('http.status-5xx')
  })
})

describe('http.fetch-failed', () => {
  it('zgłasza stronę, której nie udało się pobrać', () => {
    const page = {
      url: 'https://przyklad.test/martwa',
      depth: 1,
      http: http({ status: null, error: 'przekroczony czas oczekiwania' }),
      facts: null,
      renderDiff: null,
      graph: null,
      inSitemap: false,
    }
    const ids = runRules(INDEXATION_PAGE_RULES, page, ctx()).findings.map((f) => f.ruleId)
    expect(ids).toEqual(['http.fetch-failed'])
  })

  it('nie zgłasza strony pobranej poprawnie', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('http.fetch-failed')
  })
})

describe('redirect.chain-too-long i redirect.loop', () => {
  it('zgłasza łańcuch dłuższy niż próg', () => {
    const chain = ['https://przyklad.test/a', 'https://przyklad.test/b', 'https://przyklad.test/c']
    expect(idsFor(HEALTHY_HTML, { http: http({ redirectChain: chain }) }))
      .toContain('redirect.chain-too-long')
  })

  it('nie zgłasza łańcucha mieszczącego się w progu', () => {
    expect(idsFor(HEALTHY_HTML, { http: http({ redirectChain: ['https://przyklad.test/a'] }) }))
      .not.toContain('redirect.chain-too-long')
  })

  it('zgłasza pętlę i nie zapętla się sama', () => {
    const chain = ['https://przyklad.test/a', 'https://przyklad.test/b', 'https://przyklad.test/a']
    expect(idsFor(HEALTHY_HTML, { http: http({ redirectChain: chain }) })).toContain('redirect.loop')
  })

  it('nie widzi pętli w łańcuchu bez powtórzeń', () => {
    const chain = ['https://przyklad.test/a', 'https://przyklad.test/b']
    expect(idsFor(HEALTHY_HTML, { http: http({ redirectChain: chain }) })).not.toContain('redirect.loop')
  })
})

describe('canonical.chain', () => {
  const pageA = pageFromHtml(
    HEALTHY_HTML.replace('href="https://przyklad.test/strona"', 'href="https://przyklad.test/b"'),
    'https://przyklad.test/a',
  )
  const pageB = pageFromHtml(
    HEALTHY_HTML.replace('href="https://przyklad.test/strona"', 'href="https://przyklad.test/c"'),
    'https://przyklad.test/b',
  )
  const pageC = pageFromHtml(
    HEALTHY_HTML.replace('href="https://przyklad.test/strona"', 'href="https://przyklad.test/c"'),
    'https://przyklad.test/c',
  )

  it('zgłasza łańcuch a → b → c', () => {
    const result = auditSite(site([pageA, pageB, pageC]), ctx(), NO_RULES)
    const chain = result.findings.filter((f) => f.ruleId === 'canonical.chain')
    expect(chain).toHaveLength(1)
    expect(chain[0]?.url).toBe('https://przyklad.test/a')
  })

  it('nie zgłasza pojedynczego przeskoku b → c', () => {
    const result = auditSite(site([pageB, pageC]), ctx(), NO_RULES)
    expect(result.findings.filter((f) => f.ruleId === 'canonical.chain')).toEqual([])
  })

  it('milczy, gdy crawl był ucięty — wtedy nie wiemy, czy łańcuch istnieje', () => {
    const partial = ctx({ capabilities: new Set(['page-facts', 'link-graph']) })
    const result = auditSite(site([pageA, pageB, pageC]), partial, NO_RULES)
    expect(result.findings.filter((f) => f.ruleId === 'canonical.chain')).toEqual([])
    expect(result.skipped.map((s) => s.ruleId)).toContain('canonical.chain')
  })
})

describe('robots.blocked-but-linked', () => {
  it('zgłasza stronę zablokowaną w robots.txt, do której prowadzi link wewnętrzny', () => {
    const html = HEALTHY_HTML.replace('href="/inna-strona"', 'href="/panel"')
    const pages = [pageFromHtml(html, 'https://przyklad.test/strona')]
    const result = auditSite(
      site(pages, { robotsBlockedUrls: ['https://przyklad.test/panel'] }),
      ctx(),
      NO_RULES,
    )
    const found = result.findings.filter((f) => f.ruleId === 'robots.blocked-but-linked')
    expect(found).toHaveLength(1)
    expect(found[0]?.evidence['linkowana z']).toBe('https://przyklad.test/strona')
  })

  it('nie zgłasza blokady, do której nic nie linkuje', () => {
    const pages = [pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/strona')]
    const result = auditSite(
      site(pages, { robotsBlockedUrls: ['https://przyklad.test/panel'] }),
      ctx(),
      NO_RULES,
    )
    expect(result.findings.filter((f) => f.ruleId === 'robots.blocked-but-linked')).toEqual([])
  })
})
