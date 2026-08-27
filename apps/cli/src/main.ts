import { homedir } from 'node:os'
import { runInit } from './commands/init.js'
import { loadConfig } from './config.js'

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

export async function main(argv: readonly string[]): Promise<number> {
  const [command, sub] = argv
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

  process.stderr.write(`Nieznane polecenie: ${command}${sub ? ` ${sub}` : ''}\n\n${USAGE}`)
  return 1
}
