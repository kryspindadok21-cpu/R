CREATE TABLE tenant (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE site (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  property_type TEXT NOT NULL CHECK (property_type IN ('domain','url_prefix')),
  property_uri  TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX site_tenant_property_uq ON site (tenant_id, property_uri);

CREATE TABLE url (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL REFERENCES tenant(id),
  site_id            TEXT NOT NULL REFERENCES site(id),
  url_raw            TEXT NOT NULL,
  url_normalized     TEXT NOT NULL,
  url_hash           TEXT NOT NULL,
  normalizer_version INTEGER NOT NULL,
  first_seen_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX url_tenant_hash_ver_uq ON url (tenant_id, url_hash, normalizer_version);
CREATE INDEX url_tenant_site_idx ON url (tenant_id, site_id);

CREATE TABLE gsc_sync_run (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  site_id      TEXT NOT NULL REFERENCES site(id),
  started_at   INTEGER NOT NULL,
  finished_at  INTEGER,
  date_from    TEXT NOT NULL,
  date_to      TEXT NOT NULL,
  data_state   TEXT NOT NULL CHECK (data_state IN ('final','all')),
  dimensions   TEXT NOT NULL,
  rows_fetched INTEGER NOT NULL DEFAULT 0,
  ok           INTEGER,
  error        TEXT
);
CREATE INDEX gsc_sync_run_tenant_site_idx ON gsc_sync_run (tenant_id, site_id, started_at);

CREATE TABLE gsc_daily (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenant(id),
  site_id         TEXT NOT NULL REFERENCES site(id),
  date            TEXT NOT NULL,
  source_timezone TEXT NOT NULL,
  clicks          INTEGER NOT NULL,
  impressions     INTEGER NOT NULL,
  ctr             REAL NOT NULL,
  position        REAL NOT NULL,
  data_state      TEXT NOT NULL CHECK (data_state IN ('final','all')),
  sync_run_id     TEXT NOT NULL REFERENCES gsc_sync_run(id)
);
CREATE UNIQUE INDEX gsc_daily_uq ON gsc_daily (tenant_id, site_id, date, data_state);

CREATE TABLE gsc_query_daily (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenant(id),
  site_id         TEXT NOT NULL REFERENCES site(id),
  date            TEXT NOT NULL,
  source_timezone TEXT NOT NULL,
  query           TEXT NOT NULL,
  clicks          INTEGER NOT NULL,
  impressions     INTEGER NOT NULL,
  ctr             REAL NOT NULL,
  position        REAL NOT NULL,
  data_state      TEXT NOT NULL CHECK (data_state IN ('final','all')),
  sync_run_id     TEXT NOT NULL REFERENCES gsc_sync_run(id)
);
CREATE UNIQUE INDEX gsc_query_daily_uq ON gsc_query_daily (tenant_id, site_id, date, query, data_state);
CREATE INDEX gsc_query_daily_date_idx ON gsc_query_daily (tenant_id, site_id, date);

CREATE TABLE gsc_reconciliation (
  id                           TEXT PRIMARY KEY,
  tenant_id                    TEXT NOT NULL REFERENCES tenant(id),
  site_id                      TEXT NOT NULL REFERENCES site(id),
  date                         TEXT NOT NULL,
  total_clicks                 INTEGER NOT NULL,
  query_sum_clicks             INTEGER NOT NULL,
  anonymized_delta_clicks      INTEGER NOT NULL,
  total_impressions            INTEGER NOT NULL,
  query_sum_impressions        INTEGER NOT NULL,
  anonymized_delta_impressions INTEGER NOT NULL,
  checked_at                   INTEGER NOT NULL
);
CREATE UNIQUE INDEX gsc_reconciliation_uq ON gsc_reconciliation (tenant_id, site_id, date);

CREATE TABLE provider_call (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL REFERENCES tenant(id),
  provider_id         TEXT NOT NULL,
  capability          TEXT NOT NULL,
  started_at          INTEGER NOT NULL,
  duration_ms         INTEGER NOT NULL,
  ok                  INTEGER NOT NULL,
  http_status         INTEGER,
  error_code          TEXT,
  quota_units         INTEGER NOT NULL DEFAULT 1,
  cost_micros         INTEGER NOT NULL DEFAULT 0,
  request_fingerprint TEXT NOT NULL
);
CREATE INDEX provider_call_tenant_started_idx ON provider_call (tenant_id, started_at);
CREATE INDEX provider_call_provider_idx ON provider_call (tenant_id, provider_id, started_at);
