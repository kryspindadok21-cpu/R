import { describe, expect, it } from 'vitest'
import type { ProviderCallEntry } from '../ledger.js'
import { createOpenAiCompatibleProvider } from '../llm/openai-compatible.js'
import type { EngineAnswer, EnginePrompt, LlmEngineProvider } from '../llm/types.js'
import { CONTENT_SYSTEM_RULES, createContentProvider } from './generator.js'

const BRIEF = `# Brief: audyt seo strony

- **Decyzja:** nowy artykul
- **Wyswietlenia klastra:** 900
`

function atrapa(
  odpowiedz: Partial<EngineAnswer>,
): LlmEngineProvider & { readonly prompty: readonly string[] } {
  const prompty: string[] = []
  return {
    id: 'groq', modelVersion: 'llama-test', accessMode: 'api', prompty,
    async ask(prompt: EnginePrompt, runIndex: number): Promise<EngineAnswer> {
      prompty.push(prompt.text)
      return {
        promptId: prompt.promptId, runIndex, text: '',
        refusalReason: null, fetchError: null, latencyMs: 5, groundingUris: [],
        ...odpowiedz,
      }
    },
  }
}

describe('createContentProvider', () => {
  it('odcina tytul z naglowka i zostawia tresc', async () => {
    const silnik = atrapa({ text: '# Audyt SEO krok po kroku\n\nPierwszy akapit.\n\nDrugi.' })
    const draft = await createContentProvider({ engine: silnik }).generate(BRIEF, 'brief-01')
    expect(draft.title).toBe('Audyt SEO krok po kroku')
    expect(draft.markdown).toBe('Pierwszy akapit.\n\nDrugi.')
  })

  it('D41: model dostaje caly brief, nie sam temat', async () => {
    const silnik = atrapa({ text: '# T\n\nx' })
    await createContentProvider({ engine: silnik }).generate(BRIEF, 'brief-01')
    expect(silnik.prompty[0]).toContain('Wyswietlenia klastra:** 900')
    expect(silnik.prompty[0]).toContain(CONTENT_SYSTEM_RULES)
  })

  it('reguly domowe da sie podmienic', async () => {
    const silnik = atrapa({ text: '# T\n\nx' })
    await createContentProvider({ engine: silnik, rules: 'Pisz po angielsku.' })
      .generate(BRIEF, 'brief-01')
    expect(silnik.prompty[0]).toContain('Pisz po angielsku.')
    expect(silnik.prompty[0]).not.toContain(CONTENT_SYSTEM_RULES)
  })

  it('D40: draft niesie silnik, wersje modelu i prompt', async () => {
    const draft = await createContentProvider({ engine: atrapa({ text: '# T\n\nx' }) })
      .generate(BRIEF, 'brief-07')
    expect(draft.engine).toBe('groq')
    expect(draft.modelVersion).toBe('llama-test')
    expect(draft.promptId).toBe('brief-07')
  })

  it('odpowiedz bez naglowka nie gubi tresci', async () => {
    const draft = await createContentProvider({ engine: atrapa({ text: 'Sama tresc bez tytulu.' }) })
      .generate(BRIEF, 'p')
    expect(draft.title).toBe('')
    expect(draft.markdown).toBe('Sama tresc bez tytulu.')
  })

  it('naglowek nizszego rzedu nie jest brany za tytul', async () => {
    const draft = await createContentProvider({
      engine: atrapa({ text: '## Podrozdzial\n\ntresc\n\n# Wlasciwy tytul\n\nreszta' }),
    }).generate(BRIEF, 'p')
    expect(draft.title).toBe('Wlasciwy tytul')
  })

  it('D37: generator NIE deklaruje unikalnych zasobow za czlowieka', async () => {
    // Zgadywanie zasobu z tresci byloby zgadywaniem, a D37 wymaga deklaracji,
    // ktora ktos podpisal. Draft bez zasobu odpadnie na bramce i tak ma byc.
    const draft = await createContentProvider({ engine: atrapa({ text: '# T\n\nx' }) })
      .generate(BRIEF, 'p')
    expect(draft.uniqueAssets).toEqual([])
  })

  it('odmowa modelu wraca jako dane, nie jako wyjatek', async () => {
    const draft = await createContentProvider({
      engine: atrapa({ text: '', refusalReason: 'filtr tresci dostawcy' }),
    }).generate(BRIEF, 'p')
    expect(draft.refusalReason).toBe('filtr tresci dostawcy')
    expect(draft.error).toBeNull()
    expect(draft.markdown).toBe('')
  })

  it('blad wywolania wraca jako dane', async () => {
    const draft = await createContentProvider({ engine: atrapa({ fetchError: 'ECONNRESET' }) })
      .generate(BRIEF, 'p')
    expect(draft.error).toBe('ECONNRESET')
  })

  it('AC9: generowanie idzie tym samym adapterem, wiec laduje w rejestrze', async () => {
    const entries: ProviderCallEntry[] = []
    const silnik = createOpenAiCompatibleProvider('groq', {
      fetchFn: (async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: '# T\n\nx' } }] }), {
          status: 200, headers: { 'content-type': 'application/json' },
        })) as unknown as typeof globalThis.fetch,
      ledger: { record: (e) => { entries.push(e) } },
      now: () => 0,
      apiKey: 'k', model: 'llama-test', baseUrl: 'https://przyklad.test/v1',
    })

    await createContentProvider({ engine: silnik }).generate(BRIEF, 'brief-01')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.providerId).toBe('groq')
    expect(entries[0]?.requestFingerprint).toBe('brief-01|0')
  })
})
