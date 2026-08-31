/**
 * Klastrowanie fraz (D33).
 *
 * Metoda podstawowa to **overlap SERP**: jesli dwie frazy dziela >=3 te same
 * adresy w top10, Google uwaza je za te sama intencje. To jest bezposredni
 * pomiar opinii samego algorytmu, a nie nasza hipoteza o tym, co jest podobne.
 *
 * Metoda zapasowa jest **nazwana**, nigdy podana jako to samo. Klient, ktory
 * dostaje „klastry" i nie wie, ze powstaly z podobienstwa napisow, podejmie
 * na tej podstawie decyzje redakcyjne warte tygodni pracy.
 */

/**
 * `serp-overlap` — wspolne adresy w top10, pomiar opinii wyszukiwarki.
 * `lexical-overlap` — wspolne slowa znaczace, **nasza** hipoteza o podobienstwie.
 */
export type ClusteringMethod = 'serp-overlap' | 'lexical-overlap'

/** Ile wspolnych adresow w top10 znaczy „ta sama intencja". Wartosc z analizy. */
export const MIN_SHARED_URLS = 3

/** Ile adresow z gory bierzemy pod uwage. Ponizej dziesiatki sygnal sie rozmywa. */
export const SERP_DEPTH = 10

/** Jaka czesc slow znaczacych musza dzielic frazy, zeby metoda zapasowa je zlaczyla. */
export const MIN_LEXICAL_OVERLAP = 0.5

export interface Keyword {
  readonly query: string
  readonly impressions: number
  readonly clicks: number
  readonly position: number
}

export interface SerpSnapshot {
  readonly query: string
  /** Adresy z gory wynikow, w kolejnosci pozycji. */
  readonly urls: readonly string[]
}

export interface Cluster {
  readonly id: string
  /** Metoda, ktora ten klaster powstal. Bez tego pola klaster jest nieinterpretowalny. */
  readonly method: ClusteringMethod
  /** Fraza reprezentujaca — najwiecej wyswietlen w klastrze. */
  readonly head: string
  readonly keywords: readonly Keyword[]
  readonly totalImpressions: number
  readonly totalClicks: number
  /**
   * Ile adresow dziela frazy z fraza glowna — miara pewnosci.
   * `null` dla metody zapasowej, bo tam zadnych adresow nie widzielismy.
   */
  readonly sharedUrls: number | null
}

/** Slowa, ktore nie niosa intencji. Krotka lista — dluzsza zaczyna gubic sens fraz. */
const STOPWORDS = new Set([
  'i', 'w', 'na', 'do', 'z', 'ze', 'że', 'o', 'a', 'to', 'nie',
  'jak', 'co', 'czy', 'jest', 'sie', 'się', 'po', 'od', 'za', 'przy', 'dla',
  'lub', 'albo', 'oraz',
  'the', 'of', 'for', 'to', 'and', 'in', 'on', 'a', 'is',
])

/** Ten sam tokenizator co w bramce oryginalnosci: `\w` nie zna polskich znakow. */
export function contentTokens(query: string): string[] {
  return (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((token) => !STOPWORDS.has(token))
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function buildCluster(
  method: ClusteringMethod,
  head: Keyword,
  members: readonly Keyword[],
  sharedUrls: number | null,
): Cluster {
  const keywords = [...members].sort(
    (a, b) => b.impressions - a.impressions || a.query.localeCompare(b.query),
  )
  return {
    id: slug(head.query),
    method,
    head: head.query,
    keywords,
    totalImpressions: keywords.reduce((sum, k) => sum + k.impressions, 0),
    totalClicks: keywords.reduce((sum, k) => sum + k.clicks, 0),
    sharedUrls,
  }
}

/** Kolejnosc obslugi: najpierw frazy o najwiekszym ruchu, przy remisie alfabetycznie. */
function byTraffic(a: Keyword, b: Keyword): number {
  return b.impressions - a.impressions || a.query.localeCompare(b.query)
}

/**
 * Klastrowanie po overlapie SERP.
 *
 * Uzywamy schematu **piasta-szprychy**, a nie skladowych spojnych. Powod jest
 * konkretny: przy skladowych spojnych fraza A laczy sie z B, B z C, C z D —
 * i konczy sie tym, ze A i D siedza w jednym klastrze, choc nie dziela ani
 * jednego adresu. To jest znany sposob, w ktory klastrowanie SERP produkuje
 * jeden wielki klaster obejmujacy pol serwisu.
 */
export function clusterBySerpOverlap(
  keywords: readonly Keyword[],
  snapshots: readonly SerpSnapshot[],
  minShared = MIN_SHARED_URLS,
): Cluster[] {
  const topUrls = new Map<string, Set<string>>()
  for (const snapshot of snapshots) {
    topUrls.set(snapshot.query, new Set(snapshot.urls.slice(0, SERP_DEPTH)))
  }

  const pozostale = [...keywords].sort(byTraffic)
  const clusters: Cluster[] = []

  while (pozostale.length > 0) {
    const head = pozostale.shift() as Keyword
    const headUrls = topUrls.get(head.query)
    const members: Keyword[] = [head]
    let minOverlapWKlastrze = headUrls === undefined ? 0 : headUrls.size

    if (headUrls !== undefined && headUrls.size > 0) {
      for (let i = pozostale.length - 1; i >= 0; i -= 1) {
        const candidate = pozostale[i] as Keyword
        const candidateUrls = topUrls.get(candidate.query)
        if (candidateUrls === undefined) continue
        let wspolne = 0
        for (const url of candidateUrls) if (headUrls.has(url)) wspolne += 1
        if (wspolne < minShared) continue
        members.push(candidate)
        minOverlapWKlastrze = Math.min(minOverlapWKlastrze, wspolne)
        pozostale.splice(i, 1)
      }
    }

    clusters.push(buildCluster(
      'serp-overlap',
      head,
      members,
      // Fraza bez migawki SERP siedzi sama i nie ma czego dzielic.
      headUrls === undefined ? null : members.length === 1 ? 0 : minOverlapWKlastrze,
    ))
  }

  return clusters
}

/**
 * Metoda zapasowa: wspolne slowa znaczace.
 *
 * **To nie jest overlap SERP i nie udaje, ze jest.** Nie mamy darmowego zrodla
 * top10 i nie bedziemy go mieli, dopoki nie pojawi sie budzet. Ta metoda mowi
 * tylko tyle, ze dwie frazy sa zbudowane z podobnych slow — co bywa prawda
 * o intencji, a bywa zbiegiem okolicznosci.
 */
export function clusterByLexicalOverlap(
  keywords: readonly Keyword[],
  minOverlap = MIN_LEXICAL_OVERLAP,
): Cluster[] {
  const tokens = new Map<string, Set<string>>()
  for (const keyword of keywords) {
    tokens.set(keyword.query, new Set(contentTokens(keyword.query)))
  }

  const pozostale = [...keywords].sort(byTraffic)
  const clusters: Cluster[] = []

  while (pozostale.length > 0) {
    const head = pozostale.shift() as Keyword
    const headTokens = tokens.get(head.query) as Set<string>
    const members: Keyword[] = [head]

    if (headTokens.size > 0) {
      for (let i = pozostale.length - 1; i >= 0; i -= 1) {
        const candidate = pozostale[i] as Keyword
        const candidateTokens = tokens.get(candidate.query) as Set<string>
        if (candidateTokens.size === 0) continue
        let wspolne = 0
        for (const token of candidateTokens) if (headTokens.has(token)) wspolne += 1
        // Dzielimy przez mniejszy zbior: „audyt seo" wewnatrz „darmowy audyt seo
        // dla malej firmy" to pelne pokrycie krotszej frazy, a nie polowiczne.
        const pokrycie = wspolne / Math.min(headTokens.size, candidateTokens.size)
        if (pokrycie < minOverlap) continue
        members.push(candidate)
        pozostale.splice(i, 1)
      }
    }

    clusters.push(buildCluster('lexical-overlap', head, members, null))
  }

  return clusters
}

export type ClusterSetRefusal = 'mieszane-metody' | 'pusty-zestaw'

export type ClusterSet =
  | {
      readonly kind: 'zestaw'
      readonly method: ClusteringMethod
      readonly clusters: readonly Cluster[]
    }
  | {
      readonly kind: 'odmowa'
      readonly reason: ClusterSetRefusal
      readonly detail: string
    }

/**
 * Zestaw klastrow o jednej, jawnej metodzie (AC1).
 *
 * Odmowa jest **wynikiem**, nie bledem — ta sama zasada, co przy porownaniach
 * w Fazie 2. Zmieszane metody w jednej tabeli wygladaja jak jeden pomiar,
 * a sa dwoma o zupelnie innej wiarygodnosci.
 */
export function clusterSet(clusters: readonly Cluster[]): ClusterSet {
  if (clusters.length === 0) {
    return { kind: 'odmowa', reason: 'pusty-zestaw', detail: 'brak klastrow do zestawienia' }
  }

  const metody = [...new Set(clusters.map((c) => c.method))]
  if (metody.length > 1) {
    return {
      kind: 'odmowa',
      reason: 'mieszane-metody',
      detail: `zestaw zawiera metody ${metody.join(' i ')}; overlap SERP mierzy opinie `
        + 'wyszukiwarki, a podobienstwo leksykalne tylko nasza hipoteze — w jednej '
        + 'tabeli wygladaja identycznie i to jest problem',
    }
  }

  return {
    kind: 'zestaw',
    method: metody[0] as ClusteringMethod,
    clusters: [...clusters].sort(
      (a, b) => b.totalImpressions - a.totalImpressions || a.id.localeCompare(b.id),
    ),
  }
}
