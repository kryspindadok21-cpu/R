export type ProviderId = 'gsc'
export type SiteMetricsCapability = 'performance.byDate' | 'performance.byQuery'
export type DataState = 'final' | 'all'
export type PerformanceDimension = 'date' | 'query'

export interface PerformanceQuery {
  readonly siteUrl: string
  /** YYYY-MM-DD w kalendarzu zrodla. Nigdy nie konwertowac na Date (D3). */
  readonly startDate: string
  readonly endDate: string
  readonly dimensions: readonly PerformanceDimension[]
  readonly dataState: DataState
  readonly rowLimit: number
  readonly startRow: number
}

export interface PerformanceRow {
  /** Wartosci wymiarow w kolejnosci z zapytania, przepisane doslownie z API. */
  readonly keys: readonly string[]
  readonly clicks: number
  readonly impressions: number
  readonly ctr: number
  readonly position: number
}

export interface PerformanceRows {
  readonly rows: readonly PerformanceRow[]
  /** Strefa kalendarza, w ktorym zrodlo raportuje daty. Nie sluzy do konwersji. */
  readonly sourceTimezone: string
}

export interface SiteMetricsProvider {
  readonly id: ProviderId
  readonly capabilities: readonly SiteMetricsCapability[]
  queryPerformance(query: PerformanceQuery): Promise<PerformanceRows>
  /** Ile jednostek limitu zuzyje ten zestaw zapytan. Dla zrodel darmowych to nadal >0. */
  estimateQuota(queries: readonly PerformanceQuery[]): number
}
