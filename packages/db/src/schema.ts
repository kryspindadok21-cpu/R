// Definicje wylacznie dla typowania zapytan. Zrodlem prawdy o strukturze bazy
// sa pliki w migrations/*.sql — indeksy i klucze obce zyja tylko tam (D1).
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const DATA_STATE = ['final', 'all'] as const

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
  dataState: text('data_state', { enum: DATA_STATE }).notNull(),
  dimensions: text('dimensions').notNull(),
  rowsFetched: integer('rows_fetched').notNull(),
  ok: integer('ok'),
  error: text('error'),
})

export const gscDaily = sqliteTable('gsc_daily', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  siteId: text('site_id').notNull(),
  // Tekst YYYY-MM-DD przepisany doslownie z API. Nigdy nie konwertowac (D3).
  date: text('date').notNull(),
  sourceTimezone: text('source_timezone').notNull(),
  clicks: integer('clicks').notNull(),
  impressions: integer('impressions').notNull(),
  ctr: real('ctr').notNull(),
  position: real('position').notNull(),
  dataState: text('data_state', { enum: DATA_STATE }).notNull(),
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
  dataState: text('data_state', { enum: DATA_STATE }).notNull(),
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
