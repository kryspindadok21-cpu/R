import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import type { CallLedger } from '../ledger.js'

/**
 * Publikacja przez pull request (D35, D36).
 *
 * Pull request **jest** bramka zatwierdzenia. Automat robi cala robote —
 * galaz, plik, commit, push — a czlowiek klika „merge". Przy okazji dostajemy
 * darmowy rollback (revert), historie i diff, ktorego zaden adapter CMS nie da.
 *
 * Trzy rzeczy sa tu niemozliwe i to jest cala reszta tego pliku:
 * commit na galezi domyslnej, wciagniecie cudzych niezacommitowanych zmian
 * i zapis poza katalogiem repozytorium.
 */

export class DefaultBranchError extends Error {
  constructor(branch: string) {
    super(
      `Odmowa publikacji na galezi chronionej (${branch}). Tresc trafia zawsze na `
      + 'osobna galaz, bo pull request jest bramka zatwierdzenia (D35).',
    )
    this.name = 'DefaultBranchError'
  }
}

export class UnknownDefaultBranchError extends Error {
  constructor() {
    super(
      'Nie da sie ustalic galezi domyslnej repozytorium. Odmowa publikacji: '
      + 'zgadywanie w tym miejscu konczy sie commitem na galezi produkcyjnej. '
      + 'Podaj ja wprost przez `defaultBranch`.',
    )
    this.name = 'UnknownDefaultBranchError'
  }
}

export class NothingToCommitError extends Error {
  constructor(filePath: string) {
    super(
      `Plik ${filePath} ma juz dokladnie te tresc na galezi docelowej — nie ma czego `
      + 'commitowac. To nie jest awaria, tylko informacja, ze publikacja nic nie zmienia.',
    )
    this.name = 'NothingToCommitError'
  }
}

export class DirtyWorktreeError extends Error {
  constructor(readonly changes: string) {
    super(
      'Repozytorium ma niezacommitowane zmiany. Publikacja przerwana, zeby nie '
      + `wciagnac cudzej pracy do commita z trescia:\n${changes}`,
    )
    this.name = 'DirtyWorktreeError'
  }
}

export class PathOutsideRepoError extends Error {
  constructor(path: string) {
    super(`Sciezka ${path} wychodzi poza repozytorium. Odmowa zapisu.`)
    this.name = 'PathOutsideRepoError'
  }
}

export interface GitResult {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

export type GitRunner = (args: readonly string[], cwd: string) => Promise<GitResult>

/** Domyslny wykonawca. Podmieniany w testach na taki, ktory liczy wywolania. */
export const runGit: GitRunner = (args, cwd) =>
  new Promise((resolvePromise) => {
    execFile('git', [...args], { cwd, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolvePromise({
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        // `code` z ExecException bywa napisem (sygnal), a nas interesuje tylko
        // „udalo sie albo nie" — wiec wszystko, co nie jest liczba, to porazka.
        code: error === null ? 0 : (typeof error.code === 'number' ? error.code : 1),
      })
    })
  })

export interface GitPrDeps {
  readonly run?: GitRunner | undefined
  readonly repoDir: string
  readonly ledger: CallLedger
  readonly now: () => number
  /** Nazwa galezi, na ktora nigdy nie wolno commitowac. */
  readonly defaultBranch?: string | undefined
}

export interface PublishInput {
  readonly branch: string
  /** Sciezka wzgledem katalogu repozytorium. */
  readonly filePath: string
  readonly contents: string
  readonly commitMessage: string
}

export interface PublishResult {
  readonly branch: string
  readonly filePath: string
  readonly commit: string
  /** `true`, gdy udalo sie wypchnac galaz. Bez zdalnego repozytorium `false`. */
  readonly pushed: boolean
  /** Co czlowiek ma teraz zrobic — zawsze niepuste. */
  readonly nextStep: string
}

async function gitOrThrow(
  run: GitRunner, args: readonly string[], cwd: string,
): Promise<string> {
  const result = await run(args, cwd)
  if (result.code !== 0) {
    throw new Error(`git ${args.join(' ')} zakonczylo sie kodem ${result.code}: ${result.stderr.trim()}`)
  }
  return result.stdout.trim()
}

/** Nazwy, ktore w praktyce zawsze sa galezia produkcyjna. */
const ZWYCZAJOWE_GALEZIE_DOMYSLNE = ['main', 'master'] as const

/**
 * Galezie, na ktore nie wolno commitowac.
 *
 * **Swiadomie nie ma tu odwolania do galezi biezacej.** Pierwsza wersja tej
 * funkcji spadala na `rev-parse --abbrev-ref HEAD`, gdy `origin/HEAD` nie
 * istnialo — i to bylo grozne: po pierwszej publikacji galezia biezaca jest
 * galaz z trescia, wiec `main` przestawal byc chroniony dokladnie wtedy, gdy
 * zabezpieczenie bylo najbardziej potrzebne. Zlapal to test.
 *
 * Zamiast zgadywac, bierzemy `origin/HEAD` **oraz** te ze zwyczajowych nazw,
 * ktore w repozytorium naprawde istnieja. Gdy nie ma zadnej — odmawiamy.
 */
async function protectedBranches(run: GitRunner, cwd: string): Promise<Set<string>> {
  const chronione = new Set<string>()

  const zdalna = await run(['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], cwd)
  if (zdalna.code === 0 && zdalna.stdout.trim() !== '') {
    chronione.add(zdalna.stdout.trim().replace(/^origin\//, ''))
  }

  for (const nazwa of ZWYCZAJOWE_GALEZIE_DOMYSLNE) {
    const istnieje = await run(['rev-parse', '--verify', '--quiet', `refs/heads/${nazwa}`], cwd)
    if (istnieje.code === 0) chronione.add(nazwa)
  }

  return chronione
}

export function createGitPrProvider(deps: GitPrDeps) {
  const run = deps.run ?? runGit
  const repoDir = resolve(deps.repoDir)

  return {
    id: 'git-pr' as const,

    async publish(input: PublishInput): Promise<PublishResult> {
      const startedAt = deps.now()
      let ok = false
      let blad: string | null = null

      try {
        const target = resolve(repoDir, input.filePath)
        const wzgledna = relative(repoDir, target)
        if (wzgledna.startsWith('..') || isAbsolute(wzgledna)) {
          throw new PathOutsideRepoError(input.filePath)
        }

        const chronione = deps.defaultBranch !== undefined
          ? new Set([deps.defaultBranch])
          : await protectedBranches(run, repoDir)
        if (chronione.size === 0) throw new UnknownDefaultBranchError()
        if (chronione.has(input.branch)) throw new DefaultBranchError(input.branch)

        // Brudne drzewo przerywa publikacje. Commit z trescia, ktory przy okazji
        // wciaga czyjas niedokonczona prace, jest gorszy niz brak publikacji.
        const status = await gitOrThrow(run, ['status', '--porcelain'], repoDir)
        if (status !== '') throw new DirtyWorktreeError(status)

        await gitOrThrow(run, ['checkout', '-B', input.branch], repoDir)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, input.contents, 'utf8')
        await gitOrThrow(run, ['add', '--', wzgledna], repoDir)

        // Brak zmian po `add` znaczy, ze plik juz ma te tresc. To jest informacja,
        // a nie awaria — i zasluguje na komunikat, ktory to mowi, zamiast na
        // surowy blad gita z pustym stderr.
        const doZacommitowania = await run(['diff', '--cached', '--name-only'], repoDir)
        if (doZacommitowania.stdout.trim() === '') throw new NothingToCommitError(wzgledna)

        await gitOrThrow(run, ['commit', '-m', input.commitMessage], repoDir)
        const commit = await gitOrThrow(run, ['rev-parse', 'HEAD'], repoDir)

        const push = await run(['push', '-u', 'origin', input.branch], repoDir)
        const pushed = push.code === 0

        ok = true
        return {
          branch: input.branch,
          filePath: wzgledna,
          commit,
          pushed,
          nextStep: pushed
            ? `Galaz ${input.branch} wypchnieta. Otworz pull request i przejrzyj diff `
              + 'przed merge — to jest bramka zatwierdzenia, nie formalnosc.'
            : `Galaz ${input.branch} powstala lokalnie, ale push sie nie udal `
              + `(${push.stderr.trim() || 'brak zdalnego repozytorium'}). `
              + 'Wypchnij ja recznie i otworz pull request.',
        }
      } catch (error) {
        blad = error instanceof Error ? error.message : String(error)
        throw error
      } finally {
        deps.ledger.record({
          providerId: 'git-pr',
          capability: 'content.publish',
          startedAt,
          durationMs: deps.now() - startedAt,
          ok,
          errorCode: blad ?? undefined,
          quotaUnits: 0,
          costMicros: 0,
          requestFingerprint: `${input.branch}|${input.filePath}`,
        })
      }
    },
  }
}

export type GitPrProvider = ReturnType<typeof createGitPrProvider>
