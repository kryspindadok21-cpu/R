import { createServer, type Server } from 'node:http'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import { createGscProvider } from '@seo/providers'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { runReport } from './commands/report.js'
import { runSync } from './commands/sync.js'
import { runVerify } from './commands/verify.js'
import { dbLedger } from './ledger.js'

/**
 * Przejscie calej sciezki przez prawdziwy fetch i prawdziwy serwer HTTP na
 * petli zwrotnej. Testy jednostkowe podmieniaja fetch, wiec same nie dowodza,
 * ze naglowki, kodowanie siteUrl i cialo zadania faktycznie skladaja sie w
 * poprawne wywolanie. Serwer stoi na 127.0.0.1 — to nie jest wyjscie do sieci.
 */

const SCOPE = tenantScope('local')
const SITE = 'sc-domain:przyklad.pl'

const DATE_ROWS = [
  { keys: ['2026-05-01'], clicks: 100, impressions: 1000, ctr: 0.1, position: 5.1 },
  { keys: ['2026-05-02'], clicks: 80, impressions: 900, ctr: 0.089, position: 5.4 },
]
const QUERY_ROWS = [
  { keys: ['2026-05-01', 'buty trekkingowe'], clicks: 60, impressions: 600, ctr: 0.1, position: 4.2 },
  { keys: ['2026-05-02', 'buty trekkingowe'], clicks: 50, impressions: 500, ctr: 0.1, position: 4.4 },
]

let server: Server
let baseUrl: string
const requests: { url: string; auth: string | undefined; body: Record<string, unknown> }[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      const body = JSON.parse(raw) as Record<string, unknown>
      requests.push({ url: req.url ?? '', auth: req.headers.authorization, body })
      const dimensions = body.dimensions as string[]
      const first = (body.startRow as number) === 0
      const rows = !first ? [] : dimensions.includes('query') ? QUERY_ROWS : DATE_ROWS
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(rows.length === 0 ? {} : { rows }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/sites`
})

afterAll(async () => { await new Promise((resolve) => server.close(resolve)) })

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function freshDb() {
  const db = openDatabase(':memory:')
  migrate(db)
  repos(db, SCOPE).write.ensureTenant('local')
  return db
}

describe('przejscie od API do raportu', () => {
  it('pobiera przez prawdziwy fetch, uzgadnia i buduje raport', async () => {
    dir = mkdtempSync(join(tmpdir(), 'e2e-'))
    const db = freshDb()
    const provider = createGscProvider({
      getAccessToken: async () => 'token-testowy',
      fetchFn: globalThis.fetch,
      ledger: dbLedger(db, SCOPE),
      now: () => Date.now(),
      baseUrl,
    })

    const result = await runSync({ db, scope: SCOPE, provider }, {
      siteUrl: SITE, from: '2026-05-01', to: '2026-05-02', pageSize: 2,
    })
    expect(result.dailyRows).toBe(2)
    expect(result.queryRows).toBe(2)

    // Zadanie doszlo z tokenem i z siteUrl zakodowanym procentowo.
    expect(requests[0]!.auth).toBe('Bearer token-testowy')
    expect(requests[0]!.url).toContain(encodeURIComponent(SITE))
    expect(requests[0]!.body).toMatchObject({ startDate: '2026-05-01', dataState: 'final' })

    // Daty przepisane doslownie, nie przepuszczone przez Date.
    const verified = runVerify(db, SCOPE, SITE, '2026-05-01')
    expect(verified).toMatchObject({
      date: '2026-05-01', clicksInDatabase: 100, querySumClicks: 60, anonymizedDeltaClicks: 40,
    })

    const out = join(dir, 'raport.html')
    runReport(db, SCOPE, {
      siteUrl: SITE, from: '2026-05-01', to: '2026-05-02', outPath: out, generatedAt: 'teraz',
    })
    const html = readFileSync(out, 'utf8')
    expect(html).toContain('buty trekkingowe')
    expect(html).toContain('2026-05-01')
    expect(html).not.toMatch(/(?:src|href)\s*=\s*["'](?:https?:)?\/\//i)

    // Kazde wyjscie na zewnatrz zapisane w rejestrze wywolan.
    const calls = repos(db, SCOPE).read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)
    expect(calls.reduce((a, c) => a + c.calls, 0)).toBe(requests.length)
    expect(calls.every((c) => c.failures === 0)).toBe(true)
  })

  it('drugi przebieg nie tworzy duplikatow ani nie zmienia liczb', async () => {
    const db = freshDb()
    const make = () => createGscProvider({
      getAccessToken: async () => 'token-testowy',
      fetchFn: globalThis.fetch,
      ledger: dbLedger(db, SCOPE),
      now: () => Date.now(),
      baseUrl,
    })
    const opts = { siteUrl: SITE, from: '2026-05-01', to: '2026-05-02', pageSize: 2 }
    await runSync({ db, scope: SCOPE, provider: make() }, opts)
    await runSync({ db, scope: SCOPE, provider: make() }, opts)

    const site = repos(db, SCOPE).read.findSiteByUri(SITE)!
    expect(repos(db, SCOPE).read.listDailyRange(site.id, '2026-05-01', '2026-05-02')).toHaveLength(2)
    expect(runVerify(db, SCOPE, SITE, '2026-05-01').clicksInDatabase).toBe(100)
  })
})
