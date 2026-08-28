export type PsiStrategy = 'mobile' | 'desktop'

/**
 * Zrodlo pomiaru. `field` to dane od prawdziwych uzytkownikow z CrUX — jedyne,
 * ktore licza sie w Core Web Vitals. `lab` to symulacja Lighthouse: powtarzalna,
 * ale nie jest tym, co Google bierze pod uwage. Mieszanie ich w jednej liczbie
 * jest najczestszym oszustwem narzedzi wydajnosciowych, wiec ich nie mieszamy.
 */
export type PsiSource = 'lab' | 'field'

export interface PsiMetrics {
  readonly source: PsiSource
  readonly lcpMs: number | null
  readonly inpMs: number | null
  readonly cls: number | null
  readonly ttfbMs: number | null
  /** Ocena Lighthouse 0–1. Tylko dla `lab`; pola nie ma dla danych terenowych. */
  readonly performanceScore: number | null
}

export interface PsiResult {
  readonly url: string
  readonly strategy: PsiStrategy
  readonly measuredAt: number
  /** Zwykle dwa wpisy: `field` i `lab`. Strona bez ruchu ma tylko `lab`. */
  readonly metrics: readonly PsiMetrics[]
  readonly error: string | null
}

export interface PsiProvider {
  readonly id: 'psi'
  measure(url: string, strategy: PsiStrategy): Promise<PsiResult>
}
