import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  buildAuditReportData, buildGeoReport, dbLedger, openInitialized, runAgentBoard,
  runAgentMeasure, runAgentPlan, runAudit, runCrawlCommand, systemClock,
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

      try {
        if (req.method === 'GET' && sciezka === '/') {
          const { db } = openInitialized(config)
          try {
            wyslij(res, 200, stronaStart(listaStron(db, scope), jobs.list()))
          } finally { closeDatabase(db) }
          return
        }

        if (req.method === 'POST' && sciezka === '/analizuj') {
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

        if (req.method === 'GET' && sciezka === '/strony') {
          const { db } = openInitialized(config)
          try {
            wyslij(res, 200, stronaListyWitryn(listaStron(db, scope)))
          } finally { closeDatabase(db) }
          return
        }

        if (req.method === 'GET' && sciezka === '/pomoc') {
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

        if (req.method === 'GET' && sciezka.startsWith('/strona/')) {
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

        if (req.method === 'GET' && sciezka.startsWith('/raport-geo/')) {
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

        if (req.method === 'GET' && sciezka.startsWith('/zadanie/')) {
          const job = jobs.get(decodeURIComponent(sciezka.slice('/zadanie/'.length)))
          if (job === undefined) {
            wyslij(res, 404, stronaBledu(404, 'nie ma takiego zadania'))
            return
          }
          wyslij(res, 200, stronaZadania(job))
          return
        }

        if (req.method === 'GET' && sciezka.startsWith('/raport/')) {
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

        if (req.method === 'GET' && sciezka.startsWith('/agent/')) {
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

        if (req.method === 'POST' && sciezka.endsWith('/measure') && sciezka.startsWith('/agent/')) {
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

        if (req.method === 'POST' && sciezka.endsWith('/plan') && sciezka.startsWith('/agent/')) {
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
