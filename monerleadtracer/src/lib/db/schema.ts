/**
 * Schemat bazy MonerLeadTracer.
 *
 * Trzymamy DDL w module TS, a nie w .sql, bo Next bundluje kod serwera i odczyt
 * pliku z dysku w runtime funkcji serverless bywa zawodny. Jedno źródło prawdy.
 * Migracja jest idempotentna — bezpiecznie puszczać wielokrotnie.
 */

export const SCHEMA_SQL = `
-- MonerLeadTracer — schemat bazy.
-- Ten sam SQL działa na better-sqlite3 (lokalnie) i na libSQL/Turso (produkcja).
-- Migracja jest idempotentna: bezpiecznie puszczać wielokrotnie.

CREATE TABLE IF NOT EXISTS leads (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id             TEXT    NOT NULL UNIQUE,
  name                 TEXT    NOT NULL,
  category             TEXT,
  niche                TEXT    NOT NULL DEFAULT 'inne',
  types_json           TEXT    NOT NULL DEFAULT '[]',
  address              TEXT,
  phone                TEXT,
  website_uri          TEXT,
  website_status       TEXT    NOT NULL DEFAULT 'none',
  rating               REAL,
  reviews_count        INTEGER NOT NULL DEFAULT 0,
  opening_hours_json   TEXT,
  business_status      TEXT    NOT NULL DEFAULT 'UNKNOWN',
  lat                  REAL,
  lng                  REAL,
  maps_uri             TEXT,
  city                 TEXT    NOT NULL DEFAULT '',
  score                INTEGER NOT NULL DEFAULT 0,
  score_breakdown_json TEXT    NOT NULL DEFAULT '[]',
  status               TEXT    NOT NULL DEFAULT 'nowy',
  notes                TEXT,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_score  ON leads (score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_city   ON leads (city);
CREATE INDEX IF NOT EXISTS idx_leads_niche  ON leads (niche);

CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  author       TEXT,
  rating       REAL,
  text         TEXT    NOT NULL DEFAULT '',
  publish_time TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_lead ON reviews (lead_id, publish_time DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id    INTEGER NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  tone       TEXT    NOT NULL,
  channel    TEXT    NOT NULL,
  body       TEXT    NOT NULL DEFAULT '',
  is_edited  INTEGER NOT NULL DEFAULT 0,
  hook_used  TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lead_id, tone, channel)
);

-- Cache odpowiedzi Google Places. Jedyny powód, dla którego powtórny skan nie kosztuje.
CREATE TABLE IF NOT EXISTS api_cache (
  key           TEXT PRIMARY KEY,
  endpoint      TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON api_cache (expires_at);

-- Log przebiegów skanu: ile poszło zapytań, ile złapał cache.
CREATE TABLE IF NOT EXISTS searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  niche      TEXT    NOT NULL,
  city       TEXT    NOT NULL,
  query      TEXT    NOT NULL,
  api_calls  INTEGER NOT NULL DEFAULT 0,
  cache_hits INTEGER NOT NULL DEFAULT 0,
  results    INTEGER NOT NULL DEFAULT 0,
  new_leads  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Rate-limit logowania.
CREATE TABLE IF NOT EXISTS auth_attempts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ip         TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_ip ON auth_attempts (ip, created_at DESC);
`;

export const SCHEMA_VERSION = 1;
