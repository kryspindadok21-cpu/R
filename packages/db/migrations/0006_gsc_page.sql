-- Faza 4: metryki per strona z Search Console.
--
-- Roznica w roznicach porownuje strony zmienione ze stronami kontrolnymi,
-- wiec potrzebuje klikniec, wyswietlen i pozycji **dla pojedynczego adresu**.
-- Wymiary `date` i `date,query` z Fazy 0 tego nie daja.

CREATE TABLE gsc_page_daily (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenant(id),
  site_id         TEXT NOT NULL REFERENCES site(id),
  date            TEXT NOT NULL,
  source_timezone TEXT NOT NULL,
  -- Adres doslownie z API. Normalizacja idzie osobno, przy porownywaniu (D4).
  page            TEXT NOT NULL,
  clicks          INTEGER NOT NULL,
  impressions     INTEGER NOT NULL,
  ctr             REAL NOT NULL,
  position        REAL NOT NULL,
  data_state      TEXT NOT NULL CHECK (data_state IN ('final','all')),
  sync_run_id     TEXT NOT NULL REFERENCES gsc_sync_run(id)
);
CREATE UNIQUE INDEX gsc_page_daily_uq
  ON gsc_page_daily (tenant_id, site_id, date, page, data_state);
CREATE INDEX gsc_page_daily_zakres_idx
  ON gsc_page_daily (tenant_id, site_id, page, date);
