# Faza 1 — Crawler i audyt. Dokument decyzji

**Data:** 2026-08-28
**Status:** zatwierdzony do napisania planu wykonawczego
**Poprzednik:** `docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md` (decyzje D1–D10)
**Numeracja decyzji:** kontynuacja, od D11.

---

## 1. Streszczenie po ludzku

Faza 0 dała odpowiedź na pytanie „ile ruchu mam". Faza 1 daje odpowiedź na pytanie
**„dlaczego tyle, a nie więcej"** — czyli: co konkretnie na stronie stoi na przeszkodzie.

Program wchodzi na stronę tak, jak zrobiłby to robot Google: czyta `robots.txt`,
pobiera strony po kolei, nie szybciej niż wypada, zapisuje każdą w bazie. Potem
przepuszcza to przez zestaw reguł — brak tytułu, tytuł za długi, dwa `H1`, obrazek
bez opisu, strona osierocona (nic do niej nie linkuje), łańcuch przekierowań,
`canonical` wskazujący gdzie indziej. Wynik to lista **ustaleń z dowodem**:
nie „strona ma 62/100", tylko „`/oferta` — tytuł 91 znaków, ucięty w wynikach,
oto ten tytuł".

Druga rzecz, którą Faza 1 robi, a której nie robi żadne z 20 przeanalizowanych
narzędzi w standardzie: **porównuje surowy HTML z HTML-em po wykonaniu JavaScriptu.**
Kilka crawlerów, z których korzystają modele AI, nie wykonuje JavaScriptu w ogóle.
Strona może świetnie rankować w Google i być zupełnie niewidoczna dla ChatGPT.
Ten pomiar jest wprost warunkiem wstępnym Fazy 2.

### Czego Faza 1 świadomie **nie** robi

| Kuszące | Werdykt | Dlaczego |
|---|---|---|
| Wynik „SEO score 0–100" | **nie** | Liczba nieweryfikowalna. Sumowanie nieporównywalnych wag to teatr precyzji. Podajemy liczby ustaleń wg wagi — to da się sprawdzić palcem. |
| Automatyczne poprawianie znalezionych błędów | **nie** (Faza 4) | Bezpieczniki z §Część 6 planu wymagają silnika polityk, którego jeszcze nie ma. Faza 1 tylko **opisuje** poprawkę w polu `autofix`. |
| Crawl cudzych stron / konkurencji | **nie** | Grzeczność i prawo. Faza 1 chodzi po property, do których tenant ma potwierdzony dostęp w Search Console. |
| Pełny zestaw ~300 reguł | **nie** | 40 reguł, każda z testem na fixturze. Reguła bez testu jest zobowiązaniem, nie funkcją. |
| Renderowanie każdej strony | **nie** | Chromium na każdą stronę to minuty zamiast sekund. Renderujemy próbkę (D16). |

---

## 2. Cel Fazy 1

Doprowadzić do stanu, w którym **jedno polecenie przechodzi całą stronę właściciela,
zapisuje jej stan techniczny w lokalnej bazie i produkuje raport, w którym każde
ustalenie ma adres URL, dowód i opis poprawki.**

Kamień milowy jest falsyfikowalny: `seo crawl --site <property> && seo audit --site <property>`
kończy się bez błędu, `crawl_page` zawiera co najmniej tyle wierszy, ile stron ma
mapa witryny, a `seo report --audit` otwiera plik, w którym da się wskazać palcem
konkretny URL i konkretną wadę.

---

## 3. Decyzje

### D11 — Pobieranie stron przechodzi przez `packages/providers`, nie przez nowy pakiet `http`

**Decyzja:** grzeczny pobieracz (`SiteFetchProvider`) mieszka w `packages/providers`.
Każde pobranie strony zapisuje wiersz w `provider_call`, tak samo jak wywołanie
Search Console API.

**Uzasadnienie:** pierwotny szkic architektury z `docs/analiza-seo-geo-i-plan-budowy.md`
przewidywał osobny pakiet `packages/http`. To by złamało twarde ograniczenie ustalone
w D7 i zapisane w `CLAUDE.md`: *„`packages/providers` — jedyne wyjście na zewnątrz.
Każde wywołanie API ląduje w tabeli `provider_call`"*. Dwa wyjścia na zewnątrz to
zero wyjść pod kontrolą — po pierwszym wyjątku od reguły nie ma już reguły.

Koszt decyzji jest realny i akceptowany: crawl 1000 stron to 1000 wierszy w
`provider_call`. Zysk: licznik tempa, historia błędów i budżet zapytań działają
dla crawlera **za darmo**, bez pisania drugiego mechanizmu. `quota_units = 1`
(liczymy żądania), `cost_micros = 0` (własna strona nic nie kosztuje).

**Wniosek dla `scripts/check-deps.ts`:** reguła „tylko `providers` wykonuje żądania
sieciowe" rozszerza się o nowe pakiety `parse`, `rules`, `crawler` — wszystkie mają
zakaz importu `node:http`, `node:https`, `undici` i `node:fs`.

### D12 — Crawler jest czysty, wejście/wyjście jest wstrzykiwane

**Decyzja:** `packages/crawler` **nie importuje niczego z wejściem/wyjściem.**
Dostaje interfejs `PageSource` w argumencie:

```ts
interface PageSource {
  fetchPage(url: string, opts: FetchOptions): Promise<FetchedPage>
}
```

Orkiestracja crawla (kolejność, decyzja czy wolno wejść, kiedy przestać) to czysta
funkcja generatorowa nad tym interfejsem. W testach `PageSource` to mapa
`URL → HTML` z katalogu `fixtures/`. W produkcji to adapter z `packages/providers`.

**Uzasadnienie:** crawler to najbardziej rozgałęziony kod w całej Fazie 1 (limity,
przekierowania, pętle, `robots.txt`, budżet). Testowanie go przez prawdziwą sieć
oznaczałoby testy niedeterministyczne albo testy, których nie ma. Ograniczenie
„testy działają bez sieci" (AC9 Fazy 0) obowiązuje dalej.

### D13 — Parser HTML: `parse5`

**Decyzja:** `parse5` (licencja MIT, zero zależności przechodnich, zero wejścia/wyjścia).

**Uzasadnienie:**
- **Wyrażenia regularne odpadają.** HTML ze świata jest zepsuty — niedomknięte
  znaczniki, atrybuty bez cudzysłowów, `<title>` w `<body>`. Regexp na tym daje
  ciche błędy, czyli fałszywe ustalenia w raporcie klienta. Fałszywy alarm kosztuje
  wiarygodność bardziej niż brak reguły.
- **`jsdom` odpada.** Wnosi implementację `XMLHttpRequest`, `fetch` i całą warstwę
  wejścia/wyjścia do pakietu, który z definicji ma jej nie mieć. Złamałby D12
  i `check-deps`.
- `parse5` implementuje algorytm parsowania ze specyfikacji HTML — ten sam, którego
  używa przeglądarka. Drzewo, które zwraca, jest tym, co zobaczyłby Googlebot.

Nad `parse5` piszemy własną, minimalną warstwę zapytań (`querySelector` w wersji na
nazwę znacznika i atrybut). Pełny silnik selektorów CSS to zależność, której nie
potrzebujemy — reguły pytają o kilkanaście rzeczy, nie o dowolny selektor.

### D14 — `robots.txt` interpretujemy wg RFC 9309, w wersji rygorystycznej

**Decyzja:** własny parser, czysta funkcja `parseRobotsTxt(text) → RobotsRules`,
oraz `isAllowed(rules, userAgent, path)`. Zasady:

- Grupy `User-agent` scalane, gdy występują jeden po drugim bez `Allow`/`Disallow` pomiędzy.
- Dopasowanie agenta bez rozróżniania wielkości liter, po prefiksie nazwy produktu.
  Brak grupy dla naszego agenta → grupa `*`. Brak `*` → wszystko dozwolone.
- **Najdłuższa pasująca reguła wygrywa. Przy równej długości wygrywa `Allow`.**
- Obsługa `*` i `$` w ścieżkach.
- `Crawl-delay` respektujemy, jeśli podany; w przeciwnym razie D15.
- **Nieosiągalny `robots.txt` (5xx, timeout) = zakaz crawlowania**, nie zgoda.
  Odwrotna domyślna wartość naraża cudzy serwer. Status 404 = zgoda (tak stanowi RFC).

**Uzasadnienie rygoru:** to jedyne miejsce w projekcie, w którym błąd uderza w kogoś
na zewnątrz. Nadmiernie ostrożny crawler pominie stronę; nieostrożny wygląda jak atak.

### D15 — Bezpieczniki crawlera są twarde i wpisane w kod, nie w konfigurację

**Decyzja:** wartości domyślne, z których żadna nie jest przekraczalna flagą w górę
o więcej niż podany sufit:

| Bezpiecznik | Domyślnie | Sufit |
|---|---|---|
| Równoległość na host | 1 | 2 |
| Odstęp między żądaniami do hosta | 1000 ms | nie mniej niż 500 ms |
| Limit stron na jeden crawl | 500 | 10 000 (flaga `--max-pages`) |
| Limit głębokości | 5 | 20 |
| Timeout żądania | 15 s | 30 s |
| Limit rozmiaru odpowiedzi | 5 MB | 20 MB |
| Maks. długość łańcucha przekierowań | 5 | 10 |
| Budżet czasu całego crawla | 15 min | 2 h |

`User-Agent` jest jawny i możliwy do zablokowania: `mentiometry-crawler/0.1 (+kontakt)`.
Crawler przedstawiający się jako przeglądarka to podszywanie się — nie robimy tego.

**Uzasadnienie:** crawler bez sufitu to narzędzie do przeciążania serwerów, także
własnego. Domyślne 1 żądanie na sekundę na host jest wolne i takie ma być: własna
strona nie ucieknie, a limit chroni przed sytuacją, w której narzędzie do poprawy
SEO wywala stronę klienta.

### D16 — Renderowanie: próbka, nie całość; Playwright jest opcjonalny

**Decyzja:**
- Crawl domyślnie pobiera **wyłącznie surowy HTML**. Zero Chromium, zero Playwrighta.
- Renderowanie to osobny provider (`RenderProvider`) i osobne polecenie
  `seo crawl --render <N>`, które renderuje **N stron o najwyższym priorytecie**
  (strona główna + strony z największą liczbą wyświetleń w GSC + strony, w których
  surowy HTML ma podejrzanie mało tekstu).
- `playwright` jest **opcjonalną zależnością (`optionalDependencies`)**, importowaną
  leniwie. Bez niej `seo crawl` działa; `--render` kończy się czytelnym komunikatem.
- Porównanie to czysta funkcja `diffRenderedFacts(raw, rendered) → RenderDiff`
  w `packages/parse`. Zwraca m.in. `textOnlyInRendered`, `linksOnlyInRendered`,
  `titleChanged`, `jsonLdOnlyInRendered` i **udział treści widocznej tylko po JS**.

**Uzasadnienie:** to jest ustalenie, które wprost warunkuje Fazę 2 — strona
renderowana po stronie klienta jest niewidoczna dla części crawlerów AI. Ale
Chromium na 500 stron to kilkadziesiąt minut i pół giga pamięci. Próbka 10 stron
odpowiada na to samo pytanie („czy ta strona wymaga JS do pokazania treści")
za 2% kosztu. **Zero budżetu obejmuje też budżet czasu i pamięci.**

### D17 — Reguła audytu ma `requires` i `autofix` od pierwszego dnia

**Decyzja:** interfejs w `packages/rules/src/rule.ts`:

```ts
interface Rule<F> {
  readonly id: string                   // 'title.too-long', stabilny na zawsze
  readonly category: RuleCategory       // 'indexation' | 'content' | 'links' | ...
  readonly severity: Severity           // 'blocker' | 'high' | 'medium' | 'low' | 'info'
  readonly requires: readonly Capability[]  // czego reguła potrzebuje, żeby mieć prawo głosu
  readonly title: string                // po polsku, dla człowieka
  evaluate(facts: F, ctx: RuleContext): readonly Finding[]
}
```

`Finding` niesie **dowód**: `evidence: Record<string, string | number>` z konkretnymi
wartościami (zmierzona długość, znaleziony tekst, adres celu), nigdy samą etykietę.

`autofix?: AutofixSpec` opisuje poprawkę deklaratywnie (`{ kind: 'set-meta', name: 'description', value }`),
ale **Faza 1 niczego nie wykonuje** — pole jest czytane dopiero przez silnik polityk
w Fazie 4. Bezpieczniki z planu przypisują `canonical`, `robots` i przekierowaniom
poziom „zawsze zatwierdzenie", więc autofix bez silnika polityk byłby naruszeniem
ustalenia, które już zapadło.

**`requires` rozstrzyga problem fałszywych alarmów:** reguła „strona osierocona"
nie ma prawa głosu, gdy crawl był ograniczony głębokością — bo wtedy „nikt nie
linkuje" znaczy „nie doszliśmy". Reguła bez spełnionych `requires` nie zwraca
ustalenia „w porządku", tylko **nie zwraca nic i melduje się jako pominięta**.

### D18 — Ustalenia są danymi, nie tekstem; wynik jest liczbą ustaleń, nie oceną

**Decyzja:** tabela `audit_finding` przechowuje `rule_id`, `severity`, `url_id`,
`evidence` (JSON walidowany `zod` przy odczycie, zgodnie z D1) i `first_seen_run_id`.
Raport agreguje liczbę ustaleń w podziale na wagę i kategorię. **Nie ma kolumny
`score` ani żadnej liczby zbiorczej 0–100.**

**Uzasadnienie:** ocena zbiorcza wymaga wag, których nikt nie umie uzasadnić, i tworzy
zachęcę do optymalizowania wskaźnika zamiast strony. Kluczowa własność: to samo
`rule_id` w dwóch crawlach jest **porównywalne** — z tego bierze się `regression`
i `fixed` w Fazie 4, a z oceny 0–100 nie bierze się nic.

### D19 — Tożsamość strony w crawlu to `url_hash` z Fazy 0

**Decyzja:** crawler nie zakłada własnego pojęcia „strona". Każdy napotkany adres
przechodzi przez `normalizeUrl` z `packages/core` i ląduje w tabeli `url` z Fazy 0.
`crawl_page` wskazuje na `url.id`.

**Uzasadnienie:** to jest cały powód, dla którego `url.ts` powstał pierwszy. Graf
linków, dane z Search Console i przyszłe cytowania AI muszą mówić o tej samej stronie.
Dwa pojęcia tożsamości to dwa niezgodne raporty o tej samej witrynie.

### D20 — Graf linków wewnętrznych liczymy, ale bez PageRank

**Decyzja:** `packages/crawler/src/graph.ts` — czyste funkcje na liście krawędzi:
stopień wejściowy i wyjściowy, strony osierocone, strony ślepe (bez linków wyjściowych),
odległość kliknięciowa od strony głównej (BFS), wykrywanie łańcuchów i pętli przekierowań.

**Bez PageRank / InternalLinkJuice.** Liczba wychodząca z iteracyjnego algorytmu na
niepełnym grafie jest efektowna i nieweryfikowalna. „Do tej strony nie prowadzi żaden
link wewnętrzny, a ma 1240 wyświetleń w Search Console" to ustalenie, które właściciel
strony może sprawdzić i naprawić w 5 minut — i to jest cała wartość.

### D21 — PageSpeed Insights: tak, ale nie w tym samym przebiegu

**Decyzja:** adapter PSI (`PsiProvider`) powstaje w Fazie 1, ale wywołuje się go
osobnym poleceniem `seo psi --site <uri> [--limit N]`, domyślnie na **10 stronach**.

**Uzasadnienie:** PSI bez klucza ma limit rzędu jednostek zapytań na minutę i bywa
wolne (kilkanaście sekund na stronę). Wpięte w crawl zamieniłoby 3-minutowy crawl
w 40-minutowy i psułoby crawl przy przekroczeniu limitu. Osobne polecenie to osobna
awaria. Dane lądują w `psi_measurement`, żeby Faza 4 mogła porównywać przed/po.

### D22 — Mapa witryny jest źródłem adresów, nie prawdą o nich

**Decyzja:** crawl startuje z sumy: adres property + `Sitemap:` z `robots.txt` +
`/sitemap.xml`. Parser map (w tym indeksów map i `.gz`) jest czystą funkcją.
Adresy z mapy trafiają do kolejki, ale **każdy jest sprawdzany pobraniem** — mapa
deklarująca stronę, która zwraca 404, to samo w sobie ustalenie audytu
(`sitemap.dead-url`).

---

## 4. Zakres

**W zakresie Fazy 1:**
1. `packages/parse` — HTML → `PageFacts` (czysty).
2. `packages/rules` — silnik reguł + 40 reguł z testami (czysty).
3. `packages/crawler` — `robots.txt`, mapy witryny, kolejka, graf linków (czysty, I/O wstrzykiwane).
4. `packages/providers` — `SiteFetchProvider`, `RenderProvider` (opcjonalny), `PsiProvider`.
5. `packages/db` — migracja `0002`: `crawl_run`, `crawl_page`, `page_link`, `audit_finding`, `psi_measurement`.
6. `packages/report` — sekcja audytu w statycznym HTML.
7. `apps/cli` — `seo crawl`, `seo audit`, `seo psi`, rozszerzenie `seo report`.

**Poza zakresem:** wykonywanie poprawek, crawl cudzych domen, kolejka trwała (D8 —
Faza 2 lub później, crawl mieści się w jednym procesie), panel webowy, GEO.

---

## 5. Schemat bazy — migracja `0002`

Wszystkie tabele niosą `tenant_id TEXT NOT NULL` wiodąco w każdym indeksie (D5),
klucze główne to ULID (D6), JSON jest tekstem walidowanym `zod` przy odczycie (D1).

- **`crawl_run`** — `id`, `tenant_id`, `site_id`, `started_at`, `finished_at`, `ok`,
  `error`, `pages_fetched`, `pages_failed`, `max_pages`, `max_depth`, `render_sample`,
  `robots_state` (`ok`/`missing`/`unreachable`), `user_agent`.
- **`crawl_page`** — `id`, `tenant_id`, `site_id`, `crawl_run_id`, `url_id`, `depth`,
  `http_status`, `content_type`, `bytes`, `fetched_at`, `duration_ms`,
  `redirect_chain` (JSON), `title`, `meta_description`, `h1_count`, `word_count`,
  `indexable` (0/1), `noindex_reason`, `canonical_url_id`, `facts` (JSON `PageFacts`),
  `rendered` (0/1), `render_diff` (JSON, `NULL` gdy nie renderowano).
  `UNIQUE(tenant_id, crawl_run_id, url_id)`.
- **`page_link`** — `id`, `tenant_id`, `crawl_run_id`, `from_url_id`, `to_url_id`,
  `rel` (`follow`/`nofollow`/`sponsored`/`ugc`), `anchor_text`, `is_internal`.
  Indeks `(tenant_id, crawl_run_id, to_url_id)` — to zapytanie o strony osierocone.
- **`audit_finding`** — `id`, `tenant_id`, `site_id`, `crawl_run_id`, `rule_id`,
  `severity`, `category`, `url_id` (`NULL` dla ustaleń serwisowych), `evidence` (JSON),
  `created_at`. Indeks `(tenant_id, crawl_run_id, severity)`.
- **`psi_measurement`** — `id`, `tenant_id`, `site_id`, `url_id`, `strategy`
  (`mobile`/`desktop`), `measured_at`, `lcp_ms`, `inp_ms`, `cls`, `ttfb_ms`,
  `performance_score`, `source` (`lab`/`field`).

---

## 6. Kryteria akceptacji

- **AC1.** `seo crawl --site <uri>` na własnej stronie kończy się kodem 0 i zapisuje
  `crawl_run` z `ok = 1` oraz co najmniej jeden `crawl_page`.
- **AC2.** Crawler nie pobiera adresu zabronionego przez `robots.txt` — test na
  fixturze z regułą `Disallow`, weryfikowany przez brak wywołania `PageSource`.
- **AC3.** Nieosiągalny `robots.txt` zatrzymuje crawl z `robots_state = 'unreachable'`
  i zerem pobranych stron (D14).
- **AC4.** Odstęp między dwoma żądaniami do tego samego hosta wynosi co najmniej
  `crawlDelayMs` — mierzone na zegarze wstrzykniętym, bez `sleep` w teście.
- **AC5.** Każde pobranie strony ma odpowiadający wiersz w `provider_call` (D11) —
  liczba wierszy = liczba żądań, łącznie z nieudanymi.
- **AC6.** 40 reguł, każda ma co najmniej jeden test dodatni i jeden ujemny na fixturze HTML.
- **AC7.** Reguła z niespełnionymi `requires` melduje się jako pominięta i **nie**
  produkuje ustalenia (D17).
- **AC8.** Strona osierocona jest wykryta na fixturze grafu; strona osiągalna nie jest.
- **AC9.** `diffRenderedFacts` wykrywa treść obecną wyłącznie po renderowaniu —
  test na parze fixture'ów (surowy HTML pusty w `<div id="app">`, rendered z treścią).
- **AC10.** `seo report --audit` produkuje plik bez `http://`, `https://` i `//`
  w `src`/`href` (kontynuacja AC11 Fazy 0).
- **AC11.** Cały pakiet testów przechodzi bez sieci i bez Chromium.
- **AC12.** `pnpm check:deps` przechodzi po rozszerzeniu reguł o `parse`, `rules`, `crawler`.

---

## 7. Ryzyka

| Ryzyko | Prawdopodobieństwo | Reakcja |
|---|---|---|
| Własna warstwa zapytań nad `parse5` okazuje się za wąska dla reguł | średnie | Reguły pytają o zamknięty zbiór rzeczy; rozszerzenie warstwy to funkcja, nie przebudowa. |
| 40 reguł to więcej roboty, niż wygląda | wysokie | Reguły są niezależne — plan dzieli je na paczki po ~10, każda paczka to osobny commit. Przerwana sesja nie cofa całości. |
| Playwright nie instaluje się w środowisku właściciela | średnie | D16 czyni go opcjonalnym. Brak = brak jednego ustalenia, nie brak audytu. |
| Limit PSI zablokuje pomiary | średnie | D21 — osobne polecenie, mały domyślny limit, wynik zapisany trwale, więc powtórka nie jest potrzebna. |
| Crawl własnej strony obciąży hosting właściciela | niskie | D15 — 1 żądanie/s, budżet czasu, jawny `User-Agent` do zablokowania. |

---

## 8. Co ten dokument zostawia otwarte

- **Kolejka trwała (D8).** Crawl 500 stron mieści się w jednym procesie CLI.
  Decyzja o implementacji kolejki opartej o SQLite wraca, gdy pojawi się pierwsze
  zadanie dłuższe niż jeden przebieg — najpewniej runner GEO w Fazie 2.
- **Zestaw reguł ponad 40.** Kolejne reguły dopisujemy, gdy audyt własnej strony
  pokaże, że czegoś brakuje. Reguła wymyślona przy biurku jest hipotezą.
- **Progi wag.** `title` powyżej 60 znaków to `low`, nie `high` — ale dokładne progi
  wymagają pierwszego przebiegu na prawdziwej stronie. Progi są stałymi w jednym
  pliku, żeby dały się skorygować bez ruszania reguł.
