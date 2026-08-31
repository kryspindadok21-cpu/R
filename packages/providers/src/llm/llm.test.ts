import { describe, expect, it } from 'vitest'
import type { ProviderCallEntry } from '../ledger.js'
import { createGeminiProvider } from './gemini.js'
import { createOpenAiCompatibleProvider } from './openai-compatible.js'
import { DEFAULT_MODELS, selectEngines } from './registry.js'
import type { EnginePrompt } from './types.js'

const PROMPT: EnginePrompt = { promptId: 'p1', text: 'Jakie narzedzie do GEO?', locale: 'pl' }

function rejestr() {
  const entries: ProviderCallEntry[] = []
  return { ledger: { record: (e: ProviderCallEntry) => { entries.push(e) } }, entries }
}

/** Atrapa sieci: testy przechodza bez internetu (AC9). */
function atrapa(status: number, body: unknown): typeof globalThis.fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof globalThis.fetch
}

let zegar = 0
const now = () => (zegar += 10)

describe('adapter zgodny z OpenAI (groq, openrouter)', () => {
  it('zwraca tresc odpowiedzi i pusty grounding', async () => {
    const { ledger } = rejestr()
    const provider = createOpenAiCompatibleProvider('groq', {
      fetchFn: atrapa(200, { choices: [{ message: { content: 'Polecam Mentiometry.' } }] }),
      ledger, now, apiKey: 'k', model: 'm', baseUrl: 'https://przyklad.test/v1',
    })
    const answer = await provider.ask(PROMPT, 0)
    expect(answer.text).toBe('Polecam Mentiometry.')
    expect(answer.refusalReason).toBeNull()
    expect(answer.fetchError).toBeNull()
    // Silnik bez groundingu ma zero cytowan groundingowych i to poprawny wynik (D32).
    expect(answer.groundingUris).toEqual([])
  })

  it('AC8: kazde wywolanie ma wiersz w rejestrze', async () => {
    const { ledger, entries } = rejestr()
    const provider = createOpenAiCompatibleProvider('groq', {
      fetchFn: atrapa(200, { choices: [{ message: { content: 'ok' } }] }),
      ledger, now, apiKey: 'k', model: 'llama', baseUrl: 'https://przyklad.test/v1',
    })
    await provider.ask(PROMPT, 0)
    await provider.ask(PROMPT, 1)
    expect(entries).toHaveLength(2)
    expect(entries[0]?.providerId).toBe('groq')
    expect(entries[0]?.capability).toBe('llm.ask.llama')
    expect(entries[0]?.quotaUnits).toBe(1)
    expect(entries.map((e) => e.requestFingerprint)).toEqual(['p1|0', 'p1|1'])
  })

  it('nieudane wywolanie tez ma wiersz w rejestrze', async () => {
    const { ledger, entries } = rejestr()
    const provider = createOpenAiCompatibleProvider('groq', {
      fetchFn: atrapa(429, {}),
      ledger, now, apiKey: 'k', model: 'm', baseUrl: 'https://przyklad.test/v1',
    })
    const answer = await provider.ask(PROMPT, 0)
    expect(answer.fetchError).toContain('429')
    expect(answer.text).toBe('')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.ok).toBe(false)
    expect(entries[0]?.httpStatus).toBe(429)
  })

  it('odmowa filtra tresci jest danymi, nie bledem', async () => {
    const { ledger } = rejestr()
    const provider = createOpenAiCompatibleProvider('openrouter', {
      fetchFn: atrapa(200, { choices: [{ message: { content: '' }, finish_reason: 'content_filter' }] }),
      ledger, now, apiKey: 'k', model: 'm', baseUrl: 'https://przyklad.test/v1',
    })
    const answer = await provider.ask(PROMPT, 0)
    expect(answer.refusalReason).toBe('filtr tresci dostawcy')
    expect(answer.fetchError).toBeNull()
  })

  it('blad sieci wraca jako dane, nie jako wyjatek', async () => {
    const { ledger, entries } = rejestr()
    const provider = createOpenAiCompatibleProvider('groq', {
      fetchFn: (async () => { throw new Error('ECONNRESET') }) as unknown as typeof globalThis.fetch,
      ledger, now, apiKey: 'k', model: 'm', baseUrl: 'https://przyklad.test/v1',
    })
    const answer = await provider.ask(PROMPT, 0)
    expect(answer.fetchError).toBe('ECONNRESET')
    expect(entries[0]?.ok).toBe(false)
  })
})

describe('adapter gemini', () => {
  it('sklada tresc z czesci i wyciaga adresy groundingu', async () => {
    const { ledger } = rejestr()
    const provider = createGeminiProvider({
      fetchFn: atrapa(200, {
        candidates: [{
          content: { parts: [{ text: 'Polecam ' }, { text: 'Mentiometry.' }] },
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: 'https://mentiometry.com/blog' } },
              { web: {} },
            ],
          },
        }],
      }),
      ledger, now, apiKey: 'k', model: 'gemini-2.5-flash',
      accessMode: 'api_grounded', baseUrl: 'https://przyklad.test/v1beta',
    })
    const answer = await provider.ask(PROMPT, 0)
    expect(answer.text).toBe('Polecam Mentiometry.')
    expect(answer.groundingUris).toEqual(['https://mentiometry.com/blog'])
    expect(provider.accessMode).toBe('api_grounded')
  })

  it('tryb bez groundingu nie wysyla narzedzia wyszukiwania', async () => {
    const { ledger } = rejestr()
    let wyslane: string | null = null
    const provider = createGeminiProvider({
      fetchFn: (async (_url: string, init: RequestInit) => {
        wyslane = init.body as string
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x' }] } }] }),
          { status: 200, headers: { 'content-type': 'application/json' } })
      }) as unknown as typeof globalThis.fetch,
      ledger, now, apiKey: 'k', model: 'gemini-2.5-flash',
      accessMode: 'api', baseUrl: 'https://przyklad.test/v1beta',
    })
    await provider.ask(PROMPT, 0)
    expect(wyslane).not.toContain('google_search')
  })

  it('blokada promptu jest odmowa z powodem, a nie bledem', async () => {
    const { ledger } = rejestr()
    const provider = createGeminiProvider({
      fetchFn: atrapa(200, { promptFeedback: { blockReason: 'SAFETY' } }),
      ledger, now, apiKey: 'k', model: 'm', accessMode: 'api',
      baseUrl: 'https://przyklad.test/v1beta',
    })
    const answer = await provider.ask(PROMPT, 0)
    expect(answer.refusalReason).toBe('filtr bezpieczenstwa dostawcy')
    expect(answer.fetchError).toBeNull()
    expect(answer.text).toBe('')
  })

  it('nieznany powod blokady melduje sie doslownie zamiast milczec', async () => {
    const { ledger } = rejestr()
    const provider = createGeminiProvider({
      fetchFn: atrapa(200, { promptFeedback: { blockReason: 'COS_NOWEGO' } }),
      ledger, now, apiKey: 'k', model: 'm', accessMode: 'api',
      baseUrl: 'https://przyklad.test/v1beta',
    })
    expect((await provider.ask(PROMPT, 0)).refusalReason).toBe('zablokowane: COS_NOWEGO')
  })

  it('odpowiedz udzielona nie jest odmowa, choc ma finishReason', async () => {
    const { ledger } = rejestr()
    const provider = createGeminiProvider({
      fetchFn: atrapa(200, {
        candidates: [{ content: { parts: [{ text: 'Nie moge pomoc.' }] }, finishReason: 'STOP' }],
      }),
      ledger, now, apiKey: 'k', model: 'm', accessMode: 'api',
      baseUrl: 'https://przyklad.test/v1beta',
    })
    const answer = await provider.ask(PROMPT, 0)
    // Tresc brzmi jak odmowa, ale API mowi STOP. Zgadywanie z tresci zanizaloby
    // widocznosc bez sladu w danych — wiec swiadomie tego nie robimy.
    expect(answer.refusalReason).toBeNull()
    expect(answer.text).toBe('Nie moge pomoc.')
  })

  it('capability w rejestrze rozroznia tryb dostepu', async () => {
    const { ledger, entries } = rejestr()
    const provider = createGeminiProvider({
      fetchFn: atrapa(200, { candidates: [{ content: { parts: [{ text: 'x' }] } }] }),
      ledger, now, apiKey: 'k', model: 'gemini-2.5-flash', accessMode: 'api_grounded',
      baseUrl: 'https://przyklad.test/v1beta',
    })
    await provider.ask(PROMPT, 0)
    expect(entries[0]?.capability).toBe('llm.ask.gemini-2.5-flash.api_grounded')
  })
})

describe('dobor silnikow', () => {
  const shared = { fetchFn: atrapa(200, {}), ledger: { record: () => {} }, now }

  it('AC7: brak klucza pomija silnik i melduje to wprost', () => {
    const { engines, skipped } = selectEngines({ ...shared, env: { SEO_GROQ_KEY: 'k' } })
    expect(engines.map((e) => e.id)).toEqual(['groq'])
    expect(skipped.map((s) => s.id)).toEqual(['gemini', 'openrouter', 'anthropic'])
    expect(skipped[0]?.reason).toContain('SEO_GEMINI_KEY')
  })

  it('pusty klucz liczy sie jak brak klucza', () => {
    const { engines, skipped } = selectEngines({ ...shared, env: { SEO_GROQ_KEY: '' } })
    expect(engines).toHaveLength(0)
    expect(skipped).toHaveLength(4)
  })

  it('brak wszystkich kluczy nie wybucha — przebieg ma prawo byc pusty', () => {
    const { engines, skipped } = selectEngines({ ...shared, env: {} })
    expect(engines).toEqual([])
    expect(skipped.map((s) => s.id).sort())
      .toEqual(['anthropic', 'gemini', 'groq', 'openrouter'])
  })

  it('komplet darmowych kluczy daje trzy silniki, platny zostaje wylaczony', () => {
    const { engines, skipped } = selectEngines({
      ...shared,
      env: { SEO_GEMINI_KEY: 'a', SEO_GROQ_KEY: 'b', SEO_OPENROUTER_KEY: 'c' },
    })
    expect(engines.map((e) => e.id)).toEqual(['gemini', 'groq', 'openrouter'])
    expect(engines.map((e) => e.modelVersion)).toEqual([
      DEFAULT_MODELS.gemini, DEFAULT_MODELS.groq, DEFAULT_MODELS.openrouter,
    ])
    // Komplet darmowych kluczy to **pelny** zestaw domyslny. Anthropic zostaje
    // pominiety i to nie jest brak do uzupelnienia.
    expect(skipped.map((s) => s.id)).toEqual(['anthropic'])
  })

  it('platny silnik ma inny powod pominiecia niz darmowe', () => {
    const { skipped } = selectEngines({ ...shared, env: {} })
    const platny = skipped.find((s) => s.id === 'anthropic')
    const darmowy = skipped.find((s) => s.id === 'groq')
    expect(platny?.reason).toContain('platny')
    expect(platny?.reason).toContain('wylaczony domyslnie')
    // Darmowy silnik bez klucza to brak do uzupelnienia — platny nie.
    expect(darmowy?.reason).toContain('brak klucza')
    expect(darmowy?.reason).not.toContain('platny')
  })

  it('klucz Anthropic wlacza silnik i wybiera model domyslny', () => {
    const { engines, skipped } = selectEngines({ ...shared, env: { SEO_ANTHROPIC_KEY: 'k' } })
    expect(engines.map((e) => e.id)).toEqual(['anthropic'])
    expect(engines[0]?.modelVersion).toBe(DEFAULT_MODELS.anthropic)
    expect(engines[0]?.accessMode).toBe('api')
    expect(skipped.map((s) => s.id)).toEqual(['gemini', 'groq', 'openrouter'])
  })

  it('grounding nie dotyczy Anthropic — nie ma tam wyszukiwarki', () => {
    const { engines } = selectEngines({
      ...shared, accessMode: 'api_grounded', env: { SEO_ANTHROPIC_KEY: 'k' },
    })
    expect(engines[0]?.accessMode).toBe('api')
  })

  it('tryb groundingu dotyczy tylko gemini', () => {
    const { engines } = selectEngines({
      ...shared,
      accessMode: 'api_grounded',
      env: { SEO_GEMINI_KEY: 'a', SEO_GROQ_KEY: 'b' },
    })
    expect(engines.find((e) => e.id === 'gemini')?.accessMode).toBe('api_grounded')
    expect(engines.find((e) => e.id === 'groq')?.accessMode).toBe('api')
  })

  it('model da sie nadpisac, bo zmiana modelu to zmiana wersji pomiaru', () => {
    const { engines } = selectEngines({
      ...shared, env: { SEO_GROQ_KEY: 'b' }, models: { groq: 'inny-model' },
    })
    expect(engines[0]?.modelVersion).toBe('inny-model')
  })
})
