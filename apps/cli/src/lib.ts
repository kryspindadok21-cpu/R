/**
 * Wejscie biblioteczne aplikacji CLI.
 *
 * Panel webowy sklada te same warstwy, co linia polecen, i **musi** wolac
 * dokladnie te funkcje. Wlasna kopia sklejania w panelu rozjechalaby sie
 * z CLI przy pierwszej zmianie — a wtedy raport z przegladarki mowilby co
 * innego niz raport z terminala.
 */
export {
  przesunDate, runAgentBoard, runAgentMeasure, runAgentPlan, weeklyClicks,
} from './commands/agent.js'
export { NoCrawlError, runAudit } from './commands/audit.js'
export { buildAuditReportData, runAuditReport } from './commands/audit-report.js'
export { crawlStartUrl, runCrawlCommand, systemClock } from './commands/crawl.js'
export { buildGeoReport, runGeoReport } from './commands/geo.js'
export { openInitialized, runInit } from './commands/init.js'
export { dbLedger } from './ledger.js'
export { loadConfig, type Config } from './config.js'
