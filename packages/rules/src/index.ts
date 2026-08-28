export { auditSite, type AuditResult, type RuleCount } from './audit.js'
export { mergeResults, runRules, type RuleRunResult } from './engine.js'
export { DEFAULT_THRESHOLDS, type Thresholds } from './thresholds.js'
export { groupBy, indexByUrl, isIndexable, sameUrl, urlKey } from './helpers.js'
export {
  SEVERITY_ORDER, finding,
  type AutofixSpec, type Capability, type EvidenceValue, type Finding, type GraphFacts,
  type HttpFacts, type PageInput, type PageRule, type Rule, type RuleCategory,
  type RuleContext, type Severity, type SiteInput, type SiteRule, type SkippedRule,
} from './rule.js'
export { ALL_PAGE_RULES, ALL_RULES, ALL_SITE_RULES } from './rules/index.js'
