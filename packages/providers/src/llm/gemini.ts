import { z } from 'zod'
import type { CallLedger } from '../ledger.js'
import type { AccessMode, EngineAnswer, EnginePrompt, LlmEngineProvider } from './types.js'

/**
 * Gemini (D28). Jedyny z darmowej trojki, ktory potrafi grounding — czyli
 * odpowiadac z dostepem do wyszukiwarki. To **inny proces**, nie inne ustawienie,
 * wiec `accessMode` wedruje razem z kazdym pomiarem i nigdy nie miesza sie
 * w jednej linii trendu (D27).
 */

export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

const ResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({
      parts: z.array(z.object({ text: z.string().optional() })).optional(),
    }).optional(),
    finishReason: z.string().optional(),
    groundingMetadata: z.object({
      groundingChunks: z.array(z.object({
        web: z.object({ uri: z.string().optional() }).optional(),
      })).optional(),
    }).optional(),
  })).optional(),
  promptFeedback: z.object({ blockReason: z.string().optional() }).optional(),
})

/**
 * Powody, ktore API podaje samo. Swiadomie **nie** rozpoznajemy odmowy po tresci
 * („nie moge pomoc"): to heurystyka, ktora bledie oznaczylaby prawdziwa
 * odpowiedz jako odmowe i zanizyla widocznosc bez sladu w danych.
 */
const REFUSAL_REASONS: Readonly<Record<string, string>> = {
  SAFETY: 'filtr bezpieczenstwa dostawcy',
  RECITATION: 'odmowa z powodu cytowania chronionej tresci',
  BLOCKLIST: 'zablokowana fraza',
  PROHIBITED_CONTENT: 'tresc zabroniona',
}

export interface GeminiDeps {
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
  readonly apiKey: string
  readonly model: string
  /** `api_grounded` wlacza narzedzie wyszukiwania po stronie Google. */
  readonly accessMode: AccessMode
  readonly baseUrl?: string | undefined
}

export function createGeminiProvider(deps: GeminiDeps): LlmEngineProvider {
  const base = deps.baseUrl ?? GEMINI_BASE_URL

  return {
    id: 'gemini',
    modelVersion: deps.model,
    accessMode: deps.accessMode,

    async ask(prompt: EnginePrompt, runIndex: number): Promise<EngineAnswer> {
      const startedAt = deps.now()
      let status: number | null = null
      let text = ''
      let refusalReason: string | null = null
      let fetchError: string | null = null
      let groundingUris: string[] = []

      try {
        const response = await deps.fetchFn(
          `${base}/models/${deps.model}:generateContent`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-goog-api-key': deps.apiKey },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt.text }] }],
              ...(deps.accessMode === 'api_grounded'
                ? { tools: [{ google_search: {} }] }
                : {}),
            }),
          },
        )
        status = response.status
        if (response.ok) {
          const parsed = ResponseSchema.parse(await response.json())
          const candidate = parsed.candidates?.[0]
          text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('')

          const blocked = parsed.promptFeedback?.blockReason
          const finish = candidate?.finishReason
          if (blocked !== undefined) {
            refusalReason = REFUSAL_REASONS[blocked] ?? `zablokowane: ${blocked}`
          } else if (finish !== undefined && REFUSAL_REASONS[finish] !== undefined) {
            refusalReason = REFUSAL_REASONS[finish] as string
          }

          groundingUris = (candidate?.groundingMetadata?.groundingChunks ?? [])
            .map((chunk) => chunk.web?.uri)
            .filter((uri): uri is string => uri !== undefined)
        } else {
          fetchError = `gemini odpowiedzialo statusem ${response.status}`
        }
      } catch (error) {
        fetchError = error instanceof Error ? error.message : String(error)
      }

      deps.ledger.record({
        providerId: 'gemini',
        capability: `llm.ask.${deps.model}.${deps.accessMode}`,
        startedAt,
        durationMs: deps.now() - startedAt,
        ok: fetchError === null,
        httpStatus: status ?? undefined,
        errorCode: fetchError ?? undefined,
        quotaUnits: 1,
        costMicros: 0,
        requestFingerprint: `${prompt.promptId}|${runIndex}`,
      })

      return {
        promptId: prompt.promptId,
        runIndex,
        text,
        refusalReason,
        fetchError,
        latencyMs: deps.now() - startedAt,
        groundingUris,
      }
    },
  }
}
