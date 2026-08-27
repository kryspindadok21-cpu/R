import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { tenantScope } from '@seo/core'
import { type Db, migrate, openDatabase, repos } from '@seo/db'
import type { Config } from '../config.js'

export interface InitResult {
  readonly dbPath: string
  readonly tenantId: string
  readonly migrationsApplied: string[]
}

/**
 * Otwiera baze gotowa do uzycia: katalog, migracje i wiersz tenanta. Kazde
 * polecenie robi to samo, wiec `seo gsc sync` dziala takze bez wczesniejszego
 * `seo init` — a `seo init` pozostaje sposobem, zeby zrobic to swiadomie.
 */
export function openInitialized(config: Config): { db: Db; migrationsApplied: string[] } {
  mkdirSync(dirname(config.dbPath), { recursive: true })
  const db = openDatabase(config.dbPath)
  const migrationsApplied = migrate(db)
  const scope = tenantScope(config.tenantId)
  repos(db, scope).write.ensureTenant(config.tenantId)
  return { db, migrationsApplied }
}

export function runInit(config: Config): InitResult {
  const { migrationsApplied } = openInitialized(config)
  return { dbPath: config.dbPath, tenantId: config.tenantId, migrationsApplied }
}
