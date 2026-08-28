import { describe, expect, it } from 'vitest'
import { readPageFixture } from './fixtures.test-helper.js'
import { parsePage } from './parse.js'
import { diffRenderedFacts } from './render-diff.js'

const URL_SKLEP = 'https://przyklad.test/sklep'

function factsFor(fixture: string) {
  return parsePage(readPageFixture(fixture), { url: URL_SKLEP })
}

describe('diffRenderedFacts', () => {
  it('wykrywa tresc widoczna wylacznie po wykonaniu JavaScriptu', () => {
    const diff = diffRenderedFacts(factsFor('csr-pusty.html'), factsFor('csr-wyrenderowany.html'))

    expect(diff.rawWordCount).toBe(0)
    expect(diff.renderedWordCount).toBeGreaterThan(20)
    expect(diff.jsRequiredContentRatio).toBe(1)
    expect(diff.contentRequiresJs).toBe(true)
    expect(diff.h1OnlyInRendered).toBe(true)
    expect(diff.titleChanged).toBe(true)
  })

  it('wykazuje linki, ktore istnieja dopiero po renderowaniu', () => {
    const diff = diffRenderedFacts(factsFor('csr-pusty.html'), factsFor('csr-wyrenderowany.html'))

    expect(diff.rawLinkCount).toBe(0)
    expect(diff.linksOnlyInRendered).toEqual([
      'https://przyklad.test/buty/skorzane',
      'https://przyklad.test/buty/syntetyczne',
    ])
    expect(diff.linksOnlyInRaw).toEqual([])
  })

  it('strona serwerowa nie jest oskarzana o wymaganie JavaScriptu', () => {
    const facts = parsePage(readPageFixture('dobra-strona.html'), {
      url: 'https://przyklad.test/audyt-techniczny',
    })
    const diff = diffRenderedFacts(facts, facts)

    expect(diff.jsRequiredContentRatio).toBe(0)
    expect(diff.contentRequiresJs).toBe(false)
    expect(diff.titleChanged).toBe(false)
    expect(diff.linksOnlyInRendered).toEqual([])
  })

  it('obie wersje puste to nie jest problem z JavaScriptem', () => {
    const empty = parsePage('<html><body></body></html>', { url: URL_SKLEP })
    const diff = diffRenderedFacts(empty, empty)

    expect(diff.jsRequiredContentRatio).toBe(0)
    expect(diff.contentRequiresJs).toBe(false)
  })
})
