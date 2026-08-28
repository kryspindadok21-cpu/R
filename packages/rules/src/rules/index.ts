import type { PageRule, SiteRule } from '../rule.js'
import { CONTENT_PAGE_RULES, CONTENT_SITE_RULES } from './content.js'
import { INDEXATION_PAGE_RULES, INDEXATION_SITE_RULES } from './indexation.js'

export const ALL_PAGE_RULES: readonly PageRule[] = [
  ...INDEXATION_PAGE_RULES,
  ...CONTENT_PAGE_RULES,
]

export const ALL_SITE_RULES: readonly SiteRule[] = [
  ...INDEXATION_SITE_RULES,
  ...CONTENT_SITE_RULES,
]

export const ALL_RULES = { page: ALL_PAGE_RULES, site: ALL_SITE_RULES } as const
