import { describe, expect, it } from 'vitest'
import {
  MIN_SHARED_URLS, clusterByLexicalOverlap, clusterBySerpOverlap, clusterSet,
  contentTokens, type Keyword, type SerpSnapshot,
} from './cluster.js'

const fraza = (query: string, impressions: number, clicks = 0): Keyword =>
  ({ query, impressions, clicks, position: 12 })

const serp = (query: string, urls: readonly string[]): SerpSnapshot => ({ query, urls })

const A = ['https://a.test/1', 'https://b.test/2', 'https://c.test/3']
const B = ['https://x.test/9', 'https://y.test/8', 'https://z.test/7']

describe('contentTokens', () => {
  it('gubi slowa nieniosace intencji, zachowuje polskie znaki', () => {
    expect(contentTokens('jak zrobić audyt SEO dla małej firmy'))
      .toEqual(['zrobić', 'audyt', 'seo', 'małej', 'firmy'])
  })

  it('fraza zlozona z samych stopwordow daje pusty zbior', () => {
    expect(contentTokens('jak i co')).toEqual([])
  })
})

describe('clusterBySerpOverlap', () => {
  it('AC2: >=3 wspolne adresy lacza frazy', () => {
    const clusters = clusterBySerpOverlap(
      [fraza('audyt seo', 500), fraza('audyt techniczny strony', 300)],
      [serp('audyt seo', A), serp('audyt techniczny strony', A)],
    )
    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.head).toBe('audyt seo')
    expect(clusters[0]?.keywords.map((k) => k.query))
      .toEqual(['audyt seo', 'audyt techniczny strony'])
    expect(clusters[0]?.sharedUrls).toBe(MIN_SHARED_URLS)
  })

  it('AC2: 2 wspolne adresy NIE lacza fraz', () => {
    const clusters = clusterBySerpOverlap(
      [fraza('audyt seo', 500), fraza('cennik agencji', 300)],
      [
        serp('audyt seo', A),
        serp('cennik agencji', ['https://a.test/1', 'https://b.test/2', 'https://inne.test/5']),
      ],
    )
    expect(clusters).toHaveLength(2)
  })

  it('fraza glowna to ta z najwieksza liczba wyswietlen', () => {
    const clusters = clusterBySerpOverlap(
      [fraza('mniejsza', 50), fraza('wieksza', 900)],
      [serp('mniejsza', A), serp('wieksza', A)],
    )
    expect(clusters[0]?.head).toBe('wieksza')
  })

  it('nie laczy przechodnio — A z B i B z C nie znaczy A z C', () => {
    // To jest znany sposob, w ktory klastrowanie SERP produkuje jeden wielki
    // klaster obejmujacy pol serwisu. Schemat piasta-szprychy tego nie robi.
    const wspolneAB = ['https://p.test/1', 'https://p.test/2', 'https://p.test/3']
    const wspolneBC = ['https://q.test/1', 'https://q.test/2', 'https://q.test/3']
    const clusters = clusterBySerpOverlap(
      [fraza('a', 300), fraza('b', 200), fraza('c', 100)],
      [
        serp('a', wspolneAB),
        serp('b', [...wspolneAB, ...wspolneBC]),
        serp('c', wspolneBC),
      ],
    )
    // „a" jest piasta, „b" do niej pasuje, „c" z „a" nie dzieli nic.
    expect(clusters).toHaveLength(2)
    expect(clusters[0]?.keywords.map((k) => k.query)).toEqual(['a', 'b'])
    expect(clusters[1]?.keywords.map((k) => k.query)).toEqual(['c'])
  })

  it('fraza bez migawki SERP siedzi sama i mowi to wprost', () => {
    const clusters = clusterBySerpOverlap(
      [fraza('znana', 500), fraza('bez-migawki', 400)],
      [serp('znana', A)],
    )
    const samotna = clusters.find((c) => c.head === 'bez-migawki')
    expect(samotna?.keywords).toHaveLength(1)
    expect(samotna?.sharedUrls).toBeNull()
  })

  it('klaster jednoelementowy z migawka ma zero wspolnych adresow, nie null', () => {
    const clusters = clusterBySerpOverlap([fraza('sama', 100)], [serp('sama', A)])
    expect(clusters[0]?.sharedUrls).toBe(0)
  })

  it('sumuje wyswietlenia i klikniecia klastra', () => {
    const clusters = clusterBySerpOverlap(
      [fraza('a', 500, 20), fraza('b', 300, 5)],
      [serp('a', A), serp('b', A)],
    )
    expect(clusters[0]?.totalImpressions).toBe(800)
    expect(clusters[0]?.totalClicks).toBe(25)
  })

  it('identyfikator jest deterministyczny i bez polskich znakow', () => {
    const clusters = clusterBySerpOverlap([fraza('Audyt Techniczny Strony Łódź', 10)], [])
    expect(clusters[0]?.id).toBe('audyt-techniczny-strony-lodz')
  })

  it('pusty zestaw fraz nie wybucha', () => {
    expect(clusterBySerpOverlap([], [])).toEqual([])
  })

  it('kazdy klaster niesie metode', () => {
    const clusters = clusterBySerpOverlap([fraza('a', 1)], [serp('a', A)])
    expect(clusters[0]?.method).toBe('serp-overlap')
  })
})

describe('clusterByLexicalOverlap', () => {
  it('laczy frazy o wspolnych slowach znaczacych', () => {
    const clusters = clusterByLexicalOverlap([
      fraza('darmowy audyt seo', 500),
      fraza('audyt seo', 300),
    ])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]?.method).toBe('lexical-overlap')
  })

  it('nie laczy fraz o innych slowach', () => {
    expect(clusterByLexicalOverlap([
      fraza('audyt seo', 500),
      fraza('cennik hostingu', 300),
    ])).toHaveLength(2)
  })

  it('krotsza fraza w calosci zawarta w dluzszej liczy sie jako pelne pokrycie', () => {
    const clusters = clusterByLexicalOverlap([
      fraza('darmowy audyt seo dla malej firmy', 500),
      fraza('audyt seo', 300),
    ])
    expect(clusters).toHaveLength(1)
  })

  it('NIE podaje liczby wspolnych adresow, bo zadnych nie widziala', () => {
    const clusters = clusterByLexicalOverlap([fraza('audyt seo', 1)])
    expect(clusters[0]?.sharedUrls).toBeNull()
  })

  it('fraza z samych stopwordow zostaje sama', () => {
    const clusters = clusterByLexicalOverlap([fraza('jak i co', 100), fraza('audyt seo', 50)])
    expect(clusters).toHaveLength(2)
  })
})

describe('clusterSet', () => {
  const serpowe = clusterBySerpOverlap([fraza('a', 100)], [serp('a', A)])
  const leksykalne = clusterByLexicalOverlap([fraza('b', 50)])

  it('zestaw jednej metody przechodzi i podaje ja wprost', () => {
    const wynik = clusterSet(serpowe)
    expect(wynik.kind).toBe('zestaw')
    if (wynik.kind !== 'zestaw') return
    expect(wynik.method).toBe('serp-overlap')
  })

  it('AC1: zmieszane metody sa odmawiane z powodem', () => {
    const wynik = clusterSet([...serpowe, ...leksykalne])
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('mieszane-metody')
    expect(wynik.detail).toContain('serp-overlap')
    expect(wynik.detail).toContain('lexical-overlap')
  })

  it('pusty zestaw tez jest odmowa, a nie pusta tabela', () => {
    const wynik = clusterSet([])
    expect(wynik.kind).toBe('odmowa')
    if (wynik.kind !== 'odmowa') return
    expect(wynik.reason).toBe('pusty-zestaw')
  })

  it('sortuje klastry po ruchu, malejaco', () => {
    const wiele = clusterBySerpOverlap(
      [fraza('maly', 10), fraza('duzy', 900)],
      [serp('maly', A), serp('duzy', B)],
    )
    const wynik = clusterSet(wiele)
    if (wynik.kind !== 'zestaw') throw new Error('spodziewano sie zestawu')
    expect(wynik.clusters.map((c) => c.head)).toEqual(['duzy', 'maly'])
  })
})
