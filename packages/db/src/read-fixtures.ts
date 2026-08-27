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
  listReconciliations: (f) => [f.siteId, '2000-01-01', '2100-01-01'],
  getReconciliation: (f) => [f.siteId, f.date],
  providerCallSummary: () => [0, Number.MAX_SAFE_INTEGER],
  latestSyncRun: (f) => [f.siteId],
}
