import { normalizeUrl } from '@seo/core'

/**
 * Kolejka adresow do odwiedzenia. Deterministyczna: wszerz wg glebokosci,
 * a w obrebie glebokosci wg kolejnosci dodania. Dwa przebiegi na tym samym
 * serwisie daja te sama liste — bez tego porownanie audytow (Faza 4) mierzyloby
 * kolejnosc, a nie zmiane.
 *
 * Tozsamosc adresu to `url_hash` z Fazy 0 (D19), nie sam tekst.
 */

export interface FrontierItem {
  readonly url: string
  readonly depth: number
}

export interface Frontier {
  /** Dodaje adres. Zwraca `false`, gdy byl juz widziany albo przekracza glebokosc. */
  add(url: string, depth: number): boolean
  next(): FrontierItem | undefined
  readonly pending: number
  readonly seen: number
}

function keyOf(url: string): string | null {
  try {
    return normalizeUrl(url).hash
  } catch {
    return null
  }
}

export function createFrontier(maxDepth: number): Frontier {
  // Osobna kolejka na kazda glebokosc — to daje przejscie wszerz bez sortowania.
  const byDepth = new Map<number, string[]>()
  const seen = new Set<string>()
  let pending = 0

  return {
    add(url: string, depth: number): boolean {
      if (depth > maxDepth) return false
      const key = keyOf(url)
      if (key === null || seen.has(key)) return false
      seen.add(key)
      const bucket = byDepth.get(depth)
      if (bucket) bucket.push(url)
      else byDepth.set(depth, [url])
      pending += 1
      return true
    },

    next(): FrontierItem | undefined {
      const depths = [...byDepth.keys()].sort((a, b) => a - b)
      for (const depth of depths) {
        const bucket = byDepth.get(depth)
        if (!bucket || bucket.length === 0) continue
        const url = bucket.shift()
        if (url === undefined) continue
        pending -= 1
        return { url, depth }
      }
      return undefined
    },

    get pending() { return pending },
    get seen() { return seen.size },
  }
}
