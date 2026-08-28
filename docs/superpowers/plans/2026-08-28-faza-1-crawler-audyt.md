# Faza 1 — Crawler i audyt. Plan wykonawczy

**Cel:** jedno polecenie przechodzi całą stronę właściciela, zapisuje jej stan
techniczny w lokalnej bazie i produkuje raport, w którym każde ustalenie ma adres,
dowód i opis poprawki.

**Spec:** `docs/superpowers/specs/2026-08-28-faza-1-crawler-audyt-design.md` (decyzje D11–D22)

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 1. `packages/parse` — HTML → `PageFacts` | ukończone, 234 testy zielone łącznie | `c7c8ef1` |
| 2. `packages/rules` — silnik + paczka reguł indeksacji i treści | ukończone, 286 testów zielonych łącznie | `3deedf8` |
| 3. `packages/rules` — paczka reguł linków, obrazów, danych strukturalnych | ukończone, **52 reguły**, 364 testy zielone łącznie | `914b63f` |
| 4. `packages/crawler` — `robots.txt` + mapy witryny | nie zaczęte | — |
| 5. `packages/crawler` — kolejka, bezpieczniki, przebieg crawla | nie zaczęte | — |
| 6. `packages/crawler` — graf linków wewnętrznych | nie zaczęte | — |
| 7. `packages/providers` — grzeczny pobieracz stron | nie zaczęte | — |
| 8. `packages/db` — migracja `0002` + repozytoria crawla | nie zaczęte | — |
| 9. `apps/cli` — `seo crawl` | nie zaczęte | — |
| 10. `apps/cli` — `seo audit` | nie zaczęte | — |
| 11. `packages/report` — raport audytu | nie zaczęte | — |
| 12. Renderowanie i diff surowy↔wyrenderowany (D16) | **częściowo** — `diffRenderedFacts` gotowy i przetestowany; został `RenderProvider` na Playwrighcie | `c7c8ef1` |
| 13. PageSpeed Insights (D21) | nie zaczęte | — |
| 14. `check-deps`, CI, odbiór na własnej stronie | nie zaczęte | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone),
potem pierwsze zadanie ze stanem innym niż „ukończone".

**Odstępstwa od planu odnotowane w trakcie:**
- `parse5` ma jedną zależność przechodnią (`entities`, MIT), nie zero jak zakładał D13.
  Nadal bez wejścia/wyjścia, więc decyzja zostaje w mocy.
- Czysta połowa Zadania 12 (`diffRenderedFacts`) wykonana razem z Zadaniem 1 —
  reguła `ai.js-required-for-content` z Zadania 3 potrzebuje jej jako wejścia.
- Akumulatory w `parsePage` siedzą w jednym obiekcie, nie w osobnych `let`.
  TypeScript zawęża `let` przypisywany wyłącznie w domknięciu do typu wartości
  początkowej; pole obiektu zachowuje typ zadeklarowany.
- Reguł wyszło **52**, nie 40 — paczki rozrosły się o `http.fetch-failed`,
  `jsonld.empty-type` i `link.to-redirect`. Żadna nie jest domysłem: każda ma
  test dodatni i ujemny.
- Zamiast `image.oversized` i `image.empty-alt-on-content` z planu weszły
  `image.missing-src` i `image.alt-too-long`. Powód: crawler pobiera wyłącznie
  dokumenty HTML (D15), więc wagi obrazu nie znamy, a puste `alt` jest poprawnym
  oznaczeniem obrazu dekoracyjnego — karanie za nie byłoby fałszywym alarmem.
- Reguły serwisowe odnajdują stronę także po adresie sprzed przekierowania
  (`indexWithRedirects`). Crawler zapisuje stronę pod adresem końcowym, więc bez
  tego link do `/stara` nie trafiłby w wiersz zapisany jako `/nowa`.
- Reguła `canonical.points-elsewhere` **zgłasza** różnicę w ukośniku końcowym.
  D4 Fazy 0 celowo trzyma `/strona` i `/strona/` jako osobne adresy „do czasu, aż
  crawler wykaże przekierowanie" — czyli dokładnie do Fazy 1. Zgłoszenie jest
  poprawne: albo canonical jest zły, albo brakuje przekierowania.
- Ponad plan: `scripts/check-deps.ts` egzekwuje konwencję `*.test-helper.ts` —
  taki plik wolno wyłączyć z reguł warstw, ale importować go może wyłącznie test.
  Bez tej drugiej połowy byłoby to obejście reguły, a nie wyjątek od niej.

---

## Ograniczenia globalne

Obowiązują w każdym zadaniu, dziedziczone z Fazy 0 plus nowe z D11–D22.

- **Koszt 0 zł.** Także koszt czasu i pamięci — stąd próbka renderowania (D16).
- **Testy działają bez sieci i bez Chromium** (AC11).
- **`packages/parse`, `packages/rules`, `packages/crawler` to czyste silniki** —
  zero `node:fs`, `node:http`, `undici`, `better-sqlite3`, `drizzle-orm` (D12, AC12).
- **Jedynym wyjściem na zewnątrz jest `packages/providers`**, każde żądanie w `provider_call` (D11).
- **Tożsamość strony to `url_hash` z `normalizeUrl`** (D19). Crawler nie ma własnego pojęcia strony.
- **Zero oceny zbiorczej 0–100** (D18). Ustalenia liczymy wg wagi.
- **Bezpieczniki z D15 są w kodzie**, nie w konfiguracji; flaga może zejść w dół, nigdy powyżej sufitu.
- Każde zadanie kończy się commitem i pushem. Wiadomości commitów po polsku, `typ: opis`.

---

### Zadanie 1: `packages/parse` — HTML → `PageFacts`

**Dostarcza:** czysty silnik, który z tekstu HTML robi strukturę, o którą reguły
umieją pytać.

- [ ] `pnpm add parse5 --filter @seo/parse` (MIT, zero zależności przechodnich, D13)
- [ ] `src/dom.ts` — minimalna warstwa nad drzewem `parse5`: `byTag`, `byTagAll`,
      `attr`, `textOf`, `walk`. Bez silnika selektorów CSS.
- [ ] `src/facts.ts` — typ `PageFacts`:
      - `title`, `titleLength`, `metaDescription`, `metaDescriptionLength`
      - `metaRobots` (rozłożone na `noindex`, `nofollow`, `noarchive`, `maxSnippet`)
      - `canonical` (surowy i rozwiązany względem adresu strony)
      - `lang`, `charset`, `viewport`
      - `headings: { level, text }[]`, `h1Count`, `headingOrderJumps`
      - `links: { href, resolved, anchorText, rel, isInternal, isNofollow }[]`
      - `images: { src, alt, hasAlt, width, height, loading }[]`
      - `jsonLd: { raw, parsed, type }[]` — błąd składni JSON to fakt, nie wyjątek
      - `openGraph`, `twitterCard`, `hreflang: { lang, href }[]`
      - `text`, `wordCount`, `textToHtmlRatio`
      - `scriptCount`, `stylesheetCount`, `inlineStyleCount`, `iframeCount`
      - `hasNoscript`, `bodyBytes`
- [ ] `src/parse.ts` — `parsePage(html, { url }) → PageFacts`. Rozwiązywanie adresów
      względnych przez `new URL(href, base)`; nieparsowalny adres nie wywala parsera,
      tylko trafia do `links[].resolved = null`.
- [ ] `src/text.ts` — ekstrakcja tekstu widocznego: pomija `<script>`, `<style>`,
      `<noscript>`, `<template>`, `<svg>`; normalizuje białe znaki; liczy słowa.
- [ ] Fixture'y w `fixtures/pages/`: `dobra-strona.html`, `bez-tytulu.html`,
      `dwa-h1.html`, `zepsuty-html.html`, `csr-pusty.html`, `csr-wyrenderowany.html`.
- [ ] Testy: pełne `PageFacts` dla `dobra-strona.html` porównane z golden output;
      `zepsuty-html.html` nie rzuca wyjątku i wydobywa tytuł mimo niedomkniętych znaczników.

**Kryterium ukończenia:** `parsePage` na każdym fixturze zwraca strukturę bez wyjątku;
golden output zapisany w `fixtures/golden/`.

---

### Zadanie 2: `packages/rules` — silnik + reguły indeksacji i treści

**Dostarcza:** interfejs reguły (D17) i pierwsze ~14 reguł.

- [ ] `src/rule.ts` — `Rule`, `Finding`, `Severity`, `RuleCategory`, `Capability`,
      `AutofixSpec`, `RuleContext`. `requires` i `autofix` od pierwszego dnia (D17).
- [ ] `src/engine.ts` — `runRules(rules, facts, ctx) → { findings, skipped }`.
      Reguła z niespełnionymi `requires` trafia do `skipped`, **nie** do `findings` (AC7).
      Wyjątek w regule nie przerywa przebiegu — ląduje jako ustalenie `rule.crashed`
      o wadze `info`, bo cichy brak reguły jest gorszy niż głośny błąd.
- [ ] `src/thresholds.ts` — wszystkie progi w jednym pliku (§8 specyfikacji).
- [ ] `src/rules/indexation.ts`:
      `noindex.present`, `canonical.missing`, `canonical.points-elsewhere`,
      `canonical.chain`, `robots.blocked-but-linked`, `http.status-4xx`,
      `http.status-5xx`, `redirect.chain-too-long`, `redirect.loop`
- [ ] `src/rules/content.ts`:
      `title.missing`, `title.too-long`, `title.too-short`, `title.duplicate`,
      `description.missing`, `description.too-long`, `description.duplicate`,
      `h1.missing`, `h1.multiple`, `heading.order-jump`, `content.thin`,
      `lang.missing`
- [ ] Test dodatni i ujemny dla każdej reguły (AC6).

**Kryterium ukończenia:** `runRules` na `dobra-strona.html` zwraca zero ustaleń
o wadze wyższej niż `low`.

---

### Zadanie 3: `packages/rules` — linki, obrazy, dane strukturalne, gotowość dla AI

**Dostarcza:** pozostałe ~26 reguł, do pełnych 40.

- [ ] `src/rules/links.ts`: `link.broken-internal`, `link.nofollow-internal`,
      `link.empty-anchor`, `link.generic-anchor`, `page.orphan`, `page.dead-end`,
      `page.too-deep`, `link.to-redirect`
- [ ] `src/rules/images.ts`: `image.missing-alt`, `image.empty-alt-on-content`,
      `image.missing-dimensions`, `image.oversized`, `image.lazy-above-fold`
- [ ] `src/rules/structured.ts`: `jsonld.invalid`, `jsonld.missing-on-article`,
      `jsonld.missing-required-field`, `jsonld.type-mismatch`, `og.missing`,
      `twitter.missing`
- [ ] `src/rules/technical.ts`: `viewport.missing`, `charset.missing`,
      `hreflang.missing-return`, `hreflang.invalid-code`, `sitemap.dead-url`,
      `page.slow-response`, `page.too-heavy`
- [ ] `src/rules/ai.ts` (gotowość dla silników AI, D16 i część 6 planu):
      `ai.js-required-for-content` — treść widoczna wyłącznie po renderowaniu,
      `ai.answer-not-upfront` — brak odpowiedzi w pierwszym akapicie po `H1`,
      `ai.chunk-not-standalone` — nagłówki bez samodzielnego kontekstu
- [ ] `src/index.ts` — `ALL_RULES` z testem, że identyfikatory są unikalne
      i że jest ich co najmniej 40.

**Kryterium ukończenia:** `ALL_RULES.length >= 40`, każda reguła ma dwa testy (AC6).

---

### Zadanie 4: `packages/crawler` — `robots.txt` i mapy witryny

- [ ] `src/robots.ts` — `parseRobotsTxt`, `isAllowed`, `crawlDelayFor`, `sitemapsFrom` (D14).
      Testy: najdłuższa reguła wygrywa, `Allow` wygrywa remis, `*` i `$`,
      scalanie sąsiadujących grup `User-agent`, brak grupy → `*` → wszystko dozwolone.
- [ ] `src/sitemap.ts` — `parseSitemap(xml)` obsługujące `<urlset>` i `<sitemapindex>`,
      z `lastmod`. Zwraca też błędy jako dane (`SitemapProblem[]`), nie wyjątki.
- [ ] Fixture'y w `fixtures/robots/` i `fixtures/sitemaps/`.

**Kryterium ukończenia:** AC2 i AC3 mają pokrycie testowe na poziomie funkcji czystych.

---

### Zadanie 5: `packages/crawler` — kolejka, bezpieczniki, przebieg

- [ ] `src/frontier.ts` — kolejka deterministyczna: FIFO wg głębokości, dedup po
      `url_hash` (D19), limit stron i głębokości (D15).
- [ ] `src/limits.ts` — `CrawlLimits` z domyślnymi i sufitami z D15; `clampLimits`
      jako czysta funkcja, testowana na wartościach ponad sufitem.
- [ ] `src/crawl.ts` — `runCrawl({ pageSource, clock, limits, robots }) → CrawlResult`.
      Wstrzykiwany zegar (AC4), wstrzykiwane `PageSource` (D12).
      Obsługa: przekierowania z zapisem łańcucha, `Content-Type` inny niż HTML
      (zapisz i nie parsuj), błąd pobrania jako `crawl_page` z `http_status = NULL`.
- [ ] Testy: crawl na fixturowym `PageSource`; sprawdź kolejność, dedup, limit
      głębokości, odstęp między żądaniami na zegarze wstrzykniętym, respekt `Disallow`.

**Kryterium ukończenia:** AC2, AC4 zielone; crawl na 12-stronicowej fixturowej
witrynie kończy się deterministycznie tą samą listą adresów.

---

### Zadanie 6: `packages/crawler` — graf linków

- [ ] `src/graph.ts` — `buildLinkGraph(edges) → LinkGraph`; `inDegree`, `outDegree`,
      `orphans`, `deadEnds`, `clickDepth` (BFS od strony głównej), `redirectChains`,
      `redirectLoops` (D20). Bez PageRank.
- [ ] Testy na fixturowym grafie: strona osierocona wykryta, osiągalna nie (AC8);
      pętla przekierowań wykryta bez zapętlenia algorytmu.

---

### Zadanie 7: `packages/providers` — grzeczny pobieracz stron

- [ ] `src/site/types.ts` — `SiteFetchProvider`, `FetchedPage`
      (`status`, `headers`, `body`, `bytes`, `durationMs`, `redirectChain`, `finalUrl`).
- [ ] `src/site/fetcher.ts` — implementacja na `fetch`:
      jawny `User-Agent` (D15), timeout przez `AbortSignal`, limit rozmiaru czytany
      strumieniowo (przerwij po przekroczeniu), ręczna obsługa przekierowań
      (`redirect: 'manual'`) z zapisem łańcucha, warunkowe `GET` po `ETag`/`Last-Modified`.
- [ ] Rejestr: każde żądanie zapisuje `provider_call` z `capability = 'crawl:fetch'`,
      `quota_units = 1`, `cost_micros = 0` (D11, AC5) — także żądanie zakończone błędem.
- [ ] `src/site/rate-limit.ts` — odstęp na host, czysta arytmetyka na wstrzykniętym zegarze.
- [ ] Testy na serwerze pętli zwrotnej (jak `apps/cli/src/e2e.test.ts` z Fazy 0):
      przekierowanie 301→301→200 daje łańcuch o długości 2; odpowiedź 6 MB przy
      limicie 5 MB jest przerwana; timeout kończy się `FetchTimeoutError`.

**Kryterium ukończenia:** AC5 zielone.

---

### Zadanie 8: `packages/db` — migracja `0002` + repozytoria

- [ ] `migrations/0002_crawl.sql` — tabele z §5 specyfikacji, ręcznie pisany SQL (D1).
- [ ] `src/schema.ts` — definicje Drizzle dla nowych tabel; rozszerz istniejący
      test porównujący schemat z `PRAGMA table_info`.
- [ ] `src/repo.ts` — `startCrawlRun`, `finishCrawlRun`, `upsertUrl`, `insertCrawlPage`,
      `insertPageLinks`, `insertFindings`, `listFindings`, `findingsBySeverity`,
      `orphanPages`, `latestCrawlRun`, `upsertPsiMeasurement` — wszystkie przez `TenantScope`.
- [ ] `src/facts-schema.ts` — schematy `zod` do walidacji JSON przy odczycie (D1).
- [ ] Test izolacji tenantów rozszerzony o nowe tabele.

---

### Zadanie 9: `apps/cli` — `seo crawl`

- [ ] `src/commands/crawl.ts` — spina `SiteFetchProvider` → `runCrawl` → zapis w bazie.
- [ ] Flagi: `--site`, `--max-pages`, `--max-depth`, `--delay`, `--render N`, `--dry-run`.
      Wartości ponad sufit z D15 są przycinane z komunikatem, nie odrzucane.
- [ ] Wyjście: liczba stron pobranych, nieudanych, pominiętych przez `robots.txt`,
      czas, stan `robots.txt`.
- [ ] Test: crawl na serwerze pętli zwrotnej z 5 stronami → 5 wierszy `crawl_page`,
      5 wierszy `provider_call`, graf linków zapisany.

---

### Zadanie 10: `apps/cli` — `seo audit`

- [ ] `src/commands/audit.ts` — czyta ostatni `crawl_run`, buduje `SiteFacts`
      (duplikaty tytułów, graf, mapa witryny), przepuszcza przez `ALL_RULES`,
      zapisuje `audit_finding`.
- [ ] Wyjście: liczba ustaleń wg wagi, top 10 reguł wg liczby trafień, liczba
      reguł pominiętych z powodu `requires` (D17) — pominięte pokazujemy wprost,
      bo cichy brak reguły to fałszywe poczucie porządku.
- [ ] Test: audyt na crawlu fixturowym daje stabilną, oczekiwaną listę reguł.

---

### Zadanie 11: `packages/report` — raport audytu

- [ ] `src/audit.ts` — sekcje: podsumowanie wg wagi, tabela ustaleń z adresem
      i dowodem, strony osierocone, najgłębsze strony, rozkład statusów HTTP,
      reguły pominięte.
- [ ] Zero zasobów z sieci (AC10) — rozszerz istniejący test na nową sekcję.
- [ ] `seo report --audit` w CLI.

---

### Zadanie 12: Renderowanie i diff surowy↔wyrenderowany (D16)

- [ ] `packages/parse/src/render-diff.ts` — `diffRenderedFacts(raw, rendered) → RenderDiff`
      (czysta funkcja): `textOnlyInRendered`, `linksOnlyInRendered`, `titleChanged`,
      `jsonLdOnlyInRendered`, `jsRequiredContentRatio`.
- [ ] `packages/providers/src/render/` — `RenderProvider` na Playwrighcie,
      `playwright` w `optionalDependencies`, import leniwy, czytelny komunikat przy braku.
- [ ] Reguła `ai.js-required-for-content` dostaje dane z `RenderDiff`.
- [ ] Test na parze fixture'ów, bez uruchamiania Chromium (AC9, AC11).

---

### Zadanie 13: PageSpeed Insights (D21)

- [ ] `packages/providers/src/psi/` — `PsiProvider`, klucz opcjonalny
      (`SEO_PSI_KEY`), rejestr wywołań, obsługa limitu 429 z wykładniczym ponawianiem.
- [ ] `seo psi --site <uri> [--limit N]`, domyślnie 10 stron o najwyższym priorytecie.
- [ ] Zapis do `psi_measurement`; sekcja w raporcie.
- [ ] Test na fixturze odpowiedzi PSI, bez sieci.

---

### Zadanie 14: `check-deps`, CI, odbiór

- [ ] `scripts/check-deps.ts` — reguły dla `parse`, `rules`, `crawler` (AC12).
- [ ] CI: nowe pakiety w macierzy, testy w trzech strefach czasowych jak w Fazie 0.
- [ ] `CLAUDE.md` — architektura rozszerzona o nowe pakiety i polecenia.
- [ ] Odbiór: crawl + audyt + raport na prawdziwej stronie właściciela; wnioski
      wpisane w „Odstępstwa" i w progi z `thresholds.ts`.

---

## Kolejność

Zadania 1 → 8 są od siebie zależne tylko przez typy, więc idą po kolei.
Zadania 9–11 wymagają 1–8. Zadania 12 i 13 są niezależne od siebie i od 9–11 —
gdyby limit tokenów uciął sesję, można je odłożyć bez blokowania odbioru.
Zadanie 14 zamyka fazę.

**Ścieżka najkrótsza do wartości widocznej dla właściciela:** 1 → 2 → 4 → 5 → 7 → 8 → 9 → 10 → 11.
Zadania 3, 6, 12, 13 dokładają głębokości, ale bez nich raport już istnieje.
