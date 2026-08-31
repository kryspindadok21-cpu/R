export interface ForeignFixture {
  readonly marker: string
  readonly siteId: string
  readonly date: string
}

export const FOREIGN_FIXTURE: ForeignFixture = {
  marker: 'obcy-marker-b',
  siteId: 'PODMIENIANE-W-TESCIE',
  date: '2026-03-01',
}

/**
 * Kazda metoda z Repos["read"] MUSI miec tu wpis. Test AC6 porownuje ten
 * rejestr z faktyczna lista metod, wiec nowa metoda bez wpisu psuje CI.
 */
export const READ_METHOD_ARGS: Record<string, (f: ForeignFixture) => unknown[]> = {
  listSites: () => [],
  findSiteByUri: (f) => [`sc-domain:${f.marker}.example`],
  listDailyRange: (f) => [f.siteId, '2000-01-01', '2100-01-01'],
  topQueries: (f) => [f.siteId, '2000-01-01', '2100-01-01', 50],
  queriesWithPosition: (f) => [f.siteId, '2000-01-01', '2100-01-01', 50],
  listReconciliations: (f) => [f.siteId, '2000-01-01', '2100-01-01'],
  getReconciliation: (f) => [f.siteId, f.date],
  providerCallSummary: () => [0, Number.MAX_SAFE_INTEGER],
  latestSyncRun: (f) => [f.siteId],
}

/**
 * To samo dla repozytoriow Fazy 1. Kazda metoda z CrawlRepos["read"] MUSI miec
 * tu wpis — test izolacji porownuje ten rejestr z faktyczna lista metod.
 */
export interface CrawlFixture extends ForeignFixture {
  readonly runId: string
}

export const CRAWL_READ_METHOD_ARGS: Record<string, (f: CrawlFixture) => unknown[]> = {
  latestCrawlRun: (f) => [f.siteId],
  getCrawlRun: (f) => [f.runId],
  listCrawlRuns: (f) => [f.siteId, 50],
  listCrawlPages: (f) => [f.runId],
  listPageLinks: (f) => [f.runId],
  listFindings: (f) => [f.runId],
  findingCountsBySeverity: (f) => [f.runId],
  topFindingRules: (f) => [f.runId, 10],
  listSkippedRules: (f) => [f.runId],
  orphanPages: (f) => [f.runId],
  listPsiMeasurements: (f) => [f.siteId, 0, Number.MAX_SAFE_INTEGER],
}

/**
 * To samo dla repozytoriow Fazy 2. Kazda metoda z GeoRepos["read"] MUSI miec
 * tu wpis — test izolacji porownuje ten rejestr z faktyczna lista metod.
 */
export interface GeoFixture extends ForeignFixture {
  readonly runId: string
  readonly promptSetId: string
}

export const GEO_READ_METHOD_ARGS: Record<string, (f: GeoFixture) => unknown[]> = {
  getPromptSet: (f) => [f.promptSetId],
  listPromptSets: (f) => [f.siteId],
  listPrompts: (f) => [f.promptSetId],
  listEntities: (f) => [f.siteId],
  latestGeoRun: (f) => [f.siteId],
  getGeoRun: (f) => [f.runId],
  listGeoRuns: (f) => [f.siteId, 50],
  listAnswers: (f) => [f.runId],
  listMentions: (f) => [f.runId],
  listCitations: (f) => [f.runId, 'inline'],
}

/**
 * To samo dla repozytoriow Fazy 3. Kazda metoda z ContentRepos["read"] MUSI
 * miec tu wpis — test izolacji porownuje ten rejestr z faktyczna lista metod.
 */
export interface ContentFixture extends ForeignFixture {
  readonly clusterSetId: string
  readonly briefId: string
  readonly draftId: string
}

export const CONTENT_READ_METHOD_ARGS: Record<string, (f: ContentFixture) => unknown[]> = {
  latestClusterSet: (f) => [f.siteId],
  listClusterSets: (f) => [f.siteId, 50],
  listClusters: (f) => [f.clusterSetId],
  getBrief: (f) => [f.briefId],
  listBriefs: (f) => [f.siteId, 50],
  getDraft: (f) => [f.draftId],
  listDrafts: (f) => [f.briefId],
  getPublication: (f) => [f.draftId],
  listPublications: (f) => [f.siteId, 50],
  publicationRate: (f) => [f.siteId, 100, Date.now()],
}
