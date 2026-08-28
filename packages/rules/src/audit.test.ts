import { describe, expect, it } from 'vitest'
import { auditSite } from './audit.js'
import { ALL_PAGE_RULES, ALL_RULES, ALL_SITE_RULES } from './rules/index.js'
import { HEALTHY_HTML, ALL_CAPABILITIES, ctx, http, pageFromHtml, site } from './support.test-helper.js'

const ALL = [...ALL_PAGE_RULES, ...ALL_SITE_RULES]

describe('rejestr reguł', () => {
  it('ma co najmniej 40 reguł — tyle obiecuje plan Fazy 1', () => {
    expect(ALL.length).toBeGreaterThanOrEqual(40)
  })

  it('identyfikatory są unikalne — po nich porównujemy audyty', () => {
    const ids = ALL.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('każda reguła ma tytuł po polsku i niepustą kategorię', () => {
    for (const rule of ALL) {
      expect(rule.title.length, rule.id).toBeGreaterThan(5)
      expect(rule.category.length, rule.id).toBeGreaterThan(0)
    }
  })

  it('identyfikator ma postać obszar.problem', () => {
    for (const rule of ALL) expect(rule.id, rule.id).toMatch(/^[a-z0-9]+\.[a-z0-9-]+$/)
  })

  it('żadna reguła nie wymaga zdolności spoza listy', () => {
    for (const rule of ALL) {
      for (const capability of rule.requires) {
        expect(ALL_CAPABILITIES, rule.id).toContain(capability)
      }
    }
  })
})

describe('auditSite', () => {
  // Adres musi zgadzac sie z canonical w HEALTHY_HTML — inaczej strona „zdrowa"
  // slusznie dostaje ustalenie o kanonicznym wskazujacym gdzie indziej.
  const healthy = pageFromHtml(HEALTHY_HTML, 'https://przyklad.test/strona', {
    graph: { inDegree: 2, outDegree: 3, clickDepth: 0 },
  })
  const broken = pageFromHtml(
    '<html><head></head><body><h2>Dlaczego?</h2></body></html>',
    'https://przyklad.test/zepsuta',
    { http: http({ status: 500, durationMs: 5000 }), graph: { inDegree: 0, outDegree: 0, clickDepth: null } },
  )

  it('liczy ustalenia wg wagi, bez żadnej oceny zbiorczej', () => {
    const result = auditSite(site([healthy, broken]), ctx(), ALL_RULES)
    expect(result.countsBySeverity.blocker).toBeGreaterThan(0)
    expect(Object.keys(result.countsBySeverity).sort())
      .toEqual(['blocker', 'high', 'info', 'low', 'medium'])
    expect(result).not.toHaveProperty('score')
  })

  it('porządkuje ustalenia od najcięższych', () => {
    const result = auditSite(site([healthy, broken]), ctx(), ALL_RULES)
    const first = result.findings[0]
    expect(first?.severity).toBe('blocker')
  })

  it('daje ten sam wynik przy powtórzeniu — inaczej Faza 4 mierzyłaby szum', () => {
    const input = site([healthy, broken])
    const a = auditSite(input, ctx(), ALL_RULES)
    const b = auditSite(input, ctx(), ALL_RULES)
    expect(a.findings).toEqual(b.findings)
    expect(a.topRules).toEqual(b.topRules)
  })

  it('zdrowa strona nie generuje ustalenia cięższego niż low', () => {
    const result = auditSite(site([healthy], { siteUrl: 'https://przyklad.test/strona' }), ctx(), ALL_RULES)
    const heavy = result.findings.filter((f) => ['blocker', 'high', 'medium'].includes(f.severity))
    expect(heavy.map((f) => `${f.ruleId} ${JSON.stringify(f.evidence)}`)).toEqual([])
  })

  it('bez zdolności milkną reguły ich wymagające i wszystkie trafiają na listę pominiętych', () => {
    const minimal = ctx({ capabilities: new Set(['page-facts', 'http-response']) })
    const result = auditSite(site([healthy, broken]), minimal, ALL_RULES)
    const skippedIds = result.skipped.map((s) => s.ruleId)
    expect(skippedIds).toContain('page.orphan')
    expect(skippedIds).toContain('title.duplicate')
    expect(skippedIds).toContain('ai.js-required-for-content')
    expect(result.findings.map((f) => f.ruleId)).not.toContain('page.orphan')
  })

  it('podaje liczbę zaudytowanych stron', () => {
    expect(auditSite(site([healthy, broken]), ctx(), ALL_RULES).pagesAudited).toBe(2)
  })
})
