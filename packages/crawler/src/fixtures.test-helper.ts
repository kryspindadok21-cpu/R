import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'fixtures')

export function readRobotsFixture(name: string): string {
  return readFileSync(join(FIXTURES, 'robots', name), 'utf8')
}

export function readSitemapFixture(name: string): string {
  return readFileSync(join(FIXTURES, 'sitemaps', name), 'utf8')
}

export function readPageFixture(name: string): string {
  return readFileSync(join(FIXTURES, 'pages', name), 'utf8')
}
