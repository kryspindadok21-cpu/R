import Anthropic from '@anthropic-ai/sdk'
import type { CallLedger } from '../ledger.js'
import type { AccessMode, EngineAnswer, EnginePrompt, LlmEngineProvider } from './types.js'

/**
 * Adapter Anthropic — **jedyny platny silnik w zestawie**.
 *
 * Reszta stoi na darmowych tierach, bo „koszt 0 zl" jest granica projektu.
 * Ten adapter istnieje, bo wlasciciel ma wlasny klucz i chce go uzywac; bez
 * `SEO_ANTHROPIC_KEY` silnik jest pomijany dokladnie tak samo jak pozostale
 * i **nic** w domyslnej sciezce sie nie zmienia.
 *
 * W przeciwienstwie do Groq i OpenRouter Anthropic nie mowi protokolem OpenAI,
 * wiec nie da sie uzyc wspolnego adaptera. Idziemy przez oficjalny SDK —
 * z wstrzyknietym `fetch`, zeby testy nadal chodzily bez sieci.
 */

export const ANTHROPIC_DEFAULT_MODEL = 'claude-opus-5'

/** Ile tokenow na odpowiedz. Pomiar widocznosci to krotkie odpowiedzi, nie eseje. */
export const ANTHROPIC_MAX_TOKENS = 4096

export interface AnthropicDeps {
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
  readonly apiKey: string
  readonly model: string
  readonly baseUrl?: string | undefined
}

export function createAnthropicProvider(deps: AnthropicDeps): LlmEngineProvider {
  const client = new Anthropic({
    apiKey: deps.apiKey,
    fetch: deps.fetchFn,
    ...(deps.baseUrl === undefined ? {} : { baseURL: deps.baseUrl }),
    // Ponawianie wylaczone swiadomie: rejestr liczy jeden wiersz na wywolanie,
    // wiec ciche ponowienie w SDK zaklamywaloby zuzyty limit. Nieudane
    // wywolanie wraca jako dane i to przebieg decyduje, co z nim zrobic.
    maxRetries: 0,
  })

  const accessMode: AccessMode = 'api'

  return {
    id: 'anthropic',
    modelVersion: deps.model,
    accessMode,

    async ask(prompt: EnginePrompt, runIndex: number): Promise<EngineAnswer> {
      const startedAt = deps.now()
      let status: number | null = null
      let text = ''
      let refusalReason: string | null = null
      let fetchError: string | null = null

      try {
        const response = await client.beta.messages.create({
          model: deps.model,
          max_tokens: ANTHROPIC_MAX_TOKENS,
          // Odmowa klasyfikatora bezpieczenstwa przestaje byc koncem rozmowy:
          // API samo powtarza zadanie na modelu zapasowym w tym samym wywolaniu.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          messages: [{ role: 'user', content: prompt.text }],
        })

        status = 200
        text = response.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('')

        // Powod odmowy bierzemy z `stop_reason`, nigdy z tresci odpowiedzi —
        // tak samo jak w pozostalych adapterach.
        if (response.stop_reason === 'refusal') {
          const kategoria = response.stop_details?.category ?? 'nieznana'
          refusalReason = `odmowa klasyfikatora (${kategoria})`
        }
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          status = error.status ?? null
          fetchError = `anthropic odpowiedzialo statusem ${status ?? 'bez statusu'}`
        } else {
          fetchError = error instanceof Error ? error.message : String(error)
        }
      }

      deps.ledger.record({
        providerId: 'anthropic',
        capability: `llm.ask.${deps.model}`,
        startedAt,
        durationMs: deps.now() - startedAt,
        ok: fetchError === null,
        httpStatus: status ?? undefined,
        errorCode: fetchError ?? undefined,
        quotaUnits: 1,
        // Jedyny silnik, ktory naprawde kosztuje. Zero tutaj byloby wygodnym
        // klamstwem — dopoki nie liczymy tokenow, zostawiamy to widoczne w kodzie.
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
        // Anthropic bez narzedzia wyszukiwania nie zwraca cytowan groundingowych.
        groundingUris: [],
      }
    },
  }
}
