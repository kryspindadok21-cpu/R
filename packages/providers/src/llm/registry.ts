import type { CallLedger } from '../ledger.js'
import { createAnthropicProvider } from './anthropic.js'
import { createGeminiProvider } from './gemini.js'
import {
  GROQ_BASE_URL, OPENROUTER_BASE_URL, createOpenAiCompatibleProvider,
} from './openai-compatible.js'
import type { AccessMode, EngineId, LlmEngineProvider, SkippedEngine } from './types.js'

/**
 * Dobor silnikow na podstawie dostepnych kluczy (D28).
 *
 * Brak klucza do jednego silnika **nie blokuje przebiegu** — silnik melduje sie
 * jako pominiety z powodem, dokladnie tak jak regula bez spelnionych `requires`
 * w Fazie 1 (D17). Cicho pominiety silnik to falszywe poczucie porzadku:
 * raport pokazywalby wtedy trzy silniki i dane z dwoch.
 */

/**
 * Domyslne modele z darmowych tierow. Zmiana modelu to zmiana `model_version`,
 * czyli **nowa linia trendu**, a nie inne ustawienie tej samej (D27).
 *
 * Typ jest `Record<EngineId, string>`, a nie literalny: `as const` zawezalby go
 * do tych trzech napisow i nadpisanie modelu daloby sie zrobic wylacznie ta sama
 * wartoscia, czyli wcale.
 */
export const DEFAULT_MODELS: Readonly<Record<EngineId, string>> = {
  gemini: 'gemini-2.5-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  anthropic: 'claude-opus-5',
}

export interface EngineEnv {
  readonly SEO_GEMINI_KEY?: string | undefined
  readonly SEO_GROQ_KEY?: string | undefined
  readonly SEO_OPENROUTER_KEY?: string | undefined
  /** Jedyny platny silnik. Bez klucza pomijany, jak kazdy inny. */
  readonly SEO_ANTHROPIC_KEY?: string | undefined
}

export interface EngineSelectionDeps {
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
  readonly env: EngineEnv
  /** Tryb dla Gemini; pozostale silniki groundingu nie maja. */
  readonly accessMode?: AccessMode | undefined
  readonly models?: Partial<Record<EngineId, string>> | undefined
}

export interface EngineSelection {
  readonly engines: readonly LlmEngineProvider[]
  readonly skipped: readonly SkippedEngine[]
}

function missing(name: string): string {
  return `brak klucza — ustaw ${name}, albo zostaw pusty i silnik bedzie pomijany`
}

export function selectEngines(deps: EngineSelectionDeps): EngineSelection {
  const models = { ...DEFAULT_MODELS, ...deps.models }
  const engines: LlmEngineProvider[] = []
  const skipped: SkippedEngine[] = []
  const shared = { fetchFn: deps.fetchFn, ledger: deps.ledger, now: deps.now }

  if (deps.env.SEO_GEMINI_KEY !== undefined && deps.env.SEO_GEMINI_KEY !== '') {
    engines.push(createGeminiProvider({
      ...shared,
      apiKey: deps.env.SEO_GEMINI_KEY,
      model: models.gemini,
      accessMode: deps.accessMode ?? 'api',
    }))
  } else {
    skipped.push({ id: 'gemini', reason: missing('SEO_GEMINI_KEY') })
  }

  if (deps.env.SEO_GROQ_KEY !== undefined && deps.env.SEO_GROQ_KEY !== '') {
    engines.push(createOpenAiCompatibleProvider('groq', {
      ...shared,
      apiKey: deps.env.SEO_GROQ_KEY,
      model: models.groq,
      baseUrl: GROQ_BASE_URL,
    }))
  } else {
    skipped.push({ id: 'groq', reason: missing('SEO_GROQ_KEY') })
  }

  if (deps.env.SEO_OPENROUTER_KEY !== undefined && deps.env.SEO_OPENROUTER_KEY !== '') {
    engines.push(createOpenAiCompatibleProvider('openrouter', {
      ...shared,
      apiKey: deps.env.SEO_OPENROUTER_KEY,
      model: models.openrouter,
      baseUrl: OPENROUTER_BASE_URL,
    }))
  } else {
    skipped.push({ id: 'openrouter', reason: missing('SEO_OPENROUTER_KEY') })
  }

  if (deps.env.SEO_ANTHROPIC_KEY !== undefined && deps.env.SEO_ANTHROPIC_KEY !== '') {
    engines.push(createAnthropicProvider({
      ...shared,
      apiKey: deps.env.SEO_ANTHROPIC_KEY,
      model: models.anthropic,
    }))
  } else {
    // Inny komunikat niz reszta: brak tego klucza jest **stanem domyslnym**,
    // a nie brakiem do uzupelnienia. Zestaw darmowy dziala bez niego w calosci.
    skipped.push({
      id: 'anthropic',
      reason: 'silnik platny, wylaczony domyslnie — wlacz przez SEO_ANTHROPIC_KEY',
    })
  }

  return { engines, skipped }
}
