export { closeDatabase, openDatabase, type Db } from './connection.js'
export { migrate } from './migrate.js'
export {
  repos,
  type DailyInput, type ProviderCallInput, type QueryDailyInput,
  type ReconciliationInput, type Repos,
} from './repo.js'
export {
  crawlRepos, factsOf, noindexReasonOf, redirectChainOf, renderDiffOf,
  type CrawlPageInput, type CrawlRepos, type CrawlRunFinish, type CrawlRunInput,
  type FindingInput, type PageLinkInput, type PsiMeasurementInput, type SkippedRuleInput,
} from './crawl-repo.js'
// rawHandle i schema swiadomie nieeksportowane — jedynym wejsciem do bazy
// jest repos(), ktore wymusza TenantScope (D5).
