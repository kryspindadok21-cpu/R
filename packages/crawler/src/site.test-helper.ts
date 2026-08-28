import type { Clock, FetchedPage, PageSource } from './crawl.js'

/**
 * Fixturowa witryna i zegar sterowany recznie. Dzieki nim caly przebieg crawla
 * da sie przetestowac bez sieci i bez faktycznego czekania (D12, AC4, AC11).
 */

export interface FakeClock extends Clock {
  readonly sleeps: readonly number[]
  advance(ms: number): void
}

export function fakeClock(start = 1_000_000): FakeClock {
  let current = start
  const sleeps: number[] = []
  return {
    now: () => current,
    sleep: async (ms: number) => { sleeps.push(ms); current += ms },
    advance: (ms: number) => { current += ms },
    get sleeps() { return sleeps },
  }
}

export interface FakePageSpec {
  readonly html?: string
  readonly status?: number
  readonly contentType?: string | null
  readonly redirectTo?: string
  readonly error?: string
  readonly durationMs?: number
}

export interface FakeSource extends PageSource {
  readonly requested: readonly string[]
}

/**
 * Zrodlo stron oparte o mape `adres → zawartosc`. Przekierowania rozwiazuje
 * samo, zapisujac lancuch — tak jak zrobi to prawdziwy pobieracz.
 */
export function fakePageSource(
  spec: Readonly<Record<string, FakePageSpec | string>>,
  clock?: { advance(ms: number): void },
): FakeSource {
  const requested: string[] = []
  // Sam tekst to skrot na `{ html }` — testy podaja HTML wprost.
  const at = (url: string): FakePageSpec | undefined => {
    const entry = spec[url]
    return typeof entry === 'string' ? { html: entry } : entry
  }

  return {
    get requested() { return requested },

    async fetchPage(url: string): Promise<FetchedPage> {
      requested.push(url)
      const chain: string[] = []
      let currentUrl = url
      let current = at(currentUrl)

      while (current?.redirectTo !== undefined) {
        chain.push(currentUrl)
        currentUrl = current.redirectTo
        current = at(currentUrl)
        if (chain.length > 10) break
      }

      const durationMs = current?.durationMs ?? 50
      clock?.advance(durationMs)

      if (current === undefined) {
        return {
          url: currentUrl, requestedUrl: url, status: 404, contentType: 'text/html',
          body: '<html><head><title>404</title></head><body>Nie ma</body></html>',
          bytes: 60, durationMs, redirectChain: chain, error: null,
        }
      }

      if (current.error !== undefined) {
        return {
          url: currentUrl, requestedUrl: url, status: null, contentType: null, body: null,
          bytes: 0, durationMs, redirectChain: chain, error: current.error,
        }
      }

      const body = current.html ?? ''
      return {
        url: currentUrl,
        requestedUrl: url,
        status: current.status ?? 200,
        contentType: current.contentType === undefined ? 'text/html; charset=utf-8' : current.contentType,
        body,
        bytes: body.length,
        durationMs,
        redirectChain: chain,
        error: null,
      }
    },
  }
}

/** Minimalna strona HTML z podanymi linkami. */
export function htmlWithLinks(title: string, hrefs: readonly string[]): string {
  const links = hrefs.map((href) => `<a href="${href}">Przejdź do ${href}</a>`).join('\n')
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>${title}</title></head>`
    + `<body><h1>${title}</h1><p>Treść strony ${title}.</p>${links}</body></html>`
}
