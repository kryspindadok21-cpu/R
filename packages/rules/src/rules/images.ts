import { finding, type PageRule } from '../rule.js'
import { htmlRule } from '../helpers.js'

/**
 * Reguly obrazow. Swiadomie nie ma tu reguly „obraz za ciezki" — wagi zasobow
 * nie mierzymy, bo crawler pobiera wylacznie dokumenty HTML (D15). Zmyslona
 * liczba bajtow byla by gorsza niz jej brak.
 */

const missingAlt: PageRule = htmlRule(
  { id: 'image.missing-alt', category: 'images', severity: 'medium', title: 'Obraz bez atrybutu alt' },
  (facts, page) => {
    // Brak atrybutu to co innego niz `alt=""`. Puste `alt` jest poprawnym sposobem
    // oznaczenia obrazu dekoracyjnego — karanie za nie byloby falszywym alarmem.
    const missing = facts.images.filter((image) => !image.hasAlt)
    if (missing.length === 0) return []
    return [finding(missingAlt, page.url, {
      'liczba obrazów': missing.length,
      'pierwszy': missing[0]?.src ?? '(brak src)',
    }, { kind: 'manual', hint: 'Dodaj alt opisujący treść obrazu albo alt="" dla dekoracji.' })]
  },
)

const altTooLong: PageRule = htmlRule(
  { id: 'image.alt-too-long', category: 'images', severity: 'low', title: 'Tekst alternatywny jest opisem, nie etykietą' },
  (facts, page, ctx) => {
    const long = facts.images.filter((i) => i.alt.length > ctx.thresholds.altMaxLength)
    if (long.length === 0) return []
    return [finding(altTooLong, page.url, {
      'liczba obrazów': long.length,
      'najdłuższy': Math.max(...long.map((i) => i.alt.length)),
      'próg': ctx.thresholds.altMaxLength,
    })]
  },
)

const missingDimensions: PageRule = htmlRule(
  { id: 'image.missing-dimensions', category: 'images', severity: 'low', title: 'Obraz bez wymiarów — przeskok układu' },
  (facts, page) => {
    const missing = facts.images.filter((i) => i.width === null || i.height === null)
    if (missing.length === 0) return []
    return [finding(missingDimensions, page.url, {
      'liczba obrazów': missing.length,
      'pierwszy': missing[0]?.src ?? '(brak src)',
    })]
  },
)

const lazyAboveFold: PageRule = htmlRule(
  { id: 'image.lazy-above-fold', category: 'images', severity: 'low', title: 'Pierwszy obraz ładowany leniwie' },
  (facts, page) => {
    // Bez renderowania nie wiemy, co jest nad zgieciem. Pierwszy obraz w dokumencie
    // to przyblizenie — swiadomie ograniczone do pierwszego, zeby nie zasypac raportu.
    const first = facts.images[0]
    if (!first || first.loading?.toLowerCase() !== 'lazy') return []
    return [finding(lazyAboveFold, page.url, { 'obraz': first.src ?? '(brak src)' }, {
      kind: 'manual', hint: 'Usuń loading="lazy" z obrazu widocznego na starcie.',
    })]
  },
)

const missingSrc: PageRule = htmlRule(
  { id: 'image.missing-src', category: 'images', severity: 'medium', title: 'Znacznik obrazu bez adresu' },
  (facts, page) => {
    const broken = facts.images.filter((i) => i.src === null || i.src.trim().length === 0)
    if (broken.length === 0) return []
    return [finding(missingSrc, page.url, { 'liczba obrazów': broken.length })]
  },
)

export const IMAGE_PAGE_RULES: readonly PageRule[] = [
  missingAlt, altTooLong, missingDimensions, lazyAboveFold, missingSrc,
]
