import { describe, expect, it } from 'vitest'
import { clusterByLexicalOverlap, type Keyword } from './cluster.js'
import {
  COVERAGE_THRESHOLD, coverageOf, decideCoverage, type ExistingPage,
} from './coverage.js'

const fraza = (query: string, impressions: number): Keyword =>
  ({ query, impressions, clicks: 0, position: 12 })

const KLASTER = clusterByLexicalOverlap([
  fraza('audyt seo', 800),
  fraza('audyt seo cennik', 100),
])[0]!

const strona = (url: string, text: string, title: string | null = null): ExistingPage =>
  ({ url, title, text })

describe('coverageOf', () => {
  it('wazy pokrycie wyswietleniami, nie liczba fraz', () => {
    // Strona obsluguje fraze z 800 wyswietlen, gubi te ze 100.
    const wynik = coverageOf(KLASTER, strona('https://a.test/audyt', 'Nasz audyt seo strony.'))
    expect(wynik.coverage).toBeCloseTo(800 / 900, 6)
    expect(wynik.uncoveredQueries).toEqual(['audyt seo cennik'])
  })

  it('strona pokrywajaca wszystko nie zostawia luk', () => {
    const wynik = coverageOf(
      KLASTER,
      strona('https://a.test/', 'Audyt seo oraz jego cennik w jednym miejscu.'),
    )
    expect(wynik.coverage).toBe(1)
    expect(wynik.uncoveredQueries).toEqual([])
  })

  it('tytul liczy sie tak samo jak tresc', () => {
    const wynik = coverageOf(KLASTER, strona('https://a.test/', 'cennik', 'Audyt SEO'))
    expect(wynik.coverage).toBe(1)
  })

  it('strona o niczym daje zerowe pokrycie i pelna liste luk', () => {
    const wynik = coverageOf(KLASTER, strona('https://a.test/kontakt', 'Napisz do nas.'))
    expect(wynik.coverage).toBe(0)
    expect(wynik.uncoveredQueries).toHaveLength(2)
  })

  it('fraza z zerem wyswietlen nadal liczy sie do decyzji', () => {
    const klaster = clusterByLexicalOverlap([fraza('nowa fraza', 0)])[0]!
    expect(coverageOf(klaster, strona('https://a.test/', 'nowa fraza tutaj')).coverage).toBe(1)
    expect(coverageOf(klaster, strona('https://a.test/', 'nic')).coverage).toBe(0)
  })
})

describe('decideCoverage', () => {
  it('D38: strona pokrywajaca klaster daje refresh, nie create', () => {
    const wynik = decideCoverage(KLASTER, [
      strona('https://a.test/audyt', 'Audyt seo i jego cennik.'),
    ])
    expect(wynik.decision).toBe('refresh')
    expect(wynik.best?.url).toBe('https://a.test/audyt')
    expect(wynik.reason).toContain('D38')
  })

  it('D38: refresh z lukami wskazuje, co dopisac', () => {
    const wynik = decideCoverage(KLASTER, [strona('https://a.test/audyt', 'Nasz audyt seo.')])
    expect(wynik.decision).toBe('refresh')
    expect(wynik.reason).toContain('bez pokrycia')
    expect(wynik.best?.uncoveredQueries).toEqual(['audyt seo cennik'])
  })

  it('AC5: brak pokrywajacej strony daje create z zapisanym powodem', () => {
    const wynik = decideCoverage(KLASTER, [strona('https://a.test/kontakt', 'Napisz do nas.')])
    expect(wynik.decision).toBe('create')
    expect(wynik.reason).toContain('ponizej progu')
    expect(wynik.reason).toContain('https://a.test/kontakt')
  })

  it('AC5: create nigdy nie jest bez powodu — nawet gdy nikt go nie poda', () => {
    const wynik = decideCoverage(KLASTER, [])
    expect(wynik.decision).toBe('create')
    expect(wynik.reason).toContain('brak jakiejkolwiek strony')
    expect(wynik.best).toBeNull()
  })

  it('podany powod create zastepuje domyslny', () => {
    const wynik = decideCoverage(KLASTER, [], {
      createReason: 'osobna strona pod inna intencje zakupowa, ustalone z wlascicielem',
    })
    expect(wynik.reason).toContain('intencje zakupowa')
  })

  it('wybiera najlepiej pokrywajaca strone z wielu', () => {
    const wynik = decideCoverage(KLASTER, [
      strona('https://a.test/slaba', 'audyt'),
      strona('https://a.test/dobra', 'Audyt seo i cennik.'),
      strona('https://a.test/zadna', 'nic'),
    ])
    expect(wynik.best?.url).toBe('https://a.test/dobra')
    expect(wynik.decision).toBe('refresh')
  })

  it('prog da sie zmienic, a domyslny jest jawnie zgadniety', () => {
    const strony = [strona('https://a.test/audyt', 'Nasz audyt seo.')]
    expect(decideCoverage(KLASTER, strony).threshold).toBe(COVERAGE_THRESHOLD)
    // Podniesiony prog zamienia to samo pokrycie w decyzje create.
    expect(decideCoverage(KLASTER, strony, { threshold: 0.95 }).decision).toBe('create')
  })

  it('przy remisie pokrycia wybor jest powtarzalny', () => {
    const strony = [
      strona('https://a.test/b', 'Audyt seo cennik.'),
      strona('https://a.test/a', 'Audyt seo cennik.'),
    ]
    expect(decideCoverage(KLASTER, strony).best?.url)
      .toBe(decideCoverage(KLASTER, [...strony].reverse()).best?.url)
  })
})
