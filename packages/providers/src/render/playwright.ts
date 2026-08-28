import { type CallLedger } from '../ledger.js'
import type { RenderOptions, RenderProvider, RenderedPage } from './types.js'

/**
 * Renderowanie stron przez Chromium (D16).
 *
 * Powod istnienia: czesc crawlerow retrievalowych nie wykonuje JavaScriptu.
 * Strona moze swietnie rankowac w Google i byc calkowicie nieobecna
 * w odpowiedziach modeli. Bez tego pomiaru nie da sie tego stwierdzic.
 *
 * Dwie decyzje, ktore trzymaja koszt w ryzach:
 *  - `playwright-core` jest **zaleznoscia opcjonalna** i importowany leniwie.
 *    Swiadomie `-core`, a nie pelny `playwright`: ten drugi sciaga w postinstall
 *    okolo 150 MB przegladarki przy kazdym `pnpm install`, takze w CI, gdzie
 *    zadna przegladarka nie jest potrzebna. Przegladarke pobiera uzytkownik,
 *    raz, swiadomie. Bez niej `seo crawl` dziala; tylko `--render` konczy sie
 *    czytelnym komunikatem.
 *  - Renderujemy **probke stron**, nie wszystkie. Chromium na 500 stronach to
 *    kilkadziesiat minut, a odpowiedz na pytanie „czy ta strona wymaga JS"
 *    dostajemy z dziesieciu stron.
 */

export class RenderUnavailableError extends Error {
  constructor(readonly reason: string) {
    super(
      'Renderowanie jest niedostepne: ' + reason + '\n'
      + 'Pobierz przegladarke raz:   npx playwright install chromium\n'
      + 'Albo wskaz juz posiadana:   export SEO_CHROMIUM_PATH=/sciezka/do/chrome\n'
      + 'Crawl bez --render dziala mimo to.',
    )
    this.name = 'RenderUnavailableError'
  }
}

export interface RenderDeps {
  readonly ledger: CallLedger
  readonly now: () => number
  /**
   * Sciezka do binarki przegladarki. Potrzebna, gdy w systemie stoi Chromium
   * w innej wersji niz ta, ktorej szuka Playwright — a tak jest czesciej,
   * niz sugeruje dokumentacja.
   */
  readonly executablePath?: string | undefined
}

/** Minimalny ksztalt Playwrighta, ktorego uzywamy. Trzyma leniwy import w typach. */
interface BrowserLike {
  newPage(options: { userAgent: string }): Promise<PageLike>
  close(): Promise<void>
}

interface PageLike {
  goto(url: string, options: { timeout: number; waitUntil: 'domcontentloaded' }): Promise<ResponseLike | null>
  waitForTimeout(ms: number): Promise<void>
  content(): Promise<string>
  url(): string
  close(): Promise<void>
}

interface ResponseLike {
  status(): number
}

interface ChromiumLike {
  launch(options: { headless: true; executablePath?: string }): Promise<BrowserLike>
}

async function loadChromium(): Promise<ChromiumLike> {
  try {
    const playwright = (await import('playwright-core')) as unknown as { chromium: ChromiumLike }
    return playwright.chromium
  } catch (error) {
    throw new RenderUnavailableError(
      `nie udalo sie zaladowac pakietu playwright-core (${error instanceof Error ? error.message : String(error)})`,
    )
  }
}

export function createRenderProvider(deps: RenderDeps): RenderProvider {
  let browser: BrowserLike | null = null

  const ensureBrowser = async (): Promise<BrowserLike> => {
    if (browser !== null) return browser
    const chromium = await loadChromium()
    try {
      browser = await chromium.launch(
        deps.executablePath === undefined
          ? { headless: true }
          : { headless: true, executablePath: deps.executablePath },
      )
    } catch (error) {
      throw new RenderUnavailableError(
        error instanceof Error ? error.message.split('\n')[0] ?? error.message : String(error),
      )
    }
    return browser
  }

  return {
    id: 'render',

    async renderPage(url: string, options: RenderOptions): Promise<RenderedPage> {
      const startedAt = deps.now()
      let page: PageLike | null = null

      try {
        const active = await ensureBrowser()
        page = await active.newPage({ userAgent: options.userAgent })
        const response = await page.goto(url, {
          timeout: options.timeoutMs,
          waitUntil: 'domcontentloaded',
        })
        // Tresc dociagana po pierwszym rysowaniu jest dokladnie tym, czego szukamy.
        await page.waitForTimeout(options.settleMs)
        const html = await page.content()
        const finalUrl = page.url()
        const status = response === null ? null : response.status()

        deps.ledger.record({
          providerId: 'render',
          capability: 'crawl:render',
          startedAt,
          durationMs: deps.now() - startedAt,
          ok: true,
          httpStatus: status ?? undefined,
          quotaUnits: 1,
          costMicros: 0,
          requestFingerprint: url,
        })

        return { url, finalUrl, status, html, durationMs: deps.now() - startedAt, error: null }
      } catch (error) {
        // Brak przegladarki to blad konfiguracji, nie wlasciwosc strony —
        // ma dotrzec do uzytkownika, a nie zostac zapisany jako ustalenie audytu.
        if (error instanceof RenderUnavailableError) throw error

        const message = error instanceof Error ? error.message : String(error)
        deps.ledger.record({
          providerId: 'render',
          capability: 'crawl:render',
          startedAt,
          durationMs: deps.now() - startedAt,
          ok: false,
          errorCode: message,
          quotaUnits: 1,
          costMicros: 0,
          requestFingerprint: url,
        })
        return {
          url, finalUrl: url, status: null, html: null,
          durationMs: deps.now() - startedAt, error: message,
        }
      } finally {
        await page?.close().catch(() => undefined)
      }
    },

    async close(): Promise<void> {
      const active = browser
      browser = null
      await active?.close().catch(() => undefined)
    },
  }
}
