import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures')

/** Wczytuje fixture HTML. Uzywane wylacznie w testach — poza nimi pakiet nie dotyka dysku. */
export function readPageFixture(name: string): string {
  return readFileSync(join(FIXTURES, 'pages', name), 'utf8')
}

export function fixturesDir(...segments: readonly string[]): string {
  return join(FIXTURES, ...segments)
}
