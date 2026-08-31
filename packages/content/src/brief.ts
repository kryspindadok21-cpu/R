import type { Cluster, CoverageResult } from '@seo/keywords'
import { suggestInternalLinks, type LinkCandidate, type LinkSuggestion } from './internal-links.js'

/**
 * Generator briefow (D41).
 *
 * Brief sklada sie z tego, co **juz wiemy** — fraz z Search Console z pozycja
 * i wyswietleniami, istniejacych stron z crawla, luk w pokryciu, sygnalow
 * z trackera GEO. Model ten brief **redaguje**, a nie wymysla.
 *
 * Powod jest praktyczny: LLM poproszony o brief bez danych wyprodukuje
 * wiarygodnie wygladajacy zestaw ogolnikow. Wartosc briefu lezy w tym, ze zna
 * pozycje 11 na frazie majacej 400 wyswietlen miesiecznie — a tego model nie wie.
 */

export interface BriefQuery {
  readonly query: string
  readonly impressions: number
  readonly clicks: number
  readonly position: number
  /** Czy istniejaca strona docelowa juz to obsluguje. */
  readonly covered: boolean
}

/** Sygnal z trackera z Fazy 2 — ile razy modele wymienily marke na ten temat. */
export interface GeoSignal {
  readonly prompt: string
  readonly mentionRate: number
  readonly runs: number
}

export interface Brief {
  readonly clusterId: string
  readonly head: string
  /** Metoda klastrowania wedruje do briefu — od niej zalezy zaufanie do calosci. */
  readonly method: Cluster['method']
  readonly decision: CoverageResult['decision']
  /** Adres do odswiezenia; `null` przy `create`. */
  readonly targetUrl: string | null
  readonly decisionReason: string
  readonly queries: readonly BriefQuery[]
  readonly totalImpressions: number
  /** Frazy bez pokrycia — to jest wlasciwy material do napisania. */
  readonly gaps: readonly string[]
  readonly internalLinks: readonly LinkSuggestion[]
  readonly geoSignals: readonly GeoSignal[]
  /**
   * Zdanie, ktore trafia do promptu i do przegladu. Bez unikalnego zasobu draft
   * nie przejdzie bramki (D37), wiec brief musi o niego poprosic **wprost**.
   */
  readonly uniqueAssetRequest: string
  /** Najlepsza pozycja w klastrze — pokazuje, jak blisko jestesmy. */
  readonly bestPosition: number | null
}

export interface BriefInput {
  readonly cluster: Cluster
  readonly coverage: CoverageResult
  readonly linkCandidates: readonly LinkCandidate[]
  readonly geoSignals?: readonly GeoSignal[] | undefined
  readonly maxInternalLinks?: number | undefined
}

function uniqueAssetRequest(cluster: Cluster, decision: CoverageResult['decision']): string {
  const czynnosc = decision === 'refresh' ? 'Rozbudowa' : 'Nowy artykul'
  return `${czynnosc} na temat "${cluster.head}" wymaga co najmniej jednego `
    + 'unikalnego zasobu: wlasnych danych albo analizy, cytatu z pierwszej reki, '
    + 'autorskiego diagramu lub zrzutu, albo podpisu nazwanego eksperta. '
    + 'Bez niego tekst jest streszczeniem cudzych artykulow i nie przejdzie bramki.'
}

export function buildBrief(input: BriefInput): Brief {
  const { cluster, coverage } = input
  const pokryte = new Set(
    coverage.decision === 'refresh' && coverage.best !== null
      ? cluster.keywords
        .map((k) => k.query)
        .filter((q) => !coverage.best!.uncoveredQueries.includes(q))
      : [],
  )

  const queries: BriefQuery[] = cluster.keywords.map((keyword) => ({
    query: keyword.query,
    impressions: keyword.impressions,
    clicks: keyword.clicks,
    position: keyword.position,
    covered: pokryte.has(keyword.query),
  }))

  const targetUrl = coverage.decision === 'refresh' ? coverage.best?.url ?? null : null

  const internalLinks = suggestInternalLinks(cluster, input.linkCandidates, {
    // Strona odswiezana nie linkuje sama do siebie.
    excludeUrls: targetUrl === null ? [] : [targetUrl],
    ...(input.maxInternalLinks === undefined ? {} : { max: input.maxInternalLinks }),
  })

  const pozycje = queries.map((q) => q.position).filter((p) => p > 0)

  return {
    clusterId: cluster.id,
    head: cluster.head,
    method: cluster.method,
    decision: coverage.decision,
    targetUrl,
    decisionReason: coverage.reason,
    queries,
    totalImpressions: cluster.totalImpressions,
    gaps: queries.filter((q) => !q.covered).map((q) => q.query),
    internalLinks,
    geoSignals: input.geoSignals ?? [],
    uniqueAssetRequest: uniqueAssetRequest(cluster, coverage.decision),
    bestPosition: pozycje.length === 0 ? null : Math.min(...pozycje),
  }
}

/**
 * Brief jako Markdown — to trafia do promptu **i** do pull requesta.
 *
 * Jeden format dla obu, zeby czlowiek czytajacy PR widzial dokladnie te dane,
 * ktore dostal model. Rozjazd miedzy „co model wiedzial" a „co pokazalismy
 * w przegladzie" jest sposobem na ukrycie slabego briefu.
 */
export function briefToMarkdown(brief: Brief): string {
  const linie: string[] = [
    `# Brief: ${brief.head}`,
    '',
    `- **Decyzja:** ${brief.decision === 'refresh' ? 'odswiez istniejaca strone' : 'nowy artykul'}`,
    `- **Powod:** ${brief.decisionReason}`,
    `- **Metoda klastrowania:** ${brief.method}`
      + (brief.method === 'lexical-overlap'
        ? ' (podobienstwo slow, nie pomiar SERP — traktuj jako hipoteze)'
        : ''),
    `- **Wyswietlenia klastra:** ${brief.totalImpressions}`,
    `- **Najlepsza pozycja:** ${brief.bestPosition === null ? 'brak danych' : brief.bestPosition.toFixed(1)}`,
  ]

  if (brief.targetUrl !== null) linie.push(`- **Strona do odswiezenia:** ${brief.targetUrl}`)

  linie.push('', '## Frazy', '', '| Fraza | Wyswietlenia | Klikniecia | Pozycja | Pokryte |', '|---|---|---|---|---|')
  for (const q of brief.queries) {
    linie.push(
      `| ${q.query} | ${q.impressions} | ${q.clicks} | ${q.position.toFixed(1)} | ${q.covered ? 'tak' : 'nie'} |`,
    )
  }

  if (brief.gaps.length > 0) {
    linie.push('', '## Luki do pokrycia', '')
    for (const gap of brief.gaps) linie.push(`- ${gap}`)
  }

  if (brief.internalLinks.length > 0) {
    linie.push('', '## Linki wewnetrzne do wstawienia', '')
    for (const link of brief.internalLinks) {
      linie.push(`- [${link.anchorText}](${link.url}) — ${link.reason}`)
    }
  } else {
    linie.push('', '## Linki wewnetrzne do wstawienia', '', '_Brak dopasowanych stron w serwisie._')
  }

  if (brief.geoSignals.length > 0) {
    linie.push('', '## Widocznosc w odpowiedziach modeli', '')
    for (const signal of brief.geoSignals) {
      linie.push(
        `- "${signal.prompt}" — wzmianka w ${(signal.mentionRate * 100).toFixed(0)}% `
        + `z ${signal.runs} przebiegow`,
      )
    }
  }

  linie.push('', '## Wymagany unikalny zasob', '', brief.uniqueAssetRequest, '')
  return linie.join('\n')
}
