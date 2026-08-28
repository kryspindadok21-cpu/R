import {
  type Capability, type Finding, type Rule, type RuleContext, type SkippedRule,
} from './rule.js'

export interface RuleRunResult {
  readonly findings: readonly Finding[]
  readonly skipped: readonly SkippedRule[]
}

function missingCapabilities(rule: Rule<unknown>, ctx: RuleContext): Capability[] {
  return rule.requires.filter((needed) => !ctx.capabilities.has(needed))
}

/**
 * Uruchamia reguly nad jednym zestawem faktow.
 *
 * Dwie decyzje warte zapamietania:
 *  - Regula z niespelnionymi `requires` trafia do `skipped`, nie do `findings` (D17).
 *    Cisza jest raportowana wprost, bo cichy brak reguly to falszywe poczucie porzadku.
 *  - Wyjatek w regule nie przerywa przebiegu — ladnie jako ustalenie `rule.crashed`.
 *    Jedna zepsuta regula nie ma prawa skasowac calego audytu.
 */
export function runRules<F>(
  rules: readonly Rule<F>[],
  facts: F,
  ctx: RuleContext,
): RuleRunResult {
  const findings: Finding[] = []
  const skipped: SkippedRule[] = []

  for (const rule of rules) {
    const missing = missingCapabilities(rule as Rule<unknown>, ctx)
    if (missing.length > 0) {
      skipped.push({ ruleId: rule.id, missing })
      continue
    }
    try {
      findings.push(...rule.evaluate(facts, ctx))
    } catch (error) {
      findings.push({
        ruleId: 'rule.crashed',
        severity: 'info',
        category: rule.category,
        url: null,
        title: 'Reguła zakończyła się błędem',
        evidence: {
          reguła: rule.id,
          błąd: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  return { findings, skipped }
}

/** Scala wyniki wielu przebiegow, deduplikujac liste pominietych regul. */
export function mergeResults(results: readonly RuleRunResult[]): RuleRunResult {
  const findings: Finding[] = []
  const skipped = new Map<string, SkippedRule>()
  for (const result of results) {
    findings.push(...result.findings)
    for (const entry of result.skipped) skipped.set(entry.ruleId, entry)
  }
  return { findings, skipped: [...skipped.values()] }
}
