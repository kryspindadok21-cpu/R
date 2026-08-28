-- Faza 1: crawl i audyt.
-- tenant_id wiodaco w kazdym indeksie i kazdym ograniczeniu unikalnosci (D5).
-- Klucze glowne to ULID (D6). JSON to text walidowany zod przy odczycie (D1).

CREATE TABLE crawl_run (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  site_id        TEXT NOT NULL REFERENCES site(id),
  started_at     INTEGER NOT NULL,
  finished_at    INTEGER,
  ok             INTEGER,
  error          TEXT,
  pages_fetched  INTEGER NOT NULL DEFAULT 0,
  pages_failed   INTEGER NOT NULL DEFAULT 0,
  max_pages      INTEGER NOT NULL,
  max_depth      INTEGER NOT NULL,
  delay_ms       INTEGER NOT NULL,
  render_sample  INTEGER NOT NULL DEFAULT 0,
  -- 'ok' | 'missing' | 'unreachable' — 'unreachable' znaczy, ze crawl nie ruszyl (D14).
  robots_state   TEXT NOT NULL CHECK (robots_state IN ('ok','missing','unreachable')),
  -- 1, gdy crawl uciel jakikolwiek limit. Wtedy reguly serwisowe milkna (D17).
  truncated      INTEGER NOT NULL DEFAULT 0,
  truncation_reason TEXT,
  user_agent     TEXT NOT NULL
);
CREATE INDEX crawl_run_tenant_site_idx ON crawl_run (tenant_id, site_id, started_at);

CREATE TABLE crawl_page (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenant(id),
  site_id           TEXT NOT NULL REFERENCES site(id),
  crawl_run_id      TEXT NOT NULL REFERENCES crawl_run(id),
  url_id            TEXT NOT NULL REFERENCES url(id),
  depth             INTEGER NOT NULL,
  http_status       INTEGER,
  content_type      TEXT,
  bytes             INTEGER NOT NULL DEFAULT 0,
  duration_ms       INTEGER NOT NULL DEFAULT 0,
  fetched_at        INTEGER NOT NULL,
  redirect_chain    TEXT NOT NULL DEFAULT '[]',
  fetch_error       TEXT,
  title             TEXT,
  meta_description  TEXT,
  h1_count          INTEGER NOT NULL DEFAULT 0,
  word_count        INTEGER NOT NULL DEFAULT 0,
  indexable         INTEGER NOT NULL DEFAULT 0,
  noindex_reason    TEXT,
  canonical_url     TEXT,
  in_sitemap        INTEGER NOT NULL DEFAULT 0,
  facts             TEXT,
  rendered          INTEGER NOT NULL DEFAULT 0,
  render_diff       TEXT
);
CREATE UNIQUE INDEX crawl_page_uq ON crawl_page (tenant_id, crawl_run_id, url_id);
CREATE INDEX crawl_page_run_status_idx ON crawl_page (tenant_id, crawl_run_id, http_status);

CREATE TABLE page_link (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  crawl_run_id TEXT NOT NULL REFERENCES crawl_run(id),
  from_url_id  TEXT NOT NULL REFERENCES url(id),
  -- NULL dla linkow zewnetrznych: nie zakladamy wiersza `url` dla cudzej domeny.
  to_url_id    TEXT REFERENCES url(id),
  to_url       TEXT NOT NULL,
  rel          TEXT NOT NULL CHECK (rel IN ('follow','nofollow','sponsored','ugc')),
  anchor_text  TEXT NOT NULL DEFAULT '',
  is_internal  INTEGER NOT NULL
);
-- Indeks pod pytanie o strony osierocone: „co prowadzi do tego adresu".
CREATE INDEX page_link_to_idx ON page_link (tenant_id, crawl_run_id, to_url_id);
CREATE INDEX page_link_from_idx ON page_link (tenant_id, crawl_run_id, from_url_id);

CREATE TABLE audit_finding (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  site_id      TEXT NOT NULL REFERENCES site(id),
  crawl_run_id TEXT NOT NULL REFERENCES crawl_run(id),
  rule_id      TEXT NOT NULL,
  severity     TEXT NOT NULL CHECK (severity IN ('blocker','high','medium','low','info')),
  category     TEXT NOT NULL,
  -- NULL dla ustalen dotyczacych calego serwisu, nie pojedynczej strony.
  url_id       TEXT REFERENCES url(id),
  url          TEXT,
  title        TEXT NOT NULL,
  evidence     TEXT NOT NULL DEFAULT '{}',
  autofix      TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX audit_finding_run_severity_idx ON audit_finding (tenant_id, crawl_run_id, severity);
CREATE INDEX audit_finding_rule_idx ON audit_finding (tenant_id, site_id, rule_id, created_at);

-- Reguly pominiete z powodu niespelnionych `requires` (D17). Cisza raportowana
-- wprost, bo cichy brak reguly to falszywe poczucie porzadku.
CREATE TABLE audit_skipped_rule (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL REFERENCES tenant(id),
  crawl_run_id TEXT NOT NULL REFERENCES crawl_run(id),
  rule_id      TEXT NOT NULL,
  missing      TEXT NOT NULL
);
CREATE UNIQUE INDEX audit_skipped_rule_uq ON audit_skipped_rule (tenant_id, crawl_run_id, rule_id);

CREATE TABLE psi_measurement (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL REFERENCES tenant(id),
  site_id           TEXT NOT NULL REFERENCES site(id),
  url_id            TEXT NOT NULL REFERENCES url(id),
  strategy          TEXT NOT NULL CHECK (strategy IN ('mobile','desktop')),
  measured_at       INTEGER NOT NULL,
  lcp_ms            REAL,
  inp_ms            REAL,
  cls               REAL,
  ttfb_ms           REAL,
  performance_score REAL,
  source            TEXT NOT NULL CHECK (source IN ('lab','field'))
);
CREATE UNIQUE INDEX psi_measurement_uq
  ON psi_measurement (tenant_id, url_id, strategy, source, measured_at);
CREATE INDEX psi_measurement_site_idx ON psi_measurement (tenant_id, site_id, measured_at);
