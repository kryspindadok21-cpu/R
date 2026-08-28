import { z } from 'zod'
import type { PageFacts } from './facts.js'
import type { RenderDiff } from './render-diff.js'

/**
 * Schemat walidujacy `PageFacts` odczytane z bazy (D1: JSON w bazie to text
 * walidowany zod przy odczycie).
 *
 * Schemat mieszka **obok typu**, ktory opisuje, a nie w `@seo/db`. Powod jest
 * praktyczny: test `facts-schema.test.ts` przepuszcza przez niego wynik
 * `parsePage`, wiec kazde rozejscie sie typu ze schematem wywala sie od razu,
 * a nie dopiero przy odczycie cudzej bazy pol roku pozniej.
 */

const MetaRobotsSchema = z.object({
  raw: z.string().nullable(),
  noindex: z.boolean(),
  nofollow: z.boolean(),
  noarchive: z.boolean(),
  nosnippet: z.boolean(),
  maxSnippet: z.number().nullable(),
  maxImagePreview: z.string().nullable(),
})

const HeadingSchema = z.object({ level: z.number(), text: z.string() })

const LinkSchema = z.object({
  href: z.string(),
  resolved: z.string().nullable(),
  anchorText: z.string(),
  rel: z.enum(['follow', 'nofollow', 'sponsored', 'ugc']),
  relTokens: z.array(z.string()),
  isInternal: z.boolean(),
  wrapsImage: z.boolean(),
})

const ImageSchema = z.object({
  src: z.string().nullable(),
  resolved: z.string().nullable(),
  hasAlt: z.boolean(),
  alt: z.string(),
  width: z.string().nullable(),
  height: z.string().nullable(),
  loading: z.string().nullable(),
  documentIndex: z.number(),
})

const JsonLdSchema = z.object({
  raw: z.string(),
  parsed: z.unknown(),
  parseError: z.string().nullable(),
  types: z.array(z.string()),
})

const HreflangSchema = z.object({
  lang: z.string(),
  href: z.string(),
  resolved: z.string().nullable(),
})

export const PageFactsSchema = z.object({
  url: z.string(),
  title: z.string().nullable(),
  titleLength: z.number(),
  titleCount: z.number(),
  metaDescription: z.string().nullable(),
  metaDescriptionLength: z.number(),
  metaRobots: MetaRobotsSchema,
  canonicalRaw: z.string().nullable(),
  canonicalResolved: z.string().nullable(),
  lang: z.string().nullable(),
  charset: z.string().nullable(),
  viewport: z.string().nullable(),
  headings: z.array(HeadingSchema),
  h1Count: z.number(),
  h1Texts: z.array(z.string()),
  headingOrderJumps: z.array(z.object({ from: z.number(), to: z.number() })),
  links: z.array(LinkSchema),
  images: z.array(ImageSchema),
  jsonLd: z.array(JsonLdSchema),
  openGraph: z.record(z.string(), z.string()),
  twitterCard: z.record(z.string(), z.string()),
  hreflang: z.array(HreflangSchema),
  text: z.string(),
  wordCount: z.number(),
  textToHtmlRatio: z.number(),
  firstParagraphAfterH1: z.string().nullable(),
  scriptCount: z.number(),
  inlineScriptCount: z.number(),
  stylesheetCount: z.number(),
  inlineStyleCount: z.number(),
  iframeCount: z.number(),
  hasNoscript: z.boolean(),
  htmlBytes: z.number(),
})

export const RenderDiffSchema = z.object({
  titleChanged: z.boolean(),
  rawTitle: z.string().nullable(),
  renderedTitle: z.string().nullable(),
  descriptionChanged: z.boolean(),
  rawWordCount: z.number(),
  renderedWordCount: z.number(),
  jsRequiredContentRatio: z.number(),
  rawLinkCount: z.number(),
  renderedLinkCount: z.number(),
  linksOnlyInRendered: z.array(z.string()),
  linksOnlyInRaw: z.array(z.string()),
  jsonLdOnlyInRendered: z.number(),
  h1OnlyInRendered: z.boolean(),
  contentRequiresJs: z.boolean(),
})

/** Zwraca `null` zamiast rzucac — uszkodzony wiersz nie moze skasowac raportu. */
export function parsePageFactsJson(json: string | null): PageFacts | null {
  if (json === null) return null
  try {
    return PageFactsSchema.parse(JSON.parse(json)) as PageFacts
  } catch {
    return null
  }
}

export function parseRenderDiffJson(json: string | null): RenderDiff | null {
  if (json === null) return null
  try {
    return RenderDiffSchema.parse(JSON.parse(json)) as RenderDiff
  } catch {
    return null
  }
}
