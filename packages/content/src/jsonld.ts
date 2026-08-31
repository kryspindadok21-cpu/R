import type { ApprovedDraft } from './gates.js'

/**
 * JSON-LD dla artykulu (D39).
 *
 * `author` wskazuje na **istniejaca osobe** z rozwiazywalnym `sameAs`. Zmyslony
 * autor z biogramem to nie jest szara strefa optymalizacji — to wprowadzanie
 * czytelnika w blad co do tego, kto za tekstem stoi.
 *
 * Funkcja przyjmuje `ApprovedDraft`, wiec nie da sie jej wywolac na drafcie,
 * ktory nie przeszedl bramki autora. To nie jest ostroznosc — to jest ten sam
 * mechanizm, co przy publikacji (AC7).
 */

export interface ArticleSchemaInput {
  readonly draft: ApprovedDraft
  readonly url: string
  readonly datePublished: string
  readonly dateModified?: string | undefined
  readonly description?: string | undefined
  readonly publisherName?: string | undefined
}

export interface ArticleSchema {
  readonly '@context': 'https://schema.org'
  readonly '@type': 'Article'
  readonly headline: string
  readonly url: string
  readonly datePublished: string
  readonly dateModified: string
  readonly author: {
    readonly '@type': 'Person'
    readonly name: string
    readonly sameAs: readonly string[]
  }
  readonly description?: string
  readonly publisher?: { readonly '@type': 'Organization'; readonly name: string }
  readonly mainEntityOfPage: { readonly '@type': 'WebPage'; readonly '@id': string }
}

/** Google ucina nagłówki powyzej tej dlugosci w wynikach. */
export const MAX_HEADLINE_LENGTH = 110

export function buildArticleSchema(input: ArticleSchemaInput): ArticleSchema {
  const headline = input.draft.title.length <= MAX_HEADLINE_LENGTH
    ? input.draft.title
    : `${input.draft.title.slice(0, MAX_HEADLINE_LENGTH - 1).trimEnd()}…`

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    author: {
      '@type': 'Person',
      name: input.draft.author.name,
      sameAs: [input.draft.author.sameAs],
    },
    ...(input.description === undefined ? {} : { description: input.description }),
    ...(input.publisherName === undefined
      ? {}
      : { publisher: { '@type': 'Organization' as const, name: input.publisherName } }),
    mainEntityOfPage: { '@type': 'WebPage', '@id': input.url },
  }
}

/**
 * Blok `<script type="application/ld+json">` gotowy do wstawienia.
 *
 * `<` w tresci jest eskejpowane przez `\u003c`, bo parser HTML konczy blok
 * skryptu na `</script>` **wewnatrz** ciagu znakow. To nie jest teoretyczne:
 * tytul zawierajacy ten ciag rozwalilby strone.
 */
export function articleSchemaScript(schema: ArticleSchema): string {
  const json = JSON.stringify(schema, null, 2).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">\n${json}\n</script>`
}
