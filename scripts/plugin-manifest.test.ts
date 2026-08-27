import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from './skills-index.js'

const ROOT = process.cwd()
const marketplace = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'marketplace.json'), 'utf8'))

interface PluginEntry { name: string; source: string; description?: string }
const entries: PluginEntry[] = marketplace.plugins

describe('marketplace.json', () => {
  it('ma nazwe w kebab-case i wlasciciela', () => {
    expect(marketplace.name).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    expect(marketplace.owner?.name).toBeTruthy()
  })

  it('wymienia przynajmniej jeden plugin', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  it.each(entries.map((e) => [e.name, e] as const))('wpis %s wskazuje na istniejacy katalog', (_n, entry) => {
    expect(entry.source.startsWith('./')).toBe(true)
    expect(existsSync(join(ROOT, entry.source, '.claude-plugin', 'plugin.json'))).toBe(true)
  })
})

describe.each(entries.map((e) => [e.name, e] as const))('plugin %s', (name, entry) => {
  const dir = join(ROOT, entry.source)
  const plugin = JSON.parse(readFileSync(join(dir, '.claude-plugin', 'plugin.json'), 'utf8'))

  it('nazwa w manifescie zgadza sie z wpisem w marketplace', () => {
    expect(plugin.name).toBe(name)
  })

  it('ma wersje i opis', () => {
    expect(plugin.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(plugin.description).toBeTruthy()
  })

  it('kazda umiejetnosc ma frontmatter zgodny z nazwa katalogu', () => {
    const skillsDir = join(dir, 'skills')
    const skills = existsSync(skillsDir) ? readdirSync(skillsDir) : []
    expect(skills.length).toBeGreaterThan(0)
    for (const skill of skills) {
      const front = parseFrontmatter(readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8'))
      expect(front.name).toBe(skill)
      expect(front.description.length).toBeGreaterThan(30)
    }
  })

  it('kazde polecenie ma opis', () => {
    const commandsDir = join(dir, 'commands')
    for (const file of existsSync(commandsDir) ? readdirSync(commandsDir) : []) {
      const source = readFileSync(join(commandsDir, file), 'utf8')
      expect(/^---[\s\S]*?\ndescription:\s*\S/.test(source)).toBe(true)
    }
  })
})

describe('polecenia pluginu wobec package.json', () => {
  const scripts = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts as Record<string, string>

  it.each(['skills:index', 'skills:pick'])('skrypt %s istnieje', (name) => {
    expect(scripts[name]).toBeTruthy()
  })

  it('kazde pnpm-owe wywolanie z pluginu ma odpowiednik w package.json', () => {
    const dir = join(ROOT, 'plugins', 'dobor-narzedzi')
    const texts = [
      readFileSync(join(dir, 'commands', 'skille.md'), 'utf8'),
      readFileSync(join(dir, 'skills', 'dobor-narzedzi', 'SKILL.md'), 'utf8'),
    ].join('\n')
    const called = [...texts.matchAll(/pnpm (?:-s )?([a-z]+:[a-z]+)/g)].map((m) => m[1]!)
    expect(called.length).toBeGreaterThan(0)
    for (const script of new Set(called)) expect(scripts[script]).toBeTruthy()
  })
})
