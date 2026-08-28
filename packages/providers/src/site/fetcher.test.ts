import { createServer, type Server } from 'node:http'
import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ProviderCallEntry } from '../ledger.js'
import { createSiteFetchProvider } from './fetcher.js'
import { fetchRobots } from './robots.js'
import type { SiteFetchOptions } from './types.js'

/**
 * Testy chodza po prawdziwym `fetch` i prawdziwym serwerze na petli zwrotnej.
 * To jedyny sposob, zeby sprawdzic obsluge przekierowan, limitu rozmiaru
 * i timeoutu — atrapa `fetch` sprawdzalaby atrape. Sieci zewnetrznej nie ma (AC11).
 */

let server: Server
let base: string

const BIG = 'x'.repeat(200_000)

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = request.url ?? '/'

    if (url === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', etag: '"abc"' })
      response.end('<html><head><title>Start</title></head><body><h1>Start</h1></body></html>')
      return
    }
    if (url === '/skok1') { response.writeHead(301, { location: '/skok2' }); response.end(); return }
    if (url === '/skok2') { response.writeHead(302, { location: '/koniec' }); response.end(); return }
    if (url === '/koniec') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<html><head><title>Koniec</title></head><body>ok</body></html>')
      return
    }
    if (url === '/petla') { response.writeHead(301, { location: '/petla' }); response.end(); return }
    if (url === '/wielki') {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(BIG)
      return
    }
    if (url === '/wolno') {
      setTimeout(() => {
        response.writeHead(200, { 'content-type': 'text/html' })
        response.end('spoznione')
      }, 3000)
      return
    }
    if (url === '/warunkowe') {
      if (request.headers['if-none-match'] === '"abc"') { response.writeHead(304); response.end(); return }
      response.writeHead(200, { 'content-type': 'text/html', etag: '"abc"' })
      response.end('<html><head><title>Warunkowe</title></head><body>tresc</body></html>')
      return
    }
    if (url === '/mapa.xml.gz') {
      response.writeHead(200, { 'content-type': 'application/gzip' })
      response.end(gzipSync(Buffer.from('<urlset><url><loc>https://a.test/</loc></url></urlset>')))
      return
    }
    if (url === '/robots.txt') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end('User-agent: *\nDisallow: /panel\nSitemap: https://a.test/sitemap.xml\n')
      return
    }
    if (url === '/robots-awaria.txt') { response.writeHead(503); response.end('awaria'); return }
    if (url === '/robots-brak.txt') { response.writeHead(404); response.end('nie ma'); return }
    if (url === '/echo-agent') {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end(String(request.headers['user-agent'] ?? ''))
      return
    }
    if (url === '/serwer-padl') { response.writeHead(500); response.end('blad'); return }

    response.writeHead(404, { 'content-type': 'text/html' })
    response.end('<html><head><title>404</title></head><body>Nie ma</body></html>')
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('serwer nie wystartował')
  base = `http://127.0.0.1:${address.port}`
})

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

function options(overrides: Partial<SiteFetchOptions> = {}): SiteFetchOptions {
  return {
    timeoutMs: 5000,
    maxBytes: 100_000,
    maxRedirects: 5,
    userAgent: 'mentiometry-crawler/0.1 (+test)',
    ...overrides,
  }
}

function providerWithLedger() {
  const entries: ProviderCallEntry[] = []
  const provider = createSiteFetchProvider({
    fetchFn: globalThis.fetch,
    ledger: { record: (entry) => { entries.push(entry) } },
    now: () => Date.now(),
  })
  return { provider, entries }
}

describe('createSiteFetchProvider — pobranie zwykłe', () => {
  it('pobiera stronę razem z nagłówkami', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/`, options())

    expect(response.status).toBe(200)
    expect(response.body).toContain('<title>Start</title>')
    expect(response.contentType).toContain('text/html')
    expect(response.etag).toBe('"abc"')
    expect(response.bytes).toBeGreaterThan(0)
  })

  it('przedstawia się podanym agentem', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/echo-agent`, options())
    expect(response.body).toBe('mentiometry-crawler/0.1 (+test)')
  })

  it('status 404 to odpowiedź, nie błąd', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/nie-ma`, options())
    expect(response.status).toBe(404)
    expect(response.error).toBeNull()
  })
})

describe('createSiteFetchProvider — przekierowania', () => {
  it('idzie za łańcuchem i zapisuje adresy pośrednie', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/skok1`, options())

    expect(response.status).toBe(200)
    expect(response.url).toBe(`${base}/koniec`)
    expect(response.requestedUrl).toBe(`${base}/skok1`)
    expect(response.redirectChain).toEqual([`${base}/skok1`, `${base}/skok2`])
    expect(response.httpRequests).toBe(3)
  })

  it('zatrzymuje się na limicie przekierowań zamiast kręcić się w pętli', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/petla`, options({ maxRedirects: 3 }))

    expect(response.redirectChain).toHaveLength(3)
    expect(response.error).toContain('limit przekierowan')
  })
})

describe('createSiteFetchProvider — bezpieczniki', () => {
  it('przerywa odpowiedź przekraczającą limit rozmiaru', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/wielki`, options({ maxBytes: 1000 }))

    expect(response.status).toBeNull()
    expect(response.truncated).toBe(true)
    expect(response.error).toContain('limit 1000')
  })

  it('mieści się w limicie, gdy odpowiedź jest mniejsza', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/wielki`, options({ maxBytes: 500_000 }))
    expect(response.status).toBe(200)
  })

  it('przerywa po przekroczeniu czasu i zwraca to jako dane', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/wolno`, options({ timeoutMs: 300 }))

    expect(response.status).toBeNull()
    expect(response.error).toContain('Przekroczony czas')
  })

  it('błąd sieci nie rzuca wyjątkiem, tylko wraca jako strona bez statusu', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage('http://127.0.0.1:1/nic', options({ timeoutMs: 1000 }))
    expect(response.status).toBeNull()
    expect(response.error).not.toBeNull()
  })
})

describe('createSiteFetchProvider — warunkowe GET i gzip', () => {
  it('odpowiedź 304 wraca bez ciała i bez błędu', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/warunkowe`, options({ ifNoneMatch: '"abc"' }))

    expect(response.status).toBe(304)
    expect(response.body).toBeNull()
    expect(response.error).toBeNull()
  })

  it('bez nagłówka warunkowego dostajemy pełną treść', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchPage(`${base}/warunkowe`, options())
    expect(response.status).toBe(200)
    expect(response.body).toContain('tresc')
  })

  it('rozpakowuje mapę witryny spakowaną gzipem', async () => {
    const { provider } = providerWithLedger()
    const response = await provider.fetchText(`${base}/mapa.xml.gz`, 'crawl:sitemap', options())
    expect(response.body).toContain('<loc>https://a.test/</loc>')
  })
})

describe('rejestr wywołań', () => {
  it('zapisuje wiersz dla każdego pobrania (AC5)', async () => {
    const { provider, entries } = providerWithLedger()
    await provider.fetchPage(`${base}/`, options())
    await provider.fetchPage(`${base}/nie-ma`, options())

    expect(entries).toHaveLength(2)
    expect(entries.map((e) => e.providerId)).toEqual(['site', 'site'])
    expect(entries.map((e) => e.capability)).toEqual(['crawl:fetch', 'crawl:fetch'])
    expect(entries.map((e) => e.httpStatus)).toEqual([200, 404])
  })

  it('zapisuje także wywołanie nieudane', async () => {
    const { provider, entries } = providerWithLedger()
    await provider.fetchPage(`${base}/wolno`, options({ timeoutMs: 300 }))

    expect(entries).toHaveLength(1)
    expect(entries[0]?.ok).toBe(false)
    expect(entries[0]?.errorCode).toContain('Przekroczony czas')
  })

  it('404 i 500 są zapisane jako udane wywołania — serwer odpowiedział', async () => {
    const { provider, entries } = providerWithLedger()
    await provider.fetchPage(`${base}/serwer-padl`, options())
    expect(entries[0]?.ok).toBe(true)
    expect(entries[0]?.httpStatus).toBe(500)
  })

  it('łańcuch przekierowań kosztuje tyle jednostek, ile było żądań', async () => {
    const { provider, entries } = providerWithLedger()
    await provider.fetchPage(`${base}/skok1`, options())
    expect(entries[0]?.quotaUnits).toBe(3)
  })

  it('crawl własnej strony nic nie kosztuje', async () => {
    const { provider, entries } = providerWithLedger()
    await provider.fetchPage(`${base}/`, options())
    expect(entries[0]?.costMicros).toBe(0)
  })

  it('rozróżnia zdolność robots od zwykłego pobrania', async () => {
    const { provider, entries } = providerWithLedger()
    await provider.fetchText(`${base}/robots.txt`, 'crawl:robots', options())
    expect(entries[0]?.capability).toBe('crawl:robots')
  })
})

describe('fetchRobots', () => {
  it('czyta reguły i mapy witryny', async () => {
    const { provider } = providerWithLedger()
    const result = await fetchRobots(provider, `${base}/`, options())

    expect(result.state).toBe('ok')
    expect(result.sitemaps).toEqual(['https://a.test/sitemap.xml'])
    expect(result.rules.groups).toHaveLength(1)
  })

  // fetchRobots zawsze siega po `/robots.txt` od korzenia, wiec status podstawiamy
  // przez zastapienie fetchText — inaczej test sprawdzalby sciezke, a nie decyzje.
  const providerReturning = (status: number) => {
    const { provider } = providerWithLedger()
    return {
      ...provider,
      fetchText: async () => ({
        url: 'x', requestedUrl: 'x', status, contentType: null, body: 'cokolwiek',
        bytes: 9, durationMs: 1, redirectChain: [], error: null, etag: null,
        lastModified: null, httpRequests: 1, truncated: false,
      }),
    }
  }

  it('404 na robots.txt znaczy brak pliku, czyli zgodę na crawl', async () => {
    const result = await fetchRobots(providerReturning(404), `${base}/`, options())
    expect(result.state).toBe('missing')
  })

  it('awaria 5xx na robots.txt znaczy zakaz crawlowania', async () => {
    const result = await fetchRobots(providerReturning(503), `${base}/`, options())
    expect(result.state).toBe('unreachable')
  })

  it('403 na robots.txt też znaczy zakaz — właściciel zamknął plik', async () => {
    const result = await fetchRobots(providerReturning(403), `${base}/`, options())
    expect(result.state).toBe('unreachable')
  })

  it('brak odpowiedzi znaczy zakaz crawlowania', async () => {
    const { provider } = providerWithLedger()
    const result = await fetchRobots(provider, 'http://127.0.0.1:1/', options({ timeoutMs: 1000 }))
    expect(result.state).toBe('unreachable')
  })
})
