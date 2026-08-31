import { describe, expect, it } from 'vitest'
import {
  citationHost,
  collectCitations,
  extractInlineCitations,
  ourCitationRate,
  trimUrlTail,
} from './citation.js'

const NASZE = ['mentiometry.com']

describe('trimUrlTail', () => {
  it('obcina interpunkcje konczaca zdanie', () => {
    expect(trimUrlTail('https://a.pl/x.')).toBe('https://a.pl/x')
    expect(trimUrlTail('https://a.pl/x),')).toBe('https://a.pl/x')
    expect(trimUrlTail('https://a.pl/x?q=1!')).toBe('https://a.pl/x?q=1')
  })

  it('zostawia nawias, ktory jest czescia adresu', () => {
    expect(trimUrlTail('https://pl.wikipedia.org/wiki/Delta_(rzeka)')).toBe(
      'https://pl.wikipedia.org/wiki/Delta_(rzeka)',
    )
  })

  it('nie zjada adresu bez ogona', () => {
    expect(trimUrlTail('https://a.pl/x')).toBe('https://a.pl/x')
  })
})

describe('citationHost', () => {
  it('odcina wiodace www, ale nic wiecej', () => {
    expect(citationHost('WWW.Mentiometry.com')).toBe('mentiometry.com')
    expect(citationHost('blog.mentiometry.com')).toBe('blog.mentiometry.com')
    expect(citationHost('wwwx.mentiometry.com')).toBe('wwwx.mentiometry.com')
  })
})

describe('extractInlineCitations', () => {
  it('wyciaga adres ze skladni markdownu', () => {
    const [c] = extractInlineCitations(
      'Zobacz [Mentiometry](https://mentiometry.com/cennik) po szczegoly.',
      new Set(NASZE),
    )
    expect(c?.normalized).toBe('https://mentiometry.com/cennik')
    expect(c?.ours).toBe(true)
  })

  it('rozpoznaje nasza strone mimo www', () => {
    const [c] = extractInlineCitations('Wiecej: https://www.mentiometry.com/', new Set(NASZE))
    expect(c?.ours).toBe(true)
    expect(c?.host).toBe('mentiometry.com')
  })

  it('nie uznaje cudzej strony za nasza', () => {
    const [c] = extractInlineCitations('Zrodlo: https://semrush.com/blog', new Set(NASZE))
    expect(c?.ours).toBe(false)
  })

  it('D30: zapisuje pozycje cytowania w odpowiedzi', () => {
    const tekst = 'Duzo tekstu na poczatku bez zadnego adresu. https://mentiometry.com/'
    const [c] = extractInlineCitations(tekst, new Set(NASZE))
    expect(c?.positionShare).toBeGreaterThan(0.5)
  })

  it('nie duplikuje tego samego adresu', () => {
    const tekst = 'https://mentiometry.com/a oraz znowu https://mentiometry.com/a'
    expect(extractInlineCitations(tekst, new Set(NASZE))).toHaveLength(1)
  })

  it('adres nie do sparsowania jest danymi, nie bledem', () => {
    // Model potrafi napisac smiec — to jest obserwacja o jego zachowaniu
    // i ma trafic do raportu, a nie zginac w wyjatku.
    const wynik = extractInlineCitations('Zrodlo: http://[zly] i tyle.', new Set(NASZE))
    expect(wynik).toHaveLength(1)
    expect(wynik[0]?.normalized).toBeNull()
    expect(wynik[0]?.host).toBeNull()
    expect(wynik[0]?.ours).toBe(false)
    expect(wynik[0]?.rawUrl).toBe('http://[zly]')
  })

  it('sam schemat bez hosta nie jest kandydatem na adres', () => {
    expect(extractInlineCitations('Zerknij na https://', new Set(NASZE))).toEqual([])
  })

  it('odpowiedz bez adresow daje pusta liste', () => {
    expect(extractInlineCitations('Nie znam takiego narzedzia.', new Set(NASZE))).toEqual([])
  })
})

describe('collectCitations', () => {
  it('D32: trzyma grounding i tresc osobno', () => {
    const wynik = collectCitations(
      {
        text: 'Wedlug https://semrush.com/blog tak wlasnie jest.',
        groundingUris: ['https://mentiometry.com/blog/geo'],
      },
      NASZE,
    )
    expect(wynik.grounding.map((c) => c.host)).toEqual(['mentiometry.com'])
    expect(wynik.inline.map((c) => c.host)).toEqual(['semrush.com'])
    expect(wynik.grounding[0]?.ours).toBe(true)
    expect(wynik.inline[0]?.ours).toBe(false)
  })

  it('cytowanie z groundingu nie ma pozycji w tekscie', () => {
    const wynik = collectCitations(
      { text: 'Bez adresow.', groundingUris: ['https://mentiometry.com/'] },
      NASZE,
    )
    expect(wynik.grounding[0]?.positionShare).toBeNull()
  })

  it('silnik bez groundingu daje zero, a nie brak danych', () => {
    const wynik = collectCitations({ text: 'https://mentiometry.com/' }, NASZE)
    expect(wynik.grounding).toEqual([])
    expect(wynik.inline).toHaveLength(1)
  })

  it('ten sam adres w obu zrodlach liczy sie w obu — bo to dwie rozne obserwacje', () => {
    const adres = 'https://mentiometry.com/blog/geo'
    const wynik = collectCitations({ text: `Zobacz ${adres}`, groundingUris: [adres] }, NASZE)
    expect(wynik.grounding).toHaveLength(1)
    expect(wynik.inline).toHaveLength(1)
  })
})

describe('ourCitationRate', () => {
  const odpowiedzi = [
    collectCitations({ text: 'a', groundingUris: ['https://mentiometry.com/'] }, NASZE),
    collectCitations({ text: 'Zobacz https://mentiometry.com/' }, NASZE),
    collectCitations({ text: 'Nic.' }, NASZE),
  ]

  it('liczy kazde zrodlo osobno i nie da sie ich zsumowac jednym wywolaniem', () => {
    expect(ourCitationRate(odpowiedzi, 'grounding').hits).toBe(1)
    expect(ourCitationRate(odpowiedzi, 'inline').hits).toBe(1)
    expect(ourCitationRate(odpowiedzi, 'grounding').trials).toBe(3)
  })

  it('kazdy odsetek niesie przedzial', () => {
    const wynik = ourCitationRate(odpowiedzi, 'inline')
    expect(wynik.interval.low).toBeGreaterThan(0)
    expect(wynik.interval.high).toBeLessThan(1)
  })
})
