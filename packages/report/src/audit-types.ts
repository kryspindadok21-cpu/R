import type { Severity } from '@seo/rules'

export type { Severity }

export interface FindingRow {
  readonly ruleId: string
  readonly severity: Severity
  readonly category: string
  /** `null` dla ustalen dotyczacych calego serwisu. */
  readonly url: string | null
  readonly title: string
  readonly evidence: Readonly<Record<string, string | number | boolean>>
}

export interface RuleCountRow {
  readonly ruleId: string
  readonly title: string
  readonly severity: Severity
  readonly count: number
}

export interface StatusCountRow {
  /** `brak odpowiedzi` zamiast liczby, gdy pobranie sie nie udalo. */
  readonly status: string
  readonly count: number
}

export interface DeepPageRow {
  readonly url: string
  readonly clickDepth: number
}

export interface RedirectRow {
  /** Adres, o ktory poprosil crawler. */
  readonly from: string
  /** Adres, na ktorym skonczyl. */
  readonly to: string
  readonly hops: number
}

export interface PsiRow {
  readonly url: string
  readonly strategy: 'mobile' | 'desktop'
  /** `field` to dane od prawdziwych uzytkownikow; `lab` to symulacja. */
  readonly source: 'lab' | 'field'
  readonly lcpMs: number | null
  readonly inpMs: number | null
  readonly cls: number | null
  readonly ttfbMs: number | null
}

export interface SkippedRuleRow {
  readonly ruleId: string
  readonly missing: readonly string[]
}

export interface AuditReportData {
  readonly siteUri: string
  readonly generatedAt: string
  readonly crawlStartedAt: string
  readonly userAgent: string
  readonly robotsState: 'ok' | 'missing' | 'unreachable'
  readonly pagesCrawled: number
  readonly pagesFailed: number
  readonly truncated: boolean
  readonly truncationReason: string | null
  readonly countsBySeverity: Readonly<Record<Severity, number>>
  readonly findings: readonly FindingRow[]
  readonly topRules: readonly RuleCountRow[]
  readonly statusCounts: readonly StatusCountRow[]
  readonly orphans: readonly string[]
  readonly deepestPages: readonly DeepPageRow[]
  readonly redirects: readonly RedirectRow[]
  readonly psi: readonly PsiRow[]
  readonly skipped: readonly SkippedRuleRow[]
}
