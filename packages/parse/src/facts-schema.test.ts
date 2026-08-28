import { describe, expect, it } from 'vitest'
import { PageFactsSchema, parsePageFactsJson, parseRenderDiffJson } from './facts-schema.js'
import { readPageFixture } from './fixtures.test-helper.js'
import { parsePage } from './parse.js'
import { diffRenderedFacts } from './render-diff.js'

const FIXTURES = [
  'dobra-strona.html', 'bez-tytulu.html', 'dwa-h1.html',
  'zepsuty-html.html', 'csr-pusty.html', 'csr-wyrenderowany.html',
]

describe('PageFactsSchema', () => {
  it.each(FIXTURES)('przyjmuje wynik parsePage dla %s', (fixture) => {
    const facts = parsePage(readPageFixture(fixture), { url: 'https://przyklad.test/x' })
    expect(() => PageFactsSchema.parse(JSON.parse(JSON.stringify(facts)))).not.toThrow()
  })

  it('odrzuca strukturę z brakującym polem', () => {
    const facts = parsePage(readPageFixture('dobra-strona.html'), { url: 'https://przyklad.test/x' })
    const { wordCount, ...bezPola } = JSON.parse(JSON.stringify(facts))
    expect(wordCount).toBeGreaterThan(0)
    expect(() => PageFactsSchema.parse(bezPola)).toThrow()
  })
})

describe('odczyt z bazy', () => {
  const facts = parsePage(readPageFixture('dobra-strona.html'), { url: 'https://przyklad.test/x' })

  it('przechodzi cykl zapis-odczyt bez straty', () => {
    const restored = parsePageFactsJson(JSON.stringify(facts))
    expect(restored).toEqual(facts)
  })

  it('null zostaje nullem', () => {
    expect(parsePageFactsJson(null)).toBeNull()
    expect(parseRenderDiffJson(null)).toBeNull()
  })

  it('uszkodzony wiersz daje null, a nie wyjątek', () => {
    expect(parsePageFactsJson('{to nie jest json')).toBeNull()
    expect(parsePageFactsJson('{"url":"x"}')).toBeNull()
  })

  it('porównanie renderowania też przechodzi cykl', () => {
    const diff = diffRenderedFacts(facts, facts)
    expect(parseRenderDiffJson(JSON.stringify(diff))).toEqual(diff)
  })
})
