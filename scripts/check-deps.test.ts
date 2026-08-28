import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDependencyRules } from './check-deps.js'

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function fakeRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'deps-'))
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

describe('checkDependencyRules', () => {
  it('nie zglasza nic dla poprawnego ukladu', () => {
    dir = fakeRepo({ 'packages/core/src/a.ts': "import { z } from 'zod'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('zglasza drizzle poza packages/db', () => {
    dir = fakeRepo({ 'packages/core/src/a.ts': "import { eq } from 'drizzle-orm'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('zglasza google-auth-library poza packages/providers', () => {
    dir = fakeRepo({ 'packages/db/src/a.ts': "import { JWT } from 'google-auth-library'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('zglasza node:fs w czystym silniku', () => {
    dir = fakeRepo({ 'packages/report/src/a.ts': "import { readFileSync } from 'node:fs'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  // To jest regula z §Czesc 6 analizy, nie tylko zakaz modulow npm: silnik,
  // ktory zaimportuje warstwe wejscia/wyjscia, przestaje byc silnikiem.
  it('zglasza import @seo/db w czystym silniku', () => {
    dir = fakeRepo({ 'packages/rules/src/a.ts': "import { repos } from '@seo/db'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('zglasza import @seo/providers w crawlerze', () => {
    dir = fakeRepo({ 'packages/crawler/src/a.ts': "import { x } from '@seo/providers'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('zglasza import @seo/db w packages/providers', () => {
    dir = fakeRepo({ 'packages/providers/src/a.ts': "import { repos } from '@seo/db'\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('przepuszcza import czystego silnika przez warstwe wejscia/wyjscia', () => {
    dir = fakeRepo({ 'packages/db/src/a.ts': "import { parsePage } from '@seo/parse'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('przepuszcza import czystego silnika przez inny czysty silnik', () => {
    dir = fakeRepo({ 'packages/rules/src/a.ts': "import { parsePage } from '@seo/parse'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('pozwala better-sqlite3 w packages/db', () => {
    dir = fakeRepo({ 'packages/db/src/a.ts': "import Database from 'better-sqlite3'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('pomija pliki testowe', () => {
    dir = fakeRepo({ 'packages/core/src/a.test.ts': "import { readFileSync } from 'node:fs'\n" })
    expect(checkDependencyRules(dir)).toEqual([])
  })

  it('wykrywa import dynamiczny', () => {
    dir = fakeRepo({ 'packages/core/src/a.ts': "const m = await import('drizzle-orm')\n" })
    expect(checkDependencyRules(dir)).toHaveLength(1)
  })

  it('nie zglasza samego repozytorium', () => {
    expect(checkDependencyRules(process.cwd())).toEqual([])
  })
})
