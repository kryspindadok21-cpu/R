import { describe, expect, it } from 'vitest'
import { createFrontier } from './frontier.js'

describe('createFrontier', () => {
  it('wydaje adresy wszerz — najpierw płytsze', () => {
    const frontier = createFrontier(5)
    frontier.add('https://przyklad.test/gleboka', 2)
    frontier.add('https://przyklad.test/plytka', 0)
    frontier.add('https://przyklad.test/srednia', 1)

    expect([frontier.next()?.url, frontier.next()?.url, frontier.next()?.url]).toEqual([
      'https://przyklad.test/plytka',
      'https://przyklad.test/srednia',
      'https://przyklad.test/gleboka',
    ])
  })

  it('w obrębie głębokości zachowuje kolejność dodania', () => {
    const frontier = createFrontier(5)
    frontier.add('https://przyklad.test/a', 1)
    frontier.add('https://przyklad.test/b', 1)
    expect([frontier.next()?.url, frontier.next()?.url])
      .toEqual(['https://przyklad.test/a', 'https://przyklad.test/b'])
  })

  it('nie dodaje adresu widzianego już wcześniej', () => {
    const frontier = createFrontier(5)
    expect(frontier.add('https://przyklad.test/a', 0)).toBe(true)
    expect(frontier.add('https://przyklad.test/a', 1)).toBe(false)
    expect(frontier.pending).toBe(1)
  })

  it('dedup działa po normalizacji, nie po tekście', () => {
    const frontier = createFrontier(5)
    frontier.add('https://przyklad.test/a?utm_source=x', 0)
    expect(frontier.add('https://przyklad.test/a', 0)).toBe(false)
  })

  it('odrzuca adres głębszy niż limit', () => {
    const frontier = createFrontier(2)
    expect(frontier.add('https://przyklad.test/a', 3)).toBe(false)
    expect(frontier.pending).toBe(0)
  })

  it('odrzuca tekst, który nie jest adresem', () => {
    const frontier = createFrontier(5)
    expect(frontier.add('to nie jest adres', 0)).toBe(false)
  })

  it('pusta kolejka zwraca undefined', () => {
    expect(createFrontier(5).next()).toBeUndefined()
  })

  it('liczy widziane adresy niezależnie od tego, ile wydano', () => {
    const frontier = createFrontier(5)
    frontier.add('https://przyklad.test/a', 0)
    frontier.add('https://przyklad.test/b', 0)
    frontier.next()
    expect(frontier.seen).toBe(2)
    expect(frontier.pending).toBe(1)
  })
})
