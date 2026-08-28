import { describe, expect, it } from 'vitest'
import { runRules } from '../engine.js'
import { HEALTHY_HTML, ctx, pageFromHtml } from '../support.test-helper.js'
import { IMAGE_PAGE_RULES } from './images.js'

const IMG = '<img src="/obraz.png" alt="Opis obrazu" width="640" height="480">'

function idsFor(html: string): string[] {
  return runRules(IMAGE_PAGE_RULES, pageFromHtml(html), ctx()).findings.map((f) => f.ruleId)
}

describe('reguły obrazów', () => {
  it('nie zgłasza niczego dla poprawnego obrazu', () => {
    expect(idsFor(HEALTHY_HTML)).toEqual([])
  })

  it('zgłasza obraz bez atrybutu alt', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, '<img src="/o.png" width="1" height="1">')))
      .toContain('image.missing-alt')
  })

  it('nie karze pustego alt — to poprawne oznaczenie obrazu dekoracyjnego', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, '<img src="/o.png" alt="" width="1" height="1">')))
      .not.toContain('image.missing-alt')
  })

  it('zgłasza tekst alternatywny, który jest opisem', () => {
    const long = 'x'.repeat(200)
    expect(idsFor(HEALTHY_HTML.replace(IMG, `<img src="/o.png" alt="${long}" width="1" height="1">`)))
      .toContain('image.alt-too-long')
  })

  it('nie zgłasza krótkiego alt', () => {
    expect(idsFor(HEALTHY_HTML)).not.toContain('image.alt-too-long')
  })

  it('zgłasza obraz bez wymiarów', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, '<img src="/o.png" alt="Opis">')))
      .toContain('image.missing-dimensions')
  })

  it('zgłasza brak samej wysokości', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, '<img src="/o.png" alt="Opis" width="10">')))
      .toContain('image.missing-dimensions')
  })

  it('zgłasza leniwe ładowanie pierwszego obrazu', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, '<img src="/o.png" alt="Opis" width="1" height="1" loading="lazy">')))
      .toContain('image.lazy-above-fold')
  })

  it('nie zgłasza leniwego ładowania obrazu dalszego niż pierwszy', () => {
    const two = `${IMG}<img src="/b.png" alt="Drugi" width="1" height="1" loading="lazy">`
    expect(idsFor(HEALTHY_HTML.replace(IMG, two))).not.toContain('image.lazy-above-fold')
  })

  it('zgłasza znacznik obrazu bez adresu', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, '<img alt="Opis" width="1" height="1">')))
      .toContain('image.missing-src')
  })

  it('strona bez obrazów nie generuje żadnego ustalenia', () => {
    expect(idsFor(HEALTHY_HTML.replace(IMG, ''))).toEqual([])
  })
})
