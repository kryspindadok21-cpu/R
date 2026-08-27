import { describe, expect, it } from 'vitest'
import { buildIndex } from './skills-index.js'
import { extractTerms, rankSkills } from './skills-pick.js'
import type { SkillIndex } from './skills-index.js'

const INDEX: SkillIndex = {
  skills: [
    { name: 'seo-audit', description: 'Audyt SEO, "core web vitals", crawl errors, indeksowanie',
      tokens: 1000, referenceTokens: 5000, references: [] },
    { name: 'systematic-debugging', description: 'Debugowanie bledow, test failure, unexpected behavior',
      tokens: 800, referenceTokens: 4000, references: [] },
    { name: 'schema', description: 'Dane strukturalne, structured data, JSON-LD',
      tokens: 600, referenceTokens: 2000, references: [] },
    { name: 'writing-plans', description: 'Pisanie planow wykonawczych',
      tokens: 9000, referenceTokens: 0, references: [] },
  ],
}

describe('extractTerms', () => {
  it('sprowadza polskie znaki do postaci bez ogonkow', () => {
    expect(extractTerms('błędy indeksowania')).toContain('bledy')
  })

  it('pomija slowa funkcyjne i bardzo krotkie', () => {
    const terms = extractTerms('i w na the and use user')
    expect(terms).toEqual([])
  })

  it('nie powtarza tego samego slowa', () => {
    expect(extractTerms('audyt audyt audyt')).toEqual(['audyt'])
  })
})

describe('rankSkills', () => {
  it('wybiera umiejetnosc pasujaca do zadania', () => {
    const s = rankSkills(INDEX, 'mam crawl errors i problem z indeksowanie')
    expect(s.chosen[0]!.name).toBe('seo-audit')
  })

  it('podaje slowa, ktore zadecydowaly o wyborze', () => {
    const s = rankSkills(INDEX, 'crawl errors')
    expect(s.chosen[0]!.matched).toContain('crawl')
  })

  it('nie wybiera niczego, gdy nic nie pasuje', () => {
    const s = rankSkills(INDEX, 'przepis na zurek')
    expect(s.chosen).toEqual([])
  })

  it('miesci sie w budzecie tokenow', () => {
    const s = rankSkills(INDEX, 'audyt seo, debugowanie bledow, dane strukturalne', { budgetTokens: 1500 })
    expect(s.usedTokens).toBeLessThanOrEqual(1500)
    expect(s.skipped.some((x) => x.reason === 'budzet')).toBe(true)
  })

  it('nie przekracza limitu liczby umiejetnosci', () => {
    const s = rankSkills(INDEX, 'audyt seo, debugowanie bledow, dane strukturalne', { maxSkills: 1 })
    expect(s.chosen).toHaveLength(1)
    expect(s.skipped.some((x) => x.reason === 'limit')).toBe(true)
  })

  it('umiejetnosc przypieta wchodzi bez dopasowania i liczy sie do budzetu', () => {
    const s = rankSkills(INDEX, 'przepis na zurek', { pinned: ['schema'] })
    expect(s.chosen.map((c) => c.name)).toEqual(['schema'])
    expect(s.usedTokens).toBe(600)
  })

  it('zglasza przypieta umiejetnosc, ktorej nie ma w indeksie', () => {
    const s = rankSkills(INDEX, 'cokolwiek', { pinned: ['nie-istnieje'] })
    expect(s.skipped).toContainEqual(expect.objectContaining({ name: 'nie-istnieje', reason: 'nieznana' }))
  })

  it('nazwa umiejetnosci wazy wiecej niz slowo z opisu', () => {
    const s = rankSkills(INDEX, 'schema')
    expect(s.chosen[0]!.name).toBe('schema')
  })

  it('daje ten sam wynik przy tym samym wejsciu', () => {
    const a = rankSkills(INDEX, 'audyt seo i debugowanie')
    const b = rankSkills(INDEX, 'audyt seo i debugowanie')
    expect(a).toEqual(b)
  })

  it('dziala na prawdziwym katalogu tego repozytorium', () => {
    const s = rankSkills(buildIndex(process.cwd()), 'crawl errors, core web vitals, why am I not ranking')
    expect(s.chosen.map((c) => c.name)).toContain('seo-audit')
    expect(s.usedTokens).toBeLessThanOrEqual(s.budgetTokens)
  })
})

describe('waga rzadkosci slowa', () => {
  const COMMON = 'audyt strony';
  const IDF_INDEX: SkillIndex = {
    skills: [
      ...['a', 'b', 'c', 'd', 'e'].map((name) => ({
        name, description: COMMON, tokens: 100, referenceTokens: 0, references: [],
      })),
      { name: 'rzadka', description: 'ulid', tokens: 100, referenceTokens: 0, references: [] },
    ],
  }

  it('slowo z jednego opisu wazy wiecej niz slowo z pieciu', () => {
    const s = rankSkills(IDF_INDEX, 'audyt ulid')
    expect(s.chosen[0]!.name).toBe('rzadka')
  })

  it('trafnosc jest zaokraglona, zeby wynik dalo sie porownywac', () => {
    const s = rankSkills(IDF_INDEX, 'audyt ulid')
    for (const c of s.chosen) expect(c.score).toBe(Math.round(c.score * 100) / 100)
  })
})
