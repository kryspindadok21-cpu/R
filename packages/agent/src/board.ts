/**
 * Tablica zadan agenta (D53).
 *
 * Tablica, na ktorej `done` znaczy „wykonano", uczy patrzec na aktywnosc
 * zamiast na wynik. To jest dokladnie ten nawyk, przed ktorym broni cala
 * Faza 4 — wiec zadanie **nie moze** przejsc w `done` bez werdyktu, takze
 * wtedy, gdy werdykt brzmi „nie da sie zmierzyc".
 */

export type TaskState = 'proposed' | 'needs-you' | 'in-flight' | 'measuring' | 'done'

export interface AgentTask {
  readonly id: string
  readonly actionKind: string
  readonly state: TaskState
  readonly opportunityId: string
  /** Niepuste dopiero wtedy, gdy pomiar sie odbyl — takze gdy skonczyl sie odmowa. */
  readonly verdict: string | null
}

export type TransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

/**
 * Dozwolone przejscia.
 *
 * `proposed` jest stanem poczatkowym kazdego zadania, bo planer emituje wylacznie
 * wnioski (D46). Droga do `in-flight` wiedzie albo przez zgode czlowieka
 * (`needs-you`), albo przez polityke `auto` — nigdy przez sam planer.
 */
const DOZWOLONE: Readonly<Record<TaskState, readonly TaskState[]>> = {
  proposed: ['needs-you', 'in-flight'],
  'needs-you': ['in-flight', 'done'],
  'in-flight': ['measuring', 'done'],
  measuring: ['done'],
  done: [],
}

export function canTransition(task: AgentTask, to: TaskState): TransitionResult {
  const dozwolone = DOZWOLONE[task.state]
  if (!dozwolone.includes(to)) {
    return {
      ok: false,
      reason: `przejscie ${task.state} → ${to} nie jest dozwolone; `
        + `z ${task.state} mozna przejsc do: ${dozwolone.join(', ') || 'nigdzie'}`,
    }
  }

  if (to === 'done' && task.verdict === null) {
    return {
      ok: false,
      reason: 'zadanie nie moze byc done bez werdyktu. Nawet „nie da sie zmierzyc" '
        + 'jest werdyktem — done bez niego znaczyloby „wykonano", a to uczy patrzec '
        + 'na aktywnosc zamiast na wynik (D53)',
    }
  }

  return { ok: true }
}

export interface BoardSummary {
  readonly needsYou: number
  readonly inFlight: number
  readonly measuring: number
  readonly done: number
  readonly proposed: number
}

export function summarize(tasks: readonly AgentTask[]): BoardSummary {
  const policz = (state: TaskState): number => tasks.filter((t) => t.state === state).length
  return {
    proposed: policz('proposed'),
    needsYou: policz('needs-you'),
    inFlight: policz('in-flight'),
    measuring: policz('measuring'),
    done: policz('done'),
  }
}
