import { parse as parse5 } from 'parse5'
import {
  attr, collapseWhitespace, elementsByTag, isElement, textOf, type Element, type Node,
} from './dom.js'
import type {
  HeadingFact, HreflangFact, ImageFact, JsonLdFact, LinkFact, LinkRel, MetaRobots, PageFacts,
} from './facts.js'
import { countWords, visibleText } from './text.js'

export interface ParseOptions {
  /** Adres, wzgledem ktorego rozwiazujemy linki wzgledne i rozstrzygamy „wewnetrzny". */
  readonly url: string
}

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** Schematy, ktore nie sa nawigacja po dokumentach — nie trafiaja do grafu linkow. */
const NON_NAVIGATIONAL = /^(javascript|mailto|tel|sms|data|blob|about|ftp|file):/i

function resolveUrl(href: string, base: string): string | null {
  const trimmed = href.trim()
  if (trimmed.length === 0) return null
  if (NON_NAVIGATIONAL.test(trimmed)) return null
  try {
    const resolved = new URL(trimmed, base)
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') return null
    resolved.hash = ''
    return resolved.toString()
  } catch {
    return null
  }
}

function relOf(tokens: readonly string[]): LinkRel {
  if (tokens.includes('nofollow')) return 'nofollow'
  if (tokens.includes('sponsored')) return 'sponsored'
  if (tokens.includes('ugc')) return 'ugc'
  return 'follow'
}

function relTokensOf(element: Element): string[] {
  const raw = attr(element, 'rel')
  if (!raw) return []
  return raw.toLowerCase().split(/\s+/).filter((t) => t.length > 0)
}

/**
 * `<meta name="robots">` rozlozone na dyrektywy. Gdy brak `robots`, bierzemy
 * `googlebot` — Google honoruje wersje bardziej szczegolowa, wiec jej brak
 * przy obecnym `robots` niczego nie zmienia, a jej obecnosc przy braku `robots`
 * jest jedynym zrodlem prawdy.
 */
function parseMetaRobots(root: Node): MetaRobots {
  let raw: string | null = null
  for (const meta of elementsByTag(root, 'meta')) {
    const name = attr(meta, 'name')?.toLowerCase()
    if (name !== 'robots' && name !== 'googlebot') continue
    const content = attr(meta, 'content')
    if (content === undefined) continue
    if (name === 'robots') { raw = content; break }
    raw ??= content
  }

  const tokens = (raw ?? '').toLowerCase().split(',').map((t) => t.trim()).filter(Boolean)
  const maxSnippetToken = tokens.find((t) => t.startsWith('max-snippet:'))
  const maxImageToken = tokens.find((t) => t.startsWith('max-image-preview:'))
  const parsedMaxSnippet = maxSnippetToken
    ? Number.parseInt(maxSnippetToken.slice('max-snippet:'.length), 10)
    : Number.NaN

  return {
    raw,
    noindex: tokens.includes('noindex') || tokens.includes('none'),
    nofollow: tokens.includes('nofollow') || tokens.includes('none'),
    noarchive: tokens.includes('noarchive'),
    nosnippet: tokens.includes('nosnippet'),
    maxSnippet: Number.isNaN(parsedMaxSnippet) ? null : parsedMaxSnippet,
    maxImagePreview: maxImageToken?.slice('max-image-preview:'.length) ?? null,
  }
}

/**
 * Zbiera `@type` z calego bloku, takze z encji zagniezdzonych (`author`, `publisher`,
 * `@graph`). Regula „artykul bez znacznika Article" musi widziec typ niezaleznie od
 * tego, na ktorym poziomie autor go umiescil.
 */
function jsonLdTypes(parsed: unknown): string[] {
  const types: string[] = []
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { for (const item of value) visit(item); return }
    if (value === null || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    const type = record['@type']
    if (typeof type === 'string') types.push(type)
    else if (Array.isArray(type)) for (const t of type) if (typeof t === 'string') types.push(t)
    for (const [key, nested] of Object.entries(record)) {
      if (key === '@type') continue
      visit(nested)
    }
  }
  visit(parsed)
  return types
}

function parseJsonLd(element: Element): JsonLdFact {
  const raw = textOf(element)
  try {
    const parsed: unknown = JSON.parse(raw)
    return { raw, parsed, parseError: null, types: jsonLdTypes(parsed) }
  } catch (error) {
    return {
      raw,
      parsed: null,
      parseError: error instanceof Error ? error.message : String(error),
      types: [],
    }
  }
}

/** Ten sam host = wewnetrzny. Poddomena to osobny host i osobna decyzja crawlera. */
function isInternalTo(resolved: string | null, base: URL): boolean {
  if (!resolved) return false
  try {
    return new URL(resolved).host === base.host
  } catch {
    return false
  }
}

export function parsePage(html: string, options: ParseOptions): PageFacts {
  const document = parse5(html)
  const base = new URL(options.url)

  const headings: HeadingFact[] = []
  const links: LinkFact[] = []
  const images: ImageFact[] = []
  const jsonLd: JsonLdFact[] = []
  const hreflang: HreflangFact[] = []
  const openGraph: Record<string, string> = {}
  const twitterCard: Record<string, string> = {}

  // Akumulatory w jednym obiekcie, a nie w osobnych `let`: sa przypisywane wylacznie
  // wewnatrz domkniecia `visit`, a wtedy TypeScript zawezalby ich typ do wartosci
  // poczatkowej. Pole obiektu zachowuje typ zadeklarowany.
  const acc = {
    titleCount: 0,
    title: null as string | null,
    canonicalRaw: null as string | null,
    lang: null as string | null,
    charset: null as string | null,
    viewport: null as string | null,
    metaDescription: null as string | null,
    scriptCount: 0,
    inlineScriptCount: 0,
    stylesheetCount: 0,
    inlineStyleCount: 0,
    iframeCount: 0,
    hasNoscript: false,
    seenH1: false,
    firstParagraphAfterH1: null as string | null,
    imageIndex: 0,
  }

  const visit = (node: Node): void => {
    if (!isElement(node)) {
      const children = (node as { childNodes?: readonly Node[] }).childNodes
      if (children) for (const child of children) visit(child)
      return
    }

    const tag = node.tagName.toLowerCase()

    switch (tag) {
      case 'html':
        acc.lang ??= attr(node, 'lang') ?? null
        break

      case 'title':
        acc.titleCount += 1
        acc.title ??= textOf(node)
        break

      case 'meta': {
        const name = attr(node, 'name')?.toLowerCase()
        const property = attr(node, 'property')?.toLowerCase()
        const content = attr(node, 'content')
        if (attr(node, 'charset') !== undefined) acc.charset ??= attr(node, 'charset') ?? null
        if (attr(node, 'http-equiv')?.toLowerCase() === 'content-type') {
          const match = /charset=([\w-]+)/i.exec(content ?? '')
          if (match?.[1]) acc.charset ??= match[1]
        }
        if (name === 'description' && content !== undefined) acc.metaDescription ??= content
        if (name === 'viewport' && content !== undefined) acc.viewport ??= content
        if (property?.startsWith('og:') && content !== undefined) openGraph[property] ??= content
        if (name?.startsWith('twitter:') && content !== undefined) twitterCard[name] ??= content
        break
      }

      case 'link': {
        const rel = relTokensOf(node)
        const href = attr(node, 'href')
        if (href === undefined) break
        if (rel.includes('canonical')) acc.canonicalRaw ??= href
        if (rel.includes('stylesheet')) acc.stylesheetCount += 1
        if (rel.includes('alternate')) {
          const code = attr(node, 'hreflang')
          if (code !== undefined) {
            hreflang.push({ lang: code, href, resolved: resolveUrl(href, options.url) })
          }
        }
        break
      }

      case 'script': {
        const type = attr(node, 'type')?.toLowerCase()
        if (type === 'application/ld+json') { jsonLd.push(parseJsonLd(node)); break }
        acc.scriptCount += 1
        if (attr(node, 'src') === undefined) acc.inlineScriptCount += 1
        break
      }

      case 'style':
        acc.inlineStyleCount += 1
        break

      case 'iframe':
        acc.iframeCount += 1
        break

      case 'noscript':
        acc.hasNoscript = true
        break

      case 'a': {
        const href = attr(node, 'href')
        if (href !== undefined) {
          const tokens = relTokensOf(node)
          const resolved = resolveUrl(href, options.url)
          links.push({
            href,
            resolved,
            anchorText: textOf(node),
            rel: relOf(tokens),
            relTokens: tokens,
            isInternal: isInternalTo(resolved, base),
            wrapsImage: elementsByTag(node, 'img').length > 0,
          })
        }
        break
      }

      case 'img': {
        const src = attr(node, 'src') ?? null
        const altValue = attr(node, 'alt')
        images.push({
          src,
          resolved: src === null ? null : resolveUrl(src, options.url),
          hasAlt: altValue !== undefined,
          alt: altValue ?? '',
          width: attr(node, 'width') ?? null,
          height: attr(node, 'height') ?? null,
          loading: attr(node, 'loading') ?? null,
          documentIndex: acc.imageIndex,
        })
        acc.imageIndex += 1
        break
      }

      case 'p':
        if (acc.seenH1 && acc.firstParagraphAfterH1 === null) {
          const text = textOf(node)
          if (text.length > 0) acc.firstParagraphAfterH1 = text
        }
        break

      default:
        break
    }

    if (HEADING_TAGS.has(tag)) {
      headings.push({ level: Number.parseInt(tag.slice(1), 10), text: textOf(node) })
      if (tag === 'h1') acc.seenH1 = true
    }

    // `<style>` i `<script>` moga zawierac tekst wygladajacy na znaczniki —
    // parse5 juz to rozstrzygnal, wiec schodzimy nizej bez wyjatkow.
    for (const child of node.childNodes) visit(child)
  }

  visit(document)

  const headingOrderJumps: { from: number; to: number }[] = []
  for (let i = 1; i < headings.length; i += 1) {
    const previous = headings[i - 1]
    const current = headings[i]
    if (previous && current && current.level > previous.level + 1) {
      headingOrderJumps.push({ from: previous.level, to: current.level })
    }
  }

  const text = visibleText(document)
  const htmlBytes = new TextEncoder().encode(html).length
  const h1Texts = headings.filter((h) => h.level === 1).map((h) => h.text)

  const description = acc.metaDescription === null ? null : collapseWhitespace(acc.metaDescription)

  return {
    url: options.url,
    title: acc.title,
    titleLength: acc.title?.length ?? 0,
    titleCount: acc.titleCount,
    metaDescription: description,
    metaDescriptionLength: description?.length ?? 0,
    metaRobots: parseMetaRobots(document),
    canonicalRaw: acc.canonicalRaw,
    canonicalResolved:
      acc.canonicalRaw === null ? null : resolveUrl(acc.canonicalRaw, options.url),
    lang: acc.lang,
    charset: acc.charset,
    viewport: acc.viewport,
    headings,
    h1Count: h1Texts.length,
    h1Texts,
    headingOrderJumps,
    links,
    images,
    jsonLd,
    openGraph,
    twitterCard,
    hreflang,
    text,
    wordCount: countWords(text),
    textToHtmlRatio: htmlBytes === 0 ? 0 : new TextEncoder().encode(text).length / htmlBytes,
    firstParagraphAfterH1: acc.firstParagraphAfterH1,
    scriptCount: acc.scriptCount,
    inlineScriptCount: acc.inlineScriptCount,
    stylesheetCount: acc.stylesheetCount,
    inlineStyleCount: acc.inlineStyleCount,
    iframeCount: acc.iframeCount,
    hasNoscript: acc.hasNoscript,
    htmlBytes,
  }
}
