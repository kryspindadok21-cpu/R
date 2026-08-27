import { describe, expect, it } from 'vitest'
import { InvalidUrlError, NORMALIZER_VERSION, normalizeUrl } from './url.js'

const CASES: ReadonlyArray<readonly [string, string]> = [
  // schemat, host, port
  ['https://example.com', 'https://example.com/'],
  ['HTTPS://EXAMPLE.COM/', 'https://example.com/'],
  ['https://example.com:443/a', 'https://example.com/a'],
  ['http://example.com:80/a', 'http://example.com/a'],
  ['https://example.com:8443/a', 'https://example.com:8443/a'],
  // www NIE jest usuwane (D4)
  ['https://www.example.com/a', 'https://www.example.com/a'],
  // fragment usuwany
  ['https://example.com/a#sekcja', 'https://example.com/a'],
  ['https://example.com/a#', 'https://example.com/a'],
  // ukosnik na koncu zachowywany (D4)
  ['https://example.com/a/', 'https://example.com/a/'],
  ['https://example.com/a', 'https://example.com/a'],
  // wielkosc liter w sciezce zachowywana
  ['https://example.com/Buty', 'https://example.com/Buty'],
  // puste zapytanie usuwane
  ['https://example.com/a?', 'https://example.com/a'],
  // parametry sortowane
  ['https://example.com/a?b=2&a=1', 'https://example.com/a?a=1&b=2'],
  ['https://example.com/a?a=2&a=1', 'https://example.com/a?a=1&a=2'],
  // parametry sledzace usuwane
  ['https://example.com/a?utm_source=x', 'https://example.com/a'],
  ['https://example.com/a?utm_source=x&b=1', 'https://example.com/a?b=1'],
  ['https://example.com/a?UTM_Medium=x&b=1', 'https://example.com/a?b=1'],
  ['https://example.com/a?gclid=x', 'https://example.com/a'],
  ['https://example.com/a?fbclid=x&msclkid=y', 'https://example.com/a'],
  ['https://example.com/a?_ga=1&_gl=2', 'https://example.com/a'],
  // ref NIE jest parametrem sledzacym (D4)
  ['https://example.com/a?fbclid=x&ref=newsletter', 'https://example.com/a?ref=newsletter'],
  // IDN -> punycode
  ['https://xn--bcher-kva.example/a', 'https://xn--bcher-kva.example/a'],
  ['https://bücher.example/a', 'https://xn--bcher-kva.example/a'],
  // percent-encoding: znaki unreserved dekodowane, reszta wielkimi literami
  ['https://example.com/%7Euser', 'https://example.com/~user'],
  ['https://example.com/a%2fb', 'https://example.com/a%2Fb'],
  ['https://example.com/a%2Fb', 'https://example.com/a%2Fb'],
  // dane logowania usuwane
  ['https://user:pass@example.com/a', 'https://example.com/a'],
]

describe('normalizeUrl', () => {
  it.each(CASES)('%s -> %s', (raw, expected) => {
    expect(normalizeUrl(raw).normalized).toBe(expected)
  })

  it('zwraca surowy URL bez zmian', () => {
    expect(normalizeUrl('https://example.com/a#x').raw).toBe('https://example.com/a#x')
  })

  it('stempluje wersje normalizatora', () => {
    expect(normalizeUrl('https://example.com/').normalizerVersion).toBe(NORMALIZER_VERSION)
  })

  it('hash jest deterministyczny i ma 32 znaki', () => {
    const a = normalizeUrl('https://example.com/a?b=2&a=1')
    const b = normalizeUrl('https://example.com/a?a=1&b=2&utm_source=z')
    expect(a.hash).toBe(b.hash)
    expect(a.hash).toMatch(/^[0-9a-f]{32}$/)
  })

  it('rozne URL-e maja rozne hashe', () => {
    expect(normalizeUrl('https://example.com/a').hash).not.toBe(normalizeUrl('https://example.com/b').hash)
  })

  it('odrzuca schematy inne niz http i https', () => {
    expect(() => normalizeUrl('ftp://example.com/a')).toThrow(InvalidUrlError)
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow(InvalidUrlError)
  })

  it('odrzuca smieci', () => {
    expect(() => normalizeUrl('nie-url')).toThrow(InvalidUrlError)
    expect(() => normalizeUrl('')).toThrow(InvalidUrlError)
  })
})
