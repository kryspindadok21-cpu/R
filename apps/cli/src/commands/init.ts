import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { tenantScope } from '@seo/core'
import { migrate, openDatabase, repos } from '@seo/db'
import type { Config } from '../config.js'

export interface InitResult {
  readonly dbPath: string
  readonly tenantId: string
  readonly migrationsApplied: string[]
}

export function runInit(config: Config): InitResult {
  mkdirSync(dirname(config.dbPath), { recursive: true })
  const db = openDatabase(config.dbPath)
  const migrationsApplied = migrate(db)
  const scope = tenantScope(config.tenantId)
  repos(db, scope).write.ensureTenant(config.tenantId)
  return { dbPath: config.dbPath, tenantId: config.tenantId, migrationsApplied }
}
