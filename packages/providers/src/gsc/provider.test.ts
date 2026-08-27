import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { NULL_LEDGER, ProviderHttpError, type ProviderCallEntry } from '../ledger.js'
import type { PerformanceQuery } from '../types.js'
import { GSC_SOURCE_TIMEZONE, createGscProvider } from './provider.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'fixtures', 'gsc')
const fixture = (name: string) => JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'))

function fakeFetch(bodies: unknown[], status = 200) {
  const calls: { url: string; body: unknown; auth: string | null }[] = []
  let i = 0
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)), auth: headers.get('authorization') })
    const body = bodies[Math.min(i++, bodies.length - 1)]
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof globalThis.fetch
  return { fetchFn, calls }
}

const QUERY: PerformanceQuery = {
  siteUrl: 'sc-domain:example.pl',
  startDate: '2026-03-10',
  endDate: '2026-03-11',
  dimensions: ['date'],
  dataState: 'final',
  rowLimit: 25000,
  startRow: 0,
}

describe('adapter GSC', () => {
  it('przepisuje date doslownie, bez konwersji (AC5)', async () => {
    const { fetchFn } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    const result = await p.queryPerformance(QUERY)
    expect(result.rows[0]!.keys[0]).toBe('2026-03-10')
    expect(result.rows[1]!.keys[0]).toBe('2026-03-11')
    expect(result.sourceTimezone).toBe(GSC_SOURCE_TIMEZONE)
  })

  it('wysyla token i poprawne cialo zadania', async () => {
    const { fetchFn, calls } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    await p.queryPerformance(QUERY)
    expect(calls[0]!.auth).toBe('Bearer tok')
    expect(calls[0]!.url).toContain(encodeURIComponent('sc-domain:example.pl'))
    expect(calls[0]!.body).toMatchObject({
      startDate: '2026-03-10', endDate: '2026-03-11',
      dimensions: ['date'], dataState: 'final', rowLimit: 25000, startRow: 0,
    })
  })

  it('zwraca pusta liste, gdy API pomija klucz rows', async () => {
    const { fetchFn } = fakeFetch([fixture('empty.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    expect((await p.queryPerformance(QUERY)).rows).toEqual([])
  })

  it('odczytuje oba wymiary przy dimensions [date, query]', async () => {
    const { fetchFn } = fakeFetch([fixture('by-query-page1.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    const r = await p.queryPerformance({ ...QUERY, dimensions: ['date', 'query'] })
    expect(r.rows[0]!.keys).toEqual(['2026-03-10', 'buty trekkingowe'])
  })

  it('zapisuje wywolanie w rejestrze', async () => {
    const entries: ProviderCallEntry[] = []
    const { fetchFn } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({
      getAccessToken: async () => 'tok', fetchFn,
      ledger: { record: (e) => entries.push(e) }, now: () => 5,
    })
    await p.queryPerformance(QUERY)
    expect(entries[0]).toMatchObject({
      providerId: 'gsc', capability: 'performance.byDate', ok: true, httpStatus: 200, costMicros: 0,
    })
  })

  it('zamienia blad HTTP na ProviderHttpError i rejestruje go', async () => {
    const entries: ProviderCallEntry[] = []
    const { fetchFn } = fakeFetch([{ error: { message: 'brak dostepu' } }], 403)
    const p = createGscProvider({
      getAccessToken: async () => 'tok', fetchFn,
      ledger: { record: (e) => entries.push(e) }, now: () => 0,
    })
    await expect(p.queryPerformance(QUERY)).rejects.toThrow(ProviderHttpError)
    expect(entries[0]).toMatchObject({ ok: false, httpStatus: 403 })
  })

  it('odrzuca rowLimit ponad maksimum', async () => {
    const { fetchFn } = fakeFetch([fixture('by-date.json')])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    await expect(p.queryPerformance({ ...QUERY, rowLimit: 1_000_000 })).rejects.toThrow(/rowLimit/)
  })

  it('estimateQuota liczy jedna jednostke na zapytanie', () => {
    const { fetchFn } = fakeFetch([])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    expect(p.estimateQuota([QUERY, QUERY, QUERY])).toBe(3)
  })

  it('capability odroznia zapytanie po haslach od zapytania po dacie', async () => {
    const entries: ProviderCallEntry[] = []
    const { fetchFn } = fakeFetch([fixture('by-query-page1.json')])
    const p = createGscProvider({
      getAccessToken: async () => 'tok', fetchFn,
      ledger: { record: (e) => entries.push(e) }, now: () => 0,
    })
    await p.queryPerformance({ ...QUERY, dimensions: ['date', 'query'] })
    expect(entries[0]!.capability).toBe('performance.byQuery')
  })

  it('odcisk zadania rozroznia strony wynikow', async () => {
    const entries: ProviderCallEntry[] = []
    const { fetchFn } = fakeFetch([fixture('by-query-page1.json'), fixture('by-query-page2.json')])
    const p = createGscProvider({
      getAccessToken: async () => 'tok', fetchFn,
      ledger: { record: (e) => entries.push(e) }, now: () => 0,
    })
    await p.queryPerformance(QUERY)
    await p.queryPerformance({ ...QUERY, startRow: 25000 })
    expect(entries[0]!.requestFingerprint).not.toBe(entries[1]!.requestFingerprint)
  })

  it('odrzuca odpowiedz o nieoczekiwanym ksztalcie', async () => {
    const { fetchFn } = fakeFetch([{ rows: [{ keys: ['2026-03-10'], clicks: 'duzo' }] }])
    const p = createGscProvider({ getAccessToken: async () => 'tok', fetchFn, ledger: NULL_LEDGER, now: () => 0 })
    await expect(p.queryPerformance(QUERY)).rejects.toThrow()
  })
})
