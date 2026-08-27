import { homedir } from 'node:os'
import { parseArgs } from 'node:util'
import { GSC_SOURCE_TIMEZONE, defaultSyncRange, tenantScope } from '@seo/core'
import { closeDatabase } from '@seo/db'
import {
  GSC_MAX_ROW_LIMIT, createGscProvider, createServiceAccountTokenSource,
} from '@seo/providers'
import { openInitialized, runInit } from './commands/init.js'
import { runReport } from './commands/report.js'
import { runSync } from './commands/sync.js'
import { runVerify } from './commands/verify.js'
import type { Config } from './config.js'
import { loadConfig } from './config.js'
import { dbLedger } from './ledger.js'

const USAGE = `seo — platforma SEO/GEO (Faza 0)

  seo init                     utworz baze i zastosuj migracje
  seo gsc sync   --site <uri> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  seo gsc verify --site <uri>  --date YYYY-MM-DD
  seo gsc smoke  --site <uri>  jedno prawdziwe wywolanie API (poza CI)
  seo report     --site <uri> [--out sciezka.html]

Zmienne srodowiskowe:
  SEO_DB_PATH        sciezka pliku bazy (domyslnie ~/.seo/seo.db)
  SEO_GSC_KEY_FILE   sciezka klucza JSON konta serwisowego
  SEO_TENANT         identyfikator tenanta (domyslnie "local")
`

interface Flags {
  site?: string | undefined
  from?: string | undefined
  to?: string | undefined
  date?: string | undefined
  out?: string | undefined
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

    if (command === 'report') return runReportCommand(config, argv.slice(1))

    process.stderr.write(`Nieznane polecenie: ${command}${sub ? ` ${sub}` : ''}\n\n${USAGE}`)
    return 1
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    return 1
  }
}
