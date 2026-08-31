import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, closeDatabase, crawlRepos, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NoCrawlError } from './audit.js'
import { openInitialized } from './init.js'
import { runLlmsTxt } from './llms-txt.js'

const BASE = 'https://przyklad.test/'
const scope = tenantScope('local')

let dir: string
let db: Db

function html(tytul: string, opis: string, noindex = false): string {
  return '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">'
    + `<title>${tytul}</title><meta name="description" content="${opis}">`
    + (noindex ? '<meta name="robots" content="noindex">' : '')
    + `</head><body><h1>${tytul}</h1><p>Treść strony ${tytul}.</p></body></html>`
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-llms-'))
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db

  const siteId = repos(db, scope).write.upsertSite('url_prefix', BASE).id
  const crawlRepo = crawlRepos(db, scope)
  const runId = crawlRepo.write.startCrawlRun(siteId, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
  })

  crawlRepo.write.insertCrawlPages(siteId, runId, [
    {
      url: BASE, depth: 0, httpStatus: 200, contentType: 'text/html',
      bytes: 500, durationMs: 10, redirectChain: [], fetchError: null,
      facts: parsePage(html('Strona główna', 'Opis strony głównej'), { url: BASE }),
      renderDiff: null, inSitemap: true,
    },
    {
      url: `${BASE}blog/wpis`, depth: 1, httpStatus: 200, contentType: 'text/html',
      bytes: 500, durationMs: 10, redirectChain: [], fetchError: null,
      facts: parsePage(html('Wpis', 'Opis wpisu'), { url: `${BASE}blog/wpis` }),
      renderDiff: null, inSitemap: true,
    },
    {
      url: `${BASE}ukryta`, depth: 1, httpStatus: 200, contentType: 'text/html',
      bytes: 500, durationMs: 10, redirectChain: [], fetchError: null,
      facts: parsePage(html('Ukryta', 'Opis', true), { url: `${BASE}ukryta` }),
      renderDiff: null, inSitemap: false,
    },
  ])
  crawlRepo.write.finishCrawlRun(runId, {
    pagesFetched: 3, pagesFailed: 0, ok: true, truncated: false,
  })
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

describe('seo llms-txt', () => {
  it('sklada plik z zapisanego crawla, bez ruchu sieciowego', () => {
    const out = join(dir, 'llms.txt')
    const wynik = runLlmsTxt(db, scope, { siteUrl: BASE, outPath: out, siteName: 'Przyklad' })
    expect(wynik.pages).toBe(2)
    expect(wynik.skippedPages).toBe(1)

    const tekst = readFileSync(out, 'utf8')
    expect(tekst).toContain('# Przyklad')
    expect(tekst).toContain('- [Strona główna](https://przyklad.test/): Opis strony głównej')
    expect(tekst).toContain('## blog')
  })

  it('strona z noindex nie trafia do pliku', () => {
    const out = join(dir, 'llms.txt')
    runLlmsTxt(db, scope, { siteUrl: BASE, outPath: out })
    expect(readFileSync(out, 'utf8')).not.toContain('Ukryta')
  })

  it('bez nazwy bierze host, zamiast zostawiac pusty naglowek', () => {
    const out = join(dir, 'llms.txt')
    runLlmsTxt(db, scope, { siteUrl: BASE, outPath: out })
    expect(readFileSync(out, 'utf8').startsWith('# przyklad.test\n')).toBe(true)
  })

  it('brak crawla mowi, jak go zrobic', () => {
    expect(() => runLlmsTxt(db, scope, {
      siteUrl: 'https://obca.test/', outPath: join(dir, 'x.txt'),
    })).toThrow(NoCrawlError)
  })

  it('zaklada brakujace katalogi zamiast wywalac sie na sciezce', () => {
    const out = join(dir, 'gleboko', 'w', 'srodku', 'llms.txt')
    runLlmsTxt(db, scope, { siteUrl: BASE, outPath: out })
    expect(readFileSync(out, 'utf8')).toContain('# przyklad.test')
  })
})
