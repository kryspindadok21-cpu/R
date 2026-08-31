import { clusterByLexicalOverlap, type Keyword } from '@seo/keywords'
import { describe, expect, it } from 'vitest'
import {
  MAX_INTERNAL_LINKS, suggestInternalLinks, type LinkCandidate,
} from './internal-links.js'

const fraza = (query: string, impressions = 100): Keyword =>
  ({ query, impressions, clicks: 0, position: 12 })

const KLASTER = clusterByLexicalOverlap([fraza('audyt seo strony')])[0]!

const strona = (o: Partial<LinkCandidate> & { url: string }): LinkCandidate =>
  ({ title: null, text: '', inDegree: 5, clickDepth: 1, ...o })

describe('suggestInternalLinks', () => {
  it('wybiera strony dopasowane tresciowo', () => {
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/audyt', title: 'Audyt SEO strony krok po kroku' }),
      strona({ url: 'https://a.test/kontakt', title: 'Kontakt' }),
    ])
    expect(wynik.map((l) => l.url)).toEqual(['https://a.test/audyt'])
  })

  it('D42: nigdy wiecej niz trzy linki', () => {
    const kandydaci = Array.from({ length: 10 }, (_, i) =>
      strona({ url: `https://a.test/${i}`, title: 'Audyt SEO strony', inDegree: i }))
    expect(suggestInternalLinks(KLASTER, kandydaci)).toHaveLength(MAX_INTERNAL_LINKS)
  })

  it('przy zblizonym dopasowaniu wygrywa strona o mniejszej liczbie linkow przychodzacych', () => {
    // Link do strony glownej z setka linkow nie zmienia nic; link do strony
    // z dwoma zmienia jej pozycje w grafie.
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/popularna', title: 'Audyt SEO strony', inDegree: 120 }),
      strona({ url: 'https://a.test/zapomniana', title: 'Audyt SEO strony', inDegree: 2 }),
    ], { max: 1 })
    expect(wynik[0]?.url).toBe('https://a.test/zapomniana')
  })

  it('nie linkuje do strony, ktora sama jest odswiezana', () => {
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/audyt', title: 'Audyt SEO strony' }),
    ], { excludeUrls: ['https://a.test/audyt'] })
    expect(wynik).toEqual([])
  })

  it('naciagany link nie jest wstawiany wcale', () => {
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/kontakt', title: 'Kontakt', text: 'Napisz do nas.' }),
    ])
    expect(wynik).toEqual([])
  })

  it('tekst kotwicy bierze sie z tytulu, a bez tytulu ze sciezki', () => {
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/audyt-seo-strony', title: null, text: 'audyt seo strony' }),
    ])
    expect(wynik[0]?.anchorText).toBe('audyt seo strony')
  })

  it('powod mowi, dlaczego akurat ta strona', () => {
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/audyt', title: 'Audyt SEO strony', inDegree: 4, clickDepth: 2 }),
    ])
    expect(wynik[0]?.reason).toContain('100% slow klastra')
    expect(wynik[0]?.reason).toContain('4 linkow przychodzacych')
    expect(wynik[0]?.reason).toContain('glebokosc 2')
  })

  it('strona nieosiagalna z nawigacji jest oznaczona wprost', () => {
    const wynik = suggestInternalLinks(KLASTER, [
      strona({ url: 'https://a.test/sierota', title: 'Audyt SEO strony', clickDepth: null }),
    ])
    expect(wynik[0]?.reason).toContain('nieosiagalna z nawigacji')
  })

  it('brak kandydatow nie wybucha', () => {
    expect(suggestInternalLinks(KLASTER, [])).toEqual([])
  })

  it('wynik jest powtarzalny przy remisie', () => {
    const kandydaci = [
      strona({ url: 'https://a.test/b', title: 'Audyt SEO strony', inDegree: 3 }),
      strona({ url: 'https://a.test/a', title: 'Audyt SEO strony', inDegree: 3 }),
    ]
    expect(suggestInternalLinks(KLASTER, kandydaci, { max: 1 })[0]?.url)
      .toBe(suggestInternalLinks(KLASTER, [...kandydaci].reverse(), { max: 1 })[0]?.url)
  })
})
