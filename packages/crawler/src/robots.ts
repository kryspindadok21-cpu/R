/**
 * Parser `robots.txt` wg RFC 9309, w wersji rygorystycznej (D14).
 *
 * To jedyne miejsce w projekcie, w ktorym blad uderza w kogos na zewnatrz.
 * Nadmiernie ostrozny crawler pominie strone; nieostrozny wyglada jak atak.
 * Dlatego kazda watpliwosc rozstrzygamy na korzysc wlasciciela serwera.
 */

export interface RobotsGroup {
  /** Tokeny `User-agent` tej grupy, malymi literami. */
  readonly agents: readonly string[]
  readonly allow: readonly string[]
  readonly disallow: readonly string[]
  readonly crawlDelaySeconds: number | null
}

export interface RobotsRules {
  readonly groups: readonly RobotsGroup[]
  readonly sitemaps: readonly string[]
}

export const EMPTY_ROBOTS: RobotsRules = { groups: [], sitemaps: [] }

interface MutableGroup {
  agents: string[]
  allow: string[]
  disallow: string[]
  crawlDelaySeconds: number | null
}

function splitDirective(line: string): { field: string; value: string } | null {
  const withoutComment = line.replace(/#.*$/, '')
  const colon = withoutComment.indexOf(':')
  if (colon === -1) return null
  const field = withoutComment.slice(0, colon).trim().toLowerCase()
  const value = withoutComment.slice(colon + 1).trim()
  if (field.length === 0) return null
  return { field, value }
}

export function parseRobotsTxt(text: string): RobotsRules {
  const groups: MutableGroup[] = []
  const sitemaps: string[] = []

  let current: MutableGroup | null = null
  // Grupy sasiadujace (kolejne `User-agent` bez reguly pomiedzy) scalaja sie
  // w jedna — tak stanowi RFC 9309 i tak zachowuje sie Googlebot.
  let acceptingAgents = false

  for (const rawLine of text.split(/\r?\n/)) {
    const directive = splitDirective(rawLine)
    if (!directive) continue
    const { field, value } = directive

    if (field === 'sitemap') {
      if (value.length > 0) sitemaps.push(value)
      continue
    }

    if (field === 'user-agent') {
      if (current === null || !acceptingAgents) {
        current = { agents: [], allow: [], disallow: [], crawlDelaySeconds: null }
        groups.push(current)
        acceptingAgents = true
      }
      current.agents.push(value.toLowerCase())
      continue
    }

    if (current === null) continue // dyrektywa przed jakimkolwiek User-agent — ignorujemy
    acceptingAgents = false

    if (field === 'allow' && value.length > 0) current.allow.push(value)
    else if (field === 'disallow') {
      // `Disallow:` z pusta wartoscia znaczy „nic nie jest zabronione" — pomijamy,
      // bo pusty wzorzec pasowalby do kazdej sciezki.
      if (value.length > 0) current.disallow.push(value)
    } else if (field === 'crawl-delay') {
      const parsed = Number.parseFloat(value)
      if (Number.isFinite(parsed) && parsed >= 0) current.crawlDelaySeconds = parsed
    }
  }

  return {
    groups: groups.map((g) => ({
      agents: g.agents,
      allow: g.allow,
      disallow: g.disallow,
      crawlDelaySeconds: g.crawlDelaySeconds,
    })),
    sitemaps,
  }
}

/**
 * Wybiera grupe dla naszego agenta. Wygrywa najdluzszy token bedacy prefiksem
 * naszej nazwy — dzieki temu `mentiometry` w cudzym pliku obejmuje takze
 * `mentiometry-crawler/0.1`. Brak trafienia → grupa `*`. Brak `*` → brak grupy.
 */
export function groupFor(rules: RobotsRules, userAgent: string): RobotsGroup | null {
  const token = productToken(userAgent)
  let best: RobotsGroup | null = null
  let bestLength = -1
  let wildcard: RobotsGroup | null = null

  for (const group of rules.groups) {
    for (const agent of group.agents) {
      if (agent === '*') { wildcard ??= group; continue }
      if (!token.startsWith(agent)) continue
      if (agent.length > bestLength) { best = group; bestLength = agent.length }
    }
  }

  return best ?? wildcard
}

/** `mentiometry-crawler/0.1 (+kontakt)` → `mentiometry-crawler`. */
export function productToken(userAgent: string): string {
  return (userAgent.split('/')[0] ?? userAgent).trim().toLowerCase()
}

/**
 * Zamienia wzorzec sciezki z `robots.txt` na wyrazenie regularne.
 * `*` to dowolny ciag, `$` na koncu kotwiczy koniec sciezki.
 */
function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`)
}

/** Dlugosc wzorca bez znakow sterujacych — decyduje o tym, ktora regula wygrywa. */
function matchLength(pattern: string, path: string): number | null {
  return patternToRegExp(pattern).test(path) ? pattern.replace(/\$$/, '').length : null
}

/**
 * Rozstrzyga, czy wolno pobrac sciezke.
 *
 * Zasada z RFC 9309: wygrywa **najdluzsza pasujaca regula**, a przy rownej
 * dlugosci wygrywa `Allow`. Brak grupy dla agenta i brak `*` znaczy „wolno".
 */
export function isAllowed(rules: RobotsRules, userAgent: string, path: string): boolean {
  const group = groupFor(rules, userAgent)
  if (group === null) return true

  let longestAllow = -1
  let longestDisallow = -1

  for (const pattern of group.allow) {
    const length = matchLength(pattern, path)
    if (length !== null && length > longestAllow) longestAllow = length
  }
  for (const pattern of group.disallow) {
    const length = matchLength(pattern, path)
    if (length !== null && length > longestDisallow) longestDisallow = length
  }

  if (longestDisallow === -1) return true
  return longestAllow >= longestDisallow
}

export function crawlDelayFor(rules: RobotsRules, userAgent: string): number | null {
  return groupFor(rules, userAgent)?.crawlDelaySeconds ?? null
}

/** Sciezka wraz z zapytaniem — `robots.txt` dopasowuje sie do obu. */
export function pathWithQuery(url: string): string {
  try {
    const parsed = new URL(url)
    return `${parsed.pathname}${parsed.search}`
  } catch {
    return url
  }
}
