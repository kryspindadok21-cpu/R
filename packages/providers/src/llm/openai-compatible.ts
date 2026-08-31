import { z } from 'zod'
import type { CallLedger } from '../ledger.js'
import type { EngineAnswer, EngineId, EnginePrompt, LlmEngineProvider } from './types.js'

/**
 * Groq i OpenRouter mowia protokolem `chat/completions` zgodnym z OpenAI, wiec
 * dziela jedna implementacje. Roznia sie adresem, modelem i naglowkami — i to
 * jest cala roznica, wiec dwa osobne pliki bylyby dwiema kopiami tego samego
 * bledu do poprawienia.
 *
 * Zaden z nich nie ma groundingu, wiec `groundingUris` jest zawsze puste.
 * To **poprawny wynik**, a nie brak danych (D32).
 */

const ResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable().optional() }).optional(),
    finish_reason: z.string().nullable().optional(),
  })).optional(),
})

/** Powody, ktore API podaje samo. Tresci odpowiedzi nie zgadujemy. */
const REFUSAL_REASONS: Readonly<Record<string, string>> = {
  content_filter: 'filtr tresci dostawcy',
}

export interface OpenAiCompatibleDeps {
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
  readonly apiKey: string
  readonly model: string
  readonly baseUrl: string
  readonly extraHeaders?: Readonly<Record<string, string>> | undefined
}

export function createOpenAiCompatibleProvider(
  id: EngineId,
  deps: OpenAiCompatibleDeps,
): LlmEngineProvider {
  return {
    id,
    modelVersion: deps.model,
    accessMode: 'api',

    async ask(prompt: EnginePrompt, runIndex: number): Promise<EngineAnswer> {
      const startedAt = deps.now()
      let status: number | null = null
      let text = ''
      let refusalReason: string | null = null
      let fetchError: string | null = null

      try {
        const response = await deps.fetchFn(`${deps.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${deps.apiKey}`,
            ...deps.extraHeaders,
          },
          body: JSON.stringify({
            model: deps.model,
            messages: [{ role: 'user', content: prompt.text }],
          }),
        })
        status = response.status
        if (response.ok) {
          const parsed = ResponseSchema.parse(await response.json())
          const choice = parsed.choices?.[0]
          text = choice?.message?.content ?? ''
          const finish = choice?.finish_reason ?? null
          if (finish !== null && REFUSAL_REASONS[finish] !== undefined) {
            refusalReason = REFUSAL_REASONS[finish] as string
          }
        } else {
          fetchError = `${id} odpowiedzialo statusem ${response.status}`
        }
      } catch (error) {
        fetchError = error instanceof Error ? error.message : String(error)
      }

      // Kazde wywolanie w rejestrze — takze nieudane (D7, AC8).
      deps.ledger.record({
        providerId: id,
        capability: `llm.ask.${deps.model}`,
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
        groundingUris: [],
      }
    },
  }
}

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
