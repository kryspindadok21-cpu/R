-- Faza 4: petla agentowa.
-- tenant_id wiodaco w kazdym indeksie i kazdym ograniczeniu unikalnosci (D5).
-- Klucze glowne to ULID (D6). JSON to text walidowany zod przy odczycie (D1).

-- Okazja: wynik deterministycznej arytmetyki (D45). Kazdy czynnik z uzasadnieniem,
-- zeby dalo sie odroznic liczbe zmierzona od zadeklarowanej.
CREATE TABLE agent_opportunity (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenant(id),
  site_id     TEXT NOT NULL REFERENCES site(id),
  -- Identyfikator stabilny miedzy przebiegami, np. `refresh:audyt-seo`.
  slug        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('fix-finding','refresh-content','create-content','improve-geo')),
  title       TEXT NOT NULL,
  target_url  TEXT,
  score       REAL NOT NULL,
  -- Piec czynnikow razem ze zrodlem i uzasadnieniem, jako JSON.
  factors     TEXT NOT NULL DEFAULT '{}',
  measured_factors INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX agent_opportunity_uq ON agent_opportunity (tenant_id, site_id, slug, created_at);
CREATE INDEX agent_opportunity_score_idx ON agent_opportunity (tenant_id, site_id, score);

-- Zadanie agenta. Stan poczatkowy to ZAWSZE `proposed`: planer emituje wnioski,
-- nie akcje (D46). Przejscie do `done` wymaga werdyktu (D53) i pilnuje tego kod.
CREATE TABLE agent_task (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  site_id        TEXT NOT NULL REFERENCES site(id),
  opportunity_id TEXT NOT NULL REFERENCES agent_opportunity(id),
  action_kind    TEXT NOT NULL,
  state          TEXT NOT NULL CHECK (state IN ('proposed','needs-you','in-flight','measuring','done')),
  -- Rozstrzygniecie bramki w chwili planowania: auto, needs-approval albo blocked.
  gate           TEXT NOT NULL,
  gate_reason    TEXT NOT NULL DEFAULT '',
  -- Niepuste dopiero po pomiarze. „Nie da sie zmierzyc" tez jest werdyktem.
  verdict        TEXT,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
CREATE INDEX agent_task_state_idx ON agent_task (tenant_id, site_id, state, created_at);

-- Eksperyment: grupy zapisane PRZED zmiana (D49). Dobor po zobaczeniu wynikow
-- jest niemozliwy, bo kolumny powstaja w chwili planowania.
CREATE TABLE agent_experiment (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  site_id        TEXT NOT NULL REFERENCES site(id),
  task_id        TEXT NOT NULL REFERENCES agent_task(id),
  -- Adresy grup jako JSON. Zapisane raz i nigdy nie zmieniane.
  treatment_urls TEXT NOT NULL DEFAULT '[]',
  control_urls   TEXT NOT NULL DEFAULT '[]',
  -- Powod, gdy nie udalo sie zebrac pelnej kontroli.
  shortfall      TEXT,
  -- Data zmiany, doslownie YYYY-MM-DD. Zakaz new Date() na tej wartosci (D3).
  changed_on     TEXT NOT NULL,
  selected_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX agent_experiment_task_uq ON agent_experiment (tenant_id, task_id);

-- Werdykt per okno pomiaru i per metryka (D50). Trzy okna, trzy osobne wiersze —
-- nigdy jedna usredniona liczba.
CREATE TABLE agent_verdict (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  experiment_id TEXT NOT NULL REFERENCES agent_experiment(id),
  window_days   INTEGER NOT NULL CHECK (window_days IN (14,30,60)),
  metric        TEXT NOT NULL CHECK (metric IN ('clicks','impressions','ctr','position')),
  -- 'werdykt' albo 'odmowa'. Odmowa TEZ jest zapisywana — inaczej nie da sie
  -- odpowiedziec, ile pomiarow nie doszlo do skutku i dlaczego.
  outcome       TEXT NOT NULL CHECK (outcome IN ('werdykt','odmowa')),
  effect        REAL,
  interval_low  REAL,
  interval_high REAL,
  significant   INTEGER NOT NULL DEFAULT 0,
  direction     TEXT CHECK (direction IN ('poprawa','pogorszenie')),
  refusal_reason TEXT,
  sentence      TEXT NOT NULL,
  treatment_pages INTEGER NOT NULL DEFAULT 0,
  control_pages   INTEGER NOT NULL DEFAULT 0,
  seed          INTEGER,
  measured_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX agent_verdict_uq
  ON agent_verdict (tenant_id, experiment_id, window_days, metric);
