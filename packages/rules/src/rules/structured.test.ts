import { describe, expect, it } from 'vitest'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, pageFromHtml } from '../support.test-helper.js'
import { STRUCTURED_PAGE_RULES } from './structured.js'

const LD = /<script type="application\/ld\+json">.*?<\/script>/s

function idsFor(html: string): string[] {
  return runRules(STRUCTURED_PAGE_RULES, pageFromHtml(html), ctx()).findings.map((f) => f.ruleId)
}

function withLd(body: string): string {
  return HEALTHY_HTML.replace(LD, `<script type="application/ld+json">${body}</script>`)
}

describe('reguły danych strukturalnych', () => {
  it('nie zgłasza niczego dla poprawnej strony', () => {
    expect(idsFor(HEALTHY_HTML)).toEqual([])
  })

  it('zgłasza blok z błędem składni i podaje treść błędu', () => {
    const findings = runRules(
      STRUCTURED_PAGE_RULES,
      pageFromHtml(withLd('{ to nie jest json }')),
      ctx(),
    ).findings
    const found = findings.find((f) => f.ruleId === 'jsonld.invalid')
    expect(found).toBeDefined()
    expect(String(found?.evidence['błąd'])).not.toBe('')
  })

  it('zgłasza brak danych strukturalnych', () => {
    expect(idsFor(HEALTHY_HTML.replace(LD, ''))).toContain('jsonld.missing')
  })

  it('zgłasza blok bez @type', () => {
    expect(idsFor(withLd('{"name":"Coś bez typu"}'))).toContain('jsonld.empty-type')
  })

  it('zgłasza artykuł bez pola headline', () => {
    const findings = runRules(
      STRUCTURED_PAGE_RULES,
      pageFromHtml(withLd('{"@context":"https://schema.org","@type":"Article","author":{"@type":"Person","name":"Jan"}}')),
      ctx(),
    ).findings
    const found = findings.find((f) => f.ruleId === 'jsonld.missing-required-field')
    expect(found?.evidence['typ']).toBe('Article')
    expect(found?.evidence['brakujące pola']).toBe('headline')
  })

  it('nie zgłasza artykułu z kompletem pól', () => {
    const ld = '{"@context":"https://schema.org","@type":"Article","headline":"Tytuł"}'
    expect(idsFor(withLd(ld))).not.toContain('jsonld.missing-required-field')
  })

  it('nie zgłasza typu spoza listy pól wymaganych', () => {
    expect(idsFor(withLd('{"@type":"WebSite","url":"https://przyklad.test/"}')))
      .not.toContain('jsonld.missing-required-field')
  })

  it('zgłasza brak OpenGraph', () => {
    expect(idsFor(HEALTHY_HTML.replace(/<meta property="og:title"[^>]*>/, '')))
      .toContain('og.missing')
  })

  it('zgłasza brak karty Twittera', () => {
    expect(idsFor(HEALTHY_HTML.replace(/<meta name="twitter:card"[^>]*>/, '')))
      .toContain('twitter.missing')
  })

  it('nie zgłasza obecnych znaczników społecznościowych', () => {
    const ids = idsFor(HEALTHY_HTML)
    expect(ids).not.toContain('og.missing')
    expect(ids).not.toContain('twitter.missing')
  })
})
