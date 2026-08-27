import { expandTask } from './skills-glossary.js'
import { buildIndex, type SkillEntry, type SkillIndex } from './skills-index.js'

/**
 * Dobor umiejetnosci pod konkretne zadanie, w ramach budzetu tokenow.
 *
 * Zasada: wczytujemy tylko SKILL.md dobranych umiejetnosci, nigdy materialow
 * dodatkowych — te maja swoj koszt w indeksie i siega sie po nie dopiero,
 * gdy praca ich wymaga. Wybor jest deterministyczny, zeby dalo sie go
 * powtorzyc i zakwestionowac.
 */

export const DEFAULT_BUDGET_TOKENS = 12_000
export const DEFAULT_MAX_SKILLS = 4

/** Slowa zbyt czeste, zeby cokolwiek rozroznialy — pasowalyby do kazdego opisu. */
const STOPWORDS = new Set([
  'and', 'are', 'any', 'also', 'but', 'can', 'for', 'from', 'has', 'have', 'how', 'its',
  'like', 'not', 'the', 'that', 'this', 'them', 'they', 'their', 'these', 'those', 'use',
  'used', 'user', 'uses', 'using', 'want', 'wants', 'was', 'when', 'what', 'which', 'with',
  'you', 'your', 'need', 'needs', 'even', 'just', 'say', 'says', 'should', 'about',
  'ale', 'bez', 'bardzo', 'dla', 'gdy', 'jak', 'jest', 'jego', 'juz', 'kiedy', 'lub',
  'mam', 'moze', 'nad', 'nie', 'oraz', 'pod', 'przez', 'sie', 'tak', 'tego', 'tym',
  'wiec', 'zeby', 'ktory', 'ktora', 'ktore', 'chce', 'moj', 'moja', 'mnie', 'cos',
])

export interface PickOptions {
  readonly budgetTokens?: number
  readonly maxSkills?: number
  readonly pinned?: readonly string[]
}

export interface ChosenSkill {
  readonly name: string
  readonly score: number
  readonly tokens: number
  readonly referenceTokens: number
  readonly matched: readonly string[]
}

export type SkipReason = 'budzet' | 'limit' | 'nieznana'

export interface SkippedSkill {
  readonly name: string
  readonly score: number
  readonly tokens: number
  readonly reason: SkipReason
}

export interface Selection {
  readonly chosen: readonly ChosenSkill[]
  readonly skipped: readonly SkippedSkill[]
  readonly usedTokens: number
  readonly budgetTokens: number
}

/**
 * Litery, ktorych NFD nie rozklada na znak bazowy i diakrytyk — polskie „l"
 * z kreska jest osobnym znakiem, wiec samo NFD zjadloby je razem ze slowem.
 */
const NIEROZKLADALNE: Record<string, string> = {
  'ł': 'l', 'Ł': 'L', 'ø': 'o', 'Ø': 'O', 'đ': 'd', 'Đ': 'D', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe',
}

export function fold(text: string): string {
  return text
    .replace(/[łŁøØđĐßæœ]/g, (c) => NIEROZKLADALNE[c] ?? c)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Slowa znaczace: bez ogonkow, bez slow funkcyjnych, bez powtorzen. */
export function extractTerms(text: string): string[] {
  const folded = fold(text)
  const words = folded.split(/[^a-z0-9]+/).filter(Boolean)
  const seen = new Set<string>()
  const out: string[] = []
  for (const word of words) {
    if (word.length < 3 || STOPWORDS.has(word) || /^\d+$/.test(word)) continue
    if (seen.has(word)) continue
    seen.add(word)
    out.push(word)
  }
  return out
}

/** Frazy w cudzyslowie w opisie to wprost wypisane wyzwalacze — wazymy je wyzej. */
function quotedPhrases(description: string): string[] {
  return [...description.matchAll(/"([^"]{3,60})"/g)].map((m) => m[1]!.toLowerCase())
}

/**
 * Waga rzadkosci slowa. „test" wystepuje w polowie opisow i nie rozroznia
 * niczego; „ulid" wystepuje w jednym i jest mocna wskazowka. Bez tego
 * najczestsze slowa wygrywaja ranking i dobor sprowadza sie do losowania.
 */
function inverseFrequency(index: SkillIndex): Map<string, number> {
  const documentFrequency = new Map<string, number>()
  for (const skill of index.skills) {
    for (const term of new Set([...extractTerms(skill.name), ...extractTerms(skill.description)])) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }
  const total = Math.max(1, index.skills.length)
  const weights = new Map<string, number>()
  for (const [term, df] of documentFrequency) weights.set(term, Math.log(1 + total / df))
  return weights
}

const round2 = (value: number): number => Math.round(value * 100) / 100

function scoreSkill(
  skill: SkillEntry,
  taskTerms: readonly string[],
  task: string,
  weights: Map<string, number>,
): { score: number; matched: string[] } {
  const nameTerms = new Set(extractTerms(skill.name))
  const descriptionTerms = new Set(extractTerms(skill.description))
  const foldedTask = fold(task)

  let score = 0
  const matched: string[] = []

  // Fraza w cudzyslowie to wyzwalacz wypisany wprost przez autora umiejetnosci.
  for (const phrase of quotedPhrases(skill.description)) {
    if (foldedTask.includes(fold(phrase))) {
      score += 5
      matched.push(`"${phrase}"`)
    }
  }
  for (const term of taskTerms) {
    const weight = weights.get(term) ?? 1
    if (nameTerms.has(term)) { score += 3 * weight; matched.push(term); continue }
    if (descriptionTerms.has(term)) { score += weight; matched.push(term) }
  }
  return { score: round2(score), matched }
}

export function rankSkills(index: SkillIndex, task: string, options: PickOptions = {}): Selection {
  const budgetTokens = options.budgetTokens ?? DEFAULT_BUDGET_TOKENS
  const maxSkills = options.maxSkills ?? DEFAULT_MAX_SKILLS
  const pinned = options.pinned ?? []
  // Zadanie po polsku, opisy po angielsku — slownik dokleja odpowiedniki.
  const expandedTask = expandTask(task)
  const taskTerms = extractTerms(expandedTask)

  const chosen: ChosenSkill[] = []
  const skipped: SkippedSkill[] = []
  let usedTokens = 0

  const take = (skill: SkillEntry, score: number, matched: string[]): void => {
    if (chosen.length >= maxSkills) {
      skipped.push({ name: skill.name, score, tokens: skill.tokens, reason: 'limit' })
      return
    }
    if (usedTokens + skill.tokens > budgetTokens) {
      skipped.push({ name: skill.name, score, tokens: skill.tokens, reason: 'budzet' })
      return
    }
    usedTokens += skill.tokens
    chosen.push({
      name: skill.name, score, tokens: skill.tokens,
      referenceTokens: skill.referenceTokens, matched,
    })
  }

  // Przypiete wchodza pierwsze — placa za siebie z tego samego budzetu.
  for (const name of pinned) {
    const skill = index.skills.find((s) => s.name === name)
    if (!skill) {
      skipped.push({ name, score: 0, tokens: 0, reason: 'nieznana' })
      continue
    }
    take(skill, 0, ['przypieta'])
  }

  const weights = inverseFrequency(index)
  const ranked = index.skills
    .filter((s) => !chosen.some((c) => c.name === s.name))
    .map((skill) => ({ skill, ...scoreSkill(skill, taskTerms, expandedTask, weights) }))
    .filter((r) => r.score > 0)
    // Remis rozstrzyga tansza umiejetnosc, potem nazwa — zeby wynik byl powtarzalny.
    .sort((a, b) =>
      b.score - a.score || a.skill.tokens - b.skill.tokens || a.skill.name.localeCompare(b.skill.name))

  for (const { skill, score, matched } of ranked) take(skill, score, matched)

  return { chosen, skipped, usedTokens, budgetTokens }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const task = process.argv.slice(2).join(' ')
  if (!task) {
    process.stderr.write('Uzycie: pnpm skills:pick "opis zadania"\n')
    process.exitCode = 1
  } else {
    const selection = rankSkills(buildIndex(process.cwd()), task)
    if (selection.chosen.length === 0) {
      process.stdout.write('Zadna umiejetnosc nie pasuje do tego zadania — pracuj bez nich.\n')
    } else {
      process.stdout.write('Kandydaci do wczytania (sprawdz opisy w skills-index.json przed decyzja):\n')
      for (const c of selection.chosen) {
        process.stdout.write(
          `  ${c.name.padEnd(30)} ~${String(c.tokens).padStart(5)} tok  ` +
          `trafnosc ${c.score.toFixed(2).padStart(5)}  ` +
          `(dopasowanie: ${c.matched.slice(0, 5).join(', ')})\n`,
        )
      }
    }
    const overBudget = selection.skipped.filter((s) => s.reason !== 'nieznana')
    if (overBudget.length > 0) {
      process.stdout.write('\nPominiete:\n')
      for (const s of overBudget) {
        process.stdout.write(`  ${s.name.padEnd(30)} ~${String(s.tokens).padStart(5)} tok  (${s.reason})\n`)
      }
    }
    process.stdout.write(
      `\nBudzet: ${selection.usedTokens} / ${selection.budgetTokens} tokenow` +
      ` (${selection.chosen.length} umiejetnosci)\n`,
    )
  }
}
