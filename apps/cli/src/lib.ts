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
export {
  activePromptSet, buildGeoReport, NoEntityError, NoPromptSetError, runGeoEntity,
  runGeoPrompts, runGeoReport, runGeoRun,
  type EntityOptions, type GeoRunResult, type PromptsOptions,
} from './commands/geo.js'
/**
 * `UnknownSiteError` istnieje w dwoch modulach polecen i nazwy sie zderzaja.
 * Alias jest tu swiadomy: panel lapie **jeden** typ dla obu sciezek, wiec musi
 * widziec oba pod rozroznialnymi nazwami, a nie jeden przyslonic drugim.
 */
export {
  NoBriefError, NoClusterError, runBrief, runKeywordsCluster,
  UnknownSiteError as UnknownContentSiteError,
  type BriefCommandResult, type ClusterCommandResult,
} from './commands/content.js'
export { openInitialized, runInit } from './commands/init.js'
export { buildLlmsTxtContent, runLlmsTxt } from './commands/llms-txt.js'
export { dbLedger } from './ledger.js'
export { loadConfig, type Config } from './config.js'
