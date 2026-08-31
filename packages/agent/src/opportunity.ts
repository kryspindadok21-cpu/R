/**
 * Scoring okazji (D45).
 *
 * `score = (impact × confidence × fit) / (effort × risk)` — deterministyczna
 * arytmetyka, nigdy wywolanie modelu. Modele sa dobre w ukladaniu narracji
 * i zle w konsekwentnym rankingu liczbowym: ta sama lista podana dwa razy wraca
 * w innej kolejnosci. Ranking, ktory zmienia sie bez zmiany danych, nie jest
 * rankingiem.
 *
 * Kazdy czynnik niesie **zrodlo**. Czynnik `declared` to wartosc, ktora ktos
 * wpisal, a nie zmierzyl — i raport ma to pokazywac zamiast chowac w jednej
 * liczbie (AC2).
 */

export type OpportunityKind =
  | 'fix-finding'
  | 'refresh-content'
  | 'create-content'
  | 'improve-geo'

/** `measured` — liczba wyliczona z danych. `declared` — wpisana przez czlowieka. */
export type FactorSource = 'measured' | 'declared'

export interface Factor {
  readonly value: number
  readonly source: FactorSource
  /** Skad ta liczba. Puste nie przechodzi — czynnik bez uzasadnienia jest zgadywaniem. */
  readonly basis: string
}

export interface Opportunity {
  readonly id: string
  readonly kind: OpportunityKind
  readonly title: string
  /** Adres, ktorego dotyczy; `null` dla okazji obejmujacych caly serwis. */
  readonly targetUrl: string | null
  readonly impact: Factor
  readonly confidence: Factor
  readonly fit: Factor
  readonly effort: Factor
  readonly risk: Factor
}

export interface ScoredOpportunity extends Opportunity {
  readonly score: number
  /** Ile z pieciu czynnikow jest zmierzonych, a nie zadeklarowanych. */
  readonly measuredFactors: number
}

/** Czynniki w mianowniku nie moga byc zerem ani ujemne. */
export const MIN_DIVISOR = 0.1

export function scoreOf(opportunity: Opportunity): number {
  const effort = Math.max(opportunity.effort.value, MIN_DIVISOR)
  const risk = Math.max(opportunity.risk.value, MIN_DIVISOR)
  const licznik = opportunity.impact.value
    * opportunity.confidence.value
    * opportunity.fit.value
  return licznik / (effort * risk)
}

/**
 * Ranking. **Deterministyczny co do ostatniego miejsca** — przy remisie decyduje
 * identyfikator, nigdy kolejnosc wejscia (AC1).
 */
export function rankOpportunities(
  opportunities: readonly Opportunity[],
): ScoredOpportunity[] {
  return opportunities
    .map((o) => ({
      ...o,
      score: scoreOf(o),
      measuredFactors: [o.impact, o.confidence, o.fit, o.effort, o.risk]
        .filter((f) => f.source === 'measured').length,
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
}

// --- Generatory kandydatow ------------------------------------------------------

/**
 * Krzywa CTR wedlug pozycji.
 *
 * **To sa liczby branzowe, nie nasz pomiar** — dlatego kazdy czynnik z niej
 * wyprowadzony jest oznaczony jako `declared`. Gdy uzbieramy dosc wlasnych
 * danych z Search Console, ta krzywa ma zostac zastapiona wlasna i wtedy
 * czynnik stanie sie `measured`.
 */
const CTR_BY_POSITION: readonly number[] = [
  0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.03, 0.03, 0.03,
]

export function expectedCtr(position: number): number {
  if (position < 1) return CTR_BY_POSITION[0] as number
  const index = Math.min(Math.round(position) - 1, CTR_BY_POSITION.length - 1)
  return CTR_BY_POSITION[index] as number
}

/** Ile klikniec dolozylby awans z obecnej pozycji na `docelowa`. */
export function clickUpside(
  impressions: number, position: number, docelowa = 3,
): number {
  if (position <= docelowa) return 0
  return impressions * (expectedCtr(docelowa) - expectedCtr(position))
}

/** Wagi wag ustalen z Fazy 1. Zadeklarowane — biora sie z definicji wag, nie z pomiaru. */
const SEVERITY_IMPACT: Readonly<Record<string, number>> = {
  blocker: 100,
  high: 40,
  medium: 12,
  low: 3,
  info: 1,
}

export interface FindingInput {
  readonly ruleId: string
  readonly severity: string
  readonly url: string | null
  readonly title: string
  readonly affectedPages: number
  /** `true`, gdy regula ma gotowa poprawke — wtedy naklad jest kilkukrotnie mniejszy. */
  readonly hasAutofix: boolean
}

export function opportunityFromFinding(finding: FindingInput): Opportunity {
  const waga = SEVERITY_IMPACT[finding.severity] ?? 1
  return {
    id: `fix:${finding.ruleId}:${finding.url ?? 'serwis'}`,
    kind: 'fix-finding',
    title: finding.title,
    targetUrl: finding.url,
    impact: {
      value: waga * Math.max(finding.affectedPages, 1),
      source: 'declared',
      basis: `waga ${finding.severity} (${waga}) × ${finding.affectedPages} stron; `
        + 'wagi pochodza z definicji regul, nie z pomiaru wplywu na ruch',
    },
    confidence: {
      value: 0.9,
      source: 'measured',
      basis: 'ustalenie audytu ma adres i zmierzona wartosc — wiadomo, ze problem istnieje',
    },
    fit: {
      value: 1,
      source: 'declared',
      basis: 'poprawka techniczna pasuje do kazdego serwisu',
    },
    effort: {
      value: finding.hasAutofix ? 0.5 : 3,
      source: 'declared',
      basis: finding.hasAutofix ? 'regula ma gotowa poprawke' : 'poprawka reczna',
    },
    risk: {
      value: finding.hasAutofix ? 0.5 : 1,
      source: 'declared',
      basis: 'poprawki techniczne sa odwracalne',
    },
  }
}

export interface ClusterInput {
  readonly slug: string
  readonly head: string
  readonly totalImpressions: number
  readonly bestPosition: number | null
  readonly decision: 'refresh' | 'create'
  readonly targetUrl: string | null
  /** Metoda klastrowania — leksykalna obniza pewnosc, bo to hipoteza (D33). */
  readonly method: 'serp-overlap' | 'lexical-overlap'
}

export function opportunityFromCluster(cluster: ClusterInput): Opportunity {
  const pozycja = cluster.bestPosition ?? 50
  const upside = clickUpside(cluster.totalImpressions, pozycja)

  // Nowa strona nie ma historii, wiec jej potencjal jest z zalozenia niepewny.
  // Odswiezenie istniejacej strony opiera sie na zmierzonych wyswietleniach.
  const nowa = cluster.decision === 'create'

  return {
    id: `${cluster.decision}:${cluster.slug}`,
    kind: nowa ? 'create-content' : 'refresh-content',
    title: nowa
      ? `Nowy artykul: ${cluster.head}`
      : `Odswiez: ${cluster.head}`,
    targetUrl: cluster.targetUrl,
    impact: {
      value: Math.max(upside, 0.1),
      source: 'measured',
      basis: `${cluster.totalImpressions} wyswietlen przy pozycji ${pozycja.toFixed(1)}; `
        + `awans do trojki dalby okolo ${upside.toFixed(0)} klikniec `
        + '(krzywa CTR branzowa, nie wlasna)',
    },
    confidence: {
      // Metoda leksykalna to hipoteza o podobienstwie fraz, nie pomiar SERP (D33).
      value: (cluster.method === 'serp-overlap' ? 0.8 : 0.45) * (nowa ? 0.6 : 1),
      source: 'measured',
      basis: `metoda ${cluster.method}${nowa ? ', nowa strona bez historii' : ''}`,
    },
    fit: {
      value: 1,
      source: 'declared',
      basis: 'klaster pochodzi z fraz, na ktore serwis juz sie wyswietla',
    },
    effort: {
      value: nowa ? 8 : 3,
      source: 'declared',
      basis: nowa ? 'nowy artykul z unikalnym zasobem' : 'rozbudowa istniejacej strony',
    },
    risk: {
      // D38: nowa strona przy pokrytym temacie grozi kanibalizacja.
      value: nowa ? 2 : 1,
      source: 'declared',
      basis: nowa
        ? 'nowa strona moze kanibalizowac istniejaca (D38)'
        : 'odswiezenie nie tworzy konkurencji dla wlasnej strony',
    },
  }
}

export interface GeoGapInput {
  readonly prompt: string
  readonly mentionRate: number
  readonly runs: number
  readonly competitorRate: number
}

export function opportunityFromGeoGap(gap: GeoGapInput): Opportunity {
  const luka = Math.max(gap.competitorRate - gap.mentionRate, 0)
  return {
    id: `geo:${gap.prompt.slice(0, 60)}`,
    kind: 'improve-geo',
    title: `Brak wzmianki: „${gap.prompt}"`,
    targetUrl: null,
    impact: {
      value: Math.max(luka * 100, 0.1),
      source: 'measured',
      basis: `konkurencja wymieniana w ${(gap.competitorRate * 100).toFixed(0)}% `
        + `odpowiedzi, my w ${(gap.mentionRate * 100).toFixed(0)}%`,
    },
    confidence: {
      // Kilka przebiegow to proba Bernoulliego, nie pomiar (D24). Pewnosc rosnie
      // z liczba przebiegow i nigdy nie siega jedynki.
      value: Math.min(gap.runs / 30, 0.8),
      source: 'measured',
      basis: `${gap.runs} przebiegow promptu`,
    },
    fit: { value: 1, source: 'declared', basis: 'prompt z wlasnego zestawu' },
    effort: { value: 5, source: 'declared', basis: 'wymaga tresci albo zmian strukturalnych' },
    risk: { value: 1, source: 'declared', basis: 'dzialania GEO nie ruszaja istniejacych stron' },
  }
}
