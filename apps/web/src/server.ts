import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  activePromptSet, buildAuditReportData, buildGeoReport, buildLlmsTxtContent, dbLedger,
  openInitialized, runAgentBoard, runAgentMeasure, runAgentPlan, runAudit, runBrief,
  runCrawlCommand, runGeoEntity, runGeoPrompts, runGeoRun, runKeywordsCluster, systemClock,
} from '@seo/cli/lib'
import { tenantScope, type TenantScope } from '@seo/core'
import {
  agentRepos, closeDatabase, contentRepos, crawlRepos, geoRepos, repos, type Db,
} from '@seo/db'
import { createSiteFetchProvider, selectEngines } from '@seo/providers'
import { renderAuditReport, renderGeoReport } from '@seo/report'
import { JobRegistry } from './jobs.js'
import {
  stronaAgenta, stronaBledu, stronaListyWitryn, stronaPomocy, stronaStart,
  stronaWitryny, stronaZadania, type SiteDetail, type SiteRow,
} from './pages.js'
import { stronaGeo, stronaLlmsTxt, type GeoStan } from './pages-geo.js'
import { stronaBriefu, stronaTresci, type TrescStan } from './pages-tresc.js'

/**
 * Lokalny panel.
 *
 * Nasluchuje **wylacznie na petli zwrotnej**. To nie jest ostroznosc na wyrost:
 * panel uruchamia crawler na dowolny podany adres i ma pelny dostep do bazy,
 * wiec wystawienie go na siec byloby oddaniem obu tych rzeczy komukolwiek
 * w tej samej sieci.
 */

/**
 * Oba adresy petli zwrotnej.
 *
 * **To nie jest nadmiarowosc — to byl blad, przez ktory panel sie nie otwieral.**
 * Nasluch tylko na `127.0.0.1` znaczy, ze `http://localhost:4321` dziala albo
 * nie, zaleznie od tego, co system rozwiaze pierwsze. Windows preferuje IPv6,
 * wiec `localhost` idzie na `::1` i przegladarka dostaje odmowe polaczenia,
 * choc serwer stoi i odpowiada na IPv4.
 *
 * Nadal **wylacznie petla zwrotna**: panel uruchamia crawler na dowolny adres
 * i ma pelny dostep do bazy, wiec `0.0.0.0` nie wchodzi w gre.
 */
export const LOOPBACK_HOSTS = ['127.0.0.1', '::1'] as const

export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_PORT = 4321

/** Sufit stron w panelu. Bezpieczniki crawlera i tak tna wyzej (D15). */
export const PANEL_MAX_PAGES = 200

export interface PanelConfig {
  readonly dbPath: string
  readonly tenantId: string
  readonly gscKeyFile: string | undefined
}

function wyslij(res: ServerResponse, kod: number, html: string): void {
  res.writeHead(kod, {
    'content-type': 'text/html; charset=utf-8',
    // Panel operuje na lokalnej bazie i nie ma nic do pokazania w ramce.
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  })
  res.end(html)
}

async function odczytajFormularz(req: IncomingMessage): Promise<URLSearchParams> {
  const kawalki: Buffer[] = []
  let rozmiar = 0
  for await (const kawalek of req) {
    rozmiar += (kawalek as Buffer).length
    // Formularz panelu ma dwa pola. Wszystko powyzej to nie jest formularz.
    if (rozmiar > 64 * 1024) throw new Error('zbyt duze zadanie')
    kawalki.push(kawalek as Buffer)
  }
  return new URLSearchParams(Buffer.concat(kawalki).toString('utf8'))
}

function chwila(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
    + `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function wierszWitryny(db: Db, scope: TenantScope, site: { id: string; propertyUri: string }): SiteRow {
  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)
  const strony = run === undefined ? [] : crawlRepo.read.listCrawlPages(run.id)
  const ustalenia = run === undefined ? [] : crawlRepo.read.listFindings(run.id)

  return {
    id: site.id,
    propertyUri: site.propertyUri,
    pages: strony.length,
    failedPages: strony.filter((p) => p.httpStatus === null).length,
    findings: ustalenia.length,
    blocking: ustalenia.filter((f) => f.severity === 'blocker' || f.severity === 'high').length,
    crawledAt: run === undefined ? null : chwila(run.startedAt),
    hasGeo: geoRepos(db, scope).read.latestGeoRun(site.id) !== undefined,
    hasClusters: contentRepos(db, scope).read.latestClusterSet(site.id) !== undefined,
    agentTasks: agentRepos(db, scope).read.listTasks(site.id, 200).length,
  }
}

function listaStron(db: Db, scope: TenantScope): SiteRow[] {
  return repos(db, scope).read.listSites()
    .map((site) => wierszWitryny(db, scope, site))
    .sort((a, b) => (b.crawledAt ?? '').localeCompare(a.crawledAt ?? ''))
}

function szczegolyWitryny(db: Db, scope: TenantScope, site: { id: string; propertyUri: string }): SiteDetail {
  const podstawa = wierszWitryny(db, scope, site)
  const crawlRepo = crawlRepos(db, scope)
  const run = crawlRepo.read.latestCrawlRun(site.id)

  const severity: Record<string, number> = {
    blocker: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  let orphans = 0
  let topRules: SiteDetail['topRules'] = []

  if (run !== undefined) {
    // Zwraca wiersze `{ severity, count }`, a nie obiekt — `Object.entries`
    // dalby tu indeksy tablicy zamiast nazw wag.
    for (const wiersz of crawlRepo.read.findingCountsBySeverity(run.id)) {
      severity[wiersz.severity] = wiersz.count
    }
    topRules = crawlRepo.read.topFindingRules(run.id, 10)
    orphans = crawlRepo.read.orphanPages(run.id).length
  }

  const zadania = agentRepos(db, scope).read.listTasks(site.id, 500)
  const policz = (stan: string): number => zadania.filter((z) => z.state === stan).length

  return {
    ...podstawa,
    severity,
    topRules,
    orphans,
    truncated: run?.truncated === 1,
    robotsState: run === undefined ? 'brak crawla' : run.robotsState,
    agentSummary: {
      proposed: policz('proposed'),
      needsYou: policz('needs-you'),
      inFlight: policz('in-flight'),
      measuring: policz('measuring'),
      done: policz('done'),
    },
  }
}

/** Plik do zapisania na dysk, nie strona. */
function wyslijTekst(res: ServerResponse, tresc: string, nazwaPliku: string | null): void {
  res.writeHead(200, {
    'content-type': 'text/plain; charset=utf-8',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    ...(nazwaPliku === null
      ? {}
      : { 'content-disposition': `attachment; filename="${nazwaPliku}"` }),
  })
  res.end(tresc)
}

/**
 * Dopasowanie sciezki do wzorca `/geo/:id/run`.
 *
 * Wczesniej trasy z segmentem w srodku wycinalo sie arytmetyka na indeksach
 * (`slice(7, length - 8)`). Dzialalo, ale kazda nowa trasa byla nowa okazja
 * do pomylki o jeden znak — a taka pomylka daje 404 na trasie, ktora istnieje.
 *
 * Zwraca **odkodowany** identyfikator albo `null`, gdy sciezka nie pasuje.
 */
export function dopasuj(sciezka: string, wzorzec: string): string | null {
  const czesciW = wzorzec.split('/')
  const czesciS = sciezka.split('/')
  if (czesciW.length !== czesciS.length) return null

  let id: string | null = null
  for (let i = 0; i < czesciW.length; i += 1) {
    const w = czesciW[i] as string
    const c = czesciS[i] as string
    if (w === ':id') {
      if (c === '') return null
      id = decodeURIComponent(c)
    } else if (w !== c) return null
  }
  return id
}

/**
 * Fraza glowna tematu, dla ktorego powstal brief.
 *
 * Zrodlem jest zapisany brief, a nie biezacy wiersz klastra. Klastry przeliczaja
 * sie przy kazdym nowym zakresie dat, wiec temat o tym samym identyfikatorze
 * moze juz znaczyc co innego — brief ma pokazywac to, dla czego zostal napisany.
 */
function naglowekBriefu(payload: string): string {
  try {
    const head = (JSON.parse(payload) as { head?: unknown }).head
    return typeof head === 'string' && head !== '' ? head : 'brief bez nagłówka'
  } catch {
    return 'brief bez nagłówka'
  }
}

/** „a, b ,, c" → `['a', 'b', 'c']`. Puste pole daje pusta liste, nie `['']`. */
function listaPrzecinkowa(wartosc: string | null): string[] {
  return (wartosc ?? '').split(',').map((x) => x.trim()).filter((x) => x !== '')
}

function silnikiPanelu(): { id: string; dostepny: boolean; powod: string }[] {
  const { engines, skipped } = selectEngines({
    fetchFn: globalThis.fetch,
    ledger: { record: () => {} },
    now: () => Date.now(),
    env: process.env,
  })
  return [
    ...engines.map((e) => ({ id: e.id, dostepny: true, powod: `model ${e.modelVersion}` })),
    ...skipped.map((sk) => ({ id: sk.id, dostepny: false, powod: sk.reason })),
  ].sort((a, b) => a.id.localeCompare(b.id))
}

function stanGeo(
  db: Db, scope: TenantScope, site: { id: string; propertyUri: string }, komunikat: string | null,
): GeoStan {
  const g = geoRepos(db, scope)

  // Tylko najnowsza wersja kazdej encji — starsze zostaja w bazie, bo bez nich
  // nie da sie odtworzyc dawnych pomiarow (D29), ale na ekranie bylyby szumem.
  const najnowsze = new Map<string, { name: string; variants: readonly string[]
    exclusions: readonly string[]; version: number; isOwn: boolean }>()
  for (const e of g.read.listEntities(site.id)) {
    const poprzednia = najnowsze.get(e.name)
    if (poprzednia === undefined || e.version > poprzednia.version) najnowsze.set(e.name, e)
  }
  const encje = [...najnowsze.values()]

  const zestaw = activePromptSet(g.read.listPromptSets(site.id))
  const zapisany = zestaw === undefined ? undefined : g.read.getPromptSet(zestaw.id)

  return {
    siteId: site.id,
    siteUri: site.propertyUri,
    wlasna: encje.find((e) => e.isOwn) ?? null,
    konkurenci: encje.filter((e) => !e.isOwn),
    zestawNazwa: zestaw?.name ?? null,
    zestawWersja: zestaw?.version ?? 0,
    zamrozony: zapisany?.frozenAt != null,
    prompty: zestaw === undefined ? [] : g.read.listPrompts(zestaw.id).map((x) => x.text),
    silniki: silnikiPanelu(),
    przebiegi: g.read.listGeoRuns(site.id, 8).map((r) => ({
      engine: r.engine,
      modelVersion: r.modelVersion,
      startedAt: chwila(r.startedAt),
      answers: g.read.listAnswers(r.id).length,
    })),
    komunikat,
  }
}

function stanTresci(
  db: Db, scope: TenantScope, site: { id: string; propertyUri: string },
  komunikat: string | null, ostrzezenie: string | null,
): TrescStan {
  const c = contentRepos(db, scope)
  const zestaw = c.read.latestClusterSet(site.id)
  const klastry = zestaw === undefined ? [] : c.read.listClusters(zestaw.id)

  return {
    siteId: site.id,
    siteUri: site.propertyUri,
    zakres: repos(db, scope).read.queryDateRange(site.id),
    metoda: zestaw?.method ?? null,
    zestawZakres: zestaw === undefined ? null : { from: zestaw.fromDate, to: zestaw.toDate },
    klastry: klastry.slice(0, 20).map((k) => ({
      slug: k.slug,
      head: k.head,
      impressions: k.totalImpressions,
      clicks: k.totalClicks,
      keywords: (JSON.parse(k.keywords) as unknown[]).length,
    })),
    briefy: c.read.listBriefs(site.id, 20).map((b) => ({
      id: b.id,
      clusterHead: naglowekBriefu(b.payload),
      decision: b.decision,
      createdAt: chwila(b.createdAt),
    })),
    ostrzezenie,
    komunikat,
  }
}

/**
 * Przebieg trackera AI w tle.
 *
 * Idzie w tle z tego samego powodu, co crawl: kilkanascie promptow razy trzy
 * przebiegi razy liczba silnikow to kilkaset sekund czekania. Roznica jest taka,
 * ze tu **kazde** wywolanie laduje w rejestrze `provider_call` — dlatego rejestr
 * jest prawdziwy (`dbLedger`), a nie atrapa jak przy samym sprawdzaniu kluczy.
 */
async function zmierzWidocznosc(
  config: PanelConfig, jobs: JobRegistry, jobId: string, siteUrl: string,
): Promise<void> {
  const scope = tenantScope(config.tenantId)
  const { db } = openInitialized(config)

  try {
    jobs.step(jobId, 'pytam silniki')

    const { engines, skipped } = selectEngines({
      fetchFn: globalThis.fetch,
      ledger: dbLedger(db, scope),
      now: () => Date.now(),
      env: process.env,
    })

    if (engines.length === 0) {
      jobs.fail(jobId, 'zaden silnik nie ma klucza: '
        + skipped.map((sk) => `${sk.id} — ${sk.reason}`).join('; '))
      return
    }

    const wynik = await runGeoRun(db, scope, engines, skipped, { siteUrl })

    // Przebieg, w ktorym **kazde** pytanie sie wywrocilo, nie jest pomiarem.
    // Zameldowanie „gotowe" nad zerem odpowiedzi bylo by falszywym porzadkiem.
    const udane = wynik.outcomes.reduce((suma, o) => suma + o.answersOk, 0)
    if (udane === 0) {
      const blad = wynik.outcomes.map((o) => o.lastError).find((e) => e !== null)
      jobs.fail(jobId, blad == null
        ? 'zaden silnik nie odpowiedzial'
        : `zaden silnik nie odpowiedzial: ${blad}`)
      return
    }

    jobs.finish(jobId, wynik.siteId)
  } catch (error) {
    jobs.fail(jobId, error instanceof Error ? error.message : String(error))
  } finally {
    closeDatabase(db)
  }
}

/**
 * Crawl i audyt w tle.
 *
 * Blad **nie wywraca serwera** — laduje w rejestrze zadan i pokazuje sie na
 * stronie postepu. Panel, ktory pada, bo ktos wpisal adres nieistniejacej
 * strony, byl by gorszy niz brak panelu.
 */
async function przeanalizuj(
  config: PanelConfig, jobs: JobRegistry, jobId: string, siteUrl: string, maxPages: number,
): Promise<void> {
  const scope = tenantScope(config.tenantId)
  const { db } = openInitialized(config)

  try {
    jobs.step(jobId, 'czytam robots.txt i mapy witryny')

    const provider = createSiteFetchProvider({
      fetchFn: globalThis.fetch,
      ledger: dbLedger(db, scope),
      now: () => Date.now(),
    })

    const crawl = await runCrawlCommand(
      { db, scope, provider, clock: systemClock },
      { siteUrl, limits: { maxPages } },
    )

    if (crawl.runId === null) {
      jobs.fail(jobId, crawl.robotsState === 'unreachable'
        ? 'robots.txt jest nieosiagalny, wiec crawl nie ruszyl — tak nakazuje D14'
        : 'crawl nie ruszyl')
      return
    }

    // Crawl, ktory nie pobral **ani jednej** strony, nie jest udany, choc
    // technicznie sie zakonczyl. Panel mowiacy „gotowe" po zerowym pobraniu
    // podawalby falszywa informacje o czyms, co uzytkownik wlasnie wpisal.
    if (crawl.pagesFetched === 0) {
      const pierwszyBlad = crawlRepos(db, scope).read.listCrawlPages(crawl.runId)
        .map((p) => p.fetchError)
        .find((e): e is string => e !== null)
      jobs.fail(jobId, pierwszyBlad === undefined
        ? 'nie udalo sie pobrac zadnej strony'
        : `nie udalo sie pobrac zadnej strony: ${pierwszyBlad}`)
      return
    }

    jobs.step(jobId, `pobrano ${crawl.pagesFetched} stron, sprawdzam reguly`)
    runAudit(db, scope, { siteUrl })

    jobs.finish(jobId, crawl.siteId)
  } catch (error) {
    jobs.fail(jobId, error instanceof Error ? error.message : String(error))
  } finally {
    closeDatabase(db)
  }
}

export function createPanel(config: PanelConfig): Server {
  const jobs = new JobRegistry()
  const scope = tenantScope(config.tenantId)

  return createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', `http://${DEFAULT_HOST}`)
      const sciezka = url.pathname
      // HEAD obslugiwane jak GET — Node sam pomija tresc odpowiedzi. Bez tego
      // kazde narzedzie sprawdzajace adres (a takze `curl -I`) dostawaloby 404
      // na stronie, ktora istnieje, i melodowaloby panel jako zepsuty.
      const metoda = req.method === 'HEAD' ? 'GET' : req.method

      try {
        if (metoda === 'GET' && sciezka === '/') {
          const { db } = openInitialized(config)
          try {
            wyslij(res, 200, stronaStart(listaStron(db, scope), jobs.list()))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'POST' && sciezka === '/analizuj') {
          const pola = await odczytajFormularz(req)
          const siteUrl = (pola.get('url') ?? '').trim()

          let sprawdzony: URL
          try {
            sprawdzony = new URL(siteUrl)
          } catch {
            wyslij(res, 400, stronaBledu(400, `"${siteUrl}" nie jest adresem`))
            return
          }
          if (sprawdzony.protocol !== 'http:' && sprawdzony.protocol !== 'https:') {
            wyslij(res, 400, stronaBledu(400, 'obslugujemy wylacznie http i https'))
            return
          }

          const zadane = Number(pola.get('maxPages') ?? '25')
          const maxPages = Number.isFinite(zadane)
            ? Math.min(Math.max(Math.trunc(zadane), 1), PANEL_MAX_PAGES)
            : 25

          const job = jobs.create(sprawdzony.toString())
          void przeanalizuj(config, jobs, job.id, sprawdzony.toString(), maxPages)

          res.writeHead(303, { location: `/zadanie/${encodeURIComponent(job.id)}` })
          res.end()
          return
        }

        if (metoda === 'GET' && sciezka === '/strony') {
          const { db } = openInitialized(config)
          try {
            wyslij(res, 200, stronaListyWitryn(listaStron(db, scope)))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'GET' && sciezka === '/pomoc') {
          const { engines, skipped } = selectEngines({
            fetchFn: globalThis.fetch,
            ledger: { record: () => {} },
            now: () => Date.now(),
            env: process.env,
          })
          wyslij(res, 200, stronaPomocy({
            silniki: [
              ...engines.map((e) => ({
                id: e.id, dostepny: true, powod: `model ${e.modelVersion}`,
              })),
              ...skipped.map((sk) => ({ id: sk.id, dostepny: false, powod: sk.reason })),
            ].sort((a, b) => a.id.localeCompare(b.id)),
            gscKlucz: config.gscKeyFile !== undefined,
            dbPath: config.dbPath,
          }))
          return
        }

        if (metoda === 'GET' && sciezka.startsWith('/strona/')) {
          const siteId = decodeURIComponent(sciezka.slice('/strona/'.length))
          const { db } = openInitialized(config)
          try {
            const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
            if (site === undefined) {
              wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony w bazie'))
              return
            }
            wyslij(res, 200, stronaWitryny(szczegolyWitryny(db, scope, site)))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'GET' && sciezka.startsWith('/raport-geo/')) {
          const siteId = decodeURIComponent(sciezka.slice('/raport-geo/'.length))
          const { db } = openInitialized(config)
          try {
            const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
            if (site === undefined) {
              wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony w bazie'))
              return
            }
            wyslij(res, 200, renderGeoReport(buildGeoReport(db, scope, site.propertyUri)))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'GET' && sciezka.startsWith('/zadanie/')) {
          const job = jobs.get(decodeURIComponent(sciezka.slice('/zadanie/'.length)))
          if (job === undefined) {
            wyslij(res, 404, stronaBledu(404, 'nie ma takiego zadania'))
            return
          }
          wyslij(res, 200, stronaZadania(job))
          return
        }

        if (metoda === 'GET' && sciezka.startsWith('/raport/')) {
          const siteId = decodeURIComponent(sciezka.slice('/raport/'.length))
          const { db } = openInitialized(config)
          try {
            const site = repos(db, scope).read.listSites().find((s) => s.id === siteId)
            if (site === undefined) {
              wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
              return
            }
            const build = buildAuditReportData(db, scope, {
              siteUrl: site.propertyUri,
              generatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
            })
            wyslij(res, 200, renderAuditReport(build.data))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'GET' && sciezka.startsWith('/agent/')) {
          const siteId = decodeURIComponent(sciezka.slice('/agent/'.length))
          const { db } = openInitialized(config)
          try {
            const site = repos(db, scope).read.listSites().find((s) => s.id === siteId)
            if (site === undefined) {
              wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
              return
            }
            const tablica = runAgentBoard(db, scope, { siteUrl: site.propertyUri })
            wyslij(res, 200, stronaAgenta(
              site.propertyUri, siteId,
              tablica.summary as unknown as Record<string, number>,
              tablica.rows,
            ))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'POST' && sciezka.endsWith('/measure') && sciezka.startsWith('/agent/')) {
          const siteId = decodeURIComponent(
            sciezka.slice('/agent/'.length, sciezka.length - '/measure'.length),
          )
          const { db } = openInitialized(config)
          try {
            const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
            if (site === undefined) {
              wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
              return
            }
            const wynik = runAgentMeasure(db, scope, { siteUrl: site.propertyUri })
            const tablica = runAgentBoard(db, scope, { siteUrl: site.propertyUri })
            wyslij(res, 200, stronaAgenta(
              site.propertyUri, siteId,
              tablica.summary as unknown as Record<string, number>,
              tablica.rows,
              {
                experiments: wynik.experiments,
                windows: wynik.windows.length,
                pending: wynik.pending,
                finished: wynik.finished,
                zdania: wynik.windows.map((w) => w.sentence),
              },
            ))
          } finally { closeDatabase(db) }
          return
        }

        if (metoda === 'POST' && sciezka.endsWith('/plan') && sciezka.startsWith('/agent/')) {
          const siteId = decodeURIComponent(
            sciezka.slice('/agent/'.length, sciezka.length - '/plan'.length),
          )
          const { db } = openInitialized(config)
          try {
            const site = repos(db, scope).read.listSites().find((s) => s.id === siteId)
            if (site === undefined) {
              wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
              return
            }
            runAgentPlan(db, scope, { siteUrl: site.propertyUri })
            res.writeHead(303, { location: `/agent/${encodeURIComponent(siteId)}` })
            res.end()
          } finally { closeDatabase(db) }
          return
        }

        // --- widocznosc w AI --------------------------------------------------

        {
          const siteId = metoda === 'GET' ? dopasuj(sciezka, '/geo/:id') : null
          if (siteId !== null) {
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              wyslij(res, 200, stronaGeo(stanGeo(db, scope, site, url.searchParams.get('ok'))))
            } finally { closeDatabase(db) }
            return
          }
        }

        {
          const siteId = metoda === 'POST' ? dopasuj(sciezka, '/geo/:id/encja') : null
          if (siteId !== null) {
            const pola = await odczytajFormularz(req)
            const name = (pola.get('name') ?? '').trim()
            if (name === '') {
              wyslij(res, 400, stronaBledu(400, 'marka bez nazwy nie jest marka'))
              return
            }
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              const wynik = runGeoEntity(db, scope, {
                siteUrl: site.propertyUri,
                name,
                variants: listaPrzecinkowa(pola.get('variants')),
                exclusions: listaPrzecinkowa(pola.get('exclusions')),
                isOwn: pola.get('wlasna') === '1',
              })
              // Wersja jest w komunikacie, bo to **nowa wersja definicji**, a nie
              // poprawka starej — od niej zalezy, z czym wolno porownywac (D29).
              const komunikat = `${wynik.name}: wersja ${wynik.version}`
                + (wynik.supersededVersion === null
                  ? ' — pierwsza definicja'
                  : `, poprzednia (${wynik.supersededVersion}) zostaje w bazie`)
              res.writeHead(303, {
                location: `/geo/${encodeURIComponent(siteId)}?ok=${encodeURIComponent(komunikat)}`,
              })
              res.end()
            } finally { closeDatabase(db) }
            return
          }
        }

        {
          const siteId = metoda === 'POST' ? dopasuj(sciezka, '/geo/:id/prompty') : null
          if (siteId !== null) {
            const pola = await odczytajFormularz(req)
            const add = (pola.get('prompty') ?? '')
              .split('\n').map((x) => x.trim()).filter((x) => x !== '')
            if (add.length === 0) {
              wyslij(res, 400, stronaBledu(400, 'nie podałeś ani jednego promptu'))
              return
            }
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              const wynik = runGeoPrompts(db, scope, { siteUrl: site.propertyUri, add })
              const komunikat = `dodano ${wynik.added}, w zestawie ${wynik.total} `
                + `(${wynik.setName} v${wynik.version})`
              res.writeHead(303, {
                location: `/geo/${encodeURIComponent(siteId)}?ok=${encodeURIComponent(komunikat)}`,
              })
              res.end()
            } finally { closeDatabase(db) }
            return
          }
        }

        {
          const siteId = metoda === 'POST' ? dopasuj(sciezka, '/geo/:id/run') : null
          if (siteId !== null) {
            const { db } = openInitialized(config)
            let propertyUri: string
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              propertyUri = site.propertyUri
            } finally { closeDatabase(db) }

            const job = jobs.create(propertyUri, 'geo')
            void zmierzWidocznosc(config, jobs, job.id, propertyUri)
            res.writeHead(303, { location: `/zadanie/${encodeURIComponent(job.id)}` })
            res.end()
            return
          }
        }

        // --- llms.txt ---------------------------------------------------------

        {
          const siteId = metoda === 'GET' ? dopasuj(sciezka, '/llms-txt/:id') : null
          if (siteId !== null) {
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              const zbudowane = buildLlmsTxtContent(db, scope, { siteUrl: site.propertyUri })
              if (url.searchParams.get('format') === 'txt') {
                wyslijTekst(res, zbudowane.content, 'llms.txt')
                return
              }
              wyslij(res, 200, stronaLlmsTxt({
                siteId,
                siteUri: site.propertyUri,
                tresc: zbudowane.content,
                pages: zbudowane.pages,
                skippedPages: zbudowane.skippedPages,
              }))
            } finally { closeDatabase(db) }
            return
          }
        }

        // --- silnik tresci ----------------------------------------------------

        {
          const siteId = metoda === 'GET' ? dopasuj(sciezka, '/tresc/:id') : null
          if (siteId !== null) {
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              wyslij(res, 200, stronaTresci(stanTresci(
                db, scope, site, url.searchParams.get('ok'), url.searchParams.get('uwaga'),
              )))
            } finally { closeDatabase(db) }
            return
          }
        }

        {
          const siteId = metoda === 'POST' ? dopasuj(sciezka, '/tresc/:id/klastry') : null
          if (siteId !== null) {
            const pola = await odczytajFormularz(req)
            const from = (pola.get('from') ?? '').trim()
            const to = (pola.get('to') ?? '').trim()
            // Data z Search Console to tekst `YYYY-MM-DD` przepisany doslownie (D3).
            // Sprawdzamy **ksztalt**, a nie parsujemy przez `new Date()` — parsowanie
            // przesunelo by czesc dat o dzien i nikt by tego nie zobaczyl.
            const ksztalt = /^\d{4}-\d{2}-\d{2}$/
            if (!ksztalt.test(from) || !ksztalt.test(to)) {
              wyslij(res, 400, stronaBledu(400, 'daty muszą mieć postać RRRR-MM-DD'))
              return
            }
            if (from > to) {
              wyslij(res, 400, stronaBledu(400, 'data „od" jest późniejsza niż „do"'))
              return
            }
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              const wynik = runKeywordsCluster(db, scope, { siteUrl: site.propertyUri, from, to })
              const parametry = new URLSearchParams({
                ok: `${wynik.clusters} tematów z ${wynik.keywords} fraz`,
              })
              if (wynik.methodWarning !== null) parametry.set('uwaga', wynik.methodWarning)
              res.writeHead(303, {
                location: `/tresc/${encodeURIComponent(siteId)}?${parametry.toString()}`,
              })
              res.end()
            } finally { closeDatabase(db) }
            return
          }
        }

        {
          const siteId = metoda === 'POST' ? dopasuj(sciezka, '/tresc/:id/brief') : null
          if (siteId !== null) {
            const pola = await odczytajFormularz(req)
            const slug = (pola.get('slug') ?? '').trim()
            const { db } = openInitialized(config)
            try {
              const site = repos(db, scope).read.listSites().find((x) => x.id === siteId)
              if (site === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony'))
                return
              }
              const wynik = runBrief(db, scope, {
                siteUrl: site.propertyUri,
                clusterSlug: slug === '' ? undefined : slug,
              })
              res.writeHead(303, { location: `/brief/${encodeURIComponent(wynik.briefId)}` })
              res.end()
            } finally { closeDatabase(db) }
            return
          }
        }

        {
          const briefId = metoda === 'GET' ? dopasuj(sciezka, '/brief/:id') : null
          if (briefId !== null) {
            const { db } = openInitialized(config)
            try {
              const brief = contentRepos(db, scope).read.getBrief(briefId)
              if (brief === undefined) {
                wyslij(res, 404, stronaBledu(404, 'nie ma takiego briefu'))
                return
              }
              wyslij(res, 200, stronaBriefu({
                siteId: brief.siteId,
                clusterHead: naglowekBriefu(brief.payload),
                decision: brief.decision,
                targetUrl: brief.targetUrl,
                markdown: brief.markdown,
              }))
            } finally { closeDatabase(db) }
            return
          }
        }

        wyslij(res, 404, stronaBledu(404, 'nie ma takiej strony panelu'))
      } catch (error) {
        // Blad jednego zadania nie moze polozyc panelu.
        wyslij(res, 500, stronaBledu(
          500, error instanceof Error ? error.message : String(error),
        ))
      }
    })()
  })
}
