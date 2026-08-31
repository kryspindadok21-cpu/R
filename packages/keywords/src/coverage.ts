import { contentTokens, type Cluster } from './cluster.js'

/**
 * Decyzja `refresh` czy `create` (D38).
 *
 * Domyslna akcja to **konsolidacja**. Dwie strony o tym samym konkuruja ze soba
 * o te sama fraze i obie traca — a domyslne „tworz nowy" jest dokladnie tym,
 * co zamienia narzedzie SEO w maszyne do rozcienczania wlasnego serwisu.
 *
 * `create` jest mozliwe, ale wymaga **zapisanego powodu**. Nie po to, zeby
 * utrudnic, tylko po to, zeby za pol roku dalo sie sprawdzic, czy powod byl
 * dobry.
 */

/**
 * Prog pokrycia, powyzej ktorego istniejaca strona „obsluguje" klaster.
 *
 * **Ta liczba nie ma zrodla.** 0,85 przy oryginalnosci pochodzi z analizy rynku;
 * ta jest zgadnieta i pierwszy przebieg na wlasnej stronie ma ja poprawic.
 * Zostawiamy ja tutaj jawnie, zamiast chowac w kodzie decyzji.
 */
export const COVERAGE_THRESHOLD = 0.6

export interface ExistingPage {
  readonly url: string
  readonly title: string | null
  /** Tresc strony po ekstrakcji — to na niej liczymy pokrycie. */
  readonly text: string
}

export interface PageCoverage {
  readonly url: string
  /** Udzial wyswietlen klastra obsluzonych przez te strone. */
  readonly coverage: number
  /** Frazy, ktorych ta strona nie pokrywa — to jest material do `refresh`. */
  readonly uncoveredQueries: readonly string[]
}

export type CoverageDecision = 'refresh' | 'create'

export interface CoverageResult {
  readonly clusterId: string
  readonly decision: CoverageDecision
  readonly threshold: number
  /** Najlepiej pokrywajaca strona; `null`, gdy zadna nie siega progu. */
  readonly best: PageCoverage | null
  readonly reason: string
}

/**
 * Pokrycie wazone wyswietleniami, nie liczba fraz.
 *
 * Fraza z 400 wyswietleniami i fraza z 2 to nie to samo zobowiazanie. Liczenie
 * „ile fraz na ilu" dalo by stronie zaliczenie za pokrycie ogona przy
 * zignorowaniu frazy, ktora naprawde niesie ruch.
 */
export function coverageOf(cluster: Cluster, page: ExistingPage): PageCoverage {
  const haystack = new Set(contentTokens(`${page.title ?? ''} ${page.text}`))

  let pokryte = 0
  let razem = 0
  const uncoveredQueries: string[] = []

  for (const keyword of cluster.keywords) {
    // Fraza bez wyswietlen nadal liczy sie do decyzji, tylko z minimalna waga.
    const waga = Math.max(keyword.impressions, 1)
    razem += waga
    const tokens = contentTokens(keyword.query)
    const obsluzona = tokens.length > 0 && tokens.every((token) => haystack.has(token))
    if (obsluzona) pokryte += waga
    else uncoveredQueries.push(keyword.query)
  }

  return {
    url: page.url,
    coverage: razem === 0 ? 0 : pokryte / razem,
    uncoveredQueries,
  }
}

/**
 * Rozstrzyga, czy klaster ma odswiezyc istniejaca strone, czy dostac nowa.
 *
 * `create` bez powodu jest **niemozliwe**: brak powodu przy braku pokrywajacej
 * strony jest uzupelniany automatycznie i tez zapisany, wiec w bazie zawsze
 * stoi zdanie tlumaczace, dlaczego powstala kolejna strona.
 */
export function decideCoverage(
  cluster: Cluster,
  pages: readonly ExistingPage[],
  options: { readonly threshold?: number; readonly createReason?: string } = {},
): CoverageResult {
  const threshold = options.threshold ?? COVERAGE_THRESHOLD

  const oceny = pages
    .map((page) => coverageOf(cluster, page))
    .sort((a, b) => b.coverage - a.coverage || a.url.localeCompare(b.url))

  const best = oceny[0] ?? null

  if (best !== null && best.coverage >= threshold) {
    const brakujace = best.uncoveredQueries.length
    return {
      clusterId: cluster.id,
      decision: 'refresh',
      threshold,
      best,
      reason: `strona ${best.url} pokrywa ${(best.coverage * 100).toFixed(0)}% wyswietlen `
        + `klastra` + (brakujace === 0
          ? ' w calosci — odswiezenie zamiast nowej strony (D38)'
          : `; ${brakujace} fraz bez pokrycia to material do rozbudowy tej strony`),
    }
  }

  const powodDomyslny = best === null
    ? 'brak jakiejkolwiek strony w serwisie do porownania'
    : `najlepsza strona (${best.url}) pokrywa tylko `
      + `${(best.coverage * 100).toFixed(0)}% wyswietlen, ponizej progu `
      + `${(threshold * 100).toFixed(0)}%`

  return {
    clusterId: cluster.id,
    decision: 'create',
    threshold,
    best,
    reason: options.createReason ?? powodDomyslny,
  }
}
