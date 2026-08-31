-- Faza 2: tracker widocznosci w AI.
-- tenant_id wiodaco w kazdym indeksie i kazdym ograniczeniu unikalnosci (D5).
-- Klucze glowne to ULID (D6). JSON to text walidowany zod przy odczycie (D1).

-- Zestaw promptow jest bytem trwalym (D25). Dodanie promptu w srodku okresu
-- uniewaznia porownywalnosc, wiec zestaw uzyty w przebiegu jest **zamrazany**:
-- zmiana skladu wymaga nowego zestawu, a nie edycji istniejacego.
CREATE TABLE prompt_set (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenant(id),
  site_id     TEXT NOT NULL REFERENCES site(id),
  name        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  -- Poprzednia wersja zestawu, gdy ten powstal przez zmiane skladu.
  supersedes_id TEXT REFERENCES prompt_set(id),
  created_at  INTEGER NOT NULL,
  -- Znacznik pierwszego uzycia. Niepusty znaczy: skladu juz nie wolno ruszac.
  frozen_at   INTEGER
);
CREATE UNIQUE INDEX prompt_set_uq ON prompt_set (tenant_id, site_id, name, version);

CREATE TABLE prompt (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  prompt_set_id TEXT NOT NULL REFERENCES prompt_set(id),
  text          TEXT NOT NULL,
  -- Jezyk promptu; ten sam prompt po polsku i po angielsku to dwa prompty.
  locale        TEXT NOT NULL,
  created_at    INTEGER NOT NULL
);
CREATE UNIQUE INDEX prompt_uq ON prompt (tenant_id, prompt_set_id, text, locale);

-- Definicja encji marki (D29). Wersjonowana, bo zmiana wariantow uniewaznia
-- porownywalnosc wstecz tak samo jak NORMALIZER_VERSION w D4.
CREATE TABLE brand_entity (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenant(id),
  site_id    TEXT NOT NULL REFERENCES site(id),
  name       TEXT NOT NULL,
  variants   TEXT NOT NULL DEFAULT '[]',
  exclusions TEXT NOT NULL DEFAULT '[]',
  version    INTEGER NOT NULL DEFAULT 1,
  -- 1 dla wlasnej marki, 0 dla sledzonej konkurencji.
  is_own     INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX brand_entity_uq ON brand_entity (tenant_id, site_id, name, version);

-- Przebieg pomiaru. engine + model_version + access_mode to trojka, w obrebie
-- ktorej wolno porownywac (D27); entity_version domyka to od strony encji (D29).
CREATE TABLE geo_run (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  site_id        TEXT NOT NULL REFERENCES site(id),
  prompt_set_id  TEXT NOT NULL REFERENCES prompt_set(id),
  engine         TEXT NOT NULL,
  model_version  TEXT NOT NULL,
  access_mode    TEXT NOT NULL CHECK (access_mode IN ('api','api_grounded')),
  entity_version INTEGER NOT NULL,
  runs_per_prompt INTEGER NOT NULL,
  started_at     INTEGER NOT NULL,
  finished_at    INTEGER,
  ok             INTEGER,
  error          TEXT,
  answers_ok     INTEGER NOT NULL DEFAULT 0,
  answers_failed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX geo_run_tenant_site_idx ON geo_run (tenant_id, site_id, started_at);
CREATE INDEX geo_run_context_idx
  ON geo_run (tenant_id, site_id, engine, model_version, access_mode, started_at);

CREATE TABLE geo_answer (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenant(id),
  geo_run_id  TEXT NOT NULL REFERENCES geo_run(id),
  prompt_id   TEXT NOT NULL REFERENCES prompt(id),
  -- Numer przebiegu w obrebie promptu. Jednostka analizy jest prompt (D23),
  -- ale przebiegi trzymamy osobno, zeby dalo sie przeliczyc odsetek od nowa.
  run_index   INTEGER NOT NULL,
  text        TEXT NOT NULL DEFAULT '',
  -- Odmowa modelu jest **danymi**: pusta odpowiedz z powodem, nie blad przebiegu.
  refusal_reason TEXT,
  -- Niepuste znaczy, ze wywolanie sie nie udalo — inaczej niz odmowa.
  fetch_error TEXT,
  latency_ms  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX geo_answer_uq ON geo_answer (tenant_id, geo_run_id, prompt_id, run_index);

CREATE TABLE geo_mention (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  geo_run_id     TEXT NOT NULL REFERENCES geo_run(id),
  geo_answer_id  TEXT NOT NULL REFERENCES geo_answer(id),
  entity_id      TEXT NOT NULL REFERENCES brand_entity(id),
  matched        TEXT NOT NULL,
  start_offset   INTEGER NOT NULL,
  -- Udzial znakow przed wzmianka na tekscie po normalizacji (D30).
  position_share REAL NOT NULL,
  paragraph      INTEGER NOT NULL
);
CREATE INDEX geo_mention_run_entity_idx ON geo_mention (tenant_id, geo_run_id, entity_id);
CREATE UNIQUE INDEX geo_mention_uq
  ON geo_mention (tenant_id, geo_answer_id, entity_id, start_offset);

-- Cytowania (D32). `source` rozdziela dwa byty, ktore nigdy sie nie sumuja:
-- 'grounding' to swiadectwo pobrania dokumentu, 'inline' to tekst, ktory model
-- napisal — i moze byc zmyslony.
CREATE TABLE geo_citation (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  geo_run_id     TEXT NOT NULL REFERENCES geo_run(id),
  geo_answer_id  TEXT NOT NULL REFERENCES geo_answer(id),
  source         TEXT NOT NULL CHECK (source IN ('grounding','inline')),
  raw_url        TEXT NOT NULL,
  -- NULL, gdy adresu nie da sie znormalizowac. Model potrafi napisac smiec
  -- i to tez jest obserwacja.
  url_normalized TEXT,
  url_hash       TEXT,
  host           TEXT,
  position_share REAL,
  ours           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX geo_citation_run_source_idx ON geo_citation (tenant_id, geo_run_id, source, ours);
CREATE UNIQUE INDEX geo_citation_uq
  ON geo_citation (tenant_id, geo_answer_id, source, raw_url);
