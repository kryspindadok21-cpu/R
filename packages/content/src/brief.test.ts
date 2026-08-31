import {
  clusterByLexicalOverlap, clusterBySerpOverlap, decideCoverage,
  type ExistingPage, type Keyword,
} from '@seo/keywords'
import { describe, expect, it } from 'vitest'
import { briefToMarkdown, buildBrief, type GeoSignal } from './brief.js'
import type { LinkCandidate } from './internal-links.js'

const fraza = (query: string, impressions: number, position = 12): Keyword =>
  ({ query, impressions, clicks: 0, position })

const KLASTER = clusterByLexicalOverlap([
  fraza('audyt seo strony', 800, 11.4),
  fraza('audyt seo cennik', 100, 24.0),
])[0]!

const strona = (url: string, text: string, title: string | null = null): ExistingPage =>
  ({ url, title, text })

const kandydat = (o: Partial<LinkCandidate> & { url: string }): LinkCandidate =>
  ({ title: null, text: '', inDegree: 5, clickDepth: 1, ...o })

const KANDYDACI = [
  kandydat({ url: 'https://a.test/audyt-techniczny', title: 'Audyt SEO strony technicznie', inDegree: 2 }),
  kandydat({ url: 'https://a.test/kontakt', title: 'Kontakt', text: 'Napisz.' }),
]

describe('buildBrief', () => {
  it('przy pokrytej stronie sklada brief na odswiezenie', () => {
    const coverage = decideCoverage(KLASTER, [
      strona('https://a.test/audyt', 'Audyt seo strony i cennik audytu.'),
    ])
    const brief = buildBrief({ cluster: KLASTER, coverage, linkCandidates: KANDYDACI })

    expect(brief.decision).toBe('refresh')
    expect(brief.targetUrl).toBe('https://a.test/audyt')
    expect(brief.gaps).toEqual([])
    expect(brief.decisionReason).toContain('D38')
  })

  it('luki w pokryciu sa wlasciwym materialem do napisania', () => {
    const coverage = decideCoverage(KLASTER, [
      strona('https://a.test/audyt', 'Audyt seo strony bez slowa o pieniadzach.'),
    ])
    const brief = buildBrief({ cluster: KLASTER, coverage, linkCandidates: KANDYDACI })
    expect(brief.decision).toBe('refresh')
    expect(brief.gaps).toEqual(['audyt seo cennik'])
    expect(brief.queries.find((q) => q.query === 'audyt seo strony')?.covered).toBe(true)
  })

  it('przy braku pokrycia wszystkie frazy sa luka', () => {
    const coverage = decideCoverage(KLASTER, [])
    const brief = buildBrief({ cluster: KLASTER, coverage, linkCandidates: KANDYDACI })
    expect(brief.decision).toBe('create')
    expect(brief.targetUrl).toBeNull()
    expect(brief.gaps).toHaveLength(2)
  })

  it('D41: brief niesie dane z GSC, a nie wymyslone liczby', () => {
    const brief = buildBrief({
      cluster: KLASTER, coverage: decideCoverage(KLASTER, []), linkCandidates: [],
    })
    expect(brief.totalImpressions).toBe(900)
    expect(brief.bestPosition).toBeCloseTo(11.4, 6)
    expect(brief.queries.map((q) => q.impressions)).toEqual([800, 100])
  })

  it('metoda klastrowania wedruje do briefu', () => {
    const serpowy = clusterBySerpOverlap(
      [fraza('audyt seo', 100)],
      [{ query: 'audyt seo', urls: ['https://x.test/1'] }],
    )[0]!
    const brief = buildBrief({
      cluster: serpowy, coverage: decideCoverage(serpowy, []), linkCandidates: [],
    })
    expect(brief.method).toBe('serp-overlap')
  })

  it('D42: linki wewnetrzne sa w briefie i nie linkuja do odswiezanej strony', () => {
    const coverage = decideCoverage(KLASTER, [
      strona('https://a.test/audyt-techniczny', 'Audyt seo strony i cennik.'),
    ])
    const brief = buildBrief({ cluster: KLASTER, coverage, linkCandidates: KANDYDACI })
    expect(brief.targetUrl).toBe('https://a.test/audyt-techniczny')
    expect(brief.internalLinks.map((l) => l.url)).not.toContain('https://a.test/audyt-techniczny')
  })

  it('D37: brief prosi o unikalny zasob wprost', () => {
    const brief = buildBrief({
      cluster: KLASTER, coverage: decideCoverage(KLASTER, []), linkCandidates: [],
    })
    expect(brief.uniqueAssetRequest).toContain('unikalnego zasobu')
    expect(brief.uniqueAssetRequest).toContain('Nowy artykul')
  })

  it('sygnaly GEO sa opcjonalne i domyslnie puste', () => {
    const bez = buildBrief({
      cluster: KLASTER, coverage: decideCoverage(KLASTER, []), linkCandidates: [],
    })
    expect(bez.geoSignals).toEqual([])

    const sygnaly: GeoSignal[] = [{ prompt: 'Jakie narzedzie do audytu?', mentionRate: 0.33, runs: 3 }]
    const z = buildBrief({
      cluster: KLASTER, coverage: decideCoverage(KLASTER, []), linkCandidates: [], geoSignals: sygnaly,
    })
    expect(z.geoSignals).toEqual(sygnaly)
  })

  it('klaster bez danych o pozycji nie zmysla liczby', () => {
    const bezPozycji = clusterByLexicalOverlap([fraza('nowa fraza', 0, 0)])[0]!
    const brief = buildBrief({
      cluster: bezPozycji, coverage: decideCoverage(bezPozycji, []), linkCandidates: [],
    })
    expect(brief.bestPosition).toBeNull()
  })
})

describe('briefToMarkdown', () => {
  const brief = buildBrief({
    cluster: KLASTER,
    coverage: decideCoverage(KLASTER, [strona('https://a.test/audyt', 'Audyt seo strony.')]),
    linkCandidates: KANDYDACI,
    geoSignals: [{ prompt: 'Jakie narzedzie do audytu?', mentionRate: 0.33, runs: 3 }],
  })

  it('sklada tabele fraz z liczbami z GSC', () => {
    const md = briefToMarkdown(brief)
    expect(md).toContain('# Brief: audyt seo strony')
    expect(md).toContain('| audyt seo strony | 800 | 0 | 11.4 | tak |')
    expect(md).toContain('| audyt seo cennik | 100 | 0 | 24.0 | nie |')
  })

  it('ostrzega, gdy klaster powstal z podobienstwa slow, a nie z SERP', () => {
    const md = briefToMarkdown(brief)
    expect(md).toContain('lexical-overlap')
    expect(md).toContain('traktuj jako hipoteze')
  })

  it('nie ostrzega, gdy klaster powstal z overlapu SERP', () => {
    const serpowy = clusterBySerpOverlap(
      [fraza('audyt seo', 100)], [{ query: 'audyt seo', urls: ['https://x.test/1'] }],
    )[0]!
    const md = briefToMarkdown(buildBrief({
      cluster: serpowy, coverage: decideCoverage(serpowy, []), linkCandidates: [],
    }))
    expect(md).not.toContain('traktuj jako hipoteze')
  })

  it('wypisuje luki, linki i sygnaly GEO', () => {
    const md = briefToMarkdown(brief)
    expect(md).toContain('## Luki do pokrycia')
    expect(md).toContain('- audyt seo cennik')
    expect(md).toContain('## Linki wewnetrzne do wstawienia')
    expect(md).toContain('https://a.test/audyt-techniczny')
    expect(md).toContain('wzmianka w 33%')
  })

  it('brak linkow mowi to wprost, zamiast zostawiac pusta sekcje', () => {
    const md = briefToMarkdown(buildBrief({
      cluster: KLASTER, coverage: decideCoverage(KLASTER, []), linkCandidates: [],
    }))
    expect(md).toContain('_Brak dopasowanych stron w serwisie._')
  })

  it('zawsze konczy sie prosba o unikalny zasob', () => {
    expect(briefToMarkdown(brief)).toContain('## Wymagany unikalny zasob')
  })
})
