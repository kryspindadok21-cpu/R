import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import {
  buildAuditReportData, dbLedger, openInitialized, runAgentBoard, runAgentPlan,
  runAudit, runCrawlCommand, systemClock,
} from '@seo/cli/lib'
import { tenantScope, type TenantScope } from '@seo/core'
import { closeDatabase, crawlRepos, geoRepos, repos, type Db } from '@seo/db'
import { createSiteFetchProvider } from '@seo/providers'
import { renderAuditReport } from '@seo/report'
import { JobRegistry } from './jobs.js'
import {
  stronaAgenta, stronaBledu, stronaGlowna, stronaZadania, type SiteRow,
} from './pages.js'

/**
 * Lokalny panel.
 *
 * Nasluchuje **wylacznie na petli zwrotnej**. To nie jest ostroznosc na wyrost:
 * panel uruchamia crawler na dowolny podany adres i ma pelny dostep do bazy,
 * wiec wystawienie go na siec byloby oddaniem obu tych rzeczy komukolwiek
 * w tej samej sieci.
 */

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

function listaStron(db: Db, scope: TenantScope): SiteRow[] {
  const crawlRepo = crawlRepos(db, scope)
  const geoRepo = geoRepos(db, scope)

  return repos(db, scope).read.listSites().map((site) => {
    const run = crawlRepo.read.latestCrawlRun(site.id)
    return {
      id: site.id,
      propertyUri: site.propertyUri,
      pages: run === undefined ? 0 : crawlRepo.read.listCrawlPages(run.id).length,
      findings: run === undefined ? 0 : crawlRepo.read.listFindings(run.id).length,
      hasGeo: geoRepo.read.latestGeoRun(site.id) !== undefined,
    }
  })
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
            wyslij(res, 200, stronaGlowna(listaStron(db, scope), jobs.list()))
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
