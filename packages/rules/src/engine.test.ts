import { describe, expect, it } from 'vitest'
import { runRules } from './engine.js'
import { finding, type PageRule } from './rule.js'
import { HEALTHY_HTML, ctx, pageFromHtml } from './support.test-helper.js'

const alwaysFires: PageRule = {
  id: 'test.always',
  category: 'content',
  severity: 'low',
  requires: [],
  title: 'Zawsze zgłasza',
  evaluate: (page) => [finding(alwaysFires, page.url, { 'x': 1 })],
}

const needsGraph: PageRule = {
  id: 'test.needs-graph',
  category: 'links',
  severity: 'low',
  requires: ['link-graph', 'complete-crawl'],
  title: 'Wymaga grafu',
  evaluate: (page) => [finding(needsGraph, page.url, { 'x': 1 })],
}

const crashes: PageRule = {
  id: 'test.crashes',
  category: 'content',
  severity: 'low',
  requires: [],
  title: 'Wybucha',
  evaluate: () => { throw new Error('celowy błąd reguły') },
}

const page = pageFromHtml(HEALTHY_HTML)

describe('runRules', () => {
  it('uruchamia regułę ze spełnionymi wymaganiami', () => {
    const result = runRules([alwaysFires], page, ctx())
    expect(result.findings.map((f) => f.ruleId)).toEqual(['test.always'])
    expect(result.skipped).toEqual([])
  })

  it('regułę z niespełnionymi wymaganiami melduje jako pominiętą, nie jako w porządku', () => {
    const result = runRules([needsGraph], page, ctx({ capabilities: new Set(['page-facts']) }))
    expect(result.findings).toEqual([])
    expect(result.skipped).toEqual([
      { ruleId: 'test.needs-graph', missing: ['link-graph', 'complete-crawl'] },
    ])
  })

  it('wymienia tylko brakujące wymagania, nie wszystkie', () => {
    const result = runRules([needsGraph], page, ctx({ capabilities: new Set(['link-graph']) }))
    expect(result.skipped[0]?.missing).toEqual(['complete-crawl'])
  })

  it('błąd w jednej regule nie kasuje pozostałych', () => {
    const result = runRules([crashes, alwaysFires], page, ctx())
    expect(result.findings.map((f) => f.ruleId)).toEqual(['rule.crashed', 'test.always'])
    expect(result.findings[0]?.evidence['reguła']).toBe('test.crashes')
    expect(result.findings[0]?.evidence['błąd']).toBe('celowy błąd reguły')
  })

  it('pusta lista reguł daje pusty wynik, nie wyjątek', () => {
    expect(runRules([], page, ctx())).toEqual({ findings: [], skipped: [] })
  })
})
