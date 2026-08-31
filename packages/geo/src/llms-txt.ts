/**
 * Generator `llms.txt` (D31).
 *
 * Powstaje, ale bez obietnic. Google oswiadczylo, ze plik nie jest potrzebny dla
 * AI Overviews ani AI Mode i nie planuje wsparcia; zaden duzy dostawca nie
 * zobowiazal sie czytac go w otwartym webie. Klienci beda pytac, wiec generator
 * ma byc — ale wysilek idzie w czynniki strukturalne, ktore realnie wplywaja na
 * pobieranie tresci, i te sa mierzone od Fazy 1.
 *
 * Format wg llmstxt.org: naglowek H1 z nazwa, opcjonalny cytat z opisem,
 * sekcje H2 z listami odnosnikow.
 */

export interface LlmsTxtPage {
  readonly url: string
  readonly title: string | null
  readonly description: string | null
  readonly depth: number
  readonly httpStatus: number | null
  readonly indexable: boolean
}

export interface LlmsTxtInput {
  readonly siteName: string
  readonly siteUrl: string
  readonly description: string | null
  readonly pages: readonly LlmsTxtPage[]
}

/** Ile stron w sekcji. Plik ma byc do przeczytania przez model, nie mapa witryny. */
export const LLMS_TXT_SECTION_LIMIT = 50

function sectionOf(url: string, siteUrl: string): string {
  try {
    const path = new URL(url).pathname
    const base = new URL(siteUrl).pathname.replace(/\/+$/, '')
    const relative = path.startsWith(base) ? path.slice(base.length) : path
    const segment = relative.split('/').filter((s) => s !== '')[0]
    return segment === undefined ? 'Strona główna' : segment
  } catch {
    return 'Inne'
  }
}

/** Jedna linia opisu: bez znakow nowej linii, bo psuja liste markdownu. */
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function buildLlmsTxt(input: LlmsTxtInput): string {
  // Do pliku trafiaja wylacznie strony, ktore da sie odwiedzic i ktore same
  // pozwalaja sie indeksowac. Wpisanie tu adresu z `noindex` byloby sprzeczne
  // z tym, co strona mowi wlasnym naglowkiem.
  const kandydaci = input.pages.filter(
    (p) => p.httpStatus === 200 && p.indexable,
  )

  const sekcje = new Map<string, LlmsTxtPage[]>()
  for (const page of kandydaci) {
    const key = sectionOf(page.url, input.siteUrl)
    sekcje.set(key, [...(sekcje.get(key) ?? []), page])
  }

  const linie: string[] = [`# ${oneLine(input.siteName)}`]
  if (input.description !== null && input.description.trim() !== '') {
    linie.push('', `> ${oneLine(input.description)}`)
  }

  const nazwy = [...sekcje.keys()].sort((a, b) => {
    if (a === 'Strona główna') return -1
    if (b === 'Strona główna') return 1
    return a.localeCompare(b, 'pl')
  })

  for (const nazwa of nazwy) {
    const strony = (sekcje.get(nazwa) ?? [])
      .sort((a, b) => a.depth - b.depth || a.url.localeCompare(b.url))
      .slice(0, LLMS_TXT_SECTION_LIMIT)

    linie.push('', `## ${nazwa}`, '')
    for (const page of strony) {
      const tytul = page.title === null || page.title.trim() === ''
        ? page.url
        : oneLine(page.title)
      const opis = page.description === null || page.description.trim() === ''
        ? ''
        : `: ${oneLine(page.description)}`
      linie.push(`- [${tytul}](${page.url})${opis}`)
    }
  }

  return `${linie.join('\n')}\n`
}
