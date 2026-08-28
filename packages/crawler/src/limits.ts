/**
 * Bezpieczniki crawlera (D15). Wartosci siedza w kodzie, nie w konfiguracji:
 * crawler bez sufitu jest narzedziem do przeciazania serwerow, takze wlasnego.
 * Flaga moze zejsc w dol, nigdy powyzej sufitu.
 */

export interface CrawlLimits {
  readonly maxPages: number
  readonly maxDepth: number
  /** Minimalny odstep miedzy zadaniami do tego samego hosta. */
  readonly delayMs: number
  readonly requestTimeoutMs: number
  readonly maxResponseBytes: number
  readonly maxRedirectHops: number
  /** Budzet czasu calego przebiegu. */
  readonly totalBudgetMs: number
}

export const DEFAULT_LIMITS: CrawlLimits = {
  maxPages: 500,
  maxDepth: 5,
  delayMs: 1000,
  requestTimeoutMs: 15_000,
  maxResponseBytes: 5 * 1024 * 1024,
  maxRedirectHops: 5,
  totalBudgetMs: 15 * 60 * 1000,
}

/** Wartosci, ktorych nie wolno przekroczyc zadna flaga. */
export const LIMIT_CEILINGS = {
  maxPages: 10_000,
  maxDepth: 20,
  requestTimeoutMs: 30_000,
  maxResponseBytes: 20 * 1024 * 1024,
  maxRedirectHops: 10,
  totalBudgetMs: 2 * 60 * 60 * 1000,
} as const

/** Odstep nie moze zejsc ponizej tej wartosci — to podloga, nie sufit. */
export const MIN_DELAY_MS = 500

export const USER_AGENT = 'mentiometry-crawler/0.1 (+https://github.com/kryspindadok21-cpu/R)'

export interface LimitAdjustment {
  readonly limit: keyof CrawlLimits
  readonly requested: number
  readonly applied: number
}

/**
 * Sprowadza zadane wartosci do dopuszczalnego zakresu i melduje, co przyciela.
 * Przyciecie z komunikatem jest lepsze niz odrzucenie polecenia: uzytkownik
 * dostaje crawl, ktory chcial, tylko bezpieczny — i wie, ze tak sie stalo.
 */
export function clampLimits(requested: Partial<CrawlLimits> = {}): {
  limits: CrawlLimits
  adjustments: readonly LimitAdjustment[]
} {
  const adjustments: LimitAdjustment[] = []

  const clampMax = (key: Exclude<keyof CrawlLimits, 'delayMs'>, ceiling: number): number => {
    const value = requested[key]
    if (value === undefined) return DEFAULT_LIMITS[key]
    const applied = Math.max(1, Math.min(Math.floor(value), ceiling))
    if (applied !== value) adjustments.push({ limit: key, requested: value, applied })
    return applied
  }

  const requestedDelay = requested.delayMs
  let delayMs = DEFAULT_LIMITS.delayMs
  if (requestedDelay !== undefined) {
    delayMs = Math.max(MIN_DELAY_MS, Math.floor(requestedDelay))
    if (delayMs !== requestedDelay) {
      adjustments.push({ limit: 'delayMs', requested: requestedDelay, applied: delayMs })
    }
  }

  return {
    limits: {
      maxPages: clampMax('maxPages', LIMIT_CEILINGS.maxPages),
      maxDepth: clampMax('maxDepth', LIMIT_CEILINGS.maxDepth),
      delayMs,
      requestTimeoutMs: clampMax('requestTimeoutMs', LIMIT_CEILINGS.requestTimeoutMs),
      maxResponseBytes: clampMax('maxResponseBytes', LIMIT_CEILINGS.maxResponseBytes),
      maxRedirectHops: clampMax('maxRedirectHops', LIMIT_CEILINGS.maxRedirectHops),
      totalBudgetMs: clampMax('totalBudgetMs', LIMIT_CEILINGS.totalBudgetMs),
    },
    adjustments,
  }
}
