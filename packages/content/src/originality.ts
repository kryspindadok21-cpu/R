/**
 * Bramka oryginalnosci (D34).
 *
 * Strony publikujace duze wolumeny nieredagowanej tresci AI dostaly 50-80%
 * spadkow ruchu przy egzekwowaniu polityki scaled content abuse. To jest
 * powod istnienia tego pliku: draft, ktory jest przepisaniem cudzego tekstu,
 * ma zostac **odrzucony**, a nie oznaczony do przejrzenia.
 *
 * Podobienstwo liczymy lokalnie — TF-IDF na n-gramach slownych. Wektory z API
 * kosztuja i wymagaja konta, a tu nie chodzi o subtelna semantyke, tylko
 * o wykrycie przepisania. TF-IDF ma przy tym zalete, ktorej wektory nie maja:
 * wynik da sie **wytlumaczyc**, bo mozna pokazac pokrywajace sie n-gramy.
 */

/** Prog z analizy rynku. Powyzej niego draft jest odrzucany, nie oznaczany. */
export const ORIGINALITY_THRESHOLD = 0.85

/** Dlugosc n-gramu. Trzy slowa lapia przepisanie, a nie zbieznosc slownictwa. */
export const SHINGLE_SIZE = 3

/** Ponizej tylu n-gramow tekst jest za krotki, zeby cokolwiek o nim orzec. */
export const MIN_SHINGLES = 10

export interface CorpusDocument {
  readonly id: string
  readonly text: string
}

export interface ClosestMatch {
  readonly documentId: string
  readonly similarity: number
  /** Pokrywajace sie n-gramy — dowod, a nie sama liczba. */
  readonly overlapping: readonly string[]
}

export interface OriginalityResult {
  readonly passed: boolean
  readonly threshold: number
  readonly closest: ClosestMatch | null
  /** Niepuste, gdy nie dalo sie orzec — to co innego niz „przeszlo". */
  readonly undecidable: string | null
}

/**
 * Tokenizacja swiadoma Unicode. `\w` z JavaScriptu zna tylko ASCII, wiec polskie
 * znaki wypadalyby ze slow i „wlasciwosc" rozpadloby sie na trzy tokeny.
 */
export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
}

export function shingles(tokens: readonly string[], size = SHINGLE_SIZE): string[] {
  if (tokens.length < size) return []
  const out: string[] = []
  for (let i = 0; i + size <= tokens.length; i += 1) {
    out.push(tokens.slice(i, i + size).join(' '))
  }
  return out
}

function termFrequency(items: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1)
  return counts
}

/**
 * TF-IDF liczone **na calym zestawie porownawczym**, nie na parze.
 *
 * IDF wymaga korpusu, a korpus tu naprawde istnieje: draft plus strony z top10
 * plus wlasne strony serwisu. Efekt uboczny jest tym, o co chodzi — termy
 * wystepujace we wszystkich dokumentach (stopka, nawigacja, branzowy zargon)
 * dostaja niska wage, wiec nie napompuja podobienstwa.
 */
function inverseDocumentFrequency(
  documents: readonly (readonly string[])[],
): Map<string, number> {
  const documentCount = documents.length
  const seen = new Map<string, number>()
  for (const doc of documents) {
    for (const term of new Set(doc)) seen.set(term, (seen.get(term) ?? 0) + 1)
  }
  const idf = new Map<string, number>()
  for (const [term, count] of seen) {
    // Wygladzone IDF: term obecny wszedzie ma wage bliska zeru, ale nie zero,
    // zeby dokumenty zlozone wylacznie z takich termow nadal dalo sie porownac.
    idf.set(term, Math.log((documentCount + 1) / (count + 1)) + 1)
  }
  return idf
}

function tfidfVector(
  terms: readonly string[],
  idf: ReadonlyMap<string, number>,
): Map<string, number> {
  const tf = termFrequency(terms)
  const vector = new Map<string, number>()
  for (const [term, count] of tf) {
    vector.set(term, (count / terms.length) * (idf.get(term) ?? 1))
  }
  return vector
}

function cosine(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): number {
  let dot = 0
  for (const [term, weight] of a) dot += weight * (b.get(term) ?? 0)
  if (dot === 0) return 0

  let normA = 0
  for (const weight of a.values()) normA += weight * weight
  let normB = 0
  for (const weight of b.values()) normB += weight * weight
  if (normA === 0 || normB === 0) return 0

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Sprawdza, czy draft nie jest przepisaniem czegos, co juz istnieje.
 *
 * Pusty korpus **nie znaczy „przeszlo"** — znaczy, ze nie bylo z czym porownac.
 * Zwracamy to jako `undecidable`, bo cicha zgoda przy braku danych jest
 * dokladnie tym mechanizmem, ktory ta bramka ma zablokowac.
 */
export function checkOriginality(
  draft: string,
  corpus: readonly CorpusDocument[],
  threshold = ORIGINALITY_THRESHOLD,
): OriginalityResult {
  const draftShingles = shingles(tokenize(draft))

  if (draftShingles.length < MIN_SHINGLES) {
    return {
      passed: false,
      threshold,
      closest: null,
      undecidable: `tekst ma ${draftShingles.length} n-gramow, potrzeba co najmniej ${MIN_SHINGLES}`,
    }
  }

  const usable = corpus
    .map((doc) => ({ id: doc.id, terms: shingles(tokenize(doc.text)) }))
    .filter((doc) => doc.terms.length > 0)

  if (usable.length === 0) {
    return {
      passed: false,
      threshold,
      closest: null,
      undecidable: 'pusty zestaw porownawczy — nie bylo z czym porownac',
    }
  }

  const idf = inverseDocumentFrequency([draftShingles, ...usable.map((d) => d.terms)])
  const draftVector = tfidfVector(draftShingles, idf)
  const draftSet = new Set(draftShingles)

  let closest: ClosestMatch | null = null
  for (const doc of usable) {
    const similarity = cosine(draftVector, tfidfVector(doc.terms, idf))
    if (closest !== null && similarity <= closest.similarity) continue
    closest = {
      documentId: doc.id,
      similarity,
      overlapping: [...new Set(doc.terms.filter((t) => draftSet.has(t)))].slice(0, 20),
    }
  }

  return {
    passed: closest === null || closest.similarity <= threshold,
    threshold,
    closest,
    undecidable: null,
  }
}
