/**
 * Cytowania w odpowiedzi modelu (D32).
 *
 * Adres z metadanych groundingu jest swiadectwem, ze model **pobral** dokument.
 * Adres w tresci odpowiedzi jest tym, co model **napisal** — a generowanie adresu
 * URL to generowanie tekstu, nie odczyt. Te dwie rzeczy nie sumuja sie w jedna
 * liczbe i ten plik nie daje na to sposobu.
 */

import { InvalidUrlError, normalizeUrl } from '@seo/core'
import { normalizeAnswer } from './mention.js'
import { proportion, type Proportion } from './statistics.js'

export type CitationSource = 'grounding' | 'inline'

export interface Citation {
  readonly source: CitationSource
  readonly rawUrl: string
  /** `null`, gdy adresu nie da sie znormalizowac — model potrafi napisac smiec. */
  readonly normalized: string | null
  readonly hash: string | null
  readonly host: string | null
  /** Udzial znakow przed cytowaniem; `null` dla groundingu, ktory nie ma miejsca w tekscie. */
  readonly positionShare: number | null
  readonly ours: boolean
}

export interface AnswerCitations {
  readonly grounding: readonly Citation[]
  readonly inline: readonly Citation[]
}

/** Host bez wiodacego `www.` — zlagodzenie wylacznie dla cytowan (D32). */
export function citationHost(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi
const TRAILING_PUNCTUATION = new Set(['.', ',', ';', ':', '!', '?', '"', "'", '»', '”', '’'])
const CLOSERS: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' }

/**
 * Obcina ogon adresu: kropke konczaca zdanie, cudzyslow, niedomkniety nawias.
 *
 * Nawias domkniety zostawiamy, bo bywa czescia adresu (artykuly Wikipedii).
 * Rozstrzyga bilans w samym adresie, a nie sam znak — inaczej albo tniemy
 * poprawne adresy, albo doklejamy skladnie markdownu `[tekst](adres)`.
 */
export function trimUrlTail(url: string): string {
  let end = url.length
  for (;;) {
    const last = url[end - 1]
    if (last === undefined) break
    if (TRAILING_PUNCTUATION.has(last)) { end -= 1; continue }
    const opener = CLOSERS[last]
    if (opener !== undefined) {
      const body = url.slice(0, end)
      const opened = body.split(opener).length - 1
      const closed = body.split(last).length - 1
      if (closed > opened) { end -= 1; continue }
    }
    break
  }
  return url.slice(0, end)
}

function toCitation(
  source: CitationSource,
  rawUrl: string,
  ourHosts: ReadonlySet<string>,
  positionShare: number | null,
): Citation {
  try {
    const normalized = normalizeUrl(rawUrl)
    const host = citationHost(new URL(normalized.normalized).host)
    return {
      source,
      rawUrl,
      normalized: normalized.normalized,
      hash: normalized.hash,
      host,
      positionShare,
      ours: ourHosts.has(host),
    }
  } catch (error) {
    if (!(error instanceof InvalidUrlError)) throw error
    // Adres nie do sparsowania jest **danymi**, nie bledem: to obserwacja
    // o zachowaniu modelu i chcemy ja widziec w raporcie, a nie zgubic.
    return { source, rawUrl, normalized: null, hash: null, host: null, positionShare, ours: false }
  }
}

export function extractInlineCitations(
  text: string,
  ourHosts: ReadonlySet<string>,
): Citation[] {
  const normalized = normalizeAnswer(text)
  const length = normalized.length
  const citations: Citation[] = []
  const seen = new Set<string>()

  for (const match of normalized.matchAll(URL_PATTERN)) {
    const url = trimUrlTail(match[0])
    if (url === '' || seen.has(url)) continue
    seen.add(url)
    citations.push(toCitation('inline', url, ourHosts, length === 0 ? 0 : match.index / length))
  }
  return citations
}

/**
 * Zbiera cytowania z obu zrodel, trzymajac je osobno (D32).
 *
 * Silnik bez groundingu zwraca pusta liste `grounding` i to jest **poprawny
 * wynik**, a nie brak danych.
 */
export function collectCitations(
  answer: { readonly text: string; readonly groundingUris?: readonly string[] },
  ourHosts: readonly string[],
): AnswerCitations {
  const hosts = new Set(ourHosts.map(citationHost))
  const seenGrounding = new Set<string>()
  const grounding: Citation[] = []
  for (const uri of answer.groundingUris ?? []) {
    if (seenGrounding.has(uri)) continue
    seenGrounding.add(uri)
    grounding.push(toCitation('grounding', uri, hosts, null))
  }
  return { grounding, inline: extractInlineCitations(answer.text, hosts) }
}

/**
 * Odsetek odpowiedzi, w ktorych zacytowano nasza strone — z przedzialem
 * i **osobno dla kazdego zrodla**. Sygnatura nie pozwala ich zsumowac.
 */
export function ourCitationRate(
  answers: readonly AnswerCitations[],
  source: CitationSource,
): Proportion {
  const hits = answers.filter((a) => a[source].some((c) => c.ours)).length
  return proportion(hits, answers.length)
}
