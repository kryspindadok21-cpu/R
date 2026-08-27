import { describe, expect, it } from 'vitest'
import { buildIndex } from './skills-index.js'
import { expandTask } from './skills-glossary.js'
import { rankSkills } from './skills-pick.js'

describe('expandTask', () => {
  it('tlumaczy pojecie wielowyrazowe', () => {
    expect(expandTask('dodaj dane strukturalne')).toMatch(/structured data/)
  })

  it('tlumaczy pojecie jednowyrazowe', () => {
    expect(expandTask('zrob audyt')).toMatch(/audit/)
  })

  it('zachowuje oryginalna tresc zadania', () => {
    expect(expandTask('zrob audyt')).toMatch(/zrob audyt/)
  })

  it('radzi sobie z odmiana przez przypadki', () => {
    expect(expandTask('mam problem z indeksowaniem')).toMatch(/indexing/)
  })

  it('nie dopisuje niczego, gdy nie zna zadnego pojecia', () => {
    expect(expandTask('przepis na zurek')).toBe('przepis na zurek')
  })

  it('nie powtarza tego samego tlumaczenia', () => {
    const out = expandTask('audyt i jeszcze raz audyt')
    expect(out.match(/audit/g)).toHaveLength(1)
  })
})

describe('dobor po polsku', () => {
  it('polskie zadanie trafia w angielski opis umiejetnosci', () => {
    const s = rankSkills(buildIndex(process.cwd()), 'chce dodac dane strukturalne do stron produktow')
    expect(s.chosen.map((c) => c.name)).toContain('schema')
  })

  it('polskie zadanie o awarii trafia w debugowanie', () => {
    const s = rankSkills(buildIndex(process.cwd()), 'test sie wywala, trzeba znalezc przyczyne bledu')
    expect(s.chosen.map((c) => c.name)).toContain('systematic-debugging')
  })
})
