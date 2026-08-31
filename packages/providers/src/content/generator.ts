import type { LlmEngineProvider } from '../llm/types.js'
import type { ContentProvider, GeneratedDraft } from './types.js'

/**
 * Generowanie draftu z briefu (D41).
 *
 * Silnik jest **ten sam**, ktory mierzy widocznosc w Fazie 2 — jeden adapter,
 * jeden rejestr wywolan, jedna droga na zewnatrz. Dopisywanie drugiego kanalu
 * do tych samych API skonczyloby sie tym, ze polowa wywolan omija `provider_call`.
 *
 * Model dostaje **brief**, a nie temat. Roznica jest cala wartoscia tej fazy:
 * model poproszony o artykul „o audycie SEO" napisze ogolniki, a model
 * dostajacy pozycje 11,4 na frazie z 800 wyswietleniami wie, o co gra.
 */

/** Znacznik, po ktorym odcinamy naglowek instrukcji od wlasciwej tresci. */
const TITLE_MARKER = '# '

export const CONTENT_SYSTEM_RULES = [
  'Piszesz po polsku, rzeczowo, bez marketingowego nadecia.',
  'Kazdy akapit ma niesc informacje, ktorej nie da sie zgadnac z tytulu.',
  'Nie wymyslasz danych, cytatow ani zrodel. Jesli czegos nie wiesz, piszesz o tym wprost.',
  'Nie wstawiasz linkow, ktorych nie ma w briefie.',
  'Zaczynasz od naglowka `# ` z tytulem artykulu.',
].join(' ')

function extractTitle(markdown: string): { title: string; body: string } {
  const linie = markdown.split('\n')
  const index = linie.findIndex((linia) => linia.startsWith(TITLE_MARKER))
  if (index === -1) return { title: '', body: markdown.trim() }
  return {
    title: (linie[index] as string).slice(TITLE_MARKER.length).trim(),
    body: linie.slice(index + 1).join('\n').trim(),
  }
}

export interface ContentGeneratorDeps {
  readonly engine: LlmEngineProvider
  /** Dopisywane do promptu — regula domowa, nie zmienia sie miedzy artykulami. */
  readonly rules?: string | undefined
}

export function createContentProvider(deps: ContentGeneratorDeps): ContentProvider {
  const rules = deps.rules ?? CONTENT_SYSTEM_RULES

  return {
    engine: deps.engine.id,
    modelVersion: deps.engine.modelVersion,

    async generate(briefMarkdown: string, promptId: string): Promise<GeneratedDraft> {
      const prompt = `${rules}\n\nNapisz artykul na podstawie ponizszego briefu.\n\n${briefMarkdown}`

      // Ten sam interfejs, co przy pomiarze widocznosci — wiec to samo wywolanie
      // laduje w `provider_call` bez zadnego dodatkowego kodu (AC9).
      const answer = await deps.engine.ask(
        { promptId, text: prompt, locale: 'pl' },
        0,
      )

      const { title, body } = extractTitle(answer.text)

      return {
        title,
        markdown: body,
        // Model **deklaruje** zasoby, ale to bramka decyduje. Tutaj zostawiamy
        // pusto swiadomie: zgadywanie zasobu z tresci byloby zgadywaniem,
        // a D37 wymaga deklaracji, ktora ktos podpisal.
        uniqueAssets: [],
        engine: deps.engine.id,
        modelVersion: deps.engine.modelVersion,
        promptId,
        error: answer.fetchError,
        refusalReason: answer.refusalReason,
      }
    },
  }
}
