import type { CallLedger } from '../ledger.js'

export type SiteFetchCapability = 'crawl:fetch' | 'crawl:robots' | 'crawl:sitemap'

export interface SiteFetchOptions {
  readonly timeoutMs: number
  readonly maxBytes: number
  readonly maxRedirects: number
  readonly userAgent: string
  /** Warunkowe GET — oszczedza pasmo wlasciciela strony przy powtornym crawlu. */
  readonly ifNoneMatch?: string | undefined
  readonly ifModifiedSince?: string | undefined
}

export interface SiteResponse {
  /** Adres koncowy, po przekierowaniach. */
  readonly url: string
  readonly requestedUrl: string
  /** `null`, gdy zadanie w ogole sie nie powiodlo. */
  readonly status: number | null
  readonly contentType: string | null
  readonly body: string | null
  readonly bytes: number
  readonly durationMs: number
  /** Adresy posrednie, bez koncowego. */
  readonly redirectChain: readonly string[]
  readonly error: string | null
  readonly etag: string | null
  readonly lastModified: string | null
  /** Ile zadan HTTP kosztowalo pobranie tej strony, razem z przekierowaniami. */
  readonly httpRequests: number
  /** `true`, gdy odpowiedz przerwano po przekroczeniu limitu rozmiaru. */
  readonly truncated: boolean
}

export interface SiteFetchProvider {
  readonly id: 'site'
  readonly capabilities: readonly SiteFetchCapability[]
  /** Zgodne ksztaltem z `PageSource` z @seo/crawler — crawler wstrzykuje to wprost. */
  fetchPage(url: string, options: SiteFetchOptions): Promise<SiteResponse>
  /** Pobiera zasob tekstowy: `robots.txt` albo mape witryny (takze `.gz`). */
  fetchText(
    url: string,
    capability: 'crawl:robots' | 'crawl:sitemap',
    options: SiteFetchOptions,
  ): Promise<SiteResponse>
}

export interface SiteFetchDeps {
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
}
