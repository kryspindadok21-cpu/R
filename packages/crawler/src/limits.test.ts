import { describe, expect, it } from 'vitest'
import { DEFAULT_LIMITS, LIMIT_CEILINGS, MIN_DELAY_MS, USER_AGENT, clampLimits } from './limits.js'

describe('clampLimits', () => {
  it('bez argumentów daje wartości domyślne', () => {
    expect(clampLimits().limits).toEqual(DEFAULT_LIMITS)
    expect(clampLimits().adjustments).toEqual([])
  })

  it('przepuszcza wartość poniżej sufitu bez zmian', () => {
    const { limits, adjustments } = clampLimits({ maxPages: 50 })
    expect(limits.maxPages).toBe(50)
    expect(adjustments).toEqual([])
  })

  it('przycina wartość ponad sufitem i melduje przycięcie', () => {
    const { limits, adjustments } = clampLimits({ maxPages: 1_000_000 })
    expect(limits.maxPages).toBe(LIMIT_CEILINGS.maxPages)
    expect(adjustments).toEqual([
      { limit: 'maxPages', requested: 1_000_000, applied: LIMIT_CEILINGS.maxPages },
    ])
  })

  it('nie pozwala zejść z odstępem poniżej podłogi', () => {
    const { limits, adjustments } = clampLimits({ delayMs: 0 })
    expect(limits.delayMs).toBe(MIN_DELAY_MS)
    expect(adjustments[0]?.limit).toBe('delayMs')
  })

  it('pozwala zwolnić dowolnie', () => {
    expect(clampLimits({ delayMs: 10_000 }).limits.delayMs).toBe(10_000)
  })

  it('przycina każdy limit osobno, nie wszystkie naraz', () => {
    const { limits, adjustments } = clampLimits({ maxDepth: 999, maxPages: 10 })
    expect(limits.maxDepth).toBe(LIMIT_CEILINGS.maxDepth)
    expect(limits.maxPages).toBe(10)
    expect(adjustments.map((a) => a.limit)).toEqual(['maxDepth'])
  })

  it('nie dopuszcza zera stron ani zerowej głębokości', () => {
    expect(clampLimits({ maxPages: 0 }).limits.maxPages).toBe(1)
    expect(clampLimits({ maxDepth: -5 }).limits.maxDepth).toBe(1)
  })

  it('agent przedstawia się nazwą, nie udaje przeglądarki', () => {
    expect(USER_AGENT).toMatch(/^mentiometry-crawler\//)
    expect(USER_AGENT).toContain('+https://')
  })
})
