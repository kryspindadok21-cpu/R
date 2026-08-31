/**
 * Wykrywanie wzmianek marki w odpowiedzi modelu (D29, D30).
 *
 * To jest miejsce, w ktorym najlatwiej o cichy falsz. Marka o krotkiej albo
 * pospolitej nazwie zlapie sie w kazdym zdaniu i wygeneruje widocznosc, ktorej
 * nie ma. Odwrotnie: odmiana przez przypadki umknie naiwnemu porownaniu. Obie
 * pomylki daja liczby wygladajace na pomiar — i dlatego `includes()` jest tu
 * zakazane, a nie tylko odradzane.
 */

import { proportion, type Proportion, type PromptMeasurement } from './statistics.js'

/**
 * Definicja encji marki. **Dane, nie kod** — mieszka w bazie i jest wersjonowana.
 *
 * Zmiana wariantow unieważnia porownywalnosc wstecz dokladnie tak samo, jak
 * `NORMALIZER_VERSION` w Fazie 0 (D4). Stad `version`: bez niego zmiana listy
 * wariantow przesuwalaby caly szereg czasowy po cichu.
 */
export interface EntityDefinition {
  readonly id: string
  /** Nazwa glowna — ona trafia do raportu. */
  readonly name: string
  /**
   * Warianty **zadeklarowane**: odmiana, skrot, domena. Swiadomie nie zgadujemy
   * odmiany algorytmicznie — automatyczny stemmer polskiego dokladalby wlasne
   * bledy do pomiaru, ktory ma te bledy wykrywac.
   */
  readonly variants: readonly string[]
  /**
   * Frazy, w ktorych trafienie **nie liczy sie** jako wzmianka marki
   * (np. „delta rzeki" dla marki „Delta").
   */
  readonly exclusions: readonly string[]
  readonly version: number
}

export interface Mention {
  readonly entityId: string
  /** Dopasowany tekst tak, jak wystapil w odpowiedzi. */
  readonly matched: string
  readonly start: number
  readonly end: number
  /** Udzial znakow przed wzmianka: 0 to poczatek, 1 to koniec (D30). */
  readonly positionShare: number
  /** Numer akapitu liczony od zera. */
  readonly paragraph: number
}

export interface DetectionResult {
  readonly normalized: string
  readonly mentions: readonly Mention[]
}

/**
 * Normalizacja bialych znakow. Pozycje z D30 licza sie **na tym tekscie**,
 * wiec musi byc deterministyczna i zachowywac podzial na akapity.
 */
export function normalizeAnswer(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Granica slowa swiadoma Unicode.
 *
 * `\b` z JavaScriptu zna tylko `[A-Za-z0-9_]`, wiec `\bZak\b` **nie dopasuje**
 * frazy w polskim tekscie, gdy nazwa zaczyna sie od znaku diakrytycznego:
 * spacja i „Z" sa dla niego oba nie-slowne, wiec granicy tam nie ma. Lookaround
 * na `\p{L}\p{N}` dziala niezaleznie od alfabetu.
 */
function phrasePattern(phrase: string): RegExp {
  const body = escapeRegExp(phrase.trim()).replace(/\s+/g, '\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'giu')
}

interface Range { readonly start: number; readonly end: number }

function findRanges(text: string, phrases: readonly string[]): (Range & { matched: string })[] {
  const found: (Range & { matched: string })[] = []
  for (const phrase of phrases) {
    if (phrase.trim() === '') continue
    for (const match of text.matchAll(phrasePattern(phrase))) {
      found.push({ start: match.index, end: match.index + match[0].length, matched: match[0] })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

/** Indeksy poczatkow akapitow, zeby nie liczyc podzialu dla kazdej wzmianki od nowa. */
function paragraphStarts(normalized: string): number[] {
  const starts = [0]
  for (const match of normalized.matchAll(/\n\n/g)) starts.push(match.index + 2)
  return starts
}

function paragraphOf(starts: readonly number[], index: number): number {
  let result = 0
  for (let i = 0; i < starts.length; i += 1) {
    if ((starts[i] as number) <= index) result = i
    else break
  }
  return result
}

/**
 * Wykrywa wzmianki encji w jednej odpowiedzi.
 *
 * Trafienie lezace w calosci wewnatrz frazy wykluczajacej nie liczy sie —
 * wykluczenia sprawdzamy **po** dopasowaniu, bo dopiero wtedy znamy zakres.
 */
export function detectMentions(
  text: string,
  entities: readonly EntityDefinition[],
): DetectionResult {
  const normalized = normalizeAnswer(text)
  const starts = paragraphStarts(normalized)
  const length = normalized.length
  const mentions: Mention[] = []

  for (const entity of entities) {
    const excluded = findRanges(normalized, entity.exclusions)
    const candidates = findRanges(normalized, [entity.name, ...entity.variants])

    for (const hit of candidates) {
      const insideExclusion = excluded.some((e) => hit.start >= e.start && hit.end <= e.end)
      if (insideExclusion) continue
      // Ten sam zakres moze wpasc dwa razy, gdy wariant jest podciagiem nazwy
      // glownej. Liczy sie raz — inaczej share of voice rosloby z dlugosci listy
      // wariantow, a nie z widocznosci marki.
      if (mentions.some((m) => m.entityId === entity.id && m.start === hit.start)) continue

      mentions.push({
        entityId: entity.id,
        matched: hit.matched,
        start: hit.start,
        end: hit.end,
        positionShare: length === 0 ? 0 : hit.start / length,
        paragraph: paragraphOf(starts, hit.start),
      })
    }
  }

  return { normalized, mentions: mentions.sort((a, b) => a.start - b.start) }
}

// --- Agregacja po przebiegach --------------------------------------------------

export interface EngineAnswer {
  readonly promptId: string
  /** Numer przebiegu w obrebie promptu — ten sam prompt puszczamy `n` razy (D23). */
  readonly runIndex: number
  readonly text: string
}

export interface AnswerMentions {
  readonly answer: EngineAnswer
  readonly mentions: readonly Mention[]
}

export function detectInAnswers(
  answers: readonly EngineAnswer[],
  entities: readonly EntityDefinition[],
): AnswerMentions[] {
  return answers.map((answer) => ({
    answer,
    mentions: detectMentions(answer.text, entities).mentions,
  }))
}

/**
 * Pomiar per prompt — most miedzy wykrywaniem a statystyka.
 *
 * Jednostka jest prompt, nie przebieg (D23), wiec agregat musi wiedziec,
 * ktory przebieg nalezal do ktorego promptu. Bez tego roznica sparowana
 * jest nie do policzenia po fakcie.
 */
export function measurePrompts(
  detected: readonly AnswerMentions[],
  entityId: string,
): PromptMeasurement[] {
  const byPrompt = new Map<string, { hits: number; trials: number }>()
  for (const { answer, mentions } of detected) {
    const bucket = byPrompt.get(answer.promptId) ?? { hits: 0, trials: 0 }
    bucket.trials += 1
    if (mentions.some((m) => m.entityId === entityId)) bucket.hits += 1
    byPrompt.set(answer.promptId, bucket)
  }
  return [...byPrompt.entries()]
    .map(([promptId, b]) => ({ promptId, hits: b.hits, trials: b.trials }))
    .sort((a, b) => a.promptId.localeCompare(b.promptId))
}

/** Odsetek odpowiedzi, w ktorych encja w ogole sie pojawila — z przedzialem. */
export function visibility(detected: readonly AnswerMentions[], entityId: string): Proportion {
  const hits = detected.filter((d) => d.mentions.some((m) => m.entityId === entityId)).length
  return proportion(hits, detected.length)
}

export interface VoiceShare {
  readonly entityId: string
  readonly name: string
  /** Liczba odpowiedzi ze wzmianka — nie liczba wzmianek. */
  readonly answersWithMention: number
  /** Srednia pozycja pierwszej wzmianki (D30); `null`, gdy encji nie bylo. */
  readonly medianFirstPosition: number | null
  /** Udzial w calosci wzmianek wszystkich sledzonych encji, z przedzialem. */
  readonly share: Proportion
}

/**
 * Share of voice: udzial marki w calosci wzmianek sledzonych encji.
 *
 * Liczymy **odpowiedzi ze wzmianka**, a nie wzmianki. Marka wymieniona w jednej
 * odpowiedzi piec razy nie jest pieciokrotnie bardziej widoczna — jest widoczna
 * w jednej odpowiedzi. Zliczanie wystapien nagradzaloby gadatliwosc modelu.
 */
export function shareOfVoice(
  detected: readonly AnswerMentions[],
  entities: readonly EntityDefinition[],
): VoiceShare[] {
  const counts = entities.map((entity) => {
    const withMention = detected.filter((d) => d.mentions.some((m) => m.entityId === entity.id))
    const firstPositions = withMention
      .map((d) => {
        const own = d.mentions.filter((m) => m.entityId === entity.id)
        return Math.min(...own.map((m) => m.positionShare))
      })
      .sort((a, b) => a - b)
    return { entity, count: withMention.length, firstPositions }
  })

  const total = counts.reduce((sum, c) => sum + c.count, 0)

  return counts.map(({ entity, count, firstPositions }) => ({
    entityId: entity.id,
    name: entity.name,
    answersWithMention: count,
    medianFirstPosition: firstPositions.length === 0 ? null : median(firstPositions),
    share: proportion(count, total),
  }))
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? (sorted[middle] as number)
    : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2
}
