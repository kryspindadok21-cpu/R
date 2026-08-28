import { mergeResults, runRules, type RuleRunResult } from './engine.js'
import {
  SEVERITY_ORDER, type Finding, type PageRule, type RuleContext, type Severity,
  type SiteInput, type SiteRule,
} from './rule.js'

export interface RuleCount {
  readonly ruleId: string
  readonly title: string
  readonly severity: Severity
  readonly count: number
}

export interface AuditResult extends RuleRunResult {
  readonly countsBySeverity: Readonly<Record<Severity, number>>
  /** Reguly wg liczby trafien, malejaco — od czego zaczac prace. */
  readonly topRules: readonly RuleCount[]
  readonly pagesAudited: number
}

function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.indexOf(severity)
}

function summarize(findings: readonly Finding[]): RuleCount[] {
  const counts = new Map<string, RuleCount>()
  for (const f of findings) {
    const existing = counts.get(f.ruleId)
    counts.set(f.ruleId, {
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity,
      count: (existing?.count ?? 0) + 1,
    })
  }
  return [...counts.values()].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity)
    return bySeverity !== 0 ? bySeverity : b.count - a.count
  })
}

/**
 * Jedno przejscie audytu: reguly stronowe dla kazdej strony, reguly serwisowe raz.
 * Wynik jest deterministyczny — ta sama wejsciowa struktura daje te sama liste
 * ustalen w tej samej kolejnosci. Bez tego porownanie dwoch audytow (Faza 4)
 * mierzyloby szum, a nie zmiane.
 */
export function auditSite(
  site: SiteInput,
  ctx: RuleContext,
  rules: { readonly page: readonly PageRule[]; readonly site: readonly SiteRule[] },
): AuditResult {
  const perPage = site.pages.map((page) => runRules(rules.page, page, ctx))
  const siteLevel = runRules(rules.site, site, ctx)
  const merged = mergeResults([...perPage, siteLevel])

  const countsBySeverity: Record<Severity, number> = {
    blocker: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  for (const f of merged.findings) countsBySeverity[f.severity] += 1

  const findings = [...merged.findings].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity)
    if (bySeverity !== 0) return bySeverity
    if (a.ruleId !== b.ruleId) return a.ruleId < b.ruleId ? -1 : 1
    return (a.url ?? '') < (b.url ?? '') ? -1 : (a.url ?? '') > (b.url ?? '') ? 1 : 0
  })

  return {
    findings,
    skipped: [...merged.skipped].sort((a, b) => (a.ruleId < b.ruleId ? -1 : 1)),
    countsBySeverity,
    topRules: summarize(findings),
    pagesAudited: site.pages.length,
  }
}
