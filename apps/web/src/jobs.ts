/**
 * Zadania w tle.
 *
 * Crawl idzie z bezpiecznikiem jednego zadania na sekunde na host (D15), wiec
 * dwadziescia stron to ponad dwadziescia sekund. Synchroniczna odpowiedz HTTP
 * przez ten czas to zakrecone kolo w przegladarce i zadnej informacji, czy
 * cokolwiek sie dzieje — dlatego zadanie chodzi w tle, a strona pokazuje postep.
 *
 * Rejestr jest w pamieci i to jest **swiadome**: to narzedzie lokalne, a stan
 * trwaly i tak siedzi w bazie. Zadanie przerwane restartem panelu nie gubi
 * zadnych danych — gubi tylko pasek postepu.
 */

export type JobState = 'w-toku' | 'gotowe' | 'blad'

export interface Job {
  readonly id: string
  readonly siteUrl: string
  state: JobState
  step: string
  siteId: string | null
  error: string | null
  readonly startedAt: number
  finishedAt: number | null
}

export class JobRegistry {
  readonly #jobs = new Map<string, Job>()
  #counter = 0

  create(siteUrl: string): Job {
    this.#counter += 1
    const job: Job = {
      id: `${Date.now().toString(36)}-${this.#counter}`,
      siteUrl,
      state: 'w-toku',
      step: 'start',
      siteId: null,
      error: null,
      startedAt: Date.now(),
      finishedAt: null,
    }
    this.#jobs.set(job.id, job)
    return job
  }

  get(id: string): Job | undefined {
    return this.#jobs.get(id)
  }

  step(id: string, step: string): void {
    const job = this.#jobs.get(id)
    if (job !== undefined) job.step = step
  }

  finish(id: string, siteId: string): void {
    const job = this.#jobs.get(id)
    if (job === undefined) return
    job.state = 'gotowe'
    job.step = 'gotowe'
    job.siteId = siteId
    job.finishedAt = Date.now()
  }

  fail(id: string, error: string): void {
    const job = this.#jobs.get(id)
    if (job === undefined) return
    job.state = 'blad'
    job.error = error
    job.finishedAt = Date.now()
  }

  list(): Job[] {
    return [...this.#jobs.values()].sort((a, b) => b.startedAt - a.startedAt)
  }
}
