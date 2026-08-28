export interface RenderOptions {
  readonly timeoutMs: number
  readonly userAgent: string
  /**
   * Ile czekac na ucichniecie sieci po zaladowaniu dokumentu. Strony
   * renderowane po stronie klienta dociagaja tresc po pierwszym rysowaniu.
   */
  readonly settleMs: number
}

export interface RenderedPage {
  readonly url: string
  readonly finalUrl: string
  readonly status: number | null
  /** HTML po wykonaniu JavaScriptu; `null`, gdy renderowanie sie nie powiodlo. */
  readonly html: string | null
  readonly durationMs: number
  readonly error: string | null
}

export interface RenderProvider {
  readonly id: 'render'
  renderPage(url: string, options: RenderOptions): Promise<RenderedPage>
  /** Zwalnia przegladarke. Wolac zawsze, takze po bledzie. */
  close(): Promise<void>
}
