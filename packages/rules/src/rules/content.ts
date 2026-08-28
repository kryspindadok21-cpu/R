import { finding, type PageRule, type SiteRule } from '../rule.js'
import { groupBy, htmlRule, isIndexable, siteRule } from '../helpers.js'

/**
 * Reguly tresci. Kazda mierzy cos, co da sie sprawdzic palcem — dlugosc, liczbe,
 * obecnosc. Zadna nie ocenia „jakosci" tekstu, bo tego nie umiemy zmierzyc,
 * a udawanie, ze umiemy, jest dokladnie tym, czym slabe narzedzia SEO zywia sie od lat.
 */

const titleMissing: PageRule = htmlRule(
  { id: 'title.missing', category: 'content', severity: 'high', title: 'Brak tytułu strony' },
  (facts, page) =>
    isIndexable(page) && (facts.title === null || facts.title.length === 0)
      ? [finding(titleMissing, page.url, { 'znaleziono znaczników title': facts.titleCount }, {
          kind: 'manual',
          hint: 'Dodaj <title> opisujący treść strony, 15–60 znaków.',
        })]
      : [],
)

const titleTooLong: PageRule = htmlRule(
  { id: 'title.too-long', category: 'content', severity: 'low', title: 'Tytuł prawdopodobnie ucięty w wynikach' },
  (facts, page, ctx) =>
    facts.title !== null && facts.titleLength > ctx.thresholds.titleMaxLength
      ? [finding(titleTooLong, page.url, {
          'długość': facts.titleLength,
          'próg': ctx.thresholds.titleMaxLength,
          'tytuł': facts.title,
        })]
      : [],
)

const titleTooShort: PageRule = htmlRule(
  { id: 'title.too-short', category: 'content', severity: 'low', title: 'Tytuł zbyt krótki, by nieść kontekst' },
  (facts, page, ctx) =>
    facts.title !== null && facts.titleLength > 0 && facts.titleLength < ctx.thresholds.titleMinLength
      ? [finding(titleTooShort, page.url, {
          'długość': facts.titleLength,
          'próg': ctx.thresholds.titleMinLength,
          'tytuł': facts.title,
        })]
      : [],
)

const titleDuplicate: SiteRule = siteRule(
  {
    id: 'title.duplicate',
    category: 'content',
    severity: 'medium',
    title: 'Ten sam tytuł na wielu stronach',
    requires: ['page-facts', 'complete-crawl'],
  },
  (site) => {
    const indexable = site.pages.filter(isIndexable)
    const groups = groupBy(indexable, (page) => page.facts?.title ?? null)
    const out = []
    for (const [title, pages] of groups) {
      if (pages.length < 2) continue
      out.push(finding(titleDuplicate, null, {
        'tytuł': title,
        'liczba stron': pages.length,
        'przykłady': pages.slice(0, 3).map((p) => p.url).join(', '),
      }))
    }
    return out
  },
)

const descriptionMissing: PageRule = htmlRule(
  { id: 'description.missing', category: 'content', severity: 'medium', title: 'Brak opisu meta' },
  (facts, page) =>
    isIndexable(page) && facts.metaDescription === null
      ? [finding(descriptionMissing, page.url, { 'adres': page.url }, {
          kind: 'set-meta', name: 'description', value: '',
        })]
      : [],
)

const descriptionTooLong: PageRule = htmlRule(
  { id: 'description.too-long', category: 'content', severity: 'low', title: 'Opis meta zostanie ucięty' },
  (facts, page, ctx) =>
    facts.metaDescription !== null && facts.metaDescriptionLength > ctx.thresholds.descriptionMaxLength
      ? [finding(descriptionTooLong, page.url, {
          'długość': facts.metaDescriptionLength,
          'próg': ctx.thresholds.descriptionMaxLength,
        })]
      : [],
)

const descriptionTooShort: PageRule = htmlRule(
  { id: 'description.too-short', category: 'content', severity: 'low', title: 'Opis meta zbyt krótki' },
  (facts, page, ctx) =>
    facts.metaDescription !== null
    && facts.metaDescriptionLength > 0
    && facts.metaDescriptionLength < ctx.thresholds.descriptionMinLength
      ? [finding(descriptionTooShort, page.url, {
          'długość': facts.metaDescriptionLength,
          'próg': ctx.thresholds.descriptionMinLength,
        })]
      : [],
)

const descriptionDuplicate: SiteRule = siteRule(
  {
    id: 'description.duplicate',
    category: 'content',
    severity: 'low',
    title: 'Ten sam opis meta na wielu stronach',
    requires: ['page-facts', 'complete-crawl'],
  },
  (site) => {
    const groups = groupBy(site.pages.filter(isIndexable), (page) => page.facts?.metaDescription ?? null)
    const out = []
    for (const [description, pages] of groups) {
      if (pages.length < 2) continue
      out.push(finding(descriptionDuplicate, null, {
        'opis': description.slice(0, 80),
        'liczba stron': pages.length,
        'przykłady': pages.slice(0, 3).map((p) => p.url).join(', '),
      }))
    }
    return out
  },
)

const h1Missing: PageRule = htmlRule(
  { id: 'h1.missing', category: 'content', severity: 'medium', title: 'Brak nagłówka H1' },
  (facts, page) =>
    isIndexable(page) && facts.h1Count === 0
      ? [finding(h1Missing, page.url, { 'liczba nagłówków': facts.headings.length })]
      : [],
)

const h1Multiple: PageRule = htmlRule(
  { id: 'h1.multiple', category: 'content', severity: 'low', title: 'Więcej niż jeden nagłówek H1' },
  (facts, page) =>
    facts.h1Count > 1
      ? [finding(h1Multiple, page.url, {
          'liczba H1': facts.h1Count,
          'treści': facts.h1Texts.slice(0, 3).join(' | '),
        })]
      : [],
)

const headingOrderJump: PageRule = htmlRule(
  { id: 'heading.order-jump', category: 'content', severity: 'low', title: 'Przeskok poziomów nagłówków' },
  (facts, page) =>
    facts.headingOrderJumps.length > 0
      ? [finding(headingOrderJump, page.url, {
          'liczba przeskoków': facts.headingOrderJumps.length,
          'pierwszy': `H${facts.headingOrderJumps[0]?.from} → H${facts.headingOrderJumps[0]?.to}`,
        })]
      : [],
)

const contentThin: PageRule = htmlRule(
  { id: 'content.thin', category: 'content', severity: 'medium', title: 'Strona z bardzo ubogą treścią' },
  (facts, page, ctx) =>
    isIndexable(page) && facts.wordCount < ctx.thresholds.thinContentWords
      ? [finding(contentThin, page.url, {
          'liczba słów': facts.wordCount,
          'próg': ctx.thresholds.thinContentWords,
        })]
      : [],
)

const langMissing: PageRule = htmlRule(
  { id: 'lang.missing', category: 'content', severity: 'low', title: 'Brak deklaracji języka' },
  (facts, page) =>
    facts.lang === null || facts.lang.length === 0
      ? [finding(langMissing, page.url, { 'adres': page.url }, {
          kind: 'set-attribute', target: 'html', attribute: 'lang', value: '',
        })]
      : [],
)

export const CONTENT_PAGE_RULES: readonly PageRule[] = [
  titleMissing, titleTooLong, titleTooShort,
  descriptionMissing, descriptionTooLong, descriptionTooShort,
  h1Missing, h1Multiple, headingOrderJump, contentThin, langMissing,
]


const contentDuplicate: SiteRule = siteRule(
  {
    id: 'content.duplicate',
    category: 'content',
    severity: 'medium',
    title: 'Identyczna treść na wielu stronach',
    requires: ['page-facts', 'complete-crawl'],
  },
  (site, ctx) => {
    // Porownujemy tekst widoczny, nie HTML: dwie strony z tym samym artykulem
    // w innym szablonie sa duplikatem dla wyszukiwarki, mimo roznego zrodla.
    const candidates = site.pages.filter(
      (page) => isIndexable(page)
        && (page.facts?.wordCount ?? 0) >= ctx.thresholds.duplicateContentMinWords,
    )
    const groups = groupBy(candidates, (page) => page.facts?.text ?? null)
    const out = []
    for (const [text, pages] of groups) {
      if (pages.length < 2) continue
      out.push(finding(contentDuplicate, null, {
        'liczba stron': pages.length,
        'liczba słów': pages[0]?.facts?.wordCount ?? 0,
        'początek treści': text.slice(0, 80),
        'przykłady': pages.slice(0, 3).map((p) => p.url).join(', '),
      }, { kind: 'manual', hint: 'Skonsoliduj strony albo wskaż jedną jako kanoniczną.' }))
    }
    return out
  },
)

export const CONTENT_SITE_RULES: readonly SiteRule[] = [
  titleDuplicate, descriptionDuplicate, contentDuplicate,
]
