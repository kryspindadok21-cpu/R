-- Faza 3: silnik tresci.
-- tenant_id wiodaco w kazdym indeksie i kazdym ograniczeniu unikalnosci (D5).
-- Klucze glowne to ULID (D6). JSON to text walidowany zod przy odczycie (D1).

-- Zestaw klastrow powstaly jedna metoda. Metoda siedzi na zestawie, a nie tylko
-- na klastrze, bo mieszanie metod w jednym zestawie jest zakazane (D33, AC1).
CREATE TABLE keyword_cluster_set (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL REFERENCES tenant(id),
  site_id    TEXT NOT NULL REFERENCES site(id),
  method     TEXT NOT NULL CHECK (method IN ('serp-overlap','lexical-overlap')),
  -- Zakres dat z Search Console, z ktorego powstal. Daty doslownie, bez Date (D3).
  from_date  TEXT NOT NULL,
  to_date    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX keyword_cluster_set_site_idx
  ON keyword_cluster_set (tenant_id, site_id, created_at);

CREATE TABLE keyword_cluster (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL REFERENCES tenant(id),
  cluster_set_id TEXT NOT NULL REFERENCES keyword_cluster_set(id),
  -- Identyfikator czytelny, wyprowadzony z frazy glownej. Stabilny miedzy przebiegami.
  slug           TEXT NOT NULL,
  head           TEXT NOT NULL,
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_clicks   INTEGER NOT NULL DEFAULT 0,
  -- Ile adresow dziela frazy z fraza glowna. NULL znaczy „nie widzielismy SERP-a",
  -- co jest inna informacja niz 0 („widzielismy i nie dziela nic").
  shared_urls    INTEGER,
  keywords       TEXT NOT NULL DEFAULT '[]'
);
CREATE UNIQUE INDEX keyword_cluster_uq ON keyword_cluster (tenant_id, cluster_set_id, slug);

CREATE TABLE content_brief (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  site_id       TEXT NOT NULL REFERENCES site(id),
  cluster_id    TEXT NOT NULL REFERENCES keyword_cluster(id),
  decision      TEXT NOT NULL CHECK (decision IN ('refresh','create')),
  -- Adres do odswiezenia; NULL przy 'create'.
  target_url    TEXT,
  -- Powod decyzji jest ZAWSZE niepusty, takze gdy nikt go nie podal (D38).
  decision_reason TEXT NOT NULL,
  markdown      TEXT NOT NULL,
  -- Pelny brief jako JSON, zeby dalo sie go odtworzyc bez ponownego liczenia.
  payload       TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL
);
CREATE INDEX content_brief_site_idx ON content_brief (tenant_id, site_id, created_at);
CREATE INDEX content_brief_cluster_idx ON content_brief (tenant_id, cluster_id);

-- Draft razem z wynikiem bramek. Odrzucony draft TEZ tu ląduje — inaczej nie da
-- sie odpowiedziec na pytanie „ile draftow odpadlo i dlaczego".
CREATE TABLE content_draft (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenant(id),
  site_id       TEXT NOT NULL REFERENCES site(id),
  brief_id      TEXT NOT NULL REFERENCES content_brief(id),
  title         TEXT NOT NULL,
  markdown      TEXT NOT NULL,
  author_name   TEXT NOT NULL,
  author_same_as TEXT NOT NULL,
  unique_assets TEXT NOT NULL DEFAULT '[]',
  -- Silnik, wersja i prompt to metadane draftu (D40): inny model to inny proces.
  engine        TEXT NOT NULL,
  model_version TEXT NOT NULL,
  prompt_id     TEXT NOT NULL,
  -- 1 tylko wtedy, gdy draft przeszedl WSZYSTKIE bramki.
  approved      INTEGER NOT NULL DEFAULT 0,
  -- Lista niepowodzen bramek jako JSON. Pusta przy zatwierdzonym drafcie.
  gate_failures TEXT NOT NULL DEFAULT '[]',
  -- Wynik bramki oryginalnosci: z czym porownano i jak blisko bylo (D34).
  originality   TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL
);
CREATE INDEX content_draft_site_idx ON content_draft (tenant_id, site_id, created_at);
CREATE INDEX content_draft_brief_idx ON content_draft (tenant_id, brief_id, approved);

-- Publikacja. W Fazie 3 istnieje jeden adapter: 'git-pr' (D36).
-- Pull request JEST bramka zatwierdzenia, wiec 'merged' ustawia czlowiek (D35).
CREATE TABLE content_publication (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenant(id),
  site_id     TEXT NOT NULL REFERENCES site(id),
  draft_id    TEXT NOT NULL REFERENCES content_draft(id),
  adapter     TEXT NOT NULL CHECK (adapter IN ('git-pr')),
  -- Galaz, nigdy domyslna. Publikacja na domyslnej galezi jest zakazana.
  branch      TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  pr_url      TEXT,
  state       TEXT NOT NULL CHECK (state IN ('prepared','opened','merged','closed')),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX content_publication_draft_uq ON content_publication (tenant_id, draft_id);
CREATE INDEX content_publication_site_idx ON content_publication (tenant_id, site_id, created_at);
