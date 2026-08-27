import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

/**
 * Katalog umiejetnosci: co jest dostepne i ile kosztuje wczytanie.
 * Dobor umiejetnosci bez znajomosci kosztu konczy sie wczytaniem wszystkiego,
 * a wtedy limit kontekstu wyczerpuje sie zanim praca sie zacznie.
 */

export interface ReferenceFile {
  readonly path: string
  readonly tokens: number
}

export interface SkillEntry {
  readonly name: string
  readonly description: string
  /** Koszt samego SKILL.md — tyle placi sie za wczytanie umiejetnosci. */
  readonly tokens: number
  /** Koszt wszystkich materialow dodatkowych razem — placony dopiero na zadanie. */
  readonly referenceTokens: number
  readonly references: readonly ReferenceFile[]
}

export interface SkillIndex {
  readonly skills: readonly SkillEntry[]
}

const SKILLS_DIR = join('.agents', 'skills')

/**
 * Przyblizenie liczby tokenow. Dla mieszanki polskiego i angielskiego
 * z fragmentami kodu wychodzi okolo 3,5 znaku na token. To szacunek do
 * porownywania umiejetnosci miedzy soba, nie rachunek dla dostawcy.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}

export function parseFrontmatter(source: string): { name: string; description: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source)
  if (!match) return { name: '', description: '' }

  const fields: Record<string, string> = {}
  let current: string | undefined
  for (const line of match[1]!.split(/\r?\n/)) {
    const started = /^([a-zA-Z_][\w-]*):\s?(.*)$/.exec(line)
    if (started) {
      current = started[1]!
      fields[current] = started[2]!.trim()
      continue
    }
    // Kontynuacja poprzedniego pola — wciecie bez dwukropka na poczatku.
    if (current && /^\s+\S/.test(line) && !/^\s+[\w-]+:/.test(line)) {
      fields[current] = `${fields[current]} ${line.trim()}`.trim()
    } else {
      current = undefined
    }
  }
  return { name: fields.name ?? '', description: fields.description ?? '' }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

export function buildIndex(root: string): SkillIndex {
  const base = join(root, SKILLS_DIR)
  let dirs: string[]
  try {
    dirs = readdirSync(base).filter((e) => statSync(join(base, e)).isDirectory())
  } catch {
    return { skills: [] }
  }

  const skills: SkillEntry[] = []
  for (const dirName of dirs.sort()) {
    const skillDir = join(base, dirName)
    let source: string
    try {
      source = readFileSync(join(skillDir, 'SKILL.md'), 'utf8')
    } catch {
      continue // katalog bez SKILL.md nie jest umiejetnoscia
    }

    const front = parseFrontmatter(source)
    const references = walk(skillDir)
      .filter((f) => !f.endsWith(`${sep}SKILL.md`))
      .map((f) => ({
        path: relative(skillDir, f).split(sep).join('/'),
        tokens: estimateTokens(readFileSync(f, 'utf8')),
      }))
      .sort((a, b) => a.path.localeCompare(b.path))

    skills.push({
      name: front.name || dirName,
      description: front.description,
      tokens: estimateTokens(source),
      referenceTokens: references.reduce((a, r) => a + r.tokens, 0),
      references,
    })
  }
  return { skills }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd()
  const index = buildIndex(root)
  const out = join(root, 'skills-index.json')
  writeFileSync(out, `${JSON.stringify(index, null, 2)}\n`, 'utf8')
  const total = index.skills.reduce((a, s) => a + s.tokens, 0)
  const refs = index.skills.reduce((a, s) => a + s.referenceTokens, 0)
  process.stdout.write(
    `Umiejetnosci:                ${index.skills.length}\n` +
    `Koszt wszystkich SKILL.md:   ~${total} tokenow\n` +
    `Koszt materialow dodatkowych:~${refs} tokenow\n` +
    `Zapisano:                    ${relative(root, out)}\n`,
  )
}
