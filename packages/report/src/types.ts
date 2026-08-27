export interface DailyPoint { readonly date: string; readonly clicks: number; readonly impressions: number }
export interface QueryPoint { readonly query: string; readonly clicks: number; readonly impressions: number }

export interface ReconciliationPoint {
  readonly date: string
  readonly totalClicks: number; readonly querySumClicks: number; readonly anonymizedDeltaClicks: number
  readonly totalImpressions: number; readonly querySumImpressions: number; readonly anonymizedDeltaImpressions: number
}

export interface ProviderCallPoint {
  readonly providerId: string; readonly capability: string
  readonly calls: number; readonly quotaUnits: number; readonly costMicros: number; readonly failures: number
}

export interface ReportData {
  readonly siteUri: string
  readonly generatedAt: string
  readonly daily: readonly DailyPoint[]
  readonly topQueries: readonly QueryPoint[]
  readonly reconciliation: readonly ReconciliationPoint[]
  readonly providerCalls: readonly ProviderCallPoint[]
}
