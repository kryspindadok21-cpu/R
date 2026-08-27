import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

export interface Violation { readonly file: string; readonly specifier: string; readonly rule: string }

const IO_MODULES = [/^node:fs$/, /^node:http/, /^node:net$/, /^undici$/, /^better-sqlite3$/, /^drizzle-orm/, /^google-auth-library$/]

const RULES: readonly { prefix: string; forbidden: readonly RegExp[]; rule: string }[] = [
  { prefix: 'packages/core',   forbidden: IO_MODULES, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/report', forbidden: IO_MODULES, rule: 'czysty silnik nie moze dotykac wejscia/wyjscia' },
  { prefix: 'packages/providers', forbidden: [/^drizzle-orm/, /^better-sqlite3$/], rule: 'tylko packages/db dotyka bazy' },
  { prefix: 'packages/db', forbidden: [/^google-auth-library$/, /^undici$/, /^node:http/], rule: 'tylko packages/providers wychodzi na zewnatrz' },
]

const IMPORT_PATTERN = /(?:^|[^\w$])(?:import|export)[\s\S]{0,200}?from\s*['"]([^'"]+)['"]|(?:^|[^\w$])(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
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
  const found = checkDependencyRules(process.cwd())
  for (const v of found) process.stderr.write(`${v.file}: import "${v.specifier}" — ${v.rule}\n`)
  process.exitCode = found.length === 0 ? 0 : 1
}
