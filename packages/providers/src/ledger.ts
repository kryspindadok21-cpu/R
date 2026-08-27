export class ProviderHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'ProviderHttpError'
  }
}

export interface ProviderCallEntry {
  readonly providerId: string
  readonly capability: string
  readonly startedAt: number
  readonly durationMs: number
  readonly ok: boolean
  readonly httpStatus?: number | undefined
  readonly errorCode?: string | undefined
  readonly quotaUnits: number
  readonly costMicros: number
  readonly requestFingerprint: string
}

export interface CallLedger {
  record(entry: ProviderCallEntry): void
}

/** Rejestr, ktory nic nie zapisuje. Wylacznie do testow jednostkowych. */
export const NULL_LEDGER: CallLedger = { record() {} }

export interface CallMeta {
  readonly providerId: string
  readonly capability: string
  readonly quotaUnits: number
  readonly costMicros: number
  readonly requestFingerprint: string
}

/**
 * Kazde wyjscie poza proces przechodzi tedy (D7). Rejestr zapisuje sie takze
 * przy bledzie — inaczej zuzyty limit po nieudanym wywolaniu bylby niewidoczny.
 */
export async function withLedger<T>(
  ledger: CallLedger,
  meta: CallMeta,
  now: () => number,
  fn: () => Promise<{ value: T; httpStatus: number }>,
): Promise<T> {
  const startedAt = now()
  try {
    const { value, httpStatus } = await fn()
    ledger.record({ ...meta, startedAt, durationMs: now() - startedAt, ok: true, httpStatus })
    return value
  } catch (error) {
    const http = error instanceof ProviderHttpError ? error : undefined
    ledger.record({
      ...meta,
      startedAt,
      durationMs: now() - startedAt,
      ok: false,
      httpStatus: http?.status,
      errorCode: http?.code ?? 'unknown',
    })
    throw error
  }
}
