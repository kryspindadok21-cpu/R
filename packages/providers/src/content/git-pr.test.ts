import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ProviderCallEntry } from '../ledger.js'
import {
  DefaultBranchError, DirtyWorktreeError, NothingToCommitError, PathOutsideRepoError,
  UnknownDefaultBranchError, createGitPrProvider,
} from './git-pr.js'

/**
 * Testy chodza po **prawdziwym** repozytorium git w katalogu tymczasowym.
 * Atrapa wykonawcy dowiodlaby tylko, ze skladamy poprawne argumenty — a nie,
 * ze git faktycznie robi to, czego oczekujemy.
 */

let dir: string
let zdalne: string
let entries: ProviderCallEntry[]

const ledger = { record: (e: ProviderCallEntry) => { entries.push(e) } }
let zegar = 0
const now = () => (zegar += 5)

function git(args: readonly string[], cwd: string): string {
  return execFileSync('git', [...args], { cwd, encoding: 'utf8' })
}

beforeEach(() => {
  entries = []
  const baza = mkdtempSync(join(tmpdir(), 'git-pr-'))
  dir = join(baza, 'repo')
  zdalne = join(baza, 'zdalne.git')

  git(['init', '--bare', '--initial-branch=main', zdalne], baza)
  git(['init', '--initial-branch=main', dir], baza)
  git(['config', 'user.email', 'test@przyklad.test'], dir)
  git(['config', 'user.name', 'Test'], dir)
  writeFileSync(join(dir, 'README.md'), '# repo\n')
  git(['add', '.'], dir)
  git(['commit', '-m', 'poczatek'], dir)
  git(['remote', 'add', 'origin', zdalne], dir)
  git(['push', '-u', 'origin', 'main'], dir)
})

afterEach(() => {
  rmSync(join(dir, '..'), { recursive: true, force: true })
})

const provider = () => createGitPrProvider({ repoDir: dir, ledger, now })

const WEJSCIE = {
  branch: 'tresc/audyt-seo',
  filePath: 'content/audyt-seo.md',
  contents: '# Audyt SEO\n\nTresc artykulu.\n',
  commitMessage: 'tresc: audyt seo',
}

describe('publikacja przez git', () => {
  it('zaklada galaz, zapisuje plik i commituje', async () => {
    const wynik = await provider().publish(WEJSCIE)

    expect(wynik.branch).toBe('tresc/audyt-seo')
    expect(wynik.filePath).toBe('content/audyt-seo.md')
    expect(wynik.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(readFileSync(join(dir, 'content/audyt-seo.md'), 'utf8')).toBe(WEJSCIE.contents)
    expect(git(['rev-parse', '--abbrev-ref', 'HEAD'], dir).trim()).toBe('tresc/audyt-seo')
    expect(git(['log', '-1', '--pretty=%s'], dir).trim()).toBe('tresc: audyt seo')
  })

  it('wypycha galaz i mowi, co dalej', async () => {
    const wynik = await provider().publish(WEJSCIE)
    expect(wynik.pushed).toBe(true)
    expect(wynik.nextStep).toContain('pull request')
    expect(git(['branch', '--list', 'tresc/audyt-seo'], zdalne).trim()).toContain('tresc/audyt-seo')
  })

  it('D35: odmawia commita na galezi domyslnej', async () => {
    await expect(provider().publish({ ...WEJSCIE, branch: 'main' }))
      .rejects.toThrow(DefaultBranchError)
    // Nic nie powstalo.
    expect(git(['status', '--porcelain'], dir).trim()).toBe('')
  })

  it('D35: main zostaje chroniony TAKZE po wczesniejszej publikacji', async () => {
    // Pierwsza wersja wykrywania spadala na galaz biezaca, wiec po tej linii
    // `main` przestawal byc chroniony — dokladnie wtedy, gdy zabezpieczenie
    // bylo najbardziej potrzebne.
    await provider().publish(WEJSCIE)
    expect(git(['rev-parse', '--abbrev-ref', 'HEAD'], dir).trim()).toBe('tresc/audyt-seo')

    await expect(provider().publish({ ...WEJSCIE, branch: 'main', contents: '# co innego\n' }))
      .rejects.toThrow(DefaultBranchError)
  })

  it('master tez jest chroniony, gdy istnieje', async () => {
    git(['branch', 'master'], dir)
    await expect(provider().publish({ ...WEJSCIE, branch: 'master' }))
      .rejects.toThrow(DefaultBranchError)
  })

  it('bez zadnej rozpoznanej galezi domyslnej odmawia, zamiast zgadywac', async () => {
    git(['branch', '-m', 'main', 'produkcja'], dir)
    await expect(provider().publish(WEJSCIE)).rejects.toThrow(UnknownDefaultBranchError)
  })

  it('ta sama tresc drugi raz to informacja, nie awaria', async () => {
    await provider().publish(WEJSCIE)
    await expect(provider().publish(WEJSCIE)).rejects.toThrow(NothingToCommitError)
  })

  it('odmawia, gdy repozytorium ma niezacommitowane zmiany', async () => {
    writeFileSync(join(dir, 'README.md'), '# zmienione recznie\n')
    await expect(provider().publish(WEJSCIE)).rejects.toThrow(DirtyWorktreeError)
    // Cudza praca zostaje nietknieta.
    expect(readFileSync(join(dir, 'README.md'), 'utf8')).toBe('# zmienione recznie\n')
  })

  it('odmawia zapisu poza katalogiem repozytorium', async () => {
    await expect(provider().publish({ ...WEJSCIE, filePath: '../poza/plik.md' }))
      .rejects.toThrow(PathOutsideRepoError)
  })

  it('zaklada brakujace katalogi', async () => {
    const wynik = await provider().publish({
      ...WEJSCIE, filePath: 'content/2026/08/gleboko.md',
    })
    expect(wynik.filePath).toBe('content/2026/08/gleboko.md')
    expect(readFileSync(join(dir, 'content/2026/08/gleboko.md'), 'utf8')).toBe(WEJSCIE.contents)
  })

  it('bez zdalnego repozytorium galaz powstaje, a wynik mowi to wprost', async () => {
    git(['remote', 'remove', 'origin'], dir)
    const wynik = await provider().publish(WEJSCIE)
    expect(wynik.pushed).toBe(false)
    expect(wynik.nextStep).toContain('recznie')
    expect(git(['rev-parse', '--abbrev-ref', 'HEAD'], dir).trim()).toBe('tresc/audyt-seo')
  })

  it('galaz domyslna da sie podac wprost, gdy origin/HEAD nie istnieje', async () => {
    git(['remote', 'remove', 'origin'], dir)
    const jawny = createGitPrProvider({ repoDir: dir, ledger, now, defaultBranch: 'main' })
    await expect(jawny.publish({ ...WEJSCIE, branch: 'main' })).rejects.toThrow(DefaultBranchError)
  })

  it('kazda publikacja ma wiersz w rejestrze, takze nieudana', async () => {
    await provider().publish(WEJSCIE)
    expect(entries).toHaveLength(1)
    expect(entries[0]?.providerId).toBe('git-pr')
    expect(entries[0]?.ok).toBe(true)
    expect(entries[0]?.requestFingerprint).toBe('tresc/audyt-seo|content/audyt-seo.md')

    await expect(provider().publish({ ...WEJSCIE, branch: 'main' })).rejects.toThrow()
    expect(entries).toHaveLength(2)
    expect(entries[1]?.ok).toBe(false)
    expect(entries[1]?.errorCode).toContain('galezi chronionej')
  })

  it('publikacja nie zuzywa limitu zewnetrznego API', async () => {
    await provider().publish(WEJSCIE)
    expect(entries[0]?.quotaUnits).toBe(0)
    expect(entries[0]?.costMicros).toBe(0)
  })

  it('poprawiona tresc na tej samej galezi tworzy nowy commit', async () => {
    const pierwszy = await provider().publish(WEJSCIE)
    git(['checkout', 'main'], dir)
    const drugi = await provider().publish({
      ...WEJSCIE, contents: '# Audyt SEO\n\nPoprawiona tresc.\n', commitMessage: 'tresc: poprawka',
    })
    expect(drugi.commit).not.toBe(pierwszy.commit)
    expect(readFileSync(join(dir, 'content/audyt-seo.md'), 'utf8')).toContain('Poprawiona')
  })
})
