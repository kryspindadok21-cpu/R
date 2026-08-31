import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { GSC_SOURCE_TIMEZONE, defaultSyncRange, tenantScope } from '@seo/core'
import { closeDatabase } from '@seo/db'
import {
  GSC_MAX_ROW_LIMIT, RenderUnavailableError, createGscProvider, createPsiProvider,
  createRenderProvider, createServiceAccountTokenSource, createSiteFetchProvider,
  proxyFromEnv, selectEngines, type AccessMode, type PsiStrategy,
} from '@seo/providers'
import {
  runGeoEntity, runGeoPrompts, runGeoReport, runGeoRun,
} from './commands/geo.js'
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

    process.stderr.write(`Nieznane polecenie: ${command}${sub ? ` ${sub}` : ''}\n\n${USAGE}`)
    return 1
  } catch (error) {
    // Brak przegladarki to blad konfiguracji uzytkownika, nie awaria programu —
    // komunikat mowi wprost, co zrobic, i nie zasypuje sladem stosu.
    if (error instanceof RenderUnavailableError) {
      process.stderr.write(`${error.message}\n`)
      return 1
    }
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}
