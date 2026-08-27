import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkSecrets } from './check-secrets.js'

// Sklejane w czasie wykonania, zeby ten plik sam nie wygladal jak wyciek klucza.
const MARKER = `-----BEGIN PRIVATE${' '}KEY-----`
const FAKE_KEY = `${MARKER}\nMIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8AgEAAkEAtesttestte000000\n`

let dir: string
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }) })

function gitRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'sekrety-'))
  execFileSync('git', ['init', '-q'], { cwd: root })
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  execFileSync('git', ['add', '-A'], { cwd: root })
  return root
}

describe('checkSecrets', () => {
  it('nie zglasza nic dla czystego repozytorium', () => {
    dir = gitRepo({ 'a.ts': "export const x = 1\n", 'README.md': '# nic\n' })
    expect(checkSecrets(dir)).toEqual([])
  })

  it('zglasza plik o nazwie klucza konta serwisowego', () => {
    dir = gitRepo({ 'gsc.sa.json': '{}\n' })
    expect(checkSecrets(dir)).toHaveLength(1)
  })

  it('zglasza tresc z kluczem prywatnym', () => {
    dir = gitRepo({ 'config.yml': `klucz: |\n  ${FAKE_KEY}\n` })
    expect(checkSecrets(dir)[0]).toMatch(/klucz prywatny/)
  })

  it('zglasza klucz zapisany w jednej linii JSON-a', () => {
    // Tak wyglada klucz w pliku konta serwisowego: nowe linie jako sekwencje \n.
    dir = gitRepo({ 'config.json': `{"private_key":"${FAKE_KEY.replaceAll('\n', '\\n')}"}` })
    expect(checkSecrets(dir)).toHaveLength(1)
  })

  it('nie zglasza dokumentacji, ktora tylko cytuje naglowek PEM', () => {
    dir = gitRepo({ 'README.md': `Skaner szuka linii ${MARKER} w plikach.\n` })
    expect(checkSecrets(dir)).toEqual([])
  })

  it('nie zglasza nic dla samego repozytorium', () => {
    expect(checkSecrets(process.cwd())).toEqual([])
  })
})
