export type AccessMode = 'api' | 'api_grounded'
export type CitationSource = 'grounding' | 'inline'

/** Odsetek z przedzialem. Nigdy nie pokazujemy jednego bez drugiego (D24). */
export interface ShareRow {
  readonly rate: number
  readonly low: number
  readonly high: number
}

export interface GeoEngineRow {
  readonly engine: string
  readonly modelVersion: string
  readonly accessMode: AccessMode
  readonly answersOk: number
  readonly answersFailed: number
  readonly refusals: number
  readonly visibility: ShareRow
}

export interface GeoVoiceRow {
  readonly name: string
  readonly isOwn: boolean
  readonly answersWithMention: number
  readonly share: ShareRow
  /** Mediana pozycji pierwszej wzmianki; `null`, gdy encji nie bylo (D30). */
  readonly medianFirstPosition: number | null
}

export interface GeoCitationRow {
  readonly source: CitationSource
  readonly ourRate: ShareRow
  readonly topHosts: readonly { readonly host: string; readonly count: number }[]
}

/**
 * Porownanie z poprzednim pomiarem. `odmowa` nie jest bledem raportu — to jest
 * wynik, ktory czytelnik ma zobaczyc razem z powodem (D25, D27, D29).
 */
export type GeoComparisonRow =
  | {
      readonly kind: 'porownanie'
      readonly engine: string
      readonly meanDifference: number
      readonly low: number
      readonly high: number
      readonly significant: boolean
    }
  | {
      readonly kind: 'odmowa'
      readonly engine: string
      readonly reason: string
      readonly detail: string
    }

export interface GeoReportData {
  readonly siteUri: string
  readonly generatedAt: string
  readonly runStartedAt: string
  readonly ownBrand: string
  readonly promptSetName: string
  readonly promptSetVersion: number
  readonly prompts: number
  readonly runsPerPrompt: number
  readonly entityVersion: number
  /** Najmniejsza zmiana, ktora ten zestaw jest w stanie wykryc (D26). */
  readonly detectableDifference: number
  readonly engines: readonly GeoEngineRow[]
  readonly skipped: readonly { readonly id: string; readonly reason: string }[]
  readonly voice: readonly GeoVoiceRow[]
  readonly citations: readonly GeoCitationRow[]
  readonly comparisons: readonly GeoComparisonRow[]
}
