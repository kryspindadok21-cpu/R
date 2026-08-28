import { describe, expect, it } from 'vitest'
import { auditSite } from '../audit.js'
import { runRules } from '../engine.js'
import type { GraphFacts } from '../rule.js'
import { HEALTHY_HTML, ctx, http, pageFromHtml, site } from '../support.test-helper.js'
import { LINK_PAGE_RULES, LINK_SITE_RULES } from './links.js'

const graph = (o: Partial<GraphFacts> = {}): GraphFacts =>
  ({ inDegree: 3, outDegree: 4, clickDepth: 1, ...o })

function idsFor(html: string, overrides = {}): string[] {
  const page = pageFromHtml(html, 'https://przyklad.test/strona', { graph: graph(), ...overrides })
  return runRules(LINK_PAGE_RULES, page, ctx()).findings.map((f) => f.ruleId)
}

const SITE_ONLY = { page: [], site: LINK_SITE_RULES }

describe('reguły linków — strona poprawna', () => {
  it('nie zgłasza niczego dla zdrowej strony', () => {
    expect(idsFor(HEALTHY_HTML)).toEqual([])
  })
})

describe('link.nofollow-internal', () => {
  it('zgłasza nofollow na linku wewnętrznym', () => {
    const html = HEALTHY_HTML.replace('<a href="/inna-strona">', '<a href="/inna-strona" rel="nofollow">')
    expect(idsFor(html)).toContain('link.nofollow-internal')
  })

  it('nie zgłasza nofollow na linku zewnętrznym', () => {
    const html = HEALTHY_HTML.replace('<a href="/inna-strona">', '<a href="https://obca.test/x" rel="nofollow">')
    expect(idsFor(html)).not.toContain('link.nofollow-internal')
  })
})

describe('link.empty-anchor i link.generic-anchor', () => {
  it('zgłasza link bez tekstu kotwicy', () => {
    const html = HEALTHY_HTML.replace('>Przejdź do opisu metody pomiaru<', '><')
    expect(idsFor(html)).toContain('link.empty-anchor')
  })

  it('nie zgłasza linku owijającego obraz — alt daje mu nazwę', () => {
    const html = HEALTHY_HTML.replace(
      '<a href="/inna-strona">Przejdź do opisu metody pomiaru</a>',
      '<a href="/inna-strona"><img src="/i.png" alt="Opis" width="10" height="10"></a>',
    )
    expect(idsFor(html)).not.toContain('link.empty-anchor')
  })

  it('zgłasza kotwicę, która nie mówi dokąd prowadzi', () => {
    const html = HEALTHY_HTML.replace('>Przejdź do opisu metody pomiaru<', '>kliknij tutaj<')
    expect(idsFor(html)).toContain('link.generic-anchor')
  })

  it('nie zgłasza kotwicy opisowej', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('link.generic-anchor')
  })
})

describe('page.dead-end i page.too-deep', () => {
  it('zgłasza stronę bez linków wychodzących', () => {
    expect(idsFor(HEALTHY_HTML, { graph: graph({ outDegree: 0 }) })).toContain('page.dead-end')
  })

  it('nie zgłasza strony z linkami wychodzącymi', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('page.dead-end')
  })

  it('zgłasza stronę głębiej niż próg', () => {
    expect(idsFor(HEALTHY_HTML, { graph: graph({ clickDepth: 7 }) })).toContain('page.too-deep')
  })

  it('nie zgłasza strony w zasięgu progu', () => {
    expect(idsFor(HEALTHY_HTML, { graph: graph({ clickDepth: 2 }) })).not.toContain('page.too-deep')
  })

  it('milczy, gdy grafu nie zbudowano', () => {
    const page = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/strona', { graph: null })
    const result = runRules(LINK_PAGE_RULES, page, ctx({ capabilities: new Set(['page-facts', 'http-response']) }))
    expect(result.skipped.map((s) => s.ruleId)).toEqual(['page.dead-end', 'page.too-deep'])
  })
})

describe('link.broken-internal', () => {
  const home = pageFromHtml(
    HEALTHY_HTML.replace('href="/inna-strona"', 'href="/martwa"'),
    'https://przyklad.test/',
    { graph: graph() },
  )
  const dead = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/martwa', {
    http: http({ status: 404 }),
    graph: graph(),
  })
  const alive = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/martwa', { graph: graph() })

  it('zgłasza link prowadzący do 404 z podaniem strony źródłowej', () => {
    const result = auditSite(site([home, dead]), ctx(), SITE_ONLY)
    const found = result.findings.find((f) => f.ruleId === 'link.broken-internal')
    expect(found?.url).toBe('https://przyklad.test/')
    expect(found?.evidence['status celu']).toBe(404)
  })

  it('nie zgłasza linku do strony działającej', () => {
    const result = auditSite(site([home, alive]), ctx(), SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'link.broken-internal')).toEqual([])
  })

  it('milczy przy crawlu uciętym — brak celu nie dowodzi, że link jest zepsuty', () => {
    const partial = ctx({ capabilities: new Set(['page-facts', 'http-response', 'link-graph']) })
    const result = auditSite(site([home, dead]), partial, SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'link.broken-internal')).toEqual([])
    expect(result.skipped.map((s) => s.ruleId)).toContain('link.broken-internal')
  })
})

describe('link.to-redirect', () => {
  it('zgłasza link prowadzący przez przekierowanie', () => {
    const home = pageFromHtml(
      HEALTHY_HTML.replace('href="/inna-strona"', 'href="/stara"'),
      'https://przyklad.test/',
      { graph: graph() },
    )
    // Crawler zapisuje strone pod adresem koncowym; `/stara` zostaje w lancuchu.
    const target = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/nowa', {
      http: http({ redirectChain: ['https://przyklad.test/stara'] }),
      graph: graph(),
    })
    const result = auditSite(site([home, target]), ctx(), SITE_ONLY)
    expect(result.findings.map((f) => f.ruleId)).toContain('link.to-redirect')
  })

  it('nie zgłasza linku prowadzącego prosto do celu', () => {
    const home = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/', { graph: graph() })
    const target = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/inna-strona', { graph: graph() })
    const result = auditSite(site([home, target]), ctx(), SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'link.to-redirect')).toEqual([])
  })
})

describe('page.orphan', () => {
  const home = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/', { graph: graph({ inDegree: 0 }) })
  const orphan = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/ukryta', { graph: graph({ inDegree: 0 }) })
  const linked = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/widoczna', { graph: graph({ inDegree: 2 }) })

  it('zgłasza stronę bez linków przychodzących', () => {
    const result = auditSite(site([home, orphan, linked]), ctx(), SITE_ONLY)
    const found = result.findings.filter((f) => f.ruleId === 'page.orphan')
    expect(found.map((f) => f.url)).toEqual(['https://przyklad.test/ukryta'])
  })

  it('nie oskarża strony głównej o osierocenie', () => {
    const result = auditSite(site([home]), ctx(), SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'page.orphan')).toEqual([])
  })

  it('milczy przy crawlu uciętym limitem — to jest cały sens `requires`', () => {
    const partial = ctx({ capabilities: new Set(['page-facts', 'http-response', 'link-graph']) })
    const result = auditSite(site([home, orphan]), partial, SITE_ONLY)
    expect(result.findings.filter((f) => f.ruleId === 'page.orphan')).toEqual([])
    expect(result.skipped.map((s) => s.ruleId)).toContain('page.orphan')
  })
})
