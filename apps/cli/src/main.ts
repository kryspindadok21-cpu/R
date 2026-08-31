import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { GSC_SOURCE_TIMEZONE, defaultSyncRange, tenantScope } from '@seo/core'
import { closeDatabase } from '@seo/db'
import {
  GSC_MAX_ROW_LIMIT, RenderUnavailableError, createGscProvider, createPsiProvider,
  createRenderProvider, createServiceAccountTokenSource, createSiteFetchProvider,
  createContentProvider, createGitPrProvider, proxyFromEnv, selectEngines,
  type AccessMode, type PsiStrategy,
} from '@seo/providers'
import {
  runGeoEntity, runGeoPrompts, runGeoReport, runGeoRun,
} from './commands/geo.js'
import { runAgentBoard, runAgentMeasure, runAgentPlan } from './commands/agent.js'
import {
  RateLimitedError, runBrief, runDraft, runKeywordsCluster, runPublish,
} from './commands/content.js'
import { runLlmsTxt } from './commands/llms-txt.js'
import { runPsi } from './commands/psi.js'
import { runAuditReport } from './commands/audit-report.js'
import { runAudit } from './commands/audit.js'
import { runCrawlCommand, systemClock } from './commands/crawl.js'
import { openInitialized, runInit } from './commands/init.js'
import { runReport } from './commands/report.js'
import { runSync } from './commands/sync.js'
import { runVerify } from './commands/verify.js'
import type { Config } from './config.js'
import { loadConfig } from './config.js'
import { dbLedger } from './ledger.js'

const USAGE = `seo — platforma SEO/GEO

  seo init                     utworz baze i zastosuj migracje
  seo gsc sync   --site <uri> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  seo gsc verify --site <uri>  --date YYYY-MM-DD
  seo gsc smoke  --site <uri>  jedno prawdziwe wywolanie API (poza CI)
  seo crawl      --site <uri> [--max-pages N] [--max-depth N] [--delay MS] [--dry-run]
                             [--render N]  wyrenderuj N stron i porownaj z surowym HTML
  seo audit      --site <uri> [--run <id>]
  seo psi        --site <uri> [--limit N] [--strategy mobile|desktop]
  seo report     --site <uri> [--out sciezka.html]
  seo report     --site <uri> --audit [--out sciezka.html]   raport techniczny z crawla
  seo geo prompts --site <uri> [--add "tresc"]... [--locale pl] [--set nazwa]
  seo geo entity  --site <uri> --name "Marka" [--variants a,b] [--exclusions c] [--own]
  seo geo run     --site <uri> [--runs N] [--grounded] [--set nazwa]
  seo geo report  --site <uri> [--out sciezka.html]
  seo llms-txt   --site <uri> [--out llms.txt] [--name "Nazwa"] [--opis "Opis"]
  seo keywords cluster --site <uri> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--limit N]
  seo brief      --site <uri> [--klaster <slug>] [--powod "..."]
  seo draft      --site <uri> --brief <id> --autor "Imie Nazwisko" --autor-url <adres>
                             --zasob rodzaj:opis:zrodlo
  seo publish    --site <uri> --draft <id> --repo <sciezka> [--canonical <adres>]
  seo agent plan  --site <uri> [--limit N]   znajdz okazje i wystaw wnioski
  seo agent board --site <uri>               tablica zadan agenta
  seo agent measure --site <uri>             zmierz skutek zmian (DiD)

Bezpieczniki crawlera sa w kodzie, nie w konfiguracji: 1 zadanie/s na host,
500 stron, glebokosc 5, 15 min budzetu. Flaga moze zejsc w dol, nigdy powyzej
sufitu — wartosc ponad sufit zostanie przycieta z komunikatem.

Zmienne srodowiskowe:
  SEO_DB_PATH        sciezka pliku bazy (domyslnie ~/.seo/seo.db)
  SEO_GSC_KEY_FILE   sciezka klucza JSON konta serwisowego
  SEO_TENANT         identyfikator tenanta (domyslnie "local")
  SEO_CHROMIUM_PATH  sciezka do binarki przegladarki dla --render (opcjonalna)
  SEO_PSI_KEY        klucz PageSpeed Insights (opcjonalny, podnosi limit)
  SEO_GEMINI_KEY     klucz Gemini (opcjonalny — bez niego silnik jest pomijany)
  SEO_GROQ_KEY       klucz Groq (opcjonalny)
  SEO_OPENROUTER_KEY klucz OpenRouter (opcjonalny)
  SEO_ANTHROPIC_KEY  klucz Anthropic — jedyny PLATNY silnik, domyslnie wylaczony
  HTTPS_PROXY        serwer posredniczacy — przekazywany takze do przegladarki
`

interface Flags {
  site?: string | undefined
  from?: string | undefined
  to?: string | undefined
  date?: string | undefined
  out?: string | undefined
  run?: string | undefined
  'max-pages'?: string | undefined
  'max-depth'?: string | undefined
  delay?: string | undefined
  'dry-run'?: boolean | undefined
  audit?: boolean | undefined
  render?: string | undefined
  limit?: string | undefined
  strategy?: string | undefined
  add?: string[] | undefined
  locale?: string | undefined
  set?: string | undefined
  name?: string | undefined
  variants?: string | undefined
  exclusions?: string | undefined
  own?: boolean | undefined
  runs?: string | undefined
  grounded?: boolean | undefined
  opis?: string | undefined
  klaster?: string | undefined
  powod?: string | undefined
  brief?: string | undefined
  draft?: string | undefined
  autor?: string | undefined
  'autor-url'?: string | undefined
  zasob?: string[] | undefined
  repo?: string | undefined
  canonical?: string | undefined
}

function parseFlags(args: readonly string[]): Flags {
  const { values } = parseArgs({
    args: [...args],
    options: {
      site: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      date: { type: 'string' },
      out: { type: 'string' },
      run: { type: 'string' },
      'max-pages': { type: 'string' },
      'max-depth': { type: 'string' },
      delay: { type: 'string' },
      'dry-run': { type: 'boolean' },
      audit: { type: 'boolean' },
      render: { type: 'string' },
      limit: { type: 'string' },
      strategy: { type: 'string' },
      // `multiple` — jedno wywolanie moze dodac kilka promptow naraz.
      add: { type: 'string', multiple: true },
      locale: { type: 'string' },
      set: { type: 'string' },
      name: { type: 'string' },
      variants: { type: 'string' },
      exclusions: { type: 'string' },
      own: { type: 'boolean' },
      runs: { type: 'string' },
      grounded: { type: 'boolean' },
      opis: { type: 'string' },
      klaster: { type: 'string' },
      powod: { type: 'string' },
      brief: { type: 'string' },
      draft: { type: 'string' },
      autor: { type: 'string' },
      'autor-url': { type: 'string' },
      zasob: { type: 'string', multiple: true },
      repo: { type: 'string' },
      canonical: { type: 'string' },
    },
    allowPositionals: true,
  })
  return values
}

function requireFlag(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Brakuje wymaganej flagi --${name}`)
  return value
}

/** Dostawca GSC wymaga klucza konta serwisowego — bez niego nie ma sensu probowac. */
function gscProviderFor(config: Config, db: Parameters<typeof dbLedger>[0]) {
  if (!config.gscKeyFile) {
    throw new Error(
      'Brak klucza konta serwisowego. Ustaw SEO_GSC_KEY_FILE na sciezke pliku JSON, ' +
      'np. export SEO_GSC_KEY_FILE=~/.seo/gsc.sa.json',
    )
  }
  return createGscProvider({
    getAccessToken: createServiceAccountTokenSource(config.gscKeyFile),
    fetchFn: globalThis.fetch,
    ledger: dbLedger(db, tenantScope(config.tenantId)),
    now: () => Date.now(),
  })
}

function formatPercent(part: number, whole: number): string {
  const value = whole === 0 ? 0 : (part / whole) * 100
  return `${value.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

async function runGsc(config: Config, sub: string | undefined, args: readonly string[]): Promise<number> {
  const flags = parseFlags(args)
  const scope = tenantScope(config.tenantId)
  const { db } = openInitialized(config)

  try {
    if (sub === 'sync') {
      const siteUrl = requireFlag(flags.site, 'site')
      const fallback = defaultSyncRange(new Date(), GSC_SOURCE_TIMEZONE)
      const from = flags.from ?? fallback.from
      const to = flags.to ?? fallback.to
      const result = await runSync(
        { db, scope, provider: gscProviderFor(config, db) },
        { siteUrl, from, to, pageSize: GSC_MAX_ROW_LIMIT },
      )
      process.stdout.write(
        `Zakres:                      ${from} .. ${to}\n` +
        `Wiersze dzienne:             ${result.dailyRows}\n` +
        `Wiersze po haslach:          ${result.queryRows}\n` +
        `Wiersze po stronach:         ${result.pageRows}\n` +
        `Dni z uzgodnieniem:          ${result.reconciledDays}\n`,
      )
      return 0
    }

    if (sub === 'verify') {
      const siteUrl = requireFlag(flags.site, 'site')
      const date = requireFlag(flags.date, 'date')
      const r = runVerify(db, scope, siteUrl, date)
      process.stdout.write(
        `Dzien:                       ${r.date}\n` +
        `Klikniecia w bazie:          ${r.clicksInDatabase}      <- porownaj z Search Console\n` +
        `Wyswietlenia w bazie:        ${r.impressionsInDatabase}\n` +
        `Suma klikniec po haslach:    ${r.querySumClicks}\n` +
        `Ukryte przez Google:         ${r.anonymizedDeltaClicks} ` +
        `(${formatPercent(r.anonymizedDeltaClicks, r.clicksInDatabase)})\n`,
      )
      return 0
    }

    if (sub === 'smoke') {
      const siteUrl = requireFlag(flags.site, 'site')
      const day = flags.date ?? defaultSyncRange(new Date(), GSC_SOURCE_TIMEZONE).to
      const rows = await gscProviderFor(config, db).queryPerformance({
        siteUrl, startDate: day, endDate: day, dimensions: ['date'],
        dataState: 'final', rowLimit: 10, startRow: 0,
      })
      process.stdout.write(
        `Zapytanie o ${day} dla ${siteUrl}\n` +
        `Zwrocone wiersze:            ${rows.rows.length}\n` +
        `Strefa kalendarza zrodla:    ${rows.sourceTimezone}\n`,
      )
      return 0
    }

    process.stderr.write(`Nieznane polecenie: gsc ${sub ?? ''}\n\n${USAGE}`)
    return 1
  } finally {
    closeDatabase(db)
  }
}

function optionalNumber(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) throw new Error(`Flaga --${name} wymaga liczby, otrzymano "${value}"`)
  return parsed
}

async function runCrawlCommandLine(config: Config, args: readonly string[]): Promise<number> {
  const flags = parseFlags(args)
  const siteUrl = requireFlag(flags.site, 'site')
  const scope = tenantScope(config.tenantId)
  const { db } = openInitialized(config)

  try {
    const provider = createSiteFetchProvider({
      fetchFn: globalThis.fetch,
      ledger: dbLedger(db, scope),
      now: () => Date.now(),
    })

    const requested = {
      ...(optionalNumber(flags['max-pages'], 'max-pages') === undefined
        ? {} : { maxPages: optionalNumber(flags['max-pages'], 'max-pages') as number }),
      ...(optionalNumber(flags['max-depth'], 'max-depth') === undefined
        ? {} : { maxDepth: optionalNumber(flags['max-depth'], 'max-depth') as number }),
      ...(optionalNumber(flags.delay, 'delay') === undefined
        ? {} : { delayMs: optionalNumber(flags.delay, 'delay') as number }),
    }

    const renderCount = optionalNumber(flags.render, 'render') ?? 0

    const result = await runCrawlCommand(
      {
        db,
        scope,
        provider,
        clock: systemClock,
        renderProvider: () => {
          // Chromium nie dziedziczy proxy ze zmiennych srodowiskowych tak jak Node.
          const proxy = proxyFromEnv(process.env)
          return createRenderProvider({
            ledger: dbLedger(db, scope),
            now: () => Date.now(),
            executablePath: process.env.SEO_CHROMIUM_PATH,
            proxyServer: proxy.server,
            proxyBypass: proxy.bypass,
          })
        },
      },
      {
        siteUrl,
        limits: requested,
        dryRun: flags['dry-run'] === true,
        renderSample: renderCount,
      },
    )

    for (const adjustment of result.adjustments) {
      process.stderr.write(
        `Uwaga: --${adjustment.limit} ${adjustment.requested} przekracza sufit, ` +
        `uzyto ${adjustment.applied}\n`,
      )
    }

    if (result.robotsState === 'unreachable') {
      process.stdout.write(
        `robots.txt:                  nieosiagalny — crawl wstrzymany\n` +
        `Nic nie zostalo pobrane. To celowe: nieosiagalny robots.txt znaczy zakaz,\n` +
        `zeby nie obciazac serwera, ktory ma klopot.\n`,
      )
      return 0
    }

    if (result.runId === null) {
      process.stdout.write(
        `Proba na sucho — nic nie zostalo pobrane.\n` +
        `Adres startowy:              ${result.startUrl}\n` +
        `robots.txt:                  ${result.robotsState}\n` +
        `Adresy z mapy witryny:       ${result.sitemapUrls.length}\n` +
        `Limit stron:                 ${result.limits.maxPages}\n` +
        `Odstep miedzy zadaniami:     ${result.limits.delayMs} ms\n`,
      )
      return 0
    }

    process.stdout.write(
      `Adres startowy:              ${result.startUrl}\n` +
      `robots.txt:                  ${result.robotsState}\n` +
      `Adresy z mapy witryny:       ${result.sitemapUrls.length}\n` +
      `Strony pobrane:              ${result.pagesFetched}\n` +
      `Strony nieudane:             ${result.pagesFailed}\n` +
      `Pominiete przez robots.txt:  ${result.blockedByRobots}\n` +
      (result.outOfScope > 0
        ? `Poza katalogiem property:    ${result.outOfScope} ` +
          `— ten sam host, ale nie Twoje strony\n`
        : '') +
      `Zadania HTTP:                ${result.requests}\n` +
      `Czas:                        ${Math.round(result.durationMs / 1000)} s\n` +
      (result.rendered > 0
        ? `Strony wyrenderowane:        ${result.rendered}` +
          `${result.renderFailed > 0 ? ` (nieudane: ${result.renderFailed})` : ''}\n`
        : '') +
      // Cisza przy samych porazkach wygladalaby jak sukces. Nie wolno.
      (result.rendered === 0 && result.renderFailed > 0
        ? `Renderowanie nieudane:       ${result.renderFailed} stron\n` +
          (result.renderLastError === null
            ? ''
            : `Powod:                       ${result.renderLastError.split('\n')[0]}\n`)
        : '') +
      (result.requiringJs.length > 0
        ? `Tresc wymaga JavaScriptu:    ${result.requiringJs.length} ` +
          `— te strony sa niewidoczne dla crawlerow AI bez JS\n`
        : '') +
      (result.truncated
        ? `Crawl uciety:                ${result.truncationReason ?? 'limit'} ` +
          `— reguly serwisowe zamilkna w audycie\n`
        : ''),
    )

    // Crawl sie udal i jest w bazie; renderowania nie bylo. Kod wyjscia jest
    // niezerowy, bo uzytkownik poprosil o --render i tego nie dostal.
    if (result.renderUnavailable !== null) {
      process.stderr.write(`\n${result.renderUnavailable}\n`)
      return 1
    }
    return 0
  } finally {
    closeDatabase(db)
  }
}

async function runPsiCommand(config: Config, args: readonly string[]): Promise<number> {
  const flags = parseFlags(args)
  const siteUrl = requireFlag(flags.site, 'site')
  const scope = tenantScope(config.tenantId)

  if (flags.strategy !== undefined && flags.strategy !== 'mobile' && flags.strategy !== 'desktop') {
    throw new Error(`Flaga --strategy przyjmuje "mobile" albo "desktop", otrzymano "${flags.strategy}"`)
  }
  const strategy = (flags.strategy ?? 'mobile') as PsiStrategy
  const { db } = openInitialized(config)

  try {
    const provider = createPsiProvider({
      fetchFn: globalThis.fetch,
      ledger: dbLedger(db, scope),
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms) }),
      apiKey: process.env.SEO_PSI_KEY,
    })

    const limit = optionalNumber(flags.limit, 'limit')
    const result = await runPsi(db, scope, provider, {
      siteUrl,
      ...(limit === undefined ? {} : { limit }),
      strategy,
    })

    process.stdout.write(
      `Strategia:                   ${result.strategy}\n` +
      `Strony zmierzone:            ${result.measured}\n` +
      `Strony nieudane:             ${result.failed}\n` +
      // Powod wprost, nie „szukaj w bazie".
      (result.lastError === null ? '' : `Powod:                       ${result.lastError}\n`) +
      // 429 bez klucza to najczestszy powod porazki i ma darmowe rozwiazanie.
      (result.lastError?.includes('429') === true
        ? 'PageSpeed Insights bez klucza ma bardzo niski limit. Zaloz darmowy klucz\n' +
          'w Google Cloud i ustaw go: export SEO_PSI_KEY=<klucz>\n'
        : ''),
    )
    if (result.slowest.length > 0) {
      process.stdout.write('\nNajwolniejsze wczytanie tresci glownej:\n')
      for (const page of result.slowest) {
        process.stdout.write(`  ${String(Math.round(page.lcpMs)).padStart(6)} ms  ${page.url}\n`)
      }
    }
    return result.failed > 0 && result.measured === 0 ? 1 : 0
  } finally {
    closeDatabase(db)
  }
}

function runAuditCommand(config: Config, args: readonly string[]): number {
  const flags = parseFlags(args)
  const siteUrl = requireFlag(flags.site, 'site')
  const { db } = openInitialized(config)

  try {
    const result = runAudit(db, tenantScope(config.tenantId), {
      siteUrl,
      runId: flags.run,
    })

    const counts = result.countsBySeverity
    process.stdout.write(
      `Strony w audycie:            ${result.pagesAudited}\n` +
      `Ustalenia lacznie:           ${result.totalFindings}\n` +
      `  blokujace:                 ${counts.blocker}\n` +
      `  wysokie:                   ${counts.high}\n` +
      `  srednie:                   ${counts.medium}\n` +
      `  niskie:                    ${counts.low}\n` +
      `  informacyjne:              ${counts.info}\n`,
    )

    if (result.topRules.length > 0) {
      process.stdout.write('\nNajczestsze ustalenia:\n')
      for (const rule of result.topRules) {
        process.stdout.write(`  ${String(rule.count).padStart(4)} × ${rule.ruleId} — ${rule.title}\n`)
      }
    }

    // Pominiete reguly pokazujemy wprost: cichy brak reguly to falszywe
    // poczucie porzadku, a nie brak problemu.
    if (result.skipped.length > 0) {
      process.stdout.write(
        `\nRegul pominietych: ${result.skipped.length} ` +
        `(brakuje: ${[...new Set(result.skipped.flatMap((s) => s.missing))].join(', ')})\n`,
      )
    }
    return 0
  } finally {
    closeDatabase(db)
  }
}

/**
 * Moment wygenerowania raportu — jedyne miejsce, gdzie wolno formatowac czas
 * lokalnie, bo dotyczy chwili uruchomienia, a nie dat z Search Console (D3).
 */
function generatedAtLabel(now: Date): string {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(now)
}

function runReportCommand(config: Config, args: readonly string[]): number {
  const flags = parseFlags(args)
  const siteUrl = requireFlag(flags.site, 'site')
  const range = defaultSyncRange(new Date(), GSC_SOURCE_TIMEZONE)
  const { db } = openInitialized(config)

  try {
    if (flags.audit === true) {
      const result = runAuditReport(db, tenantScope(config.tenantId), {
        siteUrl,
        outPath: flags.out ?? 'raport-audyt.html',
        generatedAt: generatedAtLabel(new Date()),
        runId: flags.run,
      })
      process.stdout.write(
        `Raport:                      ${result.outPath}\n` +
        `Ustalenia w raporcie:        ${result.findings}\n` +
        (result.truncatedList ? 'Lista ucieta do 500 pozycji — pelna jest w bazie.\n' : ''),
      )
      return 0
    }

    const result = runReport(db, tenantScope(config.tenantId), {
      siteUrl,
      from: flags.from ?? range.from,
      to: flags.to ?? range.to,
      outPath: flags.out ?? 'raport-seo.html',
      generatedAt: generatedAtLabel(new Date()),
    })
    process.stdout.write(
      `Raport:                      ${result.outPath}\n` +
      `Dni w raporcie:              ${result.days}\n` +
      `Hasla w raporcie:            ${result.queries}\n`,
    )
    return 0
  } finally {
    closeDatabase(db)
  }
}

function listFlag(value: string | undefined): string[] {
  return (value ?? '').split(',').map((v) => v.trim()).filter((v) => v !== '')
}

function formatShare(p: { rate: number; interval: { low: number; high: number } }): string {
  const pct = (v: number) => `${(v * 100).toFixed(1)}%`
  return `${pct(p.rate)}  (${pct(p.interval.low)} – ${pct(p.interval.high)})`
}

async function runGeoCommand(
  config: Config,
  sub: string | undefined,
  args: readonly string[],
): Promise<number> {
  const flags = parseFlags(args)
  const scope = tenantScope(config.tenantId)
  const { db } = openInitialized(config)

  try {
    if (sub === 'prompts') {
      const siteUrl = requireFlag(flags.site, 'site')
      const result = runGeoPrompts(db, scope, {
        siteUrl, add: flags.add ?? [], locale: flags.locale, setName: flags.set,
      })
      process.stdout.write(
        `Zestaw:                      ${result.setName} (wersja ${result.version})\n` +
        `Dodane prompty:              ${result.added}\n` +
        `Prompty w zestawie:          ${result.total}\n` +
        `Zamrozony:                   ${result.frozen ? 'tak' : 'nie'}\n` +
        (result.frozen
          ? 'Zestaw byl juz uzyty w pomiarze. Kolejne prompty zaloza nowa wersje,\n' +
            'zeby nie uniewaznic porownan wstecz.\n'
          : ''),
      )
      return 0
    }

    if (sub === 'entity') {
      const siteUrl = requireFlag(flags.site, 'site')
      const result = runGeoEntity(db, scope, {
        siteUrl,
        name: requireFlag(flags.name, 'name'),
        variants: listFlag(flags.variants),
        exclusions: listFlag(flags.exclusions),
        isOwn: flags.own === true,
      })
      process.stdout.write(
        `Encja:                       ${result.name}\n` +
        `Wersja definicji:            ${result.version}\n` +
        (result.supersededVersion === null
          ? ''
          : `Zastapiona wersja:           ${result.supersededVersion}\n` +
            'Pomiary sprzed zmiany licza sie wedlug starej definicji i nie sa\n' +
            'porownywalne z nowymi (D29).\n'),
      )
      return 0
    }

    if (sub === 'run') {
      const siteUrl = requireFlag(flags.site, 'site')
      const accessMode: AccessMode = flags.grounded === true ? 'api_grounded' : 'api'
      const { engines, skipped } = selectEngines({
        fetchFn: globalThis.fetch,
        ledger: dbLedger(db, scope),
        now: () => Date.now(),
        env: process.env,
        accessMode,
      })

      const result = await runGeoRun(db, scope, engines, skipped, {
        siteUrl,
        runsPerPrompt: flags.runs === undefined ? undefined : Number(flags.runs),
        setName: flags.set,
      })

      const naglowek =
        `Prompty:                     ${result.prompts}\n` +
        `Przebiegi na prompt:         ${result.runsPerPrompt}\n` +
        `Wersja definicji encji:      ${result.entityVersion}\n`

      const silniki = result.outcomes.map((o) =>
        `\n${o.engine} (${o.modelVersion}, ${o.accessMode})\n` +
        `  Odpowiedzi:                ${o.answersOk}\n` +
        `  Nieudane:                  ${o.answersFailed}\n` +
        `  Odmowy modelu:             ${o.refusals}\n` +
        `  Widocznosc marki:          ${formatShare(o.visibility)}\n` +
        (o.lastError === null ? '' : `  Powod niepowodzenia:       ${o.lastError}\n`),
      ).join('')

      // Pominiety silnik melduje sie wprost. Cicha lista dwoch silnikow zamiast
      // trzech wygladalaby jak komplet danych, a nie jak brak klucza (D17, AC7).
      const pominiete = result.skipped.length === 0
        ? ''
        : `\nSilniki pominiete:\n` +
          result.skipped.map((s) => `  ${s.id}: ${s.reason}\n`).join('')

      process.stdout.write(naglowek + silniki + pominiete)

      if (result.outcomes.length === 0) {
        process.stderr.write(
          '\nZaden silnik nie byl dostepny — przebieg nie zmierzyl niczego.\n',
        )
        return 1
      }
      return 0
    }

    if (sub === 'report') {
      const siteUrl = requireFlag(flags.site, 'site')
      const result = runGeoReport(db, scope, {
        siteUrl, outPath: flags.out ?? 'raport-geo.html',
      })
      process.stdout.write(
        `Raport:                      ${result.outPath}\n` +
        `Silniki w raporcie:          ${result.engines}\n` +
        `Porownania:                  ${result.comparisons}\n` +
        (result.refused === 0
          ? ''
          : `Odmowy porownania:           ${result.refused}\n` +
            'Odmowa znaczy, ze zmienil sie zestaw promptow, wersja modelu albo\n' +
            'definicja encji. Powod jest w raporcie przy kazdym silniku.\n'),
      )
      return 0
    }

    process.stderr.write(`Nieznane polecenie: geo ${sub ?? ''}\n\n${USAGE}`)
    return 1
  } finally {
    closeDatabase(db)
  }
}

/** `rodzaj:opis:zrodlo` — dwukropki w opisie i zrodle sa dozwolone. */
function parseUniqueAsset(raw: string): {
  kind: 'own-data' | 'first-hand-quote' | 'original-diagram' | 'expert-byline'
  description: string
  sourceText: string
} {
  const czesci = raw.split(':')
  const kind = (czesci[0] ?? '').trim()
  const dozwolone = ['own-data', 'first-hand-quote', 'original-diagram', 'expert-byline']
  if (!dozwolone.includes(kind)) {
    throw new Error(
      `Nieznany rodzaj zasobu "${kind}". Dozwolone: ${dozwolone.join(', ')}. ` +
      'Format: --zasob rodzaj:opis:zrodlo',
    )
  }
  const reszta = czesci.slice(1).join(':')
  const separator = reszta.lastIndexOf(':')
  if (separator === -1) {
    throw new Error(`Zasob "${raw}" nie ma zrodla. Format: --zasob rodzaj:opis:zrodlo`)
  }
  return {
    kind: kind as 'own-data' | 'first-hand-quote' | 'original-diagram' | 'expert-byline',
    description: reszta.slice(0, separator).trim(),
    sourceText: reszta.slice(separator + 1).trim(),
  }
}

async function runContentCommand(
  config: Config,
  command: string,
  sub: string | undefined,
  args: readonly string[],
): Promise<number> {
  const flags = parseFlags(args)
  const scope = tenantScope(config.tenantId)
  const { db } = openInitialized(config)

  try {
    if (command === 'keywords') {
      if (sub !== 'cluster') {
        process.stderr.write(`Nieznane polecenie: keywords ${sub ?? ''}\n\n${USAGE}`)
        return 1
      }
      const siteUrl = requireFlag(flags.site, 'site')
      const fallback = defaultSyncRange(new Date(), GSC_SOURCE_TIMEZONE)
      const result = runKeywordsCluster(db, scope, {
        siteUrl,
        from: flags.from ?? fallback.from,
        to: flags.to ?? fallback.to,
        limit: flags.limit === undefined ? undefined : Number(flags.limit),
      })
      process.stdout.write(
        `Zestaw klastrow:             ${result.clusterSetId || 'nie powstal'}\n` +
        `Metoda:                      ${result.method}\n` +
        `Klastry:                     ${result.clusters}\n` +
        `Frazy:                       ${result.keywords}\n` +
        (result.methodWarning === null ? '' : `\n${result.methodWarning}\n`),
      )
      return result.clusters === 0 ? 1 : 0
    }

    if (command === 'brief') {
      const siteUrl = requireFlag(flags.site, 'site')
      const result = runBrief(db, scope, {
        siteUrl, clusterSlug: flags.klaster, createReason: flags.powod,
      })
      process.stdout.write(
        `Brief:                       ${result.briefId}\n` +
        `Klaster:                     ${result.clusterHead}\n` +
        `Decyzja:                     ${result.decision === 'refresh' ? 'odswiez' : 'nowy artykul'}\n` +
        (result.targetUrl === null ? '' : `Strona docelowa:             ${result.targetUrl}\n`) +
        `Luki do pokrycia:            ${result.gaps}\n` +
        `Linki wewnetrzne:            ${result.internalLinks}\n\n` +
        `${result.markdown}\n`,
      )
      return 0
    }

    if (command === 'draft') {
      const siteUrl = requireFlag(flags.site, 'site')
      const { engines, skipped } = selectEngines({
        fetchFn: globalThis.fetch,
        ledger: dbLedger(db, scope),
        now: () => Date.now(),
        env: process.env,
      })
      const engine = engines[0]
      if (engine === undefined) {
        process.stderr.write(
          'Zaden silnik nie jest dostepny — nie ma czym napisac draftu.\n' +
          skipped.map((s) => `  ${s.id}: ${s.reason}\n`).join(''),
        )
        return 1
      }

      const zasoby = (flags.zasob ?? []).map(parseUniqueAsset)
      const result = await runDraft(db, scope, createContentProvider({ engine }), {
        siteUrl,
        briefId: requireFlag(flags.brief, 'brief'),
        author: {
          name: requireFlag(flags.autor, 'autor'),
          sameAs: requireFlag(flags['autor-url'], 'autor-url'),
        },
        uniqueAssets: zasoby.map((z) => ({
          kind: z.kind, description: z.description, source: z.sourceText,
        })),
      })

      process.stdout.write(
        `Draft:                       ${result.draftId}\n` +
        `Tytul:                       ${result.title || '(brak)'}\n` +
        `Silnik:                      ${result.engine} (${result.modelVersion})\n` +
        `Bramki:                      ${result.approved ? 'przeszly' : 'ODRZUCONY'}\n` +
        (result.closestMatch === null
          ? ''
          : `Najblizszy tekst:            ${result.closestMatch}\n`),
      )
      if (!result.approved) {
        process.stderr.write(
          '\nDraft nie przeszedl bramek:\n' +
          result.failures.map((f) => `  [${f.gate}] ${f.reason}\n`).join(''),
        )
        return 1
      }
      return 0
    }

    if (command === 'publish') {
      const siteUrl = requireFlag(flags.site, 'site')
      const gitPr = createGitPrProvider({
        repoDir: requireFlag(flags.repo, 'repo'),
        ledger: dbLedger(db, scope),
        now: () => Date.now(),
      })
      const result = await runPublish(db, scope, gitPr, {
        siteUrl,
        draftId: requireFlag(flags.draft, 'draft'),
        repoDir: requireFlag(flags.repo, 'repo'),
        canonicalUrl: flags.canonical,
      })
      process.stdout.write(
        `Publikacja:                  ${result.publicationId}\n` +
        `Galaz:                       ${result.branch}\n` +
        `Plik:                        ${result.filePath}\n` +
        `Commit:                      ${result.commit.slice(0, 12)}\n` +
        `Tempo:                       ${result.rate.reason}\n\n` +
        `${result.nextStep}\n`,
      )
      return 0
    }

    process.stderr.write(`Nieznane polecenie: ${command}\n\n${USAGE}`)
    return 1
  } finally {
    closeDatabase(db)
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const [command, sub] = argv

  try {
    const config = loadConfig(process.env, homedir())

    if (!command || command === 'help' || command === '--help') {
      process.stdout.write(USAGE)
      return 0
    }

    if (command === 'init') {
      const r = runInit(config)
      process.stdout.write(
        `Baza: ${r.dbPath}\nTenant: ${r.tenantId}\nMigracje zastosowane: ` +
        `${r.migrationsApplied.length ? r.migrationsApplied.join(', ') : 'brak (juz aktualna)'}\n`,
      )
      return 0
    }

    if (command === 'gsc') return await runGsc(config, sub, argv.slice(2))

    if (command === 'crawl') return await runCrawlCommandLine(config, argv.slice(1))

    if (command === 'audit') return runAuditCommand(config, argv.slice(1))

    if (command === 'psi') return await runPsiCommand(config, argv.slice(1))

    if (command === 'report') return runReportCommand(config, argv.slice(1))

    if (command === 'geo') return await runGeoCommand(config, sub, argv.slice(2))

    if (command === 'keywords') return await runContentCommand(config, command, sub, argv.slice(2))

    if (command === 'brief' || command === 'draft' || command === 'publish') {
      return await runContentCommand(config, command, sub, argv.slice(1))
    }

    if (command === 'agent') {
      const flags = parseFlags(argv.slice(2))
      const scope = tenantScope(config.tenantId)
      const { db } = openInitialized(config)
      try {
        const siteUrl = requireFlag(flags.site, 'site')

        if (sub === 'plan') {
          const result = runAgentPlan(db, scope, {
            siteUrl, limit: flags.limit === undefined ? undefined : Number(flags.limit),
          })
          process.stdout.write(
            `Okazje znalezione:           ${result.opportunities}\n` +
            `Wnioski wystawione:          ${result.tasks.length}\n` +
            `Zablokowane wylacznikiem:    ${result.blocked}\n` +
            `Klikniecia tydzien/poprzedni:${result.breakers.clicksThisWeek} / ${result.breakers.clicksLastWeek}\n` +
            `Strony zaindeksowane:        ${result.breakers.indexedPages}\n\n`,
          )
          for (const zadanie of result.tasks) {
            const znacznik = zadanie.gate === 'auto'
              ? 'auto'
              : zadanie.gate === 'needs-approval' ? 'czeka na Ciebie' : 'ZABLOKOWANE'
            process.stdout.write(
              `[${znacznik}] ${zadanie.title}\n` +
              `  wynik ${zadanie.score.toFixed(1)}, ` +
              `${zadanie.measuredFactors}/5 czynnikow zmierzonych, akcja ${zadanie.actionKind}\n` +
              (zadanie.gateReason === '' ? '' : `  ${zadanie.gateReason}\n`),
            )
          }
          return 0
        }

        if (sub === 'board') {
          const result = runAgentBoard(db, scope, { siteUrl })
          const p = result.summary
          process.stdout.write(
            `Wnioski:                     ${p.proposed}\n` +
            `Czeka na Ciebie:             ${p.needsYou}\n` +
            `W trakcie:                   ${p.inFlight}\n` +
            `W pomiarze:                  ${p.measuring}\n` +
            `Zakonczone z werdyktem:      ${p.done}\n\n`,
          )
          for (const wiersz of result.rows) {
            process.stdout.write(
              `[${wiersz.state}] ${wiersz.title}\n` +
              (wiersz.verdict === null ? '' : `  ${wiersz.verdict}\n`) +
              (wiersz.gateReason === '' ? '' : `  ${wiersz.gateReason}\n`),
            )
          }
          return 0
        }

        if (sub === 'measure') {
          const result = runAgentMeasure(db, scope, { siteUrl })
          process.stdout.write(
            `Eksperymenty:                ${result.experiments}\n` +
            `Okna zmierzone:              ${result.windows.length}\n` +
            `Okna jeszcze trwaja:         ${result.pending}\n` +
            `Zadania zakonczone:          ${result.finished}\n\n`,
          )
          for (const okno of result.windows) {
            process.stdout.write(`${okno.sentence}\n`)
          }
          if (result.experiments === 0) {
            process.stdout.write(
              'Nie ma czego mierzyc. Eksperyment powstaje, gdy zadanie wchodzi\n' +
              'w wykonanie — a do tego trzeba najpierw danych z Search Console.\n',
            )
          }
          return 0
        }

        process.stderr.write(`Nieznane polecenie: agent ${sub ?? ''}\n\n${USAGE}`)
        return 1
      } finally {
        closeDatabase(db)
      }
    }

    if (command === 'llms-txt') {
      const flags = parseFlags(argv.slice(1))
      const { db } = openInitialized(config)
      try {
        const result = runLlmsTxt(db, tenantScope(config.tenantId), {
          siteUrl: requireFlag(flags.site, 'site'),
          outPath: flags.out ?? 'llms.txt',
          siteName: flags.name,
          description: flags.opis,
        })
        process.stdout.write(
          `Plik:                        ${result.outPath}\n` +
          `Strony w pliku:              ${result.pages}\n` +
          `Strony pominiete:            ${result.skippedPages}\n` +
          'Pominieto strony z noindex i te, ktore nie odpowiedzialy statusem 200.\n' +
          'Zaden duzy dostawca nie zobowiazal sie czytac llms.txt — ten plik nie\n' +
          'zastapi dostepnosci tresci bez JS ani samodzielnosci fragmentow.\n',
        )
        return 0
      } finally {
        closeDatabase(db)
      }
    }

    process.stderr.write(`Nieznane polecenie: ${command}${sub ? ` ${sub}` : ''}\n\n${USAGE}`)
    return 1
  } catch (error) {
    // Brak przegladarki to blad konfiguracji uzytkownika, nie awaria programu —
    // komunikat mowi wprost, co zrobic, i nie zasypuje sladem stosu.
    if (error instanceof RateLimitedError) {
      // Wylacznik zadzialal zgodnie z projektem — to nie jest awaria programu.
      process.stderr.write(
        `${error.message}\n` +
        'To jest jeden z trzech wylacznikow, ktore maja dzialac wtedy, gdy wszystko\n' +
        'inne zawiedzie. Poczekaj albo przejrzyj, co juz zostalo opublikowane.\n',
      )
      return 1
    }
    if (error instanceof RenderUnavailableError) {
      process.stderr.write(`${error.message}\n`)
      return 1
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}
