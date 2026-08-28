import { describe, expect, it } from 'vitest'
import { readSitemapFixture } from './fixtures.test-helper.js'
import { parseSitemap } from './sitemap.js'

describe('parseSitemap — mapa zwykła', () => {
  const result = parseSitemap(readSitemapFixture('prosta.xml'))

  it('rozpoznaje typ mapy', () => {
    expect(result.kind).toBe('urlset')
  })

  it('czyta wszystkie adresy w kolejności', () => {
    expect(result.entries.map((e) => e.loc)).toEqual([
      'https://przyklad.test/',
      'https://przyklad.test/oferta?a=1&b=2',
      'https://przyklad.test/blog',
    ])
  })

  it('dekoduje encje XML w adresie', () => {
    expect(result.entries[1]?.loc).toContain('&b=2')
  })

  it('rozpakowuje CDATA', () => {
    expect(result.entries[2]?.loc).toBe('https://przyklad.test/blog')
  })

  it('czyta lastmod tam, gdzie jest, i null tam, gdzie go nie ma', () => {
    expect(result.entries[0]?.lastmod).toBe('2026-08-01')
    expect(result.entries[1]?.lastmod).toBeNull()
  })

  it('poprawna mapa nie zgłasza problemów', () => {
    expect(result.problems).toEqual([])
  })
})

describe('parseSitemap — indeks map', () => {
  const result = parseSitemap(readSitemapFixture('indeks.xml'))

  it('rozpoznaje indeks i zwraca adresy map składowych', () => {
    expect(result.kind).toBe('sitemapindex')
    expect(result.entries.map((e) => e.loc)).toEqual([
      'https://przyklad.test/sitemap-strony.xml',
      'https://przyklad.test/sitemap-blog.xml',
    ])
  })
})

describe('parseSitemap — odporność', () => {
  it('zepsuta pozycja nie kasuje pozostałych', () => {
    const result = parseSitemap(readSitemapFixture('z-bledami.xml'))
    expect(result.entries.map((e) => e.loc)).toEqual(['https://przyklad.test/dobra'])
    expect(result.problems.map((p) => p.kind)).toEqual([
      'invalid-url', 'invalid-url', 'invalid-url',
    ])
  })

  it('odrzuca schemat inny niż http i https', () => {
    const result = parseSitemap(readSitemapFixture('z-bledami.xml'))
    expect(result.problems.some((p) => p.detail === 'ftp://przyklad.test/plik')).toBe(true)
  })

  it('tekst niebędący mapą zgłasza się jako not-xml, a nie wyjątek', () => {
    const result = parseSitemap('<html><body>404</body></html>')
    expect(result.kind).toBe('unknown')
    expect(result.problems[0]?.kind).toBe('not-xml')
    expect(result.entries).toEqual([])
  })

  it('pusta mapa zgłasza się jako pusta', () => {
    const result = parseSitemap('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>')
    expect(result.problems.map((p) => p.kind)).toEqual(['empty'])
  })

  it('radzi sobie z przedrostkiem przestrzeni nazw', () => {
    const xml = '<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">'
      + '<sm:url><sm:loc>https://przyklad.test/a</sm:loc></sm:url></sm:urlset>'
    expect(parseSitemap(xml).entries.map((e) => e.loc)).toEqual(['https://przyklad.test/a'])
  })
})
