import { gunzipSync } from 'node:zlib'
import type {
  SiteFetchCapability, SiteFetchDeps, SiteFetchOptions, SiteFetchProvider, SiteResponse,
} from './types.js'

/**
 * Grzeczny pobieracz stron (D11). Mieszka w `packages/providers`, bo to jedyne
 * wyjscie na zewnatrz w calym projekcie i kazde zadanie ma wyladowac
 * w `provider_call` — takze zadanie zakonczone bledem.
 *
 * Zakaz podszywania sie: agent przedstawia sie nazwa i adresem kontaktowym,
 * zeby wlasciciel serwera mogl nas zablokowac, jesli zechce.
 */

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export class FetchTimeoutError extends Error {
  constructor(readonly url: string, readonly timeoutMs: number) {
    super(`Przekroczony czas oczekiwania (${timeoutMs} ms): ${url}`)
    this.name = 'FetchTimeoutError'
  }
}

export class ResponseTooLargeError extends Error {
  constructor(readonly url: string, readonly maxBytes: number) {
    super(`Odpowiedz przekroczyla limit ${maxBytes} bajtow: ${url}`)
    this.name = 'ResponseTooLargeError'
  }
}

function charsetOf(contentType: string | null): string {
  const match = /charset=\s*"?([\w-]+)"?/i.exec(contentType ?? '')
  return match?.[1]?.toLowerCase() ?? 'utf-8'
}

function isGzip(url: string, contentType: string | null): boolean {
  if (url.toLowerCase().endsWith('.gz')) return true
  const lower = (contentType ?? '').toLowerCase()
  return lower.includes('gzip') || lower.includes('x-gzip')
}

/**
 * Czyta cialo odpowiedzi strumieniowo i przerywa po przekroczeniu limitu.
 * Wczytanie calosci do pamieci „a potem sprawdzenie" nie chronilo by przed
 * odpowiedzia, ktora ma wysadzic proces.
 */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const stream = response.body
  if (stream === null) return { bytes: new Uint8Array(0), truncated: false }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value === undefined) continue
      total += value.byteLength
      if (total > maxBytes) {
        truncated = true
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(chunks.reduce((sum, c) => sum + c.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return { bytes, truncated }
}

function decode(bytes: Uint8Array, url: string, contentType: string | null): string {
  const payload = isGzip(url, contentType) ? gunzipSync(bytes) : bytes
  try {
    return new TextDecoder(charsetOf(contentType), { fatal: false }).decode(payload)
  } catch {
    // Nieznane kodowanie w naglowku nie moze skasowac strony — czytamy jako UTF-8.
    return new TextDecoder('utf-8', { fatal: false }).decode(payload)
  }
}

function headersOf(response: Response): { contentType: string | null; etag: string | null; lastModified: string | null } {
  return {
    contentType: response.headers.get('content-type'),
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  }
}

interface RawResult {
  readonly response: SiteResponse
  readonly httpStatus: number
}

async function performFetch(
  deps: SiteFetchDeps,
  url: string,
  options: SiteFetchOptions,
): Promise<RawResult> {
  const startedAt = deps.now()
  const chain: string[] = []
  let currentUrl = url
  let httpRequests = 0

  for (;;) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs)
    httpRequests += 1

    let response: Response
    try {
      const headers: Record<string, string> = {
        'user-agent': options.userAgent,
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
        'accept-language': 'pl,en;q=0.8',
      }
      if (options.ifNoneMatch !== undefined) headers['if-none-match'] = options.ifNoneMatch
      if (options.ifModifiedSince !== undefined) headers['if-modified-since'] = options.ifModifiedSince

      response = await deps.fetchFn(currentUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers,
      })
    } catch (error) {
      // Blad sieci jest **danymi**, nie wyjatkiem: strona, ktorej nie da sie pobrac,
      // to ustalenie audytu (`http.fetch-failed`), a nie powod, zeby przerwac crawl.
      const failure = controller.signal.aborted
        ? new FetchTimeoutError(currentUrl, options.timeoutMs)
        : error
      return {
        httpStatus: 0,
        response: failureResponse(url, currentUrl, failure, startedAt, deps.now, chain, httpRequests),
      }
    } finally {
      clearTimeout(timer)
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      if (location === null) {
        // Przekierowanie bez celu — traktujemy jak odpowiedz koncowa, zeby nie zgubic faktu.
        const meta = headersOf(response)
        return {
          httpStatus: response.status,
          response: {
            url: currentUrl, requestedUrl: url, status: response.status,
            contentType: meta.contentType, body: null, bytes: 0,
            durationMs: deps.now() - startedAt, redirectChain: chain, error: null,
            etag: meta.etag, lastModified: meta.lastModified, httpRequests, truncated: false,
          },
        }
      }
      if (chain.length >= options.maxRedirects) {
        const meta = headersOf(response)
        return {
          httpStatus: response.status,
          response: {
            url: currentUrl, requestedUrl: url, status: response.status,
            contentType: meta.contentType, body: null, bytes: 0,
            durationMs: deps.now() - startedAt, redirectChain: chain,
            error: `przekroczony limit przekierowan (${options.maxRedirects})`,
            etag: meta.etag, lastModified: meta.lastModified, httpRequests, truncated: false,
          },
        }
      }
      chain.push(currentUrl)
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    const meta = headersOf(response)

    // 304 znaczy „nic sie nie zmienilo" — brak ciala nie jest bledem.
    if (response.status === 304) {
      await response.body?.cancel()
      return {
        httpStatus: 304,
        response: {
          url: currentUrl, requestedUrl: url, status: 304, contentType: meta.contentType,
          body: null, bytes: 0, durationMs: deps.now() - startedAt, redirectChain: chain,
          error: null, etag: meta.etag, lastModified: meta.lastModified, httpRequests,
          truncated: false,
        },
      }
    }

    const { bytes, truncated } = await readCapped(response, options.maxBytes)
    if (truncated) {
      return {
        httpStatus: 0,
        response: failureResponse(
          url, currentUrl, new ResponseTooLargeError(currentUrl, options.maxBytes),
          startedAt, deps.now, chain, httpRequests,
        ),
      }
    }

    return {
      httpStatus: response.status,
      response: {
        url: currentUrl,
        requestedUrl: url,
        status: response.status,
        contentType: meta.contentType,
        body: decode(bytes, currentUrl, meta.contentType),
        bytes: bytes.byteLength,
        durationMs: deps.now() - startedAt,
        redirectChain: chain,
        error: null,
        etag: meta.etag,
        lastModified: meta.lastModified,
        httpRequests,
        truncated: false,
      },
    }
  }
}

/** Nieudane pobranie jako odpowiedz bez statusu — z zachowaniem tego, co juz wiemy. */
function failureResponse(
  requestedUrl: string,
  currentUrl: string,
  error: unknown,
  startedAt: number,
  now: () => number,
  chain: readonly string[],
  httpRequests: number,
): SiteResponse {
  return {
    url: currentUrl,
    requestedUrl,
    status: null,
    contentType: null,
    body: null,
    bytes: 0,
    durationMs: now() - startedAt,
    redirectChain: chain,
    error: error instanceof Error ? error.message : String(error),
    etag: null,
    lastModified: null,
    httpRequests,
    truncated: error instanceof ResponseTooLargeError,
  }
}

export function createSiteFetchProvider(deps: SiteFetchDeps): SiteFetchProvider {
  /**
   * Kazde pobranie zapisuje wiersz w `provider_call` (D11) — takze zakonczone
   * bledem. `ok` znaczy „udalo sie porozmawiac z serwerem": 404 i 500 to
   * odpowiedzi, wiec sa `ok`; timeout i przekroczony rozmiar nie sa.
   * `quotaUnits` liczy faktyczne zadania HTTP, wiec lancuch przekierowan
   * kosztuje tyle, ile naprawde kosztowal.
   */
  const fetchRecorded = async (
    url: string,
    capability: SiteFetchCapability,
    options: SiteFetchOptions,
  ): Promise<SiteResponse> => {
    const startedAt = deps.now()
    const { response } = await performFetch(deps, url, options)
    const succeeded = response.status !== null

    deps.ledger.record({
      providerId: 'site',
      capability,
      startedAt,
      durationMs: deps.now() - startedAt,
      ok: succeeded,
      httpStatus: response.status ?? undefined,
      errorCode: succeeded ? undefined : (response.error ?? 'unknown'),
      quotaUnits: response.httpRequests,
      costMicros: 0,
      requestFingerprint: url,
    })

    return response
  }

  return {
    id: 'site',
    capabilities: ['crawl:fetch', 'crawl:robots', 'crawl:sitemap'],
    fetchPage: (url, options) => fetchRecorded(url, 'crawl:fetch', options),
    fetchText: (url, capability, options) => fetchRecorded(url, capability, options),
  }
}
