import { execFileSync } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, closeDatabase, contentRepos, crawlRepos, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import {
  createContentProvider, createGitPrProvider, createOpenAiCompatibleProvider,
} from '@seo/providers'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  RateLimitedError, runBrief, runDraft, runKeywordsCluster, runPublish,
} from './commands/content.js'
import { openInitialized } from './commands/init.js'
import { dbLedger } from './ledger.js'

/**
 * Odbior Fazy 3: od frazy z Search Console do commita na osobnej galezi.
 *
 * Silnik odpowiada przez **prawdziwy** serwer HTTP na petli zwrotnej, a publikacja
 * idzie do **prawdziwego** repozytorium git. Atrapy dowiodlyby tylko, ze warstwy
 * skladaja sie w typach — a nie, ze cala sciezka faktycznie przechodzi.
 *
 * Czego ten test **nie** dowodzi: ze model naprawde napisze dobry artykul.
 * Tego nie da sie sprawdzic testem i nie udajemy, ze da.
 */

const BASE = 'https://przyklad.test/'
const SCOPE = tenantScope('local')

const ARTYKUL_TRESC = 'Zmierzylismy widocznosc marki w odpowiedziach trzech modeli '
  + 'jezykowych przez szesc tygodni. Model z dostepem do wyszukiwarki wymienial nas '
  + 'o jedenascie punktow procentowych czesciej niz ten sam model odpowiadajacy '
  + 'z pamieci. Roznica utrzymala sie w kazdym tygodniu pomiaru i nie dalo sie jej '
  + 'wytlumaczyc zmiana tresci na stronie, bo strona w tym czasie nie byla ruszana.'

let server: Server
let baseUrl: string
const zadania: { body: Record<string, unknown> }[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      zadania.push({ body: JSON.parse(raw || '{}') as Record<string, unknown> })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        choices: [{
          message: { content: `# Audyt SEO strony krok po kroku\n\n${ARTYKUL_TRESC}` },
        }],
      }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`
})

afterAll(async () => { await new Promise((resolve) => server.close(resolve)) })

let dir: string
let repoDir: string
let db: Db

function git(args: readonly string[], cwd: string): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8' })
}

function html(tytul: string, opis: string): string {
  return '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">'
    + `<title>${tytul}</title><meta name="description" content="${opis}">`
    + `</head><body><h1>${tytul}</h1><p>Tresc.</p></body></html>`
}

beforeEach(() => {
  zadania.length = 0
  dir = mkdtempSync(join(tmpdir(), 'tresc-e2e-'))
  repoDir = join(dir, 'strona')
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db

  const base = repos(db, SCOPE)
  const site = base.write.upsertSite('url_prefix', BASE)
  const syncRunId = base.write.startSyncRun(site.id, '2026-08-01', '2026-08-31', 'final', 'date,query')
  base.write.upsertQueryDaily(site.id, syncRunId, [
    { date: '2026-08-01', query: 'audyt seo strony', clicks: 5, impressions: 800, ctr: 0.006, position: 11.4 },
    { date: '2026-08-02', query: 'audyt seo strony', clicks: 3, impressions: 200, ctr: 0.015, position: 9.0 },
    { date: '2026-08-01', query: 'audyt seo cennik', clicks: 1, impressions: 100, ctr: 0.01, position: 24.0 },
  ])

  const crawlRepo = crawlRepos(db, SCOPE)
  const runId = crawlRepo.write.startCrawlRun(site.id, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
  })
  crawlRepo.write.insertCrawlPages(site.id, runId, [
    {
      url: BASE, depth: 0, httpStatus: 200, contentType: 'text/html',
      bytes: 400, durationMs: 10, redirectChain: [], fetchError: null,
      facts: parsePage(html('Strona glowna', 'Narzedzie do audytu'), { url: BASE }),
      renderDiff: null, inSitemap: true,
    },
    {
      url: `${BASE}o-nas`, depth: 1, httpStatus: 200, contentType: 'text/html',
      bytes: 400, durationMs: 10, redirectChain: [], fetchError: null,
      facts: parsePage(html('O nas', 'Kim jestesmy'), { url: `${BASE}o-nas` }),
      renderDiff: null, inSitemap: true,
    },
  ])
  crawlRepo.write.insertPageLinks(site.id, runId, [
    { fromUrl: BASE, toUrl: `${BASE}o-nas`, rel: 'follow', anchorText: 'O nas', isInternal: true },
  ])
  crawlRepo.write.finishCrawlRun(runId, { pagesFetched: 2, pagesFailed: 0, ok: true, truncated: false })

  git(['init', '--initial-branch=main', repoDir], dir)
  git(['config', 'user.email', 'test@przyklad.test'], repoDir)
  git(['config', 'user.name', 'Test'], repoDir)
  writeFileSync(join(repoDir, 'README.md'), '# strona\n')
  git(['add', '.'], repoDir)
  git(['commit', '-m', 'poczatek'], repoDir)
})

afterEach(() => {
  closeDatabase(db)
  rmSync(dir, { recursive: true, force: true })
})

function silnik() {
  return createOpenAiCompatibleProvider('groq', {
    fetchFn: globalThis.fetch,
    ledger: dbLedger(db, SCOPE),
    now: () => Date.now(),
    apiKey: 'klucz-testowy', model: 'llama-test', baseUrl,
  })
}

describe('odbior Fazy 3 — od frazy do pull requesta', () => {
  it('przechodzi cala sciezke i konczy commitem na osobnej galezi', async () => {
    // 1. Klastrowanie z prawdziwych fraz w bazie.
    const klastry = runKeywordsCluster(db, SCOPE, {
      siteUrl: BASE, from: '2026-08-01', to: '2026-08-31',
    })
    expect(klastry.clusters).toBeGreaterThan(0)
    expect(klastry.methodWarning).toContain('nie z pomiaru SERP')

    // 2. Brief z crawla i grafu linkow.
    const brief = runBrief(db, SCOPE, { siteUrl: BASE })
    expect(brief.clusterHead).toBe('audyt seo strony')
    // Pozycja wazona wyswietleniami: (11,4*800 + 9,0*200) / 1000 = 10,92.
    expect(brief.markdown).toContain('10.9')
    expect(brief.markdown).toContain('| audyt seo strony | 1000 |')

    // 3. Draft przez prawdziwy HTTP.
    const draft = await runDraft(db, SCOPE, createContentProvider({ engine: silnik() }), {
      siteUrl: BASE, briefId: brief.briefId,
      author: { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' },
      uniqueAssets: [{
        kind: 'own-data',
        description: 'szesc tygodni pomiaru na 50 promptach',
        source: 'wlasny tracker GEO, przebiegi 2026-07-15 .. 2026-08-26',
      }],
    })
    expect(zadania).toHaveLength(1)
    // Model dostal caly brief, nie sam temat (D41).
    expect(JSON.stringify(zadania[0]?.body)).toContain('audyt seo strony')
    expect(draft.approved).toBe(true)
    expect(draft.title).toBe('Audyt SEO strony krok po kroku')

    // AC9: wywolanie silnika ma wiersz w rejestrze.
    const rejestr = repos(db, SCOPE).read.providerCallSummary(0, Number.MAX_SAFE_INTEGER)
    expect(rejestr.find((r) => r.providerId === 'groq')?.calls).toBe(1)

    // 4. Publikacja do prawdziwego repozytorium.
    const gitPr = createGitPrProvider({
      repoDir, ledger: dbLedger(db, SCOPE), now: () => Date.now(),
    })
    const publikacja = await runPublish(db, SCOPE, gitPr, {
      siteUrl: BASE, draftId: draft.draftId, repoDir,
      canonicalUrl: 'https://przyklad.test/blog/audyt-seo-strony-krok-po-kroku',
      publishedAt: '2026-08-31',
    })

    expect(publikacja.branch).toBe('tresc/audyt-seo-strony-krok-po-kroku')
    expect(git(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir).trim()).toBe(publikacja.branch)
    // main zostaje nietkniety — pull request jest bramka (D35).
    expect(git(['log', '--oneline', 'main'], repoDir).trim().split('\n')).toHaveLength(1)

    const plik = readFileSync(join(repoDir, publikacja.filePath), 'utf8')
    expect(plik).toContain('title: "Audyt SEO strony krok po kroku"')
    expect(plik).toContain('author: "Krzysztof Nowak"')
    expect(plik).toContain(ARTYKUL_TRESC.slice(0, 60))
    // AC7: JSON-LD z nazwanym autorem i rozwiazywalnym sameAs.
    expect(plik).toContain('"@type": "Person"')
    expect(plik).toContain('"https://przyklad.test/o-mnie"')

    // Publikacja zapisana i policzona do limitu tempa.
    const c = contentRepos(db, SCOPE)
    const siteId = repos(db, SCOPE).read.findSiteByUri(BASE)!.id
    expect(c.read.getPublication(draft.draftId)?.branch).toBe(publikacja.branch)
    expect(c.read.publicationRate(siteId, 2, Date.now()).publishedToday).toBe(1)
  })

  it('draft bez unikalnego zasobu nie dochodzi do repozytorium', async () => {
    runKeywordsCluster(db, SCOPE, { siteUrl: BASE, from: '2026-08-01', to: '2026-08-31' })
    const brief = runBrief(db, SCOPE, { siteUrl: BASE })

    const draft = await runDraft(db, SCOPE, createContentProvider({ engine: silnik() }), {
      siteUrl: BASE, briefId: brief.briefId,
      author: { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' },
      uniqueAssets: [],
    })
    expect(draft.approved).toBe(false)

    const gitPr = createGitPrProvider({
      repoDir, ledger: dbLedger(db, SCOPE), now: () => Date.now(),
    })
    const przed = git(['rev-parse', 'HEAD'], repoDir).trim()
    await expect(runPublish(db, SCOPE, gitPr, {
      siteUrl: BASE, draftId: draft.draftId, repoDir,
    })).rejects.toThrow()
    // Repozytorium nietkniete — bramka zadzialala przed jakimkolwiek zapisem.
    expect(git(['rev-parse', 'HEAD'], repoDir).trim()).toBe(przed)
    expect(git(['status', '--porcelain'], repoDir).trim()).toBe('')
  })

  it('D43: limit tempa zatrzymuje czwarty artykul tego samego dnia', async () => {
    runKeywordsCluster(db, SCOPE, { siteUrl: BASE, from: '2026-08-01', to: '2026-08-31' })
    const brief = runBrief(db, SCOPE, { siteUrl: BASE })
    const c = contentRepos(db, SCOPE)
    const siteId = repos(db, SCOPE).read.findSiteByUri(BASE)!.id

    for (let i = 0; i < 3; i += 1) {
      const id = c.write.insertDraft(siteId, {
        briefId: brief.briefId, title: `T${i}`, markdown: 'x',
        authorName: 'A', authorSameAs: 'https://a.test/', uniqueAssets: [],
        engine: 'groq', modelVersion: 'm', promptId: 'p',
        approved: true, gateFailures: [], originality: {},
      })
      c.write.createPublication(siteId, { draftId: id, branch: `t/${i}`, filePath: `content/${i}.md` })
    }

    const draft = await runDraft(db, SCOPE, createContentProvider({ engine: silnik() }), {
      siteUrl: BASE, briefId: brief.briefId,
      author: { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' },
      uniqueAssets: [{ kind: 'own-data', description: 'pomiar', source: 'tracker' }],
    })

    const gitPr = createGitPrProvider({
      repoDir, ledger: dbLedger(db, SCOPE), now: () => Date.now(),
    })
    await expect(runPublish(db, SCOPE, gitPr, {
      siteUrl: BASE, draftId: draft.draftId, repoDir,
    })).rejects.toThrow(RateLimitedError)
  })
})
