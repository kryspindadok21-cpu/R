import { diffRenderedFacts, parsePage } from '@seo/parse'
import { describe, expect, it } from 'vitest'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, pageFromHtml, readPageFixture } from '../support.test-helper.js'
import { AI_PAGE_RULES } from './ai.js'

const URL_SKLEP = 'https://przyklad.test/sklep'

function idsFor(html: string, overrides = {}): string[] {
  return runRules(AI_PAGE_RULES, pageFromHtml(html, 'https://przyklad.test/strona', overrides), ctx())
    .findings.map((f) => f.ruleId)
}

function diffFor(rawFixture: string, renderedFixture: string) {
  return diffRenderedFacts(
    parsePage(readPageFixture(rawFixture), { url: URL_SKLEP }),
    parsePage(readPageFixture(renderedFixture), { url: URL_SKLEP }),
  )
}

describe('ai.js-required-for-content', () => {
  it('zgłasza stronę, której treść istnieje dopiero po wykonaniu JS', () => {
    const page = pageFromHtml(readPageFixture('csr-pusty.html'), URL_SKLEP, {
      renderDiff: diffFor('csr-pusty.html', 'csr-wyrenderowany.html'),
    })
    const findings = runRules(AI_PAGE_RULES, page, ctx()).findings
    const found = findings.find((f) => f.ruleId === 'ai.js-required-for-content')
    expect(found?.evidence['słowa bez JS']).toBe(0)
    expect(found?.evidence['linki widoczne dopiero po JS']).toBe(2)
  })

  it('nie zgłasza strony renderowanej po stronie serwera', () => {
    const facts = parsePage(HEALTHY_HTML, { url: 'https://przyklad.test/strona' })
    expect(idsFor(HEALTHY_HTML, { renderDiff: diffRenderedFacts(facts, facts) }))
      .not.toContain('ai.js-required-for-content')
  })

  it('milczy, gdy strony nie renderowano — brak pomiaru to nie brak problemu', () => {
    const page = pageFromHtml(readPageFixture('csr-pusty.html'), URL_SKLEP, { renderDiff: null })
    const bezRenderu = ctx({ capabilities: new Set(['page-facts', 'http-response']) })
    const result = runRules(AI_PAGE_RULES, page, bezRenderu)
    expect(result.skipped.map((s) => s.ruleId)).toEqual(['ai.js-required-for-content'])
  })
})

describe('ai.answer-not-upfront', () => {
  it('zgłasza stronę, gdzie po H1 nie ma odpowiedzi', () => {
    const html = HEALTHY_HTML.replace(
      /<p>Pierwszy akapit[^<]*<\/p>/,
      '<p>Zapraszamy.</p>',
    )
    expect(idsFor(html)).toContain('ai.answer-not-upfront')
  })

  it('zgłasza brak jakiegokolwiek akapitu po H1', () => {
    const html = HEALTHY_HTML.replace(/<p>Pierwszy akapit[^<]*<\/p>/, '')
      .replace(/<p>Zdanie[^<]*<\/p>/, '')
    expect(idsFor(html)).toContain('ai.answer-not-upfront')
  })

  it('nie zgłasza strony z odpowiedzią wprost', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('ai.answer-not-upfront')
  })
})

describe('ai.chunk-not-standalone', () => {
  it('zgłasza nagłówek bez własnego kontekstu', () => {
    const html = HEALTHY_HTML.replace(
      '<h2>Sekcja o kolejności sprawdzeń w audycie technicznym</h2>',
      '<h2>Dlaczego?</h2>',
    )
    expect(idsFor(html)).toContain('ai.chunk-not-standalone')
  })

  it('zgłasza nagłówek zbyt krótki, żeby stać samodzielnie', () => {
    const html = HEALTHY_HTML.replace(
      '<h2>Sekcja o kolejności sprawdzeń w audycie technicznym</h2>',
      '<h2>Ceny</h2>',
    )
    expect(idsFor(html)).toContain('ai.chunk-not-standalone')
  })

  it('nie zgłasza nagłówka niosącego podmiot', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('ai.chunk-not-standalone')
  })

  it('strona bez nagłówków sekcji nie generuje ustalenia', () => {
    const html = HEALTHY_HTML.replace('<h2>Sekcja o kolejności sprawdzeń w audycie technicznym</h2>', '')
    expect(idsFor(html)).not.toContain('ai.chunk-not-standalone')
  })
})
