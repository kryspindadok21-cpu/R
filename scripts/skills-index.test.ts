import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildIndex, estimateTokens, parseFrontmatter } from './skills-index.js'

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function skillRepo(skills: Record<string, Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'skille-'))
  for (const [name, files] of Object.entries(skills)) {
    for (const [path, content] of Object.entries(files)) {
      const full = join(root, '.agents', 'skills', name, path)
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, content)
    }
  }
  return root
}

const SKILL = (name: string, description: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nTresc umiejetnosci.\n`

describe('parseFrontmatter', () => {
  it('czyta name i description', () => {
    expect(parseFrontmatter(SKILL('seo-audit', 'Audyt SEO strony'))).toEqual({
      name: 'seo-audit', description: 'Audyt SEO strony',
    })
  })

  it('czyta description zlozony z wielu linii', () => {
    const text = '---\nname: x\ndescription: pierwsza linia\n  ciag dalszy\nmetadata:\n  version: 1\n---\n# x\n'
    expect(parseFrontmatter(text).description).toBe('pierwsza linia ciag dalszy')
  })

  it('zwraca puste pola, gdy nie ma frontmattera', () => {
    expect(parseFrontmatter('# Bez frontmattera\n')).toEqual({ name: '', description: '' })
  })
})

describe('estimateTokens', () => {
  it('rosnie wraz z dlugoscia tekstu', () => {
    expect(estimateTokens('a'.repeat(350))).toBeGreaterThan(estimateTokens('a'.repeat(35)))
  })

  it('pusty tekst kosztuje zero', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('nigdy nie zwraca ulamka', () => {
    expect(Number.isInteger(estimateTokens('kilka slow po polsku'))).toBe(true)
  })
})

describe('buildIndex', () => {
  it('opisuje kazda umiejetnosc z katalogu', () => {
    dir = skillRepo({
      'seo-audit': { 'SKILL.md': SKILL('seo-audit', 'Audyt SEO') },
      'schema': { 'SKILL.md': SKILL('schema', 'Dane strukturalne') },
    })
    expect(buildIndex(dir).skills.map((s) => s.name).sort()).toEqual(['schema', 'seo-audit'])
  })

  it('liczy koszt SKILL.md osobno od materialow dodatkowych', () => {
    dir = skillRepo({
      'seo-audit': {
        'SKILL.md': SKILL('seo-audit', 'Audyt SEO'),
        'references/duzy.md': 'x'.repeat(10_000),
      },
    })
    const skill = buildIndex(dir).skills[0]!
    expect(skill.tokens).toBeLessThan(skill.referenceTokens)
    expect(skill.references).toEqual([expect.objectContaining({ path: 'references/duzy.md' })])
  })

  it('pomija katalogi bez SKILL.md', () => {
    dir = skillRepo({ 'niepelna': { 'README.md': 'nic tu nie ma' } })
    expect(buildIndex(dir).skills).toEqual([])
  })

  it('bierze nazwe z katalogu, gdy frontmatter jej nie podaje', () => {
    dir = skillRepo({ 'bez-nazwy': { 'SKILL.md': '# Bez frontmattera\n' } })
    expect(buildIndex(dir).skills[0]!.name).toBe('bez-nazwy')
  })

  it('zwraca pusty indeks dla repozytorium bez umiejetnosci', () => {
    dir = mkdtempSync(join(tmpdir(), 'skille-'))
    expect(buildIndex(dir)).toEqual({ skills: [] })
  })

  it('opisuje umiejetnosci tego repozytorium', () => {
    const index = buildIndex(process.cwd())
    expect(index.skills.length).toBeGreaterThan(10)
    expect(index.skills.every((s) => s.tokens > 0)).toBe(true)
  })
})

describe('skills-index.json', () => {
  it('jest aktualny wobec katalogu umiejetnosci', () => {
    // Nieaktualny indeks znaczy, ze dobor liczy budzet na starych kosztach.
    // Naprawa: pnpm skills:index
    const committed = JSON.parse(readFileSync(join(process.cwd(), 'skills-index.json'), 'utf8'))
    expect(committed).toEqual(buildIndex(process.cwd()))
  })
})
