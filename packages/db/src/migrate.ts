import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Db, rawHandle } from './connection.js'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')

/** Stosuje migracje w kolejnosci nazw. Zwraca nazwy tych, ktore zostaly zastosowane teraz. */
export function migrate(db: Db): string[] {
  const h = rawHandle(db)
  h.exec('CREATE TABLE IF NOT EXISTS schema_migration (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')

  const applied = new Set(
    h.prepare('SELECT name FROM schema_migration').all().map((r) => (r as { name: string }).name),
  )
  const pending = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql') && !applied.has(f)).sort()

  for (const name of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8')
    h.transaction(() => {
      h.exec(sql)
      h.prepare('INSERT INTO schema_migration VALUES (?, ?)').run(name, Date.now())
    })()
  }
  return pending
}
