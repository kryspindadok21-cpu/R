import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { LOCAL_TENANT, tenantScope } from '@seo/core'

export interface Config {
  readonly dbPath: string
  readonly gscKeyFile: string | undefined
  readonly tenantId: string
}

/**
 * Domyslne miejsce klucza konta serwisowego.
 *
 * Dokumentacja mowila „zapisz w `~/.seo/gsc.sa.json`" i **na tym sie konczylo** —
 * plik lezal na miejscu, a narzedzie i tak meldowalo brak klucza, dopoki ktos nie
 * wyeksportowal `SEO_GSC_KEY_FILE`. Instrukcja, ktora nie dziala po wykonaniu jej
 * co do litery, jest gorsza niz brak instrukcji.
 */
export const DOMYSLNY_KLUCZ_GSC = join('.seo', 'gsc.sa.json')

/**
 * Rozwiniecie wiodacego `~/`.
 *
 * Powloka rozwija tylde tylko bez cudzyslowu. `export SEO_GSC_KEY_FILE=~/x.json`
 * zadziala, a `SEO_GSC_KEY_FILE="~/x.json"` — z cudzyslowem, w pliku `.env` albo
 * w konfiguracji edytora — przekaze doslowna tylde i skonczy sie bledem
 * „nie ma takiego pliku", ktory nie mowi, o co naprawde chodzi.
 */
function rozwinTylde(sciezka: string, homeDir: string): string {
  return sciezka === '~' ? homeDir
    : sciezka.startsWith('~/') ? join(homeDir, sciezka.slice(2))
      : sciezka
}

export function loadConfig(
  env: NodeJS.ProcessEnv,
  homeDir: string,
  /** Wstrzykiwane, zeby test nie zalezal od zawartosci katalogu domowego. */
  istnieje: (sciezka: string) => boolean = existsSync,
): Config {
  const tenantId = env.SEO_TENANT ?? LOCAL_TENANT
  tenantScope(tenantId) // waliduje ksztalt slug-a, rzuca przy bledzie

  const wskazany = env.SEO_GSC_KEY_FILE
  const domyslny = join(homeDir, DOMYSLNY_KLUCZ_GSC)

  return {
    dbPath: rozwinTylde(env.SEO_DB_PATH ?? join(homeDir, '.seo', 'seo.db'), homeDir),
    gscKeyFile: wskazany !== undefined && wskazany !== ''
      ? rozwinTylde(wskazany, homeDir)
      : istnieje(domyslny) ? domyslny : undefined,
    tenantId,
  }
}
