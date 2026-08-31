import {
  checkOriginality, ORIGINALITY_THRESHOLD,
  type CorpusDocument, type OriginalityResult,
} from './originality.js'

/**
 * Bramki, przez ktore musi przejsc kazdy draft (D34, D37, D39).
 *
 * Kluczowa decyzja projektowa: `ApprovedDraft` ma **znacznik, ktorego nie da sie
 * napisac z zewnatrz**. Funkcja publikujaca przyjmuje ten typ, wiec jedyna droga
 * do publikacji wiedzie przez `approveDraft`. Bramka jako sprawdzenie w czasie
 * wykonania byla by pomijalna — ktos kiedys doda sciezke, ktora jej nie wola,
 * i nikt tego nie zauwazy. Bramka jako typ nie ma tej wlasciwosci: kompilator
 * odmawia, zanim ktokolwiek uruchomi kod.
 */

/** Rodzaje unikalnego zasobu z D37. Lista jest zamknieta swiadomie. */
export type UniqueAssetKind =
  | 'own-data'
  | 'first-hand-quote'
  | 'original-diagram'
  | 'expert-byline'

export interface UniqueAsset {
  readonly kind: UniqueAssetKind
  /** Czym ten zasob jest. Puste nie przejdzie. */
  readonly description: string
  /** Skad pochodzi — pomiar, rozmowa, wlasny wykres. Puste nie przejdzie. */
  readonly source: string
}

/** Autor jest prawdziwy i nazwany (D39). Nigdy nie generujemy encji autorskich. */
export interface Author {
  readonly name: string
  /** Rozwiazywalny adres tozsamosci — profil, strona, publikacja. */
  readonly sameAs: string
}

export interface DraftInput {
  readonly title: string
  readonly markdown: string
  readonly author: Author
  readonly uniqueAssets: readonly UniqueAsset[]
  /** Silnik, wersja i prompt to metadane draftu (D40). */
  readonly engine: string
  readonly modelVersion: string
  readonly promptId: string
}

declare const zatwierdzony: unique symbol

/**
 * Draft, ktory przeszedl wszystkie bramki.
 *
 * Znacznika `[zatwierdzony]` nie da sie zadeklarowac poza tym modulem, wiec
 * `{ ...input } as ApprovedDraft` jest jedynym obejsciem — i jest widoczne
 * w przegladzie kodu jako rzutowanie, a nie jako zwykle wywolanie.
 */
export interface ApprovedDraft extends DraftInput {
  readonly [zatwierdzony]: true
  readonly originality: OriginalityResult
  readonly approvedAt: number
}

export type GateId = 'originality' | 'unique-asset' | 'author'

export interface GateFailure {
  readonly gate: GateId
  readonly reason: string
}

export type ApprovalResult =
  | { readonly kind: 'approved'; readonly draft: ApprovedDraft }
  | { readonly kind: 'rejected'; readonly failures: readonly GateFailure[] }

function checkUniqueAsset(assets: readonly UniqueAsset[]): GateFailure | null {
  const uzyteczne = assets.filter(
    (a) => a.description.trim() !== '' && a.source.trim() !== '',
  )
  if (uzyteczne.length > 0) return null
  return {
    gate: 'unique-asset',
    reason: assets.length === 0
      ? 'brak unikalnego zasobu — artykul bez wlasnych danych, cytatu z pierwszej reki, '
        + 'wlasnego diagramu albo podpisu eksperta jest streszczeniem cudzych artykulow'
      : 'unikalny zasob zadeklarowany, ale bez opisu albo bez zrodla',
  }
}

function checkAuthor(author: Author): GateFailure | null {
  if (author.name.trim() === '') {
    return { gate: 'author', reason: 'brak nazwiska autora — nigdy nie generujemy encji autorskich' }
  }
  let parsed: URL
  try {
    parsed = new URL(author.sameAs)
  } catch {
    return {
      gate: 'author',
      reason: `sameAs "${author.sameAs}" nie jest adresem — zmyslony autor to falszowanie E-E-A-T`,
    }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { gate: 'author', reason: `sameAs uzywa schematu ${parsed.protocol}, a musi byc http albo https` }
  }
  return null
}

export interface ApprovalOptions {
  readonly corpus: readonly CorpusDocument[]
  readonly threshold?: number | undefined
  readonly now?: (() => number) | undefined
}

/**
 * Jedyna droga do `ApprovedDraft`.
 *
 * Zbieramy **wszystkie** niepowodzenia, a nie pierwsze. Redaktor, ktory poprawia
 * draft, ma zobaczyc cala liste od razu, zamiast wracac trzy razy.
 */
export function approveDraft(
  input: DraftInput,
  options: ApprovalOptions,
): ApprovalResult {
  const failures: GateFailure[] = []

  const originality = checkOriginality(
    input.markdown,
    options.corpus,
    options.threshold ?? ORIGINALITY_THRESHOLD,
  )
  if (originality.undecidable !== null) {
    failures.push({
      gate: 'originality',
      reason: `nie da sie ocenic oryginalnosci: ${originality.undecidable}`,
    })
  } else if (!originality.passed && originality.closest !== null) {
    const procent = (originality.closest.similarity * 100).toFixed(1)
    failures.push({
      gate: 'originality',
      reason: `podobienstwo ${procent}% do "${originality.closest.documentId}" `
        + `przekracza prog ${(originality.threshold * 100).toFixed(0)}%; `
        + `pokrywajace sie fragmenty: ${originality.closest.overlapping.slice(0, 5).join(' | ')}`,
    })
  }

  const asset = checkUniqueAsset(input.uniqueAssets)
  if (asset !== null) failures.push(asset)

  const author = checkAuthor(input.author)
  if (author !== null) failures.push(author)

  if (failures.length > 0) return { kind: 'rejected', failures }

  return {
    kind: 'approved',
    draft: {
      ...input,
      originality,
      approvedAt: (options.now ?? Date.now)(),
    } as ApprovedDraft,
  }
}
