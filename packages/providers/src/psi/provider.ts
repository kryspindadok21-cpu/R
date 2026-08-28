import { z } from 'zod'
import type { CallLedger } from '../ledger.js'
import type { PsiMetrics, PsiProvider, PsiResult, PsiStrategy } from './types.js'

/**
 * PageSpeed Insights (D21).
 *
 * Osobne polecenie, nie czesc crawla. Powod: PSI bez klucza ma limit rzedu
 * jednostek zapytan na minute i bywa wolne (kilkanascie sekund na strone).
 * Wpiete w crawl zamienialoby 3-minutowy przebieg w 40-minutowy i wywracalo
 * caly crawl przy przekroczeniu limitu. Osobne polecenie to osobna awaria.
 */

export const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'

/** Ile razy ponowic po odmowie z powodu limitu. Kazda kolejna proba czeka dluzej. */
export const PSI_MAX_RETRIES = 3

/** Podstawa wykladniczego ponawiania. Pierwsza przerwa, kolejne razy dwa. */
export const PSI_BACKOFF_BASE_MS = 2000

const MetricSchema = z.object({ percentile: z.number().optional() }).optional()

const ResponseSchema = z.object({
  loadingExperience: z.object({
    metrics: z.object({
      LARGEST_CONTENTFUL_PAINT_MS: MetricSchema,
      INTERACTION_TO_NEXT_PAINT: MetricSchema,
      CUMULATIVE_LAYOUT_SHIFT_SCORE: MetricSchema,
      EXPERIMENTAL_TIME_TO_FIRST_BYTE: MetricSchema,
    }).optional(),
  }).optional(),
  lighthouseResult: z.object({
    categories: z.object({
      performance: z.object({ score: z.number().nullable().optional() }).optional(),
    }).optional(),
    audits: z.record(z.string(), z.object({ numericValue: z.number().optional() }).loose()).optional(),
  }).optional(),
})

function labMetrics(parsed: z.infer<typeof ResponseSchema>): PsiMetrics | null {
  const lighthouse = parsed.lighthouseResult
  if (lighthouse === undefined) return null
  const audits = lighthouse.audits ?? {}
  const value = (id: string): number | null => audits[id]?.numericValue ?? null

  return {
    source: 'lab',
    lcpMs: value('largest-contentful-paint'),
    // Lighthouse w trybie laboratoryjnym nie mierzy INP — to metryka interakcji
    // prawdziwego uzytkownika. Zamiast zmyslac, zostawiamy null.
    inpMs: null,
    cls: value('cumulative-layout-shift'),
    ttfbMs: value('server-response-time'),
    performanceScore: lighthouse.categories?.performance?.score ?? null,
  }
}

function fieldMetrics(parsed: z.infer<typeof ResponseSchema>): PsiMetrics | null {
  const metrics = parsed.loadingExperience?.metrics
  if (metrics === undefined) return null
  const cls = metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile

  return {
    source: 'field',
    lcpMs: metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    inpMs: metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    // CrUX podaje CLS jako liczbe calkowita przemnozona przez 100.
    cls: cls === undefined ? null : cls / 100,
    ttfbMs: metrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ?? null,
    performanceScore: null,
  }
}

export interface PsiDeps {
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
  readonly sleep: (ms: number) => Promise<void>
  /** Klucz jest opcjonalny — bez niego limit jest niższy, ale API działa. */
  readonly apiKey?: string | undefined
  /** Podmieniany wylacznie w tescie na serwerze petli zwrotnej. */
  readonly baseUrl?: string | undefined
}

export function createPsiProvider(deps: PsiDeps): PsiProvider {
  const endpoint = deps.baseUrl ?? PSI_ENDPOINT

  return {
    id: 'psi',

    async measure(url: string, strategy: PsiStrategy): Promise<PsiResult> {
      const params = new URLSearchParams({ url, strategy, category: 'performance' })
      if (deps.apiKey !== undefined) params.set('key', deps.apiKey)
      const target = `${endpoint}?${params.toString()}`

      for (let attempt = 0; ; attempt += 1) {
        const startedAt = deps.now()
        let status: number | null = null
        let message: string | null = null
        let parsed: z.infer<typeof ResponseSchema> | null = null

        try {
          const response = await deps.fetchFn(target, { method: 'GET' })
          status = response.status
          if (response.ok) {
            parsed = ResponseSchema.parse(await response.json())
          } else {
            message = `PSI odpowiedzialo statusem ${response.status}`
          }
        } catch (error) {
          message = error instanceof Error ? error.message : String(error)
        }

        // Kazde wywolanie w rejestrze — takze odmowa z powodu limitu (D7).
        deps.ledger.record({
          providerId: 'psi',
          capability: `psi.${strategy}`,
          startedAt,
          durationMs: deps.now() - startedAt,
          ok: parsed !== null,
          httpStatus: status ?? undefined,
          errorCode: message ?? undefined,
          quotaUnits: 1,
          costMicros: 0,
          requestFingerprint: `${url}|${strategy}`,
        })

        if (parsed !== null) {
          const metrics = [fieldMetrics(parsed), labMetrics(parsed)]
            .filter((m): m is PsiMetrics => m !== null)
          return { url, strategy, measuredAt: deps.now(), metrics, error: null }
        }

        // 429 i 5xx znaczą „sprobuj pozniej", nie „to nie zadziala".
        const retriable = status === 429 || (status !== null && status >= 500)
        if (!retriable || attempt >= PSI_MAX_RETRIES) {
          return {
            url, strategy, measuredAt: deps.now(), metrics: [],
            error: message ?? 'nieznany blad',
          }
        }
        await deps.sleep(PSI_BACKOFF_BASE_MS * 2 ** attempt)
      }
    },
  }
}
