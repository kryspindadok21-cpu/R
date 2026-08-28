import { describe, expect, it } from 'vitest'
import type { ProviderCallEntry } from '../ledger.js'
import { PSI_BACKOFF_BASE_MS, createPsiProvider } from './provider.js'

/**
 * Testy na atrapie `fetch` i fixturze odpowiedzi — bez sieci (AC11).
 * Prawdziwe wywolanie PSI to `seo psi` uruchomione recznie przez wlasciciela.
 */

const ODPOWIEDZ = {
  loadingExperience: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2400 },
      INTERACTION_TO_NEXT_PAINT: { percentile: 180 },
      CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12 },
      EXPERIMENTAL_TIME_TO_FIRST_BYTE: { percentile: 620 },
    },
  },
  lighthouseResult: {
    categories: { performance: { score: 0.78 } },
    audits: {
      'largest-contentful-paint': { numericValue: 2100.5 },
      'cumulative-layout-shift': { numericValue: 0.09 },
      'server-response-time': { numericValue: 410 },
    },
  },
}

function stub(responses: readonly { status: number; body?: unknown }[]) {
  const entries: ProviderCallEntry[] = []
  const calls: string[] = []
  const sleeps: number[] = []
  let index = 0

  const provider = createPsiProvider({
    fetchFn: (async (url: string) => {
      calls.push(String(url))
      const next = responses[Math.min(index, responses.length - 1)]
      index += 1
      return {
        ok: next!.status >= 200 && next!.status < 300,
        status: next!.status,
        json: async () => next!.body ?? {},
      } as unknown as Response
    }) as unknown as typeof globalThis.fetch,
    ledger: { record: (e) => { entries.push(e) } },
    now: () => 1_000_000,
    sleep: async (ms) => { sleeps.push(ms) },
  })

  return { provider, entries, calls, sleeps }
}

describe('createPsiProvider', () => {
  it('rozdziela dane terenowe od laboratoryjnych', async () => {
    const { provider } = stub([{ status: 200, body: ODPOWIEDZ }])
    const result = await provider.measure('https://przyklad.test/', 'mobile')

    expect(result.metrics.map((m) => m.source)).toEqual(['field', 'lab'])
    expect(result.error).toBeNull()
  })

  it('przelicza CLS z zapisu CrUX na wartość rzeczywistą', async () => {
    const { provider } = stub([{ status: 200, body: ODPOWIEDZ }])
    const result = await provider.measure('https://przyklad.test/', 'mobile')
    const field = result.metrics.find((m) => m.source === 'field')

    expect(field?.cls).toBeCloseTo(0.12)
    expect(field?.lcpMs).toBe(2400)
    expect(field?.inpMs).toBe(180)
  })

  it('nie zmyśla INP w danych laboratoryjnych — Lighthouse go nie mierzy', async () => {
    const { provider } = stub([{ status: 200, body: ODPOWIEDZ }])
    const result = await provider.measure('https://przyklad.test/', 'mobile')
    const lab = result.metrics.find((m) => m.source === 'lab')

    expect(lab?.inpMs).toBeNull()
    expect(lab?.lcpMs).toBe(2100.5)
    expect(lab?.performanceScore).toBe(0.78)
  })

  it('strona bez ruchu ma tylko dane laboratoryjne', async () => {
    const { provider } = stub([{ status: 200, body: { lighthouseResult: ODPOWIEDZ.lighthouseResult } }])
    const result = await provider.measure('https://przyklad.test/', 'mobile')

    expect(result.metrics.map((m) => m.source)).toEqual(['lab'])
  })

  it('przekazuje strategię i klucz w adresie', async () => {
    const entries: ProviderCallEntry[] = []
    const calls: string[] = []
    const provider = createPsiProvider({
      fetchFn: (async (url: string) => {
        calls.push(String(url))
        return { ok: true, status: 200, json: async () => ODPOWIEDZ } as unknown as Response
      }) as unknown as typeof globalThis.fetch,
      ledger: { record: (e) => { entries.push(e) } },
      now: () => 1,
      sleep: async () => {},
      apiKey: 'tajny-klucz',
    })
    await provider.measure('https://przyklad.test/', 'desktop')

    expect(calls[0]).toContain('strategy=desktop')
    expect(calls[0]).toContain('key=tajny-klucz')
  })

  it('ponawia po odmowie z powodu limitu, czekając coraz dłużej', async () => {
    const { provider, sleeps } = stub([
      { status: 429 }, { status: 429 }, { status: 200, body: ODPOWIEDZ },
    ])
    const result = await provider.measure('https://przyklad.test/', 'mobile')

    expect(sleeps).toEqual([PSI_BACKOFF_BASE_MS, PSI_BACKOFF_BASE_MS * 2])
    expect(result.error).toBeNull()
  })

  it('poddaje się po wyczerpaniu prób i mówi dlaczego', async () => {
    const { provider, sleeps } = stub([{ status: 429 }])
    const result = await provider.measure('https://przyklad.test/', 'mobile')

    expect(result.metrics).toEqual([])
    expect(result.error).toContain('429')
    expect(sleeps).toHaveLength(3)
  })

  it('nie ponawia po błędzie, który się nie naprawi', async () => {
    const { provider, sleeps } = stub([{ status: 400 }])
    const result = await provider.measure('https://przyklad.test/', 'mobile')

    expect(sleeps).toEqual([])
    expect(result.error).toContain('400')
  })

  it('zapisuje każde wywołanie w rejestrze, także odmowę', async () => {
    const { provider, entries } = stub([{ status: 429 }, { status: 200, body: ODPOWIEDZ }])
    await provider.measure('https://przyklad.test/', 'mobile')

    expect(entries).toHaveLength(2)
    expect(entries[0]?.ok).toBe(false)
    expect(entries[0]?.httpStatus).toBe(429)
    expect(entries[1]?.ok).toBe(true)
    expect(entries.every((e) => e.costMicros === 0)).toBe(true)
    expect(entries.every((e) => e.capability === 'psi.mobile')).toBe(true)
  })

  it('awaria sieci wraca jako wynik z błędem, nie jako wyjątek', async () => {
    const entries: ProviderCallEntry[] = []
    const provider = createPsiProvider({
      fetchFn: (async () => { throw new Error('sieć padła') }) as unknown as typeof globalThis.fetch,
      ledger: { record: (e) => { entries.push(e) } },
      now: () => 1,
      sleep: async () => {},
    })
    const result = await provider.measure('https://przyklad.test/', 'mobile')

    expect(result.error).toContain('sieć padła')
    expect(entries[0]?.ok).toBe(false)
  })
})
