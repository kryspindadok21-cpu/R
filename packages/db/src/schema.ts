import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Typowanie zapytan. Zrodlem prawdy dla struktury bazy sa pliki `migrations/*.sql`.
 * Indeksy i klucze obce nie sa deklarowane tutaj — zyja wylacznie w SQL.
 */

export const tenant = sqliteTable('tenant', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const site = sqliteTable('site', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  propertyType: text('property_type', { enum: ['domain', 'url_prefix'] }).notNull(),
  propertyUri: text('property_uri').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const url = sqliteTable('url', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  urlRaw: text('url_raw').notNull(),
  urlNormalized: text('url_normalized').notNull(),
  urlHash: text('url_hash').notNull(),
  normalizerVersion: integer('normalizer_version').notNull(),
  firstSeenAt: integer('first_seen_at').notNull(),
})

export const gscSyncRun = sqliteTable('gsc_sync_run', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  dateFrom: text('date_from').notNull(),
  dateTo: text('date_to').notNull(),
  dataState: text('data_state', { enum: ['final', 'all'] }).notNull(),
  dimensions: text('dimensions').notNull(),
  rowsFetched: integer('rows_fetched').notNull(),
  ok: integer('ok'),
  error: text('error'),
})

export const gscDaily = sqliteTable('gsc_daily', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  date: text('date').notNull(),
  sourceTimezone: text('source_timezone').notNull(),
  clicks: integer('clicks').notNull(),
  impressions: integer('impressions').notNull(),
  ctr: real('ctr').notNull(),
  position: real('position').notNull(),
  dataState: text('data_state', { enum: ['final', 'all'] }).notNull(),
  syncRunId: text('sync_run_id').notNull(),
})

export const gscQueryDaily = sqliteTable('gsc_query_daily', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  date: text('date').notNull(),
  sourceTimezone: text('source_timezone').notNull(),
  query: text('query').notNull(),
  clicks: integer('clicks').notNull(),
  impressions: integer('impressions').notNull(),
  ctr: real('ctr').notNull(),
  position: real('position').notNull(),
  dataState: text('data_state', { enum: ['final', 'all'] }).notNull(),
  syncRunId: text('sync_run_id').notNull(),
})

export const gscPageDaily = sqliteTable('gsc_page_daily', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  date: text('date').notNull(),
  sourceTimezone: text('source_timezone').notNull(),
  page: text('page').notNull(),
  clicks: integer('clicks').notNull(),
  impressions: integer('impressions').notNull(),
  ctr: real('ctr').notNull(),
  position: real('position').notNull(),
  dataState: text('data_state', { enum: ['final', 'all'] }).notNull(),
  syncRunId: text('sync_run_id').notNull(),
})

export const gscReconciliation = sqliteTable('gsc_reconciliation', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  date: text('date').notNull(),
  totalClicks: integer('total_clicks').notNull(),
  querySumClicks: integer('query_sum_clicks').notNull(),
  anonymizedDeltaClicks: integer('anonymized_delta_clicks').notNull(),
  totalImpressions: integer('total_impressions').notNull(),
  querySumImpressions: integer('query_sum_impressions').notNull(),
  anonymizedDeltaImpressions: integer('anonymized_delta_impressions').notNull(),
  checkedAt: integer('checked_at').notNull(),
})

export const providerCall = sqliteTable('provider_call', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  providerId: text('provider_id').notNull(),
  capability: text('capability').notNull(),
  startedAt: integer('started_at').notNull(),
  durationMs: integer('duration_ms').notNull(),
  ok: integer('ok').notNull(),
  httpStatus: integer('http_status'),
  errorCode: text('error_code'),
  quotaUnits: integer('quota_units').notNull(),
  costMicros: integer('cost_micros').notNull(),
  requestFingerprint: text('request_fingerprint').notNull(),
})

// --- Faza 1: crawl i audyt -----------------------------------------------------

export const crawlRun = sqliteTable('crawl_run', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  ok: integer('ok'),
  error: text('error'),
  pagesFetched: integer('pages_fetched').notNull(),
  pagesFailed: integer('pages_failed').notNull(),
  maxPages: integer('max_pages').notNull(),
  maxDepth: integer('max_depth').notNull(),
  delayMs: integer('delay_ms').notNull(),
  renderSample: integer('render_sample').notNull(),
  robotsState: text('robots_state', { enum: ['ok', 'missing', 'unreachable'] }).notNull(),
  truncated: integer('truncated').notNull(),
  truncationReason: text('truncation_reason'),
  userAgent: text('user_agent').notNull(),
  sitemapUrls: text('sitemap_urls').notNull(),
})

export const crawlPage = sqliteTable('crawl_page', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  crawlRunId: text('crawl_run_id').notNull(),
  urlId: text('url_id').notNull(),
  depth: integer('depth').notNull(),
  httpStatus: integer('http_status'),
  contentType: text('content_type'),
  bytes: integer('bytes').notNull(),
  durationMs: integer('duration_ms').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
  redirectChain: text('redirect_chain').notNull(),
  fetchError: text('fetch_error'),
  title: text('title'),
  metaDescription: text('meta_description'),
  h1Count: integer('h1_count').notNull(),
  wordCount: integer('word_count').notNull(),
  indexable: integer('indexable').notNull(),
  noindexReason: text('noindex_reason'),
  canonicalUrl: text('canonical_url'),
  inSitemap: integer('in_sitemap').notNull(),
  facts: text('facts'),
  rendered: integer('rendered').notNull(),
  renderDiff: text('render_diff'),
})

export const pageLink = sqliteTable('page_link', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  crawlRunId: text('crawl_run_id').notNull(),
  fromUrlId: text('from_url_id').notNull(),
  toUrlId: text('to_url_id'),
  toUrl: text('to_url').notNull(),
  rel: text('rel', { enum: ['follow', 'nofollow', 'sponsored', 'ugc'] }).notNull(),
  anchorText: text('anchor_text').notNull(),
  isInternal: integer('is_internal').notNull(),
})

export const auditFinding = sqliteTable('audit_finding', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  crawlRunId: text('crawl_run_id').notNull(),
  ruleId: text('rule_id').notNull(),
  severity: text('severity', { enum: ['blocker', 'high', 'medium', 'low', 'info'] }).notNull(),
  category: text('category').notNull(),
  urlId: text('url_id'),
  url: text('url'),
  title: text('title').notNull(),
  evidence: text('evidence').notNull(),
  autofix: text('autofix'),
  createdAt: integer('created_at').notNull(),
})

export const auditSkippedRule = sqliteTable('audit_skipped_rule', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  crawlRunId: text('crawl_run_id').notNull(),
  ruleId: text('rule_id').notNull(),
  missing: text('missing').notNull(),
})

export const psiMeasurement = sqliteTable('psi_measurement', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  urlId: text('url_id').notNull(),
  strategy: text('strategy', { enum: ['mobile', 'desktop'] }).notNull(),
  measuredAt: integer('measured_at').notNull(),
  lcpMs: real('lcp_ms'),
  inpMs: real('inp_ms'),
  cls: real('cls'),
  ttfbMs: real('ttfb_ms'),
  performanceScore: real('performance_score'),
  source: text('source', { enum: ['lab', 'field'] }).notNull(),
})

export const promptSet = sqliteTable('prompt_set', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  name: text('name').notNull(),
  version: integer('version').notNull(),
  supersedesId: text('supersedes_id'),
  createdAt: integer('created_at').notNull(),
  frozenAt: integer('frozen_at'),
})

export const prompt = sqliteTable('prompt', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  promptSetId: text('prompt_set_id').notNull(),
  text: text('text').notNull(),
  locale: text('locale').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const brandEntity = sqliteTable('brand_entity', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  name: text('name').notNull(),
  variants: text('variants').notNull(),
  exclusions: text('exclusions').notNull(),
  version: integer('version').notNull(),
  isOwn: integer('is_own').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const geoRun = sqliteTable('geo_run', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  promptSetId: text('prompt_set_id').notNull(),
  engine: text('engine').notNull(),
  modelVersion: text('model_version').notNull(),
  accessMode: text('access_mode', { enum: ['api', 'api_grounded'] }).notNull(),
  entityVersion: integer('entity_version').notNull(),
  runsPerPrompt: integer('runs_per_prompt').notNull(),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at'),
  ok: integer('ok'),
  error: text('error'),
  answersOk: integer('answers_ok').notNull(),
  answersFailed: integer('answers_failed').notNull(),
})

export const geoAnswer = sqliteTable('geo_answer', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  geoRunId: text('geo_run_id').notNull(),
  promptId: text('prompt_id').notNull(),
  runIndex: integer('run_index').notNull(),
  text: text('text').notNull(),
  refusalReason: text('refusal_reason'),
  fetchError: text('fetch_error'),
  latencyMs: integer('latency_ms').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const geoMention = sqliteTable('geo_mention', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  geoRunId: text('geo_run_id').notNull(),
  geoAnswerId: text('geo_answer_id').notNull(),
  entityId: text('entity_id').notNull(),
  matched: text('matched').notNull(),
  startOffset: integer('start_offset').notNull(),
  positionShare: real('position_share').notNull(),
  paragraph: integer('paragraph').notNull(),
})

export const geoCitation = sqliteTable('geo_citation', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  geoRunId: text('geo_run_id').notNull(),
  geoAnswerId: text('geo_answer_id').notNull(),
  source: text('source', { enum: ['grounding', 'inline'] }).notNull(),
  rawUrl: text('raw_url').notNull(),
  urlNormalized: text('url_normalized'),
  urlHash: text('url_hash'),
  host: text('host'),
  positionShare: real('position_share'),
  ours: integer('ours').notNull(),
})

export const keywordClusterSet = sqliteTable('keyword_cluster_set', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  method: text('method', { enum: ['serp-overlap', 'lexical-overlap'] }).notNull(),
  fromDate: text('from_date').notNull(),
  toDate: text('to_date').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const keywordCluster = sqliteTable('keyword_cluster', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  clusterSetId: text('cluster_set_id').notNull(),
  slug: text('slug').notNull(),
  head: text('head').notNull(),
  totalImpressions: integer('total_impressions').notNull(),
  totalClicks: integer('total_clicks').notNull(),
  sharedUrls: integer('shared_urls'),
  keywords: text('keywords').notNull(),
})

export const contentBrief = sqliteTable('content_brief', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  clusterId: text('cluster_id').notNull(),
  decision: text('decision', { enum: ['refresh', 'create'] }).notNull(),
  targetUrl: text('target_url'),
  decisionReason: text('decision_reason').notNull(),
  markdown: text('markdown').notNull(),
  payload: text('payload').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const contentDraft = sqliteTable('content_draft', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  briefId: text('brief_id').notNull(),
  title: text('title').notNull(),
  markdown: text('markdown').notNull(),
  authorName: text('author_name').notNull(),
  authorSameAs: text('author_same_as').notNull(),
  uniqueAssets: text('unique_assets').notNull(),
  engine: text('engine').notNull(),
  modelVersion: text('model_version').notNull(),
  promptId: text('prompt_id').notNull(),
  approved: integer('approved').notNull(),
  gateFailures: text('gate_failures').notNull(),
  originality: text('originality').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const contentPublication = sqliteTable('content_publication', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  draftId: text('draft_id').notNull(),
  adapter: text('adapter', { enum: ['git-pr'] }).notNull(),
  branch: text('branch').notNull(),
  filePath: text('file_path').notNull(),
  prUrl: text('pr_url'),
  state: text('state', { enum: ['prepared', 'opened', 'merged', 'closed'] }).notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const agentOpportunity = sqliteTable('agent_opportunity', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  slug: text('slug').notNull(),
  kind: text('kind', {
    enum: ['fix-finding', 'refresh-content', 'create-content', 'improve-geo'],
  }).notNull(),
  title: text('title').notNull(),
  targetUrl: text('target_url'),
  score: real('score').notNull(),
  factors: text('factors').notNull(),
  measuredFactors: integer('measured_factors').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const agentTask = sqliteTable('agent_task', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  opportunityId: text('opportunity_id').notNull(),
  actionKind: text('action_kind').notNull(),
  state: text('state', {
    enum: ['proposed', 'needs-you', 'in-flight', 'measuring', 'done'],
  }).notNull(),
  gate: text('gate').notNull(),
  gateReason: text('gate_reason').notNull(),
  verdict: text('verdict'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const agentExperiment = sqliteTable('agent_experiment', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  taskId: text('task_id').notNull(),
  treatmentUrls: text('treatment_urls').notNull(),
  controlUrls: text('control_urls').notNull(),
  shortfall: text('shortfall'),
  changedOn: text('changed_on').notNull(),
  selectedAt: integer('selected_at').notNull(),
})

export const agentVerdict = sqliteTable('agent_verdict', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  experimentId: text('experiment_id').notNull(),
  windowDays: integer('window_days').notNull(),
  metric: text('metric', { enum: ['clicks', 'impressions', 'ctr', 'position'] }).notNull(),
  outcome: text('outcome', { enum: ['werdykt', 'odmowa'] }).notNull(),
  effect: real('effect'),
  intervalLow: real('interval_low'),
  intervalHigh: real('interval_high'),
  significant: integer('significant').notNull(),
  direction: text('direction', { enum: ['poprawa', 'pogorszenie'] }),
  refusalReason: text('refusal_reason'),
  sentence: text('sentence').notNull(),
  treatmentPages: integer('treatment_pages').notNull(),
  controlPages: integer('control_pages').notNull(),
  seed: integer('seed'),
  measuredAt: integer('measured_at').notNull(),
})
