import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export interface Violation { readonly file: string; readonly specifier: string; readonly rule: string }

const IO_MODULES = [/^node:fs$/, /^node:http/, /^node:https$/, /^node:net$/, /^node:dns$/, /^node:child_process$/, /^undici$/, /^better-sqlite3$/, /^drizzle-orm/, /^google-auth-library$/, /^playwright/]

/**
 * Pakiety warstwy wejscia/wyjscia. Silnik, ktory je zaimportuje, przestaje byc
 * silnikiem — to jest reguła z §Czesc 6 analizy („silniki nigdy nie zaleza od db,
 * http, jobs, providers"), a nie tylko zakaz konkretnych modulow npm. Bez tej
 * linii regula istniala w dokumencie, ale nikt jej nie pilnowal.
 */
const IO_PACKAGES = [/^@seo\/db$/, /^@seo\/providers$/]

const PURE_ENGINE = [...IO_MODULES, ...IO_PACKAGES]

const RULES: readonly { prefix: string; forbidden: readonly RegExp[]; rule: string }[] = [
  { prefix: 'packages/core',    forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/report',  forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/parse',   forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/rules',   forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/geo',     forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/content', forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/keywords', forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/agent',   forbidden: PURE_ENGINE, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/crawler', forbidden: PURE_ENGINE, rule: 'crawler dostaje zrodlo stron wstrzykniete (D12)' },
  { prefix: 'packages/providers', forbidden: [/^drizzle-orm/, /^better-sqlite3$/, /^@seo\/db$/], rule: 'tylko packages/db dotyka bazy' },
  { prefix: 'packages/db', forbidden: [/^google-auth-library$/, /^undici$/, /^node:http/, /^@seo\/providers$/], rule: 'tylko packages/providers wychodzi na zewnatrz' },
]

const IMPORT_PATTERN = /(?:^|[^\w$])(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|(?:^|[^\w$])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g

/**
 * Pliki `*.test-helper.ts` wolno wylaczyc z regul warstw (czytaja fixture'y z dysku),
 * ale tylko dlatego, ze `checkTestHelperUsage` pilnuje, ze nikt poza testami ich nie
 * importuje. Bez tej drugiej polowy byloby to obejscie reguly, a nie wyjatek od niej.
 */
export function isTestOnly(fileName: string): boolean {
  return fileName.endsWith('.test.ts') || fileName.endsWith('.test-helper.ts')
}

function walk(dir: string, out: string[] = [], includeTests = false): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out, includeTests)
    else if (entry.endsWith('.ts') && (includeTests || !isTestOnly(entry))) out.push(full)
  }
  return out
}

/** Pomocnik testowy zaimportowany z kodu produkcyjnego to naruszenie, nie wygoda. */
export function checkTestHelperUsage(root: string): Violation[] {
  const violations: Violation[] = []
  for (const file of walk(root, [], true)) {
    const rel = relative(root, file).split(sep).join('/')
    const name = rel.slice(rel.lastIndexOf('/') + 1)
    if (isTestOnly(name)) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2]
      if (specifier?.includes('.test-helper')) {
        violations.push({
          file: rel,
          specifier,
          rule: 'pomocnik testowy wolno importowac wylacznie z plikow *.test.ts',
        })
      }
    }
  }
  return violations
}

export function checkDependencyRules(root: string): Violation[] {
  const violations: Violation[] = []
  for (const file of walk(root)) {
    const rel = relative(root, file).split(sep).join('/')
    const rule = RULES.find((r) => rel.startsWith(`${r.prefix}/`))
    if (!rule) continue
    const source = readFileSync(file, 'utf8')
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2]
      if (!specifier) continue
      if (rule.forbidden.some((p) => p.test(specifier))) {
        violations.push({ file: rel, specifier, rule: rule.rule })
      }
    }
  }
  return violations
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const found = [...checkDependencyRules(process.cwd()), ...checkTestHelperUsage(process.cwd())]
  for (const v of found) process.stderr.write(`${v.file}: import "${v.specifier}" — ${v.rule}\n`)
  process.exitCode = found.length === 0 ? 0 : 1
}
