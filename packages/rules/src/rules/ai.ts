import { finding, type PageRule } from '../rule.js'
import { htmlRule, isIndexable, pageRule } from '../helpers.js'

/**
 * Gotowosc strony dla silnikow AI.
 *
 * Powod istnienia tej paczki: czesc crawlerow retrievalowych nie wykonuje
 * JavaScriptu, a modele tna strony na fragmenty i cytuja fragment, nie strone.
 * Strona moze wiec swietnie rankowac w Google i byc calkowicie nieobecna
 * w odpowiedziach modeli. Zadna z tych regul nie jest czynnikiem rankingowym
 * Google — i dokladnie w tym rzecz.
 */

/** Naglowki, ktore nie niosa wlasnego kontekstu po wycieciu z otoczenia. */
const CONTEXT_FREE_HEADINGS = new Set([
  'wstęp', 'wstep', 'wprowadzenie', 'podsumowanie', 'zakończenie', 'zakonczenie',
  'dlaczego', 'dlaczego?', 'jak to działa', 'jak to dziala', 'jak to działa?',
  'co dalej', 'co dalej?', 'o nas', 'faq', 'najczęstsze pytania', 'przykłady',
  'przyklady', 'zalety', 'wady', 'korzyści', 'korzysci', 'krok 1', 'krok 2',
  'intro', 'summary', 'conclusion', 'why', 'how it works', 'benefits', 'examples',
])

const jsRequiredForContent: PageRule = pageRule(
  {
    id: 'ai.js-required-for-content',
    category: 'ai',
    severity: 'high',
    title: 'Treść strony istnieje dopiero po wykonaniu JavaScriptu',
    requires: ['render-diff'],
  },
  (page) => {
    const diff = page.renderDiff
    if (diff === null || !diff.contentRequiresJs) return []
    return [finding(jsRequiredForContent, page.url, {
      'słowa bez JS': diff.rawWordCount,
      'słowa po renderowaniu': diff.renderedWordCount,
      'udział treści wymagającej JS': Number(diff.jsRequiredContentRatio.toFixed(2)),
      'linki widoczne dopiero po JS': diff.linksOnlyInRendered.length,
    }, {
      kind: 'manual',
      hint: 'Renderuj treść po stronie serwera albo dostarcz statyczny odpowiednik. '
        + 'Crawlery retrievalowe modeli AI zwykle nie wykonują JavaScriptu.',
    })]
  },
)

const answerNotUpfront: PageRule = htmlRule(
  { id: 'ai.answer-not-upfront', category: 'ai', severity: 'low', title: 'Brak odpowiedzi wprost pod nagłówkiem' },
  (facts, page, ctx) => {
    if (!isIndexable(page) || facts.h1Count === 0) return []
    const paragraph = facts.firstParagraphAfterH1
    const words = paragraph === null ? 0 : paragraph.trim().split(/\s+/).filter(Boolean).length
    if (paragraph !== null && words >= ctx.thresholds.answerUpfrontMinWords) return []
    return [finding(answerNotUpfront, page.url, {
      'słów w pierwszym akapicie': words,
      'próg': ctx.thresholds.answerUpfrontMinWords,
    }, {
      kind: 'manual',
      hint: 'Umieść odpowiedź na pytanie z nagłówka w pierwszym akapicie, w jednym zdaniu.',
    })]
  },
)

const chunkNotStandalone: PageRule = htmlRule(
  { id: 'ai.chunk-not-standalone', category: 'ai', severity: 'info', title: 'Nagłówki bez własnego kontekstu' },
  (facts, page, ctx) => {
    const sections = facts.headings.filter((h) => h.level >= 2 && h.level <= 3)
    if (sections.length === 0) return []

    const weak = sections.filter((h) => {
      const text = h.text.trim().toLowerCase()
      if (text.length === 0) return false
      return CONTEXT_FREE_HEADINGS.has(text) || h.text.trim().length < ctx.thresholds.standaloneHeadingMinLength
    })
    if (weak.length === 0) return []

    return [finding(chunkNotStandalone, page.url, {
      'nagłówków bez kontekstu': weak.length,
      'wszystkich nagłówków sekcji': sections.length,
      'przykład': weak[0]?.text ?? '',
    }, {
      kind: 'manual',
      hint: 'Dopisz do nagłówka podmiot, np. „Dlaczego” → „Dlaczego audyt techniczny wykrywa to wcześniej”.',
    })]
  },
)

export const AI_PAGE_RULES: readonly PageRule[] = [
  jsRequiredForContent, answerNotUpfront, chunkNotStandalone,
]
