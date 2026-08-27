export interface DailyTotals { readonly date: string; readonly clicks: number; readonly impressions: number }
export interface QueryTotals extends DailyTotals { readonly query: string }

export interface ReconciliationRow {
  readonly date: string
  readonly totalClicks: number
  readonly querySumClicks: number
  readonly anonymizedDeltaClicks: number
  readonly totalImpressions: number
  readonly querySumImpressions: number
  readonly anonymizedDeltaImpressions: number
}

export class ReconciliationMismatchError extends Error {
  constructor(readonly date: string, readonly total: number, readonly querySum: number) {
    super(
      `Suma po haslach (${querySum}) przekracza sume dzienna (${total}) dla ${date}. ` +
      'Google nie moze ujawnic w rozbiciu wiecej niz raportuje w sumie — to blad w liczeniu, nie w danych.',
    )
    this.name = 'ReconciliationMismatchError'
  }
}

/**
 * Roznica miedzy suma dzienna a suma po haslach to dane, ktore Google ukrywa
 * ze wzgledu na prywatnosc. Mierzymy ja i pokazujemy, zamiast scigac (AC4).
 */
export function computeReconciliation(
  daily: readonly DailyTotals[],
  queryDaily: readonly QueryTotals[],
): ReconciliationRow[] {
  const sums = new Map<string, { clicks: number; impressions: number }>()
  for (const row of queryDaily) {
    const acc = sums.get(row.date) ?? { clicks: 0, impressions: 0 }
    acc.clicks += row.clicks
    acc.impressions += row.impressions
    sums.set(row.date, acc)
  }

  return daily.map((d) => {
    const q = sums.get(d.date) ?? { clicks: 0, impressions: 0 }
    if (q.clicks > d.clicks) throw new ReconciliationMismatchError(d.date, d.clicks, q.clicks)
    if (q.impressions > d.impressions) throw new ReconciliationMismatchError(d.date, d.impressions, q.impressions)
    return {
      date: d.date,
      totalClicks: d.clicks,
      querySumClicks: q.clicks,
      anonymizedDeltaClicks: d.clicks - q.clicks,
      totalImpressions: d.impressions,
      querySumImpressions: q.impressions,
      anonymizedDeltaImpressions: d.impressions - q.impressions,
    }
  })
}
