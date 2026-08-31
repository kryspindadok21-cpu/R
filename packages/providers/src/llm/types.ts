export type EngineId = 'gemini' | 'groq' | 'openrouter'

/** `api_grounded` znaczy: model mial dostep do wyszukiwarki. To inny proces (D27). */
export type AccessMode = 'api' | 'api_grounded'

export interface EnginePrompt {
  readonly promptId: string
  readonly text: string
  readonly locale: string
}

export interface EngineAnswer {
  readonly promptId: string
  readonly runIndex: number
  readonly text: string
  /**
   * Powod odmowy podany **przez API**, nie zgadniety z tresci. Odmowa jest
   * danymi: pusta odpowiedz z powodem, a nie blad przebiegu.
   */
  readonly refusalReason: string | null
  /** Niepuste znaczy, ze wywolanie sie nie udalo — to co innego niz odmowa. */
  readonly fetchError: string | null
  readonly latencyMs: number
  /** Adresy z metadanych groundingu. Puste dla silnika bez groundingu (D32). */
  readonly groundingUris: readonly string[]
}

export interface LlmEngineProvider {
  readonly id: EngineId
  readonly modelVersion: string
  readonly accessMode: AccessMode
  ask(prompt: EnginePrompt, runIndex: number): Promise<EngineAnswer>
}

/** Silnik pominiety z powodem — tak samo jak regula bez `requires` w D17. */
export interface SkippedEngine {
  readonly id: EngineId
  readonly reason: string
}
