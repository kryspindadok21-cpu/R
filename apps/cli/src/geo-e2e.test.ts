import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { crawlRepos, geoRepos, migrate, openDatabase, repos, type Db } from '@seo/db'
import { createGeminiProvider, createOpenAiCompatibleProvider } from '@seo/providers'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildGeoReport, runGeoEntity, runGeoPrompts, runGeoReport, runGeoRun } from './commands/geo.js'
import { dbLedger } from './ledger.js'

/**
 * Odbior Fazy 2: cala sciezka przez **prawdziwy** `fetch` i prawdziwy serwer HTTP
 * na petli zwrotnej. Testy jednostkowe podmieniaja `fetch`, wiec same nie dowodza,
 * ze naglowki, cialo zadania i odczyt odpowiedzi skladaja sie w poprawne wywolanie.
 * Serwer stoi na 127.0.0.1 — to nie jest wyjscie do sieci.
 *
 * Czego ten test **nie** dowodzi: ze prawdziwe API Gemini, Groq i OpenRouter
 * odpowiadaja tak, jak zakladaja schematy. Do tego trzeba klucza, a klucza w CI
 * nie ma i miec nie bedzie.
 */

const SCOPE = tenantScope('local')
const SITE = 'https://przyklad.test/'

let server: Server
let baseUrl: string
const zadania: { url: string; auth: string | undefined; apiKey: string | undefined; body: Record<string, unknown> }[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const body = JSON.parse(raw) as Record<string, unknown>
      zadania.push({
        url: req.url ?? '',
        auth: req.headers.authorization,
        apiKey: req.headers['x-goog-api-key'] as string | undefined,
        body,
      })

      const tresc = 'Do audytu polecam Mentiometry — szczegoly na '
        + 'https://przyklad.test/o-projekcie. Alternatywa jest Semrush.'

      if ((req.url ?? '').includes(':generateContent')) {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          candidates: [{
            content: { parts: [{ text: tresc }] },
            groundingMetadata: {
              groundingChunks: [{ web: { uri: 'https://przyklad.test/blog/geo' } }],
            },
          }],
        }))
        return
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ choices: [{ message: { content: tresc } }] }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => { await new Promise((resolve) => server.close(resolve)) })

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function przygotowanaBaza(): Db {
  const db = openDatabase(':memory:')
  migrate(db)
  repos(db, SCOPE).write.ensureTenant('local')
  repos(db, SCOPE).write.upsertSite('url_prefix', SITE)

  runGeoPrompts(db, SCOPE, {
    siteUrl: SITE,
    add: ['Jakie darmowe narzedzie do audytu SEO?', 'Czym jest GEO?'],
  })
  runGeoEntity(db, SCOPE, {
    siteUrl: SITE, name: 'Mentiometry', variants: ['Mentiometrym'],
    exclusions: [], isOwn: true,
  })
  runGeoEntity(db, SCOPE, {
    siteUrl: SITE, name: 'Semrush', variants: [], exclusions: [], isOwn: false,
  })
  return db
}

describe('odbior Fazy 2 — od zapytania do raportu', () => {
  it('przechodzi cala sciezke przez prawdziwy HTTP i sklada raport', async () => {
    dir = mkdtempSync(join(tmpdir(), 'geo-e2e-'))
    const db = przygotowanaBaza()
    const ledger = dbLedger(db, SCOPE)

    const gemini = createGeminiProvider({
      fetchFn: globalThis.fetch, ledger, now: () => Date.now(),
      apiKey: 'klucz-gemini', model: 'gemini-2.5-flash',
      accessMode: 'api_grounded', baseUrl,
    })
    const groq = createOpenAiCompatibleProvider('groq', {
      fetchFn: globalThis.fetch, ledger, now: () => Date.now(),
      apiKey: 'klucz-groq', model: 'llama-test', baseUrl,
    })

    const wynik = await runGeoRun(db, SCOPE, [gemini, groq], [
      { id: 'openrouter', reason: 'brak klucza — ustaw SEO_OPENROUTER_KEY' },
    ], { siteUrl: SITE, runsPerPrompt: 2 })

    // 2 prompty x 2 przebiegi x 2 silniki
    expect(zadania).toHaveLength(8)
    expect(zadania.some((z) => z.apiKey === 'klucz-gemini')).toBe(true)
    expect(zadania.some((z) => z.auth === 'Bearer klucz-groq')).toBe(true)
    expect(wynik.outcomes).toHaveLength(2)
    expect(wynik.skipped).toHaveLength(1)

    // Marka wystepuje w kazdej odpowiedzi — widocznosc pelna, przedzial waski,
    // ale nie zerowy, bo cztery proby to nadal cztery proby.
    for (const outcome of wynik.outcomes) {
      expect(outcome.answersOk).toBe(4)
      expect(outcome.answersFailed).toBe(0)
      expect(outcome.visibility.rate).toBe(1)
      expect(outcome.visibility.interval.low).toBeLessThan(1)
    }

    // AC8: kazde wywolanie silnika ma wiersz w rejestrze.
    const rejestr = repos(db, SCOPE).read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)
    const geoWiersze = rejestr.filter((r) => r.providerId === 'gemini' || r.providerId === 'groq')
    expect(geoWiersze.reduce((sum, r) => sum + r.calls, 0)).toBe(8)

    // D32: cytowanie z groundingu i z tresci nie zlewaja sie w jedno.
    const g = geoRepos(db, SCOPE)
    const geminiRun = wynik.outcomes.find((o) => o.engine === 'gemini')!.runId
    const groqRun = wynik.outcomes.find((o) => o.engine === 'groq')!.runId
    expect(g.read.listCitations(geminiRun, 'grounding')).toHaveLength(4)
    expect(g.read.listCitations(geminiRun, 'inline')).toHaveLength(4)
    // Groq groundingu nie ma — zero jest poprawnym wynikiem, nie brakiem danych.
    expect(g.read.listCitations(groqRun, 'grounding')).toHaveLength(0)
    expect(g.read.listCitations(groqRun, 'inline')).toHaveLength(4)

    const dane = buildGeoReport(db, SCOPE, SITE)
    expect(dane.engines).toHaveLength(2)
    expect(dane.voice.map((v) => v.name).sort()).toEqual(['Mentiometry', 'Semrush'])
    expect(dane.voice.find((v) => v.isOwn)?.answersWithMention).toBe(8)
    expect(dane.comparisons).toEqual([])

    const out = join(dir, 'raport-geo.html')
    runGeoReport(db, SCOPE, { siteUrl: SITE, outPath: out })
    const html = readFileSync(out, 'utf8')
    expect(html).toContain('Widoczność w AI')
    expect(html).toContain('Mentiometry')
    // Raport nie pobiera niczego z sieci — twarde ograniczenie z Fazy 0.
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)
    // D18: nadal zero oceny zbiorczej.
    expect(html).toContain('nie podaje oceny w skali 0–100')

    crawlRepos(db, SCOPE) // warstwy Fazy 1 i 2 dziela te sama baze bez kolizji
  })
})
