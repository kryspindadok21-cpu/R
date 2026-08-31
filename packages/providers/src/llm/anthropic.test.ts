import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { ProviderCallEntry } from '../ledger.js'
import { ANTHROPIC_MAX_TOKENS, createAnthropicProvider } from './anthropic.js'
import type { EnginePrompt } from './types.js'

/**
 * Adapter idzie przez oficjalny SDK, wiec zadania sklada nie nasz kod, tylko
 * biblioteka. Atrapa `fetch` dowiodlaby tylko, ze nasz kod woła SDK — a nie,
 * ze SDK wysyla to, co myslimy. Stad prawdziwy serwer na petli zwrotnej.
 */

const PROMPT: EnginePrompt = { promptId: 'p1', text: 'Jakie narzedzie do GEO?', locale: 'pl' }

let server: Server
let baseUrl: string
let odpowiedz: { status: number; body: unknown }
const zadania: {
  url: string
  apiKey: string | undefined
  beta: string | undefined
  body: Record<string, unknown>
}[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      zadania.push({
        url: req.url ?? '',
        apiKey: req.headers['x-api-key'] as string | undefined,
        beta: req.headers['anthropic-beta'] as string | undefined,
        body: JSON.parse(raw || '{}') as Record<string, unknown>,
      })
      res.writeHead(odpowiedz.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(odpowiedz.body))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => { await new Promise((resolve) => server.close(resolve)) })

function rejestr() {
  const entries: ProviderCallEntry[] = []
  return { ledger: { record: (e: ProviderCallEntry) => { entries.push(e) } }, entries }
}

let zegar = 0
const now = () => (zegar += 10)

function wiadomosc(pola: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5',
    content: [{ type: 'text', text: 'Polecam Mentiometry.' }],
    stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...pola,
  }
}

function silnik(ledger: { record: (e: ProviderCallEntry) => void }) {
  return createAnthropicProvider({
    fetchFn: globalThis.fetch, ledger, now,
    apiKey: 'klucz-testowy', model: 'claude-opus-5', baseUrl,
  })
}

beforeEach(() => {
  zadania.length = 0
  odpowiedz = { status: 200, body: wiadomosc({}) }
})

describe('adapter anthropic', () => {
  it('sklada tresc z blokow tekstowych', async () => {
    const { ledger } = rejestr()
    odpowiedz = {
      status: 200,
      body: wiadomosc({ content: [{ type: 'text', text: 'Polecam ' }, { type: 'text', text: 'Mentiometry.' }] }),
    }
    const answer = await silnik(ledger).ask(PROMPT, 0)
    expect(answer.text).toBe('Polecam Mentiometry.')
    expect(answer.refusalReason).toBeNull()
    expect(answer.fetchError).toBeNull()
    expect(answer.groundingUris).toEqual([])
  })

  it('wysyla klucz w naglowku i prompt w tresci zadania', async () => {
    const { ledger } = rejestr()
    await silnik(ledger).ask(PROMPT, 0)
    const zadanie = zadania[0]
    expect(zadanie?.apiKey).toBe('klucz-testowy')
    expect(zadanie?.body.model).toBe('claude-opus-5')
    expect(zadanie?.body.max_tokens).toBe(ANTHROPIC_MAX_TOKENS)
    expect(zadanie?.body.messages).toEqual([{ role: 'user', content: PROMPT.text }])
  })

  it('wlacza zapasowy model na wypadek odmowy klasyfikatora', async () => {
    const { ledger } = rejestr()
    await silnik(ledger).ask(PROMPT, 0)
    expect(zadania[0]?.beta).toContain('server-side-fallback')
    expect(zadania[0]?.body.fallbacks).toBe('default')
  })

  it('nie wysyla ustawien myslenia — na tym modelu jest domyslnie wlaczone', async () => {
    const { ledger } = rejestr()
    await silnik(ledger).ask(PROMPT, 0)
    expect(zadania[0]?.body).not.toHaveProperty('thinking')
    expect(zadania[0]?.body).not.toHaveProperty('budget_tokens')
  })

  it('odmowa klasyfikatora jest danymi z kategoria, nie bledem', async () => {
    const { ledger } = rejestr()
    odpowiedz = {
      status: 200,
      body: wiadomosc({
        content: [], stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'powod' },
      }),
    }
    const answer = await silnik(ledger).ask(PROMPT, 0)
    expect(answer.refusalReason).toBe('odmowa klasyfikatora (cyber)')
    expect(answer.fetchError).toBeNull()
    expect(answer.text).toBe('')
  })

  it('odmowa bez kategorii nie gubi informacji, ze byla odmowa', async () => {
    const { ledger } = rejestr()
    odpowiedz = { status: 200, body: wiadomosc({ content: [], stop_reason: 'refusal' }) }
    expect((await silnik(ledger).ask(PROMPT, 0)).refusalReason)
      .toBe('odmowa klasyfikatora (nieznana)')
  })

  it('AC8: kazde wywolanie ma wiersz w rejestrze', async () => {
    const { ledger, entries } = rejestr()
    const provider = silnik(ledger)
    await provider.ask(PROMPT, 0)
    await provider.ask(PROMPT, 1)
    expect(entries).toHaveLength(2)
    expect(entries[0]?.providerId).toBe('anthropic')
    expect(entries[0]?.capability).toBe('llm.ask.claude-opus-5')
    expect(entries.map((e) => e.requestFingerprint)).toEqual(['p1|0', 'p1|1'])
  })

  it('blad HTTP wraca jako dane i ma wiersz w rejestrze', async () => {
    const { ledger, entries } = rejestr()
    odpowiedz = { status: 429, body: { type: 'error', error: { type: 'rate_limit_error', message: 'za duzo' } } }
    const answer = await silnik(ledger).ask(PROMPT, 0)
    expect(answer.fetchError).toContain('429')
    expect(answer.text).toBe('')
    expect(entries[0]?.ok).toBe(false)
    expect(entries[0]?.httpStatus).toBe(429)
  })

  it('nie ponawia po cichu — jeden wiersz w rejestrze to jedno zadanie', async () => {
    const { ledger, entries } = rejestr()
    odpowiedz = { status: 500, body: { type: 'error', error: { type: 'api_error', message: 'awaria' } } }
    await silnik(ledger).ask(PROMPT, 0)
    // SDK domyslnie ponawia dwa razy przy 5xx. Wylaczylismy to swiadomie:
    // ciche ponowienie zaklamywaloby zuzyty limit w rejestrze.
    expect(zadania).toHaveLength(1)
    expect(entries).toHaveLength(1)
  })
})
