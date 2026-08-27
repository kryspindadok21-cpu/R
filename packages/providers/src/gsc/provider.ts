import { GSC_SOURCE_TIMEZONE } from '@seo/core'
import { z } from 'zod'
import { type CallLedger, ProviderHttpError, withLedger } from '../ledger.js'
import type {
  PerformanceQuery, PerformanceRows, SiteMetricsCapability, SiteMetricsProvider,
} from '../types.js'

export { GSC_SOURCE_TIMEZONE } from '@seo/core'

/** Wartosc ustalona w Zadaniu 0, Krok 4. Zaktualizuj, jesli weryfikacja da inna. */
export const GSC_MAX_ROW_LIMIT = 25_000

const ENDPOINT = 'https://www.googleapis.com/webmasters/v3/sites'

const ResponseSchema = z.object({
  rows: z.array(z.object({
    keys: z.array(z.string()),
    clicks: z.number(),
    impressions: z.number(),
    ctr: z.number(),
    position: z.number(),
  })).optional(),
})

export interface GscDeps {
  readonly getAccessToken: () => Promise<string>
  readonly fetchFn: typeof globalThis.fetch
  readonly ledger: CallLedger
  readonly now: () => number
}

function capabilityOf(query: PerformanceQuery): SiteMetricsCapability {
  return query.dimensions.includes('query') ? 'performance.byQuery' : 'performance.byDate'
}

function fingerprint(q: PerformanceQuery): string {
  return `${q.siteUrl}|${q.startDate}..${q.endDate}|${q.dimensions.join(',')}|${q.dataState}|${q.startRow}`
}

export function createGscProvider(deps: GscDeps): SiteMetricsProvider {
  return {
    id: 'gsc',
    capabilities: ['performance.byDate', 'performance.byQuery'],

    estimateQuota: (queries) => queries.length,

    async queryPerformance(query: PerformanceQuery): Promise<PerformanceRows> {
      if (query.rowLimit < 1 || query.rowLimit > GSC_MAX_ROW_LIMIT) {
        throw new Error(`rowLimit musi byc z zakresu 1..${GSC_MAX_ROW_LIMIT}, otrzymano ${query.rowLimit}`)
      }
      const token = await deps.getAccessToken()

      return withLedger(
        deps.ledger,
        {
          providerId: 'gsc',
          capability: capabilityOf(query),
          quotaUnits: 1,
          costMicros: 0,
          requestFingerprint: fingerprint(query),
        },
        deps.now,
        async () => {
          const url = `${ENDPOINT}/${encodeURIComponent(query.siteUrl)}/searchAnalytics/query`
          const response = await deps.fetchFn(url, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              startDate: query.startDate,
              endDate: query.endDate,
              dimensions: [...query.dimensions],
              dataState: query.dataState,
              rowLimit: query.rowLimit,
              startRow: query.startRow,
            }),
          })

          if (!response.ok) {
            throw new ProviderHttpError(
              response.status,
              `http_${response.status}`,
              `Search Console zwrocilo ${response.status}: ${await response.text()}`,
            )
          }

          const parsed = ResponseSchema.parse(await response.json())
          // keys przepisywane doslownie — zadnego Date, zadnej strefy (D3, AC5).
          return {
            value: { rows: parsed.rows ?? [], sourceTimezone: GSC_SOURCE_TIMEZONE },
            httpStatus: response.status,
          }
        },
      )
    },
  }
}
