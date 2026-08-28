/**
 * Parser map witryny (D22). Obsluguje `<urlset>` i `<sitemapindex>`.
 *
 * Mapa jest zrodlem adresow, nie prawda o nich — kazdy adres i tak sprawdzamy
 * pobraniem. Dlatego parser jest wyrozumialy: bledy zwraca jako dane, nie jako
 * wyjatki, zeby jedna zepsuta pozycja nie skasowala calej mapy.
 *
 * Rozpakowywanie `.gz` nalezy do pobieracza — tutaj wchodzi juz sam tekst,
 * inaczej czysty silnik musialby dotknac `node:zlib`.
 */

export interface SitemapEntry {
  readonly loc: string
  readonly lastmod: string | null
}

export type SitemapProblemKind = 'not-xml' | 'invalid-url' | 'empty' | 'over-limit'

export interface SitemapProblem {
  readonly kind: SitemapProblemKind
  readonly detail: string
}

export interface SitemapParseResult {
  readonly kind: 'urlset' | 'sitemapindex' | 'unknown'
  readonly entries: readonly SitemapEntry[]
  readonly problems: readonly SitemapProblem[]
}

/** Limit ze specyfikacji sitemaps.org. Powyzej niego mapa powinna byc podzielona. */
export const SITEMAP_MAX_ENTRIES = 50_000

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
}

function decodeXmlText(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const code = Number.parseInt(body.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    if (body.startsWith('#')) {
      const code = Number.parseInt(body.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match
  })
}

function stripCdata(value: string): string {
  const match = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(value)
  return match?.[1] ?? value
}

/** Wyciaga zawartosc pierwszego znacznika o danej nazwie, ignorujac przestrzenie nazw. */
function tagContent(block: string, tag: string): string | null {
  const pattern = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'i')
  const match = pattern.exec(block)
  return match?.[1] === undefined ? null : decodeXmlText(stripCdata(match[1])).trim()
}

function blocksOf(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-zA-Z0-9_-]+:)?${tag}>`, 'gi')
  const out: string[] = []
  for (const match of xml.matchAll(pattern)) if (match[1] !== undefined) out.push(match[1])
  return out
}

export function parseSitemap(xml: string): SitemapParseResult {
  const problems: SitemapProblem[] = []

  if (!/<\s*(?:[a-zA-Z0-9_-]+:)?(urlset|sitemapindex)\b/i.test(xml)) {
    return {
      kind: 'unknown',
      entries: [],
      problems: [{ kind: 'not-xml', detail: 'brak elementu urlset ani sitemapindex' }],
    }
  }

  const isIndex = /<\s*(?:[a-zA-Z0-9_-]+:)?sitemapindex\b/i.test(xml)
  const blocks = blocksOf(xml, isIndex ? 'sitemap' : 'url')

  const entries: SitemapEntry[] = []
  for (const block of blocks) {
    const loc = tagContent(block, 'loc')
    if (loc === null || loc.length === 0) {
      problems.push({ kind: 'invalid-url', detail: 'pozycja bez elementu loc' })
      continue
    }
    try {
      const parsed = new URL(loc)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        problems.push({ kind: 'invalid-url', detail: loc })
        continue
      }
    } catch {
      problems.push({ kind: 'invalid-url', detail: loc })
      continue
    }
    entries.push({ loc, lastmod: tagContent(block, 'lastmod') })
  }

  if (entries.length === 0) {
    problems.push({ kind: 'empty', detail: 'mapa nie zawiera żadnego poprawnego adresu' })
  }
  if (entries.length > SITEMAP_MAX_ENTRIES) {
    problems.push({
      kind: 'over-limit',
      detail: `${entries.length} adresów przy limicie ${SITEMAP_MAX_ENTRIES}`,
    })
  }

  return { kind: isIndex ? 'sitemapindex' : 'urlset', entries, problems }
}
