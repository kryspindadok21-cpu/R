import type { PageRule, SiteRule } from '../rule.js'
import { AI_PAGE_RULES } from './ai.js'
import { CONTENT_PAGE_RULES, CONTENT_SITE_RULES } from './content.js'
import { IMAGE_PAGE_RULES } from './images.js'
import { INDEXATION_PAGE_RULES, INDEXATION_SITE_RULES } from './indexation.js'
import { LINK_PAGE_RULES, LINK_SITE_RULES } from './links.js'
import { STRUCTURED_PAGE_RULES } from './structured.js'
import { TECHNICAL_PAGE_RULES, TECHNICAL_SITE_RULES } from './technical.js'

export const ALL_PAGE_RULES: readonly PageRule[] = [
  ...INDEXATION_PAGE_RULES,
  ...CONTENT_PAGE_RULES,
  ...LINK_PAGE_RULES,
  ...IMAGE_PAGE_RULES,
  ...STRUCTURED_PAGE_RULES,
  ...TECHNICAL_PAGE_RULES,
  ...AI_PAGE_RULES,
]

export const ALL_SITE_RULES: readonly SiteRule[] = [
  ...INDEXATION_SITE_RULES,
  ...CONTENT_SITE_RULES,
  ...LINK_SITE_RULES,
  ...TECHNICAL_SITE_RULES,
]

export const ALL_RULES = { page: ALL_PAGE_RULES, site: ALL_SITE_RULES } as const

export { AI_PAGE_RULES } from './ai.js'
export { CONTENT_PAGE_RULES, CONTENT_SITE_RULES } from './content.js'
export { IMAGE_PAGE_RULES } from './images.js'
export { INDEXATION_PAGE_RULES, INDEXATION_SITE_RULES } from './indexation.js'
export { LINK_PAGE_RULES, LINK_SITE_RULES } from './links.js'
export { STRUCTURED_PAGE_RULES } from './structured.js'
export { TECHNICAL_PAGE_RULES, TECHNICAL_SITE_RULES } from './technical.js'
