import { createHash } from 'node:crypto'

/**
 * Wersja regul normalizacji. Zmiana tej stalej uniewaznia porownywalnosc
 * zapisanych url_hash — wymaga nowych wierszy i skryptu backfillu (D4).
 */
export const NORMALIZER_VERSION = 1

export class InvalidUrlError extends Error {
  constructor(
    readonly raw: string,
    readonly reason: string,
  ) {
    super(`Nieprawidlowy URL (${reason}): ${raw}`)
    this.name = 'InvalidUrlError'
  }
}

export interface NormalizedUrl {
  readonly raw: string
  readonly normalized: string
  readonly hash: string
  readonly normalizerVersion: number
}

/** Parametry czysto sledzace. `ref` swiadomie pominiete — bywa nosnikiem tresci. */
const TRACKING_PARAM_PATTERNS: readonly RegExp[] = [
  /^utm_/i,
  /^(gclid|gbraid|wbraid|fbclid|msclkid|mc_eid|mc_cid|yclid|igshid|ttclid|li_fat_id|_ga|_gl|_hsenc|_hsmi|vero_id|s_kwcid)$/i,
]

function isTrackingParam(name: string): boolean {
  return TRACKING_PARAM_PATTERNS.some((pattern) => pattern.test(name))
}

/** RFC 3986: znaki unreserved dekodujemy, pozostale trojki zapisujemy wielkimi literami. */
function canonicalizePercentEncoding(value: string): string {
  return value.replace(/%([0-9a-fA-F]{2})/g, (_match, hex: string) => {
    const ch = String.fromCharCode(Number.parseInt(hex, 16))
    return /[A-Za-z0-9\-._~]/.test(ch) ? ch : `%${hex.toUpperCase()}`
  })
}

function compareParams(a: readonly [string, string], b: readonly [string, string]): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1
  return 0
}

export function normalizeUrl(raw: string): NormalizedUrl {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new InvalidUrlError(raw, 'nie da sie sparsowac')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError(raw, `nieobslugiwany schemat ${parsed.protocol}`)
  }

  // URL juz: obniza wielkosc liter w hoscie, robi punycode, usuwa domyslny port.
  parsed.hash = ''
  parsed.username = ''
  parsed.password = ''

  const params: [string, string][] = [...parsed.searchParams.entries()].filter(
    ([name]) => !isTrackingParam(name),
  )
  params.sort(compareParams)
  const query = new URLSearchParams(params).toString()

  const path = canonicalizePercentEncoding(parsed.pathname)
  const normalized = `${parsed.protocol}//${parsed.host}${path}${query ? `?${query}` : ''}`

  return {
    raw,
    normalized,
    hash: createHash('sha256').update(normalized, 'utf8').digest('hex').slice(0, 32),
    normalizerVersion: NORMALIZER_VERSION,
  }
}
