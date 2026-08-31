import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, closeDatabase, contentRepos, crawlRepos, repos } from '@seo/db'
import { parsePage } from '@seo/parse'
import {
  createGitPrProvider, type ContentProvider, type GeneratedDraft,
} from '@seo/providers'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  NoClusterError, RateLimitedError, UnknownSiteError,
  draftToMarkdownFile, runBrief, runDraft, runKeywordsCluster, runPublish,
} from './content.js'
import { openInitialized } from './init.js'

const BASE = 'https://przyklad.test/'
const scope = tenantScope('local')

let dir: string
let repoDir: string
let db: Db

const ARTYKUL = '# Grounding zmienia widocznosc\n\n'
  + 'Zmierzylismy widocznosc marki w odpowiedziach trzech modeli jezykowych przez '
  + 'szesc tygodni. Model z dostepem do wyszukiwarki wymienial nas o jedenascie '
  + 'punktow procentowych czesciej niz ten sam model odpowiadajacy z pamieci. '
  + 'Roznica utrzymala sie w kazdym tygodniu pomiaru i nie dalo sie jej wytlumaczyc '
  + 'zmiana tresci na stronie, bo strona w tym czasie nie byla ruszana.'

function atrapaProvidera(nadpisz: Partial<GeneratedDraft> = {}): ContentProvider {
  return {
    engine: 'groq',
    modelVersion: 'llama-test',
    async generate(briefMarkdown, promptId) {
      return {
        title: 'Grounding zmienia widocznosc',
        markdown: ARTYKUL.split('\n\n').slice(1).join('\n\n'),
        uniqueAssets: [],
        engine: 'groq', modelVersion: 'llama-test', promptId,
        error: null, refusalReason: null,
        ...nadpisz,
      }
    },
  }
}

function git(args: readonly string[], cwd: string): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8' })
}

function html(tytul: string, opis: string): string {
  return '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">'
    + `<title>${tytul}</title><meta name="description" content="${opis}">`
    + `</head><body><h1>${tytul}</h1><p>Tresc ${tytul}.</p></body></html>`
}

const AUTOR = { name: 'Krzysztof Nowak', sameAs: 'https://przyklad.test/o-mnie' }
const ZASOB = [{
  kind: 'own-data' as const,
  description: 'szesc tygodni pomiaru na 50 promptach',
  source: 'wlasny tracker GEO',
}]

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'seo-tresc-'))
  repoDir = join(dir, 'strona')
  db = openInitialized({ dbPath: join(dir, 'seo.db'), gscKeyFile: undefined, tenantId: 'local' }).db

  const base = repos(db, scope)
  const site = base.write.upsertSite('url_prefix', BASE)

  // Frazy z Search Console.
  const syncRunId = base.write.startSyncRun(site.id, '2026-08-01', '2026-08-31', 'final', 'date,query')
  base.write.upsertQueryDaily(site.id, syncRunId, [
    { date: '2026-08-01', query: 'audyt seo strony', clicks: 5, impressions: 800, ctr: 0.006, position: 11.4 },
    { date: '2026-08-01', query: 'audyt seo cennik', clicks: 1, impressions: 100, ctr: 0.01, position: 24.0 },
    { date: '2026-08-01', query: 'hosting porownanie', clicks: 0, impressions: 50, ctr: 0, position: 40.0 },
  ])

  // Crawl z jedna strona, zeby brief mial czym operowac.
  const crawlRepo = crawlRepos(db, scope)
  const runId = crawlRepo.write.startCrawlRun(site.id, {
    maxPages: 500, maxDepth: 5, delayMs: 1000, renderSample: 0,
    robotsState: 'ok', userAgent: 'agent', sitemapUrls: [],
  })
  crawlRepo.write.insertCrawlPages(site.id, runId, [
    {
      url: `${BASE}o-nas`, depth: 1, httpStatus: 200, contentType: 'text/html',
      bytes: 400, durationMs: 10, redirectChain: [], fetchError: null,
      facts: parsePage(html('O nas', 'Kim jestesmy'), { url: `${BASE}o-nas` }),
      renderDiff: null, inSitemap: true,
    },
  ])
  crawlRepo.write.finishCrawlRun(runId, { pagesFetched: 1, pagesFailed: 0, ok: true, truncated: false })

  // Prawdziwe repozytorium git na publikacje.
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

const ZAKRES = { from: '2026-08-01', to: '2026-08-31' }

describe('seo keywords cluster', () => {
  it('sklada klastry z fraz Search Console', () => {
    const wynik = runKeywordsCluster(db, scope, { siteUrl: BASE, ...ZAKRES })
    expect(wynik.keywords).toBe(3)
    expect(wynik.clusters).toBeGreaterThan(0)
    expect(wynik.clusterSetId).not.toBe('')
  })

  it('D33: bez migawek SERP mowi wprost, ze to hipoteza, a nie pomiar', () => {
    const wynik = runKeywordsCluster(db, scope, { siteUrl: BASE, ...ZAKRES })
    expect(wynik.method).toBe('lexical-overlap')
    expect(wynik.methodWarning).toContain('nie z pomiaru SERP')
  })

  it('D33: migawki SERP wlaczaja metode podstawowa bez ostrzezenia', () => {
    const wspolne = ['https://x.test/1', 'https://x.test/2', 'https://x.test/3']
    const wynik = runKeywordsCluster(db, scope, {
      siteUrl: BASE, ...ZAKRES,
      serpSnapshots: [
        { query: 'audyt seo strony', urls: wspolne },
        { query: 'audyt seo cennik', urls: wspolne },
        { query: 'hosting porownanie', urls: ['https://y.test/9'] },
      ],
    })
    expect(wynik.method).toBe('serp-overlap')
    expect(wynik.methodWarning).toBeNull()
    expect(wynik.clusters).toBe(2)
  })

  it('nieznana strona mowi, co zrobic', () => {
    expect(() => runKeywordsCluster(db, scope, { siteUrl: 'https://obca.test/', ...ZAKRES }))
      .toThrow(UnknownSiteError)
  })
})

describe('seo brief', () => {
  beforeEach(() => { runKeywordsCluster(db, scope, { siteUrl: BASE, ...ZAKRES }) })

  it('sklada brief z danych, nie ze zgadywania', () => {
    const wynik = runBrief(db, scope, { siteUrl: BASE })
    expect(wynik.clusterHead).toBe('audyt seo strony')
    expect(wynik.markdown).toContain('| audyt seo strony | 800 |')
    expect(wynik.markdown).toContain('11.4')
  })

  it('D38: bez pokrywajacej strony decyzja to create z powodem', () => {
    const wynik = runBrief(db, scope, { siteUrl: BASE })
    expect(wynik.decision).toBe('create')
    expect(wynik.targetUrl).toBeNull()
    expect(wynik.markdown).toContain('**Powod:**')
  })

  it('podany klaster wygrywa z domyslnym', () => {
    const wynik = runBrief(db, scope, { siteUrl: BASE, clusterSlug: 'hosting-porownanie' })
    expect(wynik.clusterHead).toBe('hosting porownanie')
  })

  it('brak klastrow mowi, jak je zrobic', () => {
    const czysta = openInitialized({
      dbPath: join(dir, 'pusta.db'), gscKeyFile: undefined, tenantId: 'local',
    }).db
    repos(czysta, scope).write.upsertSite('url_prefix', BASE)
    expect(() => runBrief(czysta, scope, { siteUrl: BASE })).toThrow(NoClusterError)
    closeDatabase(czysta)
  })
})

describe('seo draft', () => {
  let briefId: string

  beforeEach(() => {
    runKeywordsCluster(db, scope, { siteUrl: BASE, ...ZAKRES })
    briefId = runBrief(db, scope, { siteUrl: BASE }).briefId
  })

  it('draft z autorem i zasobem przechodzi bramki', async () => {
    const wynik = await runDraft(db, scope, atrapaProvidera(), {
      siteUrl: BASE, briefId, author: AUTOR, uniqueAssets: ZASOB,
    })
    expect(wynik.approved).toBe(true)
    expect(wynik.failures).toEqual([])
    expect(wynik.engine).toBe('groq')
  })

  it('D37: draft bez zasobu jest odrzucony i zapisany z powodem', async () => {
    const wynik = await runDraft(db, scope, atrapaProvidera(), {
      siteUrl: BASE, briefId, author: AUTOR, uniqueAssets: [],
    })
    expect(wynik.approved).toBe(false)
    expect(wynik.failures.map((f) => f.gate)).toContain('unique-asset')

    const zapisany = contentRepos(db, scope).read.getDraft(wynik.draftId)
    expect(zapisany?.approved).toBe(0)
    expect(JSON.parse(zapisany?.gateFailures ?? '[]')).not.toHaveLength(0)
  })

  it('odmowa modelu uniewaznia zatwierdzenie, choc tresc bramek nie ruszyla', async () => {
    const wynik = await runDraft(db, scope, atrapaProvidera({
      refusalReason: 'filtr tresci dostawcy',
    }), { siteUrl: BASE, briefId, author: AUTOR, uniqueAssets: ZASOB })
    expect(wynik.approved).toBe(false)
    expect(wynik.failures.some((f) => f.reason.includes('model odmowil'))).toBe(true)
  })

  it('blad wywolania tez uniewaznia zatwierdzenie', async () => {
    const wynik = await runDraft(db, scope, atrapaProvidera({ error: 'ECONNRESET' }), {
      siteUrl: BASE, briefId, author: AUTOR, uniqueAssets: ZASOB,
    })
    expect(wynik.approved).toBe(false)
    expect(wynik.failures.some((f) => f.reason.includes('ECONNRESET'))).toBe(true)
  })

  it('D39: zmyslony autor odrzuca draft', async () => {
    const wynik = await runDraft(db, scope, atrapaProvidera(), {
      siteUrl: BASE, briefId,
      author: { name: 'Ekspert', sameAs: 'ekspert branzowy' },
      uniqueAssets: ZASOB,
    })
    expect(wynik.approved).toBe(false)
    expect(wynik.failures.map((f) => f.gate)).toContain('author')
  })
})

describe('draftToMarkdownFile', () => {
  it('D44: sklada front matter i tresc jako Markdown', () => {
    const plik = draftToMarkdownFile({
      title: 'Tytul z "cudzyslowem"',
      markdown: '## Naglowek\n\nTresc.',
      authorName: 'Krzysztof Nowak',
      publishedAt: '2026-08-31',
      schemaScript: null,
    })
    expect(plik).toContain('title: "Tytul z \\"cudzyslowem\\""')
    expect(plik).toContain('date: 2026-08-31')
    expect(plik).toContain('## Naglowek')
  })

  it('JSON-LD dokleja sie na koncu, gdy jest', () => {
    const plik = draftToMarkdownFile({
      title: 'T', markdown: 'x', authorName: 'A', publishedAt: '2026-08-31',
      schemaScript: '<script type="application/ld+json">{}</script>',
    })
    expect(plik.trimEnd().endsWith('</script>')).toBe(true)
  })
})

describe('seo publish', () => {
  let draftId: string

  beforeEach(async () => {
    runKeywordsCluster(db, scope, { siteUrl: BASE, ...ZAKRES })
    const briefId = runBrief(db, scope, { siteUrl: BASE }).briefId
    draftId = (await runDraft(db, scope, atrapaProvidera(), {
      siteUrl: BASE, briefId, author: AUTOR, uniqueAssets: ZASOB,
    })).draftId
  })

  const gitPr = () => createGitPrProvider({
    repoDir, ledger: { record: () => {} }, now: () => Date.now(),
  })

  it('D35: zapisuje plik na osobnej galezi i mowi, co dalej', async () => {
    const wynik = await runPublish(db, scope, gitPr(), {
      siteUrl: BASE, draftId, repoDir, publishedAt: '2026-08-31',
    })
    expect(wynik.branch).toBe('tresc/grounding-zmienia-widocznosc')
    expect(wynik.filePath).toBe('content/grounding-zmienia-widocznosc.md')
    expect(wynik.nextStep).toContain('pull request')
    expect(git(['rev-parse', '--abbrev-ref', 'HEAD'], repoDir).trim())
      .toBe('tresc/grounding-zmienia-widocznosc')

    const tresc = readFileSync(join(repoDir, wynik.filePath), 'utf8')
    expect(tresc).toContain('title: "Grounding zmienia widocznosc"')
    expect(tresc).toContain('author: "Krzysztof Nowak"')
  })

  it('AC7: canonical dokleja JSON-LD z nazwanym autorem', async () => {
    const wynik = await runPublish(db, scope, gitPr(), {
      siteUrl: BASE, draftId, repoDir,
      canonicalUrl: 'https://przyklad.test/blog/grounding', publishedAt: '2026-08-31',
    })
    const tresc = readFileSync(join(repoDir, wynik.filePath), 'utf8')
    expect(tresc).toContain('application/ld+json')
    expect(tresc).toContain('"name": "Krzysztof Nowak"')
    expect(tresc).toContain('"sameAs"')
  })

  it('publikacja jest zapisana w bazie razem z galezia', async () => {
    const wynik = await runPublish(db, scope, gitPr(), {
      siteUrl: BASE, draftId, repoDir, publishedAt: '2026-08-31',
    })
    const zapis = contentRepos(db, scope).read.getPublication(draftId)
    expect(zapis?.id).toBe(wynik.publicationId)
    expect(zapis?.branch).toBe(wynik.branch)
    expect(zapis?.adapter).toBe('git-pr')
  })

  it('D43: wyczerpany limit dzienny wstrzymuje PRZED zapisem do repozytorium', async () => {
    const c = contentRepos(db, scope)
    const siteId = repos(db, scope).read.findSiteByUri(BASE)!.id
    const brief = c.read.listBriefs(siteId, 1)[0]!

    for (let i = 0; i < 3; i += 1) {
      const id = c.write.insertDraft(siteId, {
        briefId: brief.id, title: `T${i}`, markdown: 'x',
        authorName: 'A', authorSameAs: 'https://a.test/', uniqueAssets: [],
        engine: 'groq', modelVersion: 'm', promptId: 'p',
        approved: true, gateFailures: [], originality: {},
      })
      c.write.createPublication(siteId, { draftId: id, branch: `t/${i}`, filePath: `content/${i}.md` })
    }

    const przed = git(['rev-parse', 'HEAD'], repoDir).trim()
    await expect(runPublish(db, scope, gitPr(), { siteUrl: BASE, draftId, repoDir }))
      .rejects.toThrow(RateLimitedError)
    // Repozytorium nietkniete.
    expect(git(['rev-parse', 'HEAD'], repoDir).trim()).toBe(przed)
    expect(git(['status', '--porcelain'], repoDir).trim()).toBe('')
  })
})
