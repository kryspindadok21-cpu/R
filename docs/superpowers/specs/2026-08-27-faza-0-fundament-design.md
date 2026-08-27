# Faza 0 — Fundament. Dokument decyzji

**Data:** 2026-08-27
**Status:** zatwierdzony do napisania planu wykonawczego
**Poprzednik:** `docs/analiza-seo-geo-i-plan-budowy.md`, Część 5 („Faza 0") i Część 6 („Architektura")
**Powód powstania:** stress test Fazy 0 wykazał sprzeczność blokującą, minę zatruwającą pomiary Fazy 4, niefalsyfikowalny kamień milowy i niedoszacowany blocker zewnętrzny. Ten dokument je rozstrzyga.

---

## 1. Streszczenie po ludzku

Faza 0 to fundament — nie ma w niej nic, co widać na ekranie. Robi trzy rzeczy: wybiera magazyn na dane, ustala jak nazywać strony, i podłącza pierwsze prawdziwe źródło (Google Search Console).

Co zmieniamy względem pierwotnego planu:

| Temat | Było w planie | Jest po stress teście | Dlaczego |
|---|---|---|---|
| Magazyn danych | raz „chmura", raz „plik na komputerze" | **plik na komputerze** (SQLite) | Plan podawał dwie różne odpowiedzi. Obsługa obu naraz to podwójna robota na zawsze. |
| Dostęp do Google | logowanie przez przeglądarkę (OAuth) | **konto serwisowe** | Logowanie wygasa po 7 dniach, dopóki Google nie zweryfikuje aplikacji. Konto serwisowe nie wygasa i jest darmowe. |
| Daty z Google | niedopowiedziane | **zapisywane dokładnie tak, jak podał Google** | Google raportuje w czasie kalifornijskim. Przesunięcie o dzień zatrułoby wszystkie pomiary z Fazy 4. |
| Liczniki darmowych limitów | Faza 4 | **Faza 0** | Doklejenie ich po fakcie to przerabianie kilkunastu miejsc w kodzie. |
| Rozdział danych między klientami | etykieta w tabeli | **etykieta + jedno miejsce, które tego pilnuje** | Sama etykieta nie chroni. Pierwszy klient zobaczyłby dane drugiego. |
| Kolejka zadań | „w pamięci" | **decyzja: trwała** (implementacja w Fazie 1) | Kolejka w pamięci gubi całą pracę przy zamknięciu programu. |
| Kamień milowy | „liczby muszą się zgadzać" | **konkretny, sprawdzalny warunek** (§8) | Liczby w oryginalnym brzmieniu nie mają prawa się zgodzić — Google celowo ukrywa część danych. |

Czas: **3 dni roboty są realne po tych cięciach.** Bez nich zakres wychodził na 1,5–2 tygodnie.

---

## 2. Cel Fazy 0

Doprowadzić do stanu, w którym prawdziwe dane z Google Search Console dla własnej strony leżą w lokalnym magazynie, są policzalne, a ich poprawność da się jednoznacznie zweryfikować.

Faza 0 **nie** produkuje wartości dla użytkownika końcowego. Produkuje fundament, którego cechą jest to, że nie trzeba go będzie wyburzać.

---

## 3. Decyzje

### D1 — Magazyn: wyłącznie SQLite

**Decyzja:** `better-sqlite3` przez `drizzle-orm/sqlite-core`. Jeden dialekt, jeden schemat, jeden zestaw migracji.

**Uzasadnienie:** `drizzle-orm/pg-core` i `drizzle-orm/sqlite-core` to rozłączne przestrzenie nazw z osobnymi builderami kolumn i osobnymi migracjami z `drizzle-kit`. „Jeden schemat na dwa dialekty" wymaga własnej warstwy fabryk kolumn, którą trzeba napisać i utrzymywać przy każdej nowej tabeli, a jej efektem jest i tak najniższy wspólny mianownik typów: bez `jsonb`, bez tablic, bez enumów, bez indeksów częściowych.

**Odrzucone alternatywy:**
- *Postgres/Neon od razu* — traci tryb offline i lokalny; darmowy tier Neona ma automatyczne wstrzymywanie instancji; każdy test i każdy crawl wymaga sieci.
- *Oba dialekty od dnia 1* — koszt startu ~1 dzień plus stały podatek, w zamian za elastyczność, która nie jest potrzebna przez najbliższe miesiące.

**Konsekwencje przyjęte świadomie:**
- JSON przechowujemy jako `text`, walidowany schematem `zod` przy odczycie.
- Enumy jako `text` + `CHECK`.
- Znaczniki czasu jako `integer` (epoch w milisekundach, UTC) — z wyjątkiem opisanym w D3.

**Ścieżka do Postgresa (gdy pojawi się pierwszy płacący klient):** nie przez „ten sam schemat", tylko przez port. `packages/db` eksponuje wyłącznie funkcje domenowe (nie surowe zapytania), więc podmiana dialektu dotyka jednego pakietu. Identyfikatory ULID (D6) sprawiają, że przeniesienie danych z lokalnych baz do wspólnej jest skryptem, a nie archeologią.

### D2 — Dostęp do Google Search Console: konto serwisowe

**Decyzja:** konto serwisowe (service account) w Google Cloud, z włączonym Search Console API. Adres e-mail konta serwisowego dodajemy jako użytkownika w ustawieniach property w Search Console — tak samo, jak dodaje się współpracownika. Uwierzytelnianie kluczem JSON.

**Uzasadnienie:** zakres `webmasters.readonly` jest u Google zakresem wrażliwym (sensitive). Aplikacja w stanie publikacji „Testing" działa, ale **token odświeżający wygasa po 7 dniach**. Kamień milowy zaliczony w dniu 3 przestałby działać w dniu 10, bez komunikatu. Wyjście ze stanu „Testing" wymaga weryfikacji u Google — kolejka liczona w tygodniach, wymagająca opublikowanej strony domowej i polityki prywatności, których jeszcze nie ma.

**Odrzucona alternatywa:** pełny przepływ OAuth. Wraca w Fazie 5, gdy podłączane będą property klientów — wtedy strona i polityka prywatności już istnieją, więc weryfikacja przestaje być blokerem.

**Przechowywanie klucza:** plik JSON poza repozytorium, ścieżka wskazywana zmienną środowiskową `SEO_GSC_KEY_FILE`, uprawnienia `0600`. `.gitignore` blokuje `*.sa.json` i `credentials/`. Test w CI sprawdza, że w drzewie git nie ma pliku wyglądającego na klucz serwisowy.

**Do zweryfikowania przed implementacją (zadanie nr 1 planu):** czy poziom uprawnień „Ograniczony" (Restricted) wystarcza do Search Analytics API, oraz czy URL Inspection API wymaga poziomu „Pełny" (Full). Ma to znaczenie dla Fazy 1, nie dla Fazy 0, ale uprawnienie nadaje się raz.

### D3 — Czas: data z Google jest tekstem, nie momentem

**Decyzja:**
- Kolumny `date` w tabelach pochodzących z GSC mają typ `text` w formacie `YYYY-MM-DD` i przechowują **dokładnie ten string, który zwróciło API** — bez parsowania, bez konwersji, bez `new Date()`.
- Każdy taki wiersz ma kolumnę `source_timezone` z wartością `'America/Los_Angeles'`.
- Wszystkie pozostałe znaczniki czasu (kiedy pobraliśmy dane, kiedy trwał crawl) to epoch w milisekundach UTC.

**Uzasadnienie:** Google Search Console raportuje w kalendarzu pacyficznym. Konwersja na moment w czasie wprowadza stałe przesunięcie o jeden dzień, zależne od strefy czasowej procesu. Skutek nie jest widoczny w Fazie 0 — ujawnia się w Fazie 4, w której cała przewaga produktu polega na zdaniu „zmiana z dnia D dała efekt X". Przesunięte daty czynią te pomiary fałszywymi, a wykrycie tego zajmuje miesiące.

**Egzekucja:** test regresyjny AC5 (§8) uruchamiany w dwóch skrajnych strefach czasowych.

### D4 — Tożsamość URL-a

**Decyzja:** `packages/core/src/url.ts`, stała `NORMALIZER_VERSION = 1`.

**Reguły normalizacji (wyczerpujące, wersjonowane razem ze stałą):**

| Element | Reguła |
|---|---|
| Schemat, host | małe litery; IDN → punycode |
| Port | usuwany, gdy domyślny dla schematu (80/443) |
| `www` | **nie usuwamy** — `www.x.pl` i `x.pl` bywają różnymi hostami. Sklejenie następuje dopiero, gdy crawler udowodni przekierowanie (Faza 1), i jest wtedy faktem o stronie, nie regułą normalizatora |
| Fragment (`#…`) | usuwany |
| Ścieżka | zachowuje wielkość liter; percent-encoding sprowadzany do formy kanonicznej (znaki `unreserved` dekodowane, hex wielkimi literami) |
| Ukośnik na końcu | **zachowywany** — `/buty` i `/buty/` pozostają osobne do czasu, aż crawler wykaże przekierowanie |
| Parametry zapytania | sortowane alfabetycznie; usuwane wyłącznie z jawnej listy śledzących: `utm_*`, `gclid`, `fbclid`, `msclkid`, `mc_eid`, `_ga`, `_gl`, `yclid`, `igshid` |
| `?` bez parametrów | usuwany |

Parametr `ref` **nie** jest usuwany — bywa nośnikiem treści, nie tylko śledzenia.

**Decyzja o przechowywaniu:** wiersz `url` zawiera `url_raw`, `url_normalized`, `url_hash` (SHA-256 z `url_normalized`, pierwsze 32 znaki hex) i `normalizer_version`. Kluczem głównym jest **surogat ULID**, nigdy sam URL. Unikalność: `UNIQUE(tenant_id, url_hash, normalizer_version)`.

**Uzasadnienie surogatu:** jeżeli klucz główny jest URL-em, przenormalizowanie zbioru jest niemożliwe bez przepisania wszystkich powiązań. Przy surogacie bump `NORMALIZER_VERSION` tworzy nowe wiersze i skrypt mapujący stare na nowe. Nigdy nie nadpisujemy w miejscu — historia musi pozostać interpretowalna.

### D5 — Rozdział danych między klientami

**Decyzja:**
- `tenant_id TEXT NOT NULL` w każdej tabeli domenowej. W trybie lokalnym stała wartość `'local'`. **Nigdy `NULL`** — kolumna dopuszczająca `NULL` jest klasycznym źródłem wycieku.
- `tenant_id` wchodzi wiodąco do **każdego** indeksu i **każdego** ograniczenia unikalności. `UNIQUE(url_hash)` byłoby błędem; poprawne jest `UNIQUE(tenant_id, url_hash, normalizer_version)`.
- Klucze obce zawsze wskazują wiersz w tym samym tenancie.

**Mechanizm egzekwowania:** SQLite nie ma bezpieczeństwa na poziomie wiersza (Postgres ma RLS, ale wybraliśmy SQLite), więc jedyną linią obrony jest warstwa dostępu. Dlatego:
- `packages/db` eksponuje **wyłącznie** funkcje domenowe przyjmujące pierwszym argumentem `TenantScope` (opakowany `tenant_id`). Surowy uchwyt bazy nie jest eksportowany.
- Reguła w CI: żaden pakiet poza `packages/db` nie importuje `drizzle-orm` ani `better-sqlite3`.
- Test AC6 (§8) generuje przypadek dla każdej eksportowanej funkcji zapytania — nowa funkcja bez izolacji nie przejdzie CI.

**Uzasadnienie:** przy docelowym modelu biznesowym (dostęp sprzedawany innym) wyciek danych między klientami nie jest usterką, tylko końcem sprzedaży. Koszt zabezpieczenia dziś to pół dnia; przy czterdziestu tabelach to przepisywanie warstwy dostępu.

### D6 — Identyfikatory: ULID

**Decyzja:** wszystkie klucze główne to ULID w postaci tekstowej (26 znaków). Zero `AUTOINCREMENT`.

Jedyny wyjątek: `tenant.id` jest czytelnym identyfikatorem nadawanym ręcznie (`'local'` w trybie CLI, później slug klienta), ponieważ występuje w poleceniach i w ścieżkach plików, a nie tylko w złączeniach. Musi być unikalny globalnie — walidacja wymusza wzór `^[a-z0-9][a-z0-9-]{1,62}$`.

**Uzasadnienie:** ULID jest sortowalny po czasie utworzenia i globalnie unikalny, więc przeniesienie danych z wielu lokalnych baz do jednej wspólnej (Faza 5) jest zwykłym `INSERT`, a nie remapowaniem kluczy. Liczniki autoinkrementowane gwarantują kolizje przy takim scaleniu.

### D7 — Rejestr wywołań zewnętrznych od pierwszego dnia

**Decyzja:** każde wyjście poza proces przechodzi przez `packages/providers` i zapisuje wiersz w tabeli `provider_call`:

`id, tenant_id, provider_id, capability, started_at, duration_ms, ok, http_status, error_code, quota_units, cost_micros, request_fingerprint`

`cost_micros` wynosi `0` dla źródeł darmowych, ale kolumna istnieje od początku.

**Uzasadnienie:** cała platforma stoi na darmowych limitach. „Governor budżetu" z Fazy 4 ma być czytelnikiem tej tabeli, a nie powodem do przerabiania kilkunastu miejsc wołających na zewnątrz. Bez rejestru od dnia 1 governor nie ma czego pilnować, a wyczerpanie limitu w połowie doby jest niediagnozowalne.

**Egzekucja:** reguła w CI — tylko `packages/providers` importuje klienty HTTP i SDK dostawców.

### D8 — Kolejka zadań: decyzja teraz, implementacja w Fazie 1

**Decyzja (zapisana tu, wykonana w Fazie 1):** interfejs `Queue` projektujemy pod semantykę trwałą — `enqueue` z `singletonKey`, `retryLimit`, wykładniczym ponawianiem, limitem widoczności i kolejką martwych listów. Adapterem pierwszej implementacji jest kolejka oparta o SQLite, **nie** `p-queue`.

**Uzasadnienie:** `p-queue` działa w pamięci procesu: brak trwałości, brak ponawiania po restarcie, brak limitu widoczności. Zaprojektowanie interfejsu jako części wspólnej `p-queue` i `pg-boss` oznacza semantykę `p-queue` na zawsze, a praktycznym skutkiem jest utrata crawla 10 000 adresów przy przerwaniu procesu.

**Faza 0 nie tworzy pakietu `jobs`.** Ingest z GSC jest jednorazowy i synchroniczny, więc kolejka byłaby kodem bez odbiorcy. Decyzja jest tu zapisana, bo Faza 1 nie może jej podejmować od nowa pod presją terminu.

### D9 — Warstwa dostawców: jeden kształt, nie cztery

**Decyzja:** Faza 0 definiuje **wyłącznie** ten interfejs, którego potrzebuje pierwszy adapter, plus część wspólną.

```ts
// packages/providers/src/site-metrics.ts
export interface SiteMetricsProvider {
  readonly id: ProviderId
  readonly capabilities: readonly SiteMetricsCapability[]
  queryPerformance(req: PerformanceQuery): Promise<PerformanceRows>
  estimateQuota(reqs: readonly PerformanceQuery[]): QuotaUnits
}
```

`SerpProvider`, `KeywordProvider` i `LlmEngineProvider` z Części 6 **nie** powstają w Fazie 0.

**Uzasadnienie:** Część 6 nazywa `providers/interfaces.ts` „polisą ubezpieczeniową" i ma rację co do celu, ale myli się co do środka. Polisę kupuje **rejestr wywołań (D7) + reguła zależności + jeden adapter faktycznie schowany za interfejsem**, a nie cztery interfejsy napisane z góry. Interfejs zaprojektowany przed drugą implementacją jest prawie zawsze zły, a jego poprawianie kosztuje więcej niż napisanie go później.

Dodatkowo Część 6 przewidywała trzy kształty, do których Google Search Console — jedyne źródło Fazy 0 — nie pasuje. `SiteMetricsProvider` jest tym brakującym czwartym kształtem.

---

## 4. Zakres

**W Fazie 0:**

1. Monorepo: pnpm workspaces + Turborepo, TypeScript, vitest, jeden linter/formatter.
2. `packages/core` — normalizacja URL i `NORMALIZER_VERSION`, generator ULID, `TenantScope`, typy bazowe.
3. `packages/db` — schemat SQLite w Drizzle, migracje, warstwa repozytoriów w całości scoped per tenant.
4. `packages/providers` — `SiteMetricsProvider`, adapter `gsc`, rejestr `provider_call`.
5. `apps/cli` — polecenia `seo init`, `seo gsc sync`, `seo gsc verify`, `seo gsc smoke`.
6. `fixtures/gsc/` — nagrane odpowiedzi API + skrypt ich odświeżania.
7. CI — typecheck, testy, reguły zależności, skan na wyciek klucza serwisowego.

**Poza Fazą 0 (jawnie, żeby nie było sporu przy planie):**

- crawler, Playwright, reguły audytu — Faza 1
- pakiet `jobs` (implementacja kolejki) — Faza 1
- URL Inspection API (indeksacja) — Faza 1
- `SerpProvider`, `KeywordProvider`, `LlmEngineProvider` — Fazy 2–3
- Postgres, Neon, praca wielu klientów naraz, OAuth, płatności, panel — Faza 5

---

## 5. Struktura repozytorium po Fazie 0

```
apps/
  cli/                    seo — polecenia init / gsc sync / gsc verify / gsc smoke
packages/
  core/                   url.ts, ids.ts, tenant.ts, types.ts
  db/                     schema.ts, migrations/, repo/*.ts  (jedyne wejście do bazy)
  providers/              site-metrics.ts, ledger.ts, adapters/gsc/
fixtures/
  gsc/                    nagrane odpowiedzi API
docs/
  superpowers/specs/      ten dokument
```

Zależności: `apps/cli` → `db`, `providers`, `core`. `providers` → `core`. `db` → `core`. `core` → nic.

---

## 6. Schemat bazy (Faza 0)

Klucze główne to ULID (`text`), z wyjątkiem `tenant.id` (slug — patrz D6). Wszystkie znaczniki czasu to `integer` (epoch ms, UTC), poza kolumnami `date` opisanymi w D3.

| Tabela | Zawartość | Ograniczenie unikalności |
|---|---|---|
| `tenant` | `id` (`'local'` w trybie CLI), `name`, `created_at` | PK |
| `site` | `tenant_id`, `property_type` (`domain` \| `url_prefix`), `property_uri`, `created_at` | `(tenant_id, property_uri)` |
| `url` | `tenant_id`, `site_id`, `url_raw`, `url_normalized`, `url_hash`, `normalizer_version`, `first_seen_at` | `(tenant_id, url_hash, normalizer_version)` |
| `gsc_sync_run` | `tenant_id`, `site_id`, `started_at`, `finished_at`, `date_from`, `date_to`, `data_state`, `dimensions`, `rows_fetched`, `ok`, `error` | PK |
| `gsc_daily` | `tenant_id`, `site_id`, `date` (text), `source_timezone`, `clicks`, `impressions`, `ctr`, `position`, `data_state`, `sync_run_id` | `(tenant_id, site_id, date, data_state)` |
| `gsc_query_daily` | jw. + `query` | `(tenant_id, site_id, date, query, data_state)` |
| `gsc_reconciliation` | `tenant_id`, `site_id`, `date`, `total_clicks`, `query_sum_clicks`, `anonymized_delta_clicks`, te same trzy dla wyświetleń, `checked_at` | `(tenant_id, site_id, date)` |
| `provider_call` | pola z D7 | PK |

`gsc_reconciliation` jest kamieniem milowym zmaterializowanym jako dane: różnica między sumą dzienną a sumą po hasłach nie jest błędem do ścigania, tylko wielkością do zapisania i podpisania.

W Fazie 0 pobieramy dwa zestawy wymiarów: `[date]` oraz `[date, query]`. Wymiar `page` (i tym samym zapełnienie tabeli `url` danymi z GSC) należy do Fazy 1 — tabela `url` powstaje teraz, bo od niej zależy schemat, ale w Fazie 0 pozostaje pusta lub zasilana wyłącznie adresem strony głównej.

---

## 7. Przepływ `seo gsc sync`

1. Wczytaj klucz serwisowy ze ścieżki z `SEO_GSC_KEY_FILE`.
2. Otwórz `gsc_sync_run`.
3. Dla zestawu wymiarów `[date]`, następnie `[date, query]`:
   - `dataState: 'final'`,
   - paginacja przez `startRow` aż odpowiedź zwróci mniej wierszy niż `rowLimit`,
   - każde wywołanie zapisuje wiersz w `provider_call`,
   - wiersze zapisywane transakcyjnie, `INSERT … ON CONFLICT DO UPDATE` po kluczu unikalności (ponowna synchronizacja tego samego zakresu jest idempotentna).
4. Przelicz `gsc_reconciliation` dla każdego dnia z zakresu.
5. Zamknij `gsc_sync_run`.

Zakres domyślny: od `dzisiaj − 90 dni` do `dzisiaj − 3 dni`. Górna granica wynika z niekompletności najświeższych danych i jest stałą nazwaną `GSC_FRESHNESS_LAG_DAYS = 3`.

---

## 8. Kryteria akceptacji

Faza 0 jest zakończona wtedy i tylko wtedy, gdy wszystkie poniższe przechodzą.

**AC1 — inicjalizacja.** `seo init` tworzy plik bazy, uruchamia migracje i wstawia `tenant('local')`. Ponowne wywołanie nie zmienia stanu.

**AC2 — pobranie.** `seo gsc sync --site <property> --from <D1> --to <D2>` zapisuje wiersze dla obu zestawów wymiarów. Liczba wierszy w `provider_call` równa się liczbie faktycznych wywołań API. Powtórzenie tego samego polecenia nie tworzy duplikatów.

**AC3 — uzgodnienie z Google (kamień milowy).** Dla dnia `D` starszego niż `GSC_FRESHNESS_LAG_DAYS`, wartość `gsc_daily.clicks` zgadza się **co do jednego kliknięcia** z liczbą pokazywaną w interfejsie Search Console dla tego dnia. `seo gsc verify --date D` drukuje obie liczby obok siebie i zapisuje wynik w `gsc_reconciliation`.

**AC4 — anonimizacja jest mierzona, nie ścigana.** Dla każdego dnia `SUM(gsc_query_daily.clicks) <= gsc_daily.clicks`. Różnica trafia do `anonymized_delta_clicks`. Naruszenie nierówności (suma po hasłach większa niż suma dzienna) jest błędem blokującym — oznacza błąd w liczeniu, ponieważ Google nie może ujawnić w rozbiciu więcej, niż raportuje w sumie.

**AC5 — data z Google jest nietknięta.** Test wstrzykuje odpowiedź API z datą `2026-03-10` i sprawdza, że w bazie znajduje się dokładnie string `2026-03-10`. Test wykonywany dwukrotnie, z `TZ=Pacific/Kiritimati` i `TZ=Pacific/Niue` (skrajne strefy po obu stronach linii zmiany daty). Oba przebiegi muszą dać identyczny wynik.

**AC6 — izolacja klientów.** Test zasiewa dane dwóch tenantów i wywołuje **każdą** eksportowaną funkcję zapytania z `packages/db` w zakresie tenanta A. Żadna nie może zwrócić choćby jednego wiersza tenanta B. Przypadki generowane z listy eksportów, więc nowa funkcja bez izolacji nie przechodzi CI.

**AC7 — normalizacja URL.** Tabela minimum 25 przypadków `raw → normalized` jako test wzorcowy, pokrywająca każdą regułę z D4. Zmiana `NORMALIZER_VERSION` bez aktualizacji wzorców powoduje czerwone CI.

**AC8 — reguły zależności.** Żaden pakiet poza `packages/db` nie importuje `drizzle-orm` ani `better-sqlite3`. Żaden poza `packages/providers` nie importuje klienta HTTP ani SDK Google. Naruszenie zatrzymuje CI.

**AC9 — testy działają bez sieci.** Cały pakiet testów adaptera GSC przechodzi offline, na nagranych odpowiedziach. Jedyne prawdziwe wywołanie API to `seo gsc smoke`, uruchamiane ręcznie, poza CI.

**AC10 — klucz nie wycieka.** Test CI sprawdza, że w drzewie git nie ma pliku o kształcie klucza konta serwisowego.

---

## 9. Testy

- **Silniki bez wejścia/wyjścia** (`packages/core`) — testy czystych funkcji, bez bazy i bez sieci. Normalizator URL testowany tabelą przypadków.
- **Warstwa bazy** — baza SQLite w pamięci, świeża na każdy przypadek, migracje uruchamiane w setupie.
- **Adapter GSC** — testy kontraktowe na nagranych fixture'ach, przez podmieniony transport HTTP. Skrypt `pnpm fixtures:gsc:record` odświeża nagrania z prawdziwego API i jest uruchamiany ręcznie.
- **Uzgodnienie (AC3)** — jedyny krok wymagający człowieka: porównanie z interfejsem Search Console. Wynik zapisywany w bazie, żeby dało się do niego wrócić.

---

## 10. Ryzyka

| # | Ryzyko | Postępowanie |
|---|---|---|
| R1 | Nie wiadomo, czy poziom uprawnień „Ograniczony" wystarcza dla Search Analytics, ani czy URL Inspection wymaga „Pełny" | Zadanie nr 1 planu: sprawdzić w dokumentacji **przed** pisaniem adaptera. Uprawnienie nadaje się raz, więc pomyłka kosztuje ponowne przejście przez konsolę Google |
| R2 | Pierwotny plan podawał limit 50 000 wierszy na dobę; dokumentacja Search Analytics API mówi o limicie `rowLimit` na pojedyncze zapytanie z paginacją przez `startRow` | Potwierdzić rzeczywiste wartości w dokumentacji przed implementacją paginacji. Nie opierać harmonogramu pobierania na liczbie z planu |
| R3 | AC3 może nie przejść mimo poprawnego kodu, z przyczyny jeszcze nieznanej | Nie wolno rozluźniać kryterium. Przyczynę zapisujemy w tym dokumencie jako aneks i dopiero wtedy korygujemy próg |
| R4 | `better-sqlite3` jest modułem natywnym i nie uruchomi się na Cloudflare Workers; Playwright z Fazy 1 również nie | Nie blokuje Fazy 0 (CLI działa na Node). Sygnalizuje, że wybór hostingu z Części 6 jest niezgodny z trybem lokalnym i z crawlerem — decyzja o hostingu należy do Fazy 5 i wymaga ponownego rozpatrzenia |
| R5 | Trzy dni to szacunek przy założeniu, że konfiguracja Google Cloud przebiegnie bez niespodzianek | Konfiguracja konta serwisowego jest pierwszym zadaniem planu, żeby ewentualne opóźnienie ujawniło się w dniu 1, a nie w dniu 3 |

---

## 11. Co ten dokument świadomie zostawia otwarte

Nic. Wszystkie punkty wymagające decyzji zostały rozstrzygnięte w §3. Pozycje R1 i R2 nie są decyzjami, tylko faktami zewnętrznymi do zweryfikowania, i mają przypisane zadania w planie wykonawczym.

---

## 12. Następny krok

Plan wykonawczy (skill `writing-plans`) rozbijający ten dokument na zadania z kolejnością i kryteriami odbioru. Kod nie powstaje przed zatwierdzeniem planu.
