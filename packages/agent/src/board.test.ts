import { describe, expect, it } from 'vitest'
import { canTransition, summarize, type AgentTask, type TaskState } from './board.js'

const zadanie = (state: TaskState, verdict: string | null = null): AgentTask => ({
  id: 'z1', actionKind: 'publish-article', state, opportunityId: 'o1', verdict,
})

describe('canTransition', () => {
  it('D46: zadanie zaczyna sie jako proposed', () => {
    expect(canTransition(zadanie('proposed'), 'needs-you').ok).toBe(true)
    expect(canTransition(zadanie('proposed'), 'in-flight').ok).toBe(true)
  })

  it('proposed nie przeskakuje od razu do pomiaru ani do done', () => {
    expect(canTransition(zadanie('proposed'), 'measuring').ok).toBe(false)
    expect(canTransition(zadanie('proposed', 'werdykt'), 'done').ok).toBe(false)
  })

  it('D53: done bez werdyktu jest niemozliwe', () => {
    const wynik = canTransition(zadanie('measuring'), 'done')
    expect(wynik.ok).toBe(false)
    if (wynik.ok) return
    expect(wynik.reason).toContain('bez werdyktu')
    expect(wynik.reason).toContain('aktywnosc zamiast na wynik')
  })

  it('D53: „nie da sie zmierzyc" TEZ jest werdyktem', () => {
    const wynik = canTransition(
      zadanie('measuring', 'Po 30 dniach nie da sie zmierzyc: za mala kontrola.'), 'done',
    )
    expect(wynik.ok).toBe(true)
  })

  it('zadanie odrzucone przez czlowieka konczy sie z werdyktem', () => {
    expect(canTransition(zadanie('needs-you', 'odrzucone przez wlasciciela'), 'done').ok)
      .toBe(true)
  })

  it('done jest stanem koncowym', () => {
    for (const cel of ['proposed', 'needs-you', 'in-flight', 'measuring'] as const) {
      expect(canTransition(zadanie('done', 'w'), cel).ok).toBe(false)
    }
  })

  it('powod odmowy mowi, dokad wolno przejsc', () => {
    const wynik = canTransition(zadanie('measuring'), 'in-flight')
    expect(wynik.ok).toBe(false)
    if (wynik.ok) return
    expect(wynik.reason).toContain('mozna przejsc do: done')
  })
})

describe('summarize', () => {
  it('liczy zadania w kazdym stanie', () => {
    const podsumowanie = summarize([
      zadanie('proposed'), zadanie('needs-you'), zadanie('needs-you'),
      zadanie('in-flight'), zadanie('measuring'), zadanie('done', 'w'),
    ])
    expect(podsumowanie).toEqual({
      proposed: 1, needsYou: 2, inFlight: 1, measuring: 1, done: 1,
    })
  })

  it('pusta tablica daje same zera', () => {
    expect(summarize([])).toEqual({
      proposed: 0, needsYou: 0, inFlight: 0, measuring: 0, done: 0,
    })
  })
})
