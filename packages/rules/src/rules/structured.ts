import type { JsonLdFact } from '@seo/parse'
import { finding, type PageRule } from '../rule.js'
import { htmlRule, isIndexable } from '../helpers.js'

/**
 * Dane strukturalne. Reguly sprawdzaja skladnie i obecnosc pol wymaganych przez
 * dokumentacje Google — nie „jakosc" znacznikow, bo tego nie da sie zmierzyc.
 */

/** Typy, dla ktorych Google dokumentuje pola wymagane. Lista celowo waska. */
const REQUIRED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  Article: ['headline'],
  BlogPosting: ['headline'],
  NewsArticle: ['headline', 'datePublished'],
  Product: ['name'],
  Recipe: ['name', 'recipeIngredient'],
  FAQPage: ['mainEntity'],
  Event: ['name', 'startDate'],
  JobPosting: ['title', 'datePosted', 'hiringOrganization'],
}

interface Entity {
  readonly type: string
  readonly value: Record<string, unknown>
}

/** Rozklada blok JSON-LD na encje — takze te w `@graph` i zagniezdzone. */
function entitiesOf(block: JsonLdFact): Entity[] {
  const out: Entity[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { for (const item of value) visit(item); return }
    if (value === null || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const type = record['@type']
    if (typeof type === 'string') out.push({ type, value: record })
    else if (Array.isArray(type)) {
      for (const t of type) if (typeof t === 'string') out.push({ type: t, value: record })
    }
    for (const [key, nested] of Object.entries(record)) {
      if (key === '@type') continue
      visit(nested)
    }
  }
  visit(block.parsed)
  return out
}

const jsonLdInvalid: PageRule = htmlRule(
  { id: 'jsonld.invalid', category: 'structured', severity: 'medium', title: 'Blok danych strukturalnych z błędem składni' },
  (facts, page) => {
    const broken = facts.jsonLd.filter((b) => b.parseError !== null)
    if (broken.length === 0) return []
    return [finding(jsonLdInvalid, page.url, {
      'liczba bloków': broken.length,
      'błąd': broken[0]?.parseError ?? '',
    })]
  },
)

const jsonLdMissing: PageRule = htmlRule(
  { id: 'jsonld.missing', category: 'structured', severity: 'low', title: 'Brak danych strukturalnych' },
  (facts, page) =>
    isIndexable(page) && facts.jsonLd.length === 0
      ? [finding(jsonLdMissing, page.url, { 'adres': page.url })]
      : [],
)

const jsonLdEmptyType: PageRule = htmlRule(
  { id: 'jsonld.empty-type', category: 'structured', severity: 'low', title: 'Dane strukturalne bez @type' },
  (facts, page) => {
    const untyped = facts.jsonLd.filter((b) => b.parseError === null && b.types.length === 0)
    if (untyped.length === 0) return []
    return [finding(jsonLdEmptyType, page.url, { 'liczba bloków': untyped.length })]
  },
)

const jsonLdMissingRequiredField: PageRule = htmlRule(
  {
    id: 'jsonld.missing-required-field',
    category: 'structured',
    severity: 'low',
    title: 'Dane strukturalne bez pola wymaganego przez Google',
  },
  (facts, page) => {
    const out = []
    for (const block of facts.jsonLd) {
      if (block.parseError !== null) continue
      for (const entity of entitiesOf(block)) {
        const required = REQUIRED_FIELDS[entity.type]
        if (!required) continue
        const missing = required.filter((field) => entity.value[field] === undefined)
        if (missing.length === 0) continue
        out.push(finding(jsonLdMissingRequiredField, page.url, {
          'typ': entity.type,
          'brakujące pola': missing.join(', '),
        }))
      }
    }
    return out
  },
)

const ogMissing: PageRule = htmlRule(
  { id: 'og.missing', category: 'structured', severity: 'low', title: 'Brak znaczników OpenGraph' },
  (facts, page) =>
    isIndexable(page) && Object.keys(facts.openGraph).length === 0
      ? [finding(ogMissing, page.url, { 'adres': page.url }, {
          kind: 'set-meta', name: 'og:title', value: facts.title ?? '',
        })]
      : [],
)

const twitterMissing: PageRule = htmlRule(
  { id: 'twitter.missing', category: 'structured', severity: 'info', title: 'Brak znaczników karty Twittera' },
  (facts, page) =>
    isIndexable(page) && Object.keys(facts.twitterCard).length === 0
      ? [finding(twitterMissing, page.url, { 'adres': page.url })]
      : [],
)

export const STRUCTURED_PAGE_RULES: readonly PageRule[] = [
  jsonLdInvalid, jsonLdMissing, jsonLdEmptyType, jsonLdMissingRequiredField,
  ogMissing, twitterMissing,
]
