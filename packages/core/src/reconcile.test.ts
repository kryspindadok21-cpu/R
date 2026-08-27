import { describe, expect, it } from 'vitest'
import { ReconciliationMismatchError, computeReconciliation } from './reconcile.js'

const daily = [
  { date: '2026-03-10', clicks: 100, impressions: 1000 },
  { date: '2026-03-11', clicks: 50, impressions: 500 },
]

describe('computeReconciliation', () => {
  it('liczy roznice anonimizacji jako total minus suma po haslach', () => {
    const out = computeReconciliation(daily, [
      { date: '2026-03-10', query: 'a', clicks: 60, impressions: 600 },
      { date: '2026-03-10', query: 'b', clicks: 30, impressions: 300 },
      { date: '2026-03-11', query: 'a', clicks: 50, impressions: 500 },
    ])
    expect(out).toEqual([
      { date: '2026-03-10', totalClicks: 100, querySumClicks: 90, anonymizedDeltaClicks: 10,
        totalImpressions: 1000, querySumImpressions: 900, anonymizedDeltaImpressions: 100 },
      { date: '2026-03-11', totalClicks: 50, querySumClicks: 50, anonymizedDeltaClicks: 0,
        totalImpressions: 500, querySumImpressions: 500, anonymizedDeltaImpressions: 0 },
    ])
  })

  it('traktuje brak wierszy po haslach jako pelna anonimizacje', () => {
    const out = computeReconciliation([daily[0]!], [])
    expect(out[0]).toMatchObject({ querySumClicks: 0, anonymizedDeltaClicks: 100 })
  })

  it('rzuca, gdy suma po haslach przekracza sume dzienna (AC4)', () => {
    expect(() =>
      computeReconciliation([daily[0]!], [{ date: '2026-03-10', query: 'a', clicks: 101, impressions: 10 }]),
    ).toThrow(ReconciliationMismatchError)
  })

  it('rzuca, gdy suma wyswietlen po haslach przekracza sume dzienna', () => {
    expect(() =>
      computeReconciliation([daily[0]!], [{ date: '2026-03-10', query: 'a', clicks: 1, impressions: 1001 }]),
    ).toThrow(ReconciliationMismatchError)
  })

  it('ignoruje hasla z dni spoza zestawu dziennego', () => {
    const out = computeReconciliation([daily[0]!], [{ date: '2020-01-01', query: 'x', clicks: 5, impressions: 5 }])
    expect(out).toHaveLength(1)
    expect(out[0]!.querySumClicks).toBe(0)
  })
})
