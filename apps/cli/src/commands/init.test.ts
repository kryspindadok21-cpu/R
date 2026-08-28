import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runInit } from './init.js'

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

describe('runInit', () => {
  it('tworzy baze, stosuje migracje i wstawia tenanta', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'a.db'), gscKeyFile: undefined, tenantId: 'local' }
    const result = runInit(cfg)
    // Bez wpisywania listy na sztywno — katalog migracji rosnie z kazda faza.
    expect(result.migrationsApplied).toContain('0001_init.sql')
    expect(result.migrationsApplied).toEqual([...result.migrationsApplied].sort())
    expect(result.tenantId).toBe('local')
  })

  it('jest idempotentny', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'a.db'), gscKeyFile: undefined, tenantId: 'local' }
    runInit(cfg)
    expect(runInit(cfg).migrationsApplied).toEqual([])
  })

  it('tworzy katalog nadrzedny, jesli nie istnieje', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'gleboko', 'a.db'), gscKeyFile: undefined, tenantId: 'local' }
    expect(() => runInit(cfg)).not.toThrow()
  })

  it('odrzuca tenanta o nieprawidlowym ksztalcie', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'))
    const cfg = { dbPath: join(dir, 'a.db'), gscKeyFile: undefined, tenantId: 'ZLE' }
    expect(() => runInit(cfg)).toThrow()
  })
})
