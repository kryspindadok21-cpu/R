import { describe, expect, it } from 'vitest'
import { buildLlmsTxt, type LlmsTxtPage } from './llms-txt.js'

const strona = (o: Partial<LlmsTxtPage> & { url: string }): LlmsTxtPage => ({
  title: 'Tytuł', description: null, depth: 1, httpStatus: 200, indexable: true, ...o,
})

const WEJSCIE = {
  siteName: 'Mentiometry',
  siteUrl: 'https://przyklad.test/',
  description: 'Pomiar wzmianek marki w odpowiedziach AI.',
  pages: [
    strona({ url: 'https://przyklad.test/', title: 'Strona główna', depth: 0 }),
    strona({ url: 'https://przyklad.test/blog/geo', title: 'Czym jest GEO' }),
    strona({ url: 'https://przyklad.test/blog/seo', title: 'Czym jest SEO' }),
    strona({ url: 'https://przyklad.test/cennik', title: 'Cennik' }),
  ],
}

describe('buildLlmsTxt', () => {
  it('sklada naglowek, opis i sekcje wedlug pierwszego segmentu sciezki', () => {
    const tekst = buildLlmsTxt(WEJSCIE)
    expect(tekst.startsWith('# Mentiometry\n')).toBe(true)
    expect(tekst).toContain('> Pomiar wzmianek marki w odpowiedziach AI.')
    expect(tekst).toContain('## blog')
    expect(tekst).toContain('- [Czym jest GEO](https://przyklad.test/blog/geo)')
  })

  it('strona glowna idzie pierwsza', () => {
    const tekst = buildLlmsTxt(WEJSCIE)
    expect(tekst.indexOf('## Strona główna')).toBeLessThan(tekst.indexOf('## blog'))
  })

  it('nie wpisuje stron z noindex ani niedostepnych', () => {
    const tekst = buildLlmsTxt({
      ...WEJSCIE,
      pages: [
        strona({ url: 'https://przyklad.test/ukryta', indexable: false, title: 'Ukryta' }),
        strona({ url: 'https://przyklad.test/zepsuta', httpStatus: 404, title: 'Zepsuta' }),
        strona({ url: 'https://przyklad.test/dobra', title: 'Dobra' }),
      ],
    })
    expect(tekst).not.toContain('Ukryta')
    expect(tekst).not.toContain('Zepsuta')
    expect(tekst).toContain('Dobra')
  })

  it('strona bez tytulu wchodzi z adresem zamiast pustego nawiasu', () => {
    const tekst = buildLlmsTxt({
      ...WEJSCIE,
      pages: [strona({ url: 'https://przyklad.test/bez', title: null })],
    })
    expect(tekst).toContain('- [https://przyklad.test/bez](https://przyklad.test/bez)')
  })

  it('opis dokleja sie po dwukropku i nie lamie listy', () => {
    const tekst = buildLlmsTxt({
      ...WEJSCIE,
      pages: [strona({
        url: 'https://przyklad.test/a', title: 'A',
        description: 'Opis\nz  lamaniem   linii',
      })],
    })
    expect(tekst).toContain('- [A](https://przyklad.test/a): Opis z lamaniem linii')
  })

  it('brak opisu strony nie zostawia wiszacego dwukropka', () => {
    expect(buildLlmsTxt({ ...WEJSCIE, description: null })).not.toContain('>')
  })

  it('tnie sekcje do limitu — to plik do czytania, nie mapa witryny', () => {
    const tekst = buildLlmsTxt({
      ...WEJSCIE,
      pages: Array.from({ length: 80 }, (_, i) =>
        strona({ url: `https://przyklad.test/blog/${i}`, title: `Wpis ${i}` })),
    })
    expect(tekst.split('\n').filter((l) => l.startsWith('- '))).toHaveLength(50)
  })

  it('pusty crawl daje sam naglowek, a nie plik udajacy tresc', () => {
    const tekst = buildLlmsTxt({ ...WEJSCIE, pages: [] })
    expect(tekst).toContain('# Mentiometry')
    expect(tekst).not.toContain('- [')
  })

  it('konczy sie pojedynczym znakiem nowej linii', () => {
    const tekst = buildLlmsTxt(WEJSCIE)
    expect(tekst.endsWith('\n')).toBe(true)
    expect(tekst.endsWith('\n\n')).toBe(false)
  })
})
