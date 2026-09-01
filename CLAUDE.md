# R — platforma auto-SEO/GEO

Czytane automatycznie na starcie każdej sesji. Trzymaj krótkie — każda linia
kosztuje kontekst w każdej rozmowie.

## Zacznij tutaj

1. **Tabela STAN PRAC** w `docs/superpowers/plans/2026-08-31-faza-4-petla-agentowa.md`
   — mówi, co zrobione i gdzie wznowić. Fazy 0–3 są zamknięte po stronie kodu;
   ich plany czytaj **tylko zakresami** przez `grep -n '^### Zadanie'`,
   nigdy w całości.
2. **Panel:** `pnpm panel` → `http://localhost:4321`. Nasłuch na **obu** adresach
   pętli zwrotnej — sam IPv4 znaczył, że na Windowsie `localhost` nie działa.
2. **Preferencje właściciela** — sekcja na dole tego pliku.
3. Dobór umiejętności: `pnpm -s skills:pick "opis zadania"` (plugin `dobor-narzedzi`).

## Co to jest

Platforma do automatycznego SEO/GEO. Cel biznesowy: najpierw urosnąć na własnej
stronie właściciela, dopiero potem sprzedawać dostęp innym. Multi-tenancy jest
w schemacie bazy od pierwszej tabeli, ale billingu nie budujemy, dopóki nie ma
klienta. Roadmapa faz 0–5: `docs/analiza-seo-geo-i-plan-budowy.md` §Część 5.

## Architektura

Monorepo pnpm + Turborepo. Warstwy nie mieszają się:

- `packages/core` — czyste silniki (URL, daty, ULID, TenantScope, uzgodnienie).
  **Zero wejścia/wyjścia.**
- `packages/report` — generowanie raportu HTML. **Zero wejścia/wyjścia, zero sieci.**
- `packages/db` — **jedyne** wejście do bazy. Eksponuje wyłącznie funkcje
  przyjmujące `TenantScope`. Tylko tutaj `drizzle-orm` i `better-sqlite3`.
- `packages/providers` — **jedyne** wyjście na zewnątrz. Każde wywołanie API
  ląduje w tabeli `provider_call`. Tylko tutaj `google-auth-library` i sieć.
- `packages/parse` — HTML → `PageFacts` (`parse5`). **Zero wejścia/wyjścia.**
- `packages/rules` — silnik reguł audytu i paczki reguł. **Zero wejścia/wyjścia.**
- `packages/crawler` — `robots.txt`, mapy, kolejka, graf linków. Czysty; źródło
  stron dostaje **wstrzyknięte** interfejsem `PageSource` (D12).
- `packages/geo` — statystyka trackera AI, wykrywanie wzmianek, share of voice.
  **Zero wejścia/wyjścia.**
- `packages/keywords` — klastrowanie fraz, decyzja `refresh` vs `create`.
  **Zero wejścia/wyjścia.**
- `packages/content` — bramki anty-slop, briefy, linkowanie wewnętrzne, JSON-LD.
  **Zero wejścia/wyjścia.**
- `packages/agent` — scoring okazji, różnica w różnicach, polityki, wyłączniki.
  **Zero wejścia/wyjścia.**
- `apps/web` — panel lokalny. HTTP **wyłącznie na pętli zwrotnej**.
- `apps/cli` — skleja warstwy. Komendy: `init`, `gsc sync`, `verify`, `smoke`,
  `crawl`, `audit`, `psi`, `report`, `report --audit`, `geo prompts`, `geo entity`,
  `geo run`, `geo report`, `llms-txt`, `keywords cluster`, `brief`, `draft`, `publish`,
  `agent plan`, `agent board`, `agent measure`.

Reguły zależności egzekwuje `scripts/check-deps.ts` — nie obchodź ich, popraw projekt.

## Komendy

```bash
pnpm install
pnpm test              # cała sucha; musi być zielone przed commitem
pnpm typecheck
pnpm check:deps        # reguły warstw
pnpm check:secrets     # skan sekretów
pnpm -s skills:pick "opis zadania"
pnpm -s skills:index   # po zmianie katalogu .agents/skills
```

## Bezpieczniki crawlera (D15)

Wartości w kodzie, nie w konfiguracji. Flaga może zejść w dół, nigdy powyżej sufitu:
1 żądanie/s na host, 500 stron, głębokość 5, timeout 15 s, 5 MB na odpowiedź,
15 min na crawl. `User-Agent` jawny i możliwy do zablokowania — **nigdy nie
podszywamy się pod przeglądarkę.**

## Renderowanie (D16)

`--render N` renderuje **próbkę** stron, nie wszystkie: Chromium na 500 stronach
to kilkadziesiąt minut. Zależność to `playwright-core` (opcjonalna, nic nie
pobiera w tle). Przeglądarkę pobiera się raz: `npx playwright install chromium`,
albo wskazuje istniejącą przez `SEO_CHROMIUM_PATH`. **Brak przeglądarki nigdy
nie unieważnia udanego crawla.**

## Ograniczenia twarde

Wynikają ze specyfikacji, nie z gustu. Łamanie ich to zmiana decyzji, nie detal:

- **Koszt 0 zł.** Żadnej zależności wymagającej płatnego konta, żadnego hostingu.
- **Baza wyłącznie SQLite.** Żadnego `pg`, żadnego `drizzle-orm/pg-core`.
- **Migracje to ręczne pliki `.sql`.** `drizzle-kit generate` nie jest używany.
- **Klucze główne to ULID** (`text`, 26 znaków). Zero `AUTOINCREMENT`.
  Wyjątek: `tenant.id` to slug `^[a-z0-9][a-z0-9-]{1,62}$`.
- **`tenant_id TEXT NOT NULL` w każdej tabeli domenowej**, wiodąco w każdym
  indeksie i każdym ograniczeniu unikalności.
- **Data z GSC to `text` `YYYY-MM-DD` przepisany dosłownie z API.** Zakaz
  `new Date()` na tej wartości. Strefa źródła: `America/Los_Angeles`.
- **Testy działają bez sieci.** Jedyne prawdziwe wywołanie API to `seo gsc smoke`,
  poza CI.
- **Raport nie pobiera niczego z sieci** — bez `http://`, `https://` i `//`
  w `src`/`href`.
- **Zero oceny zbiorczej 0–100** (D18). Liczymy ustalenia wg wagi. Ocena wymaga
  wag, których nikt nie umie uzasadnić, i zachęca do poprawiania wskaźnika
  zamiast strony.
- **Reguła bez spełnionych `requires` milczy i melduje się jako pominięta** (D17).
  Cicho pominięta reguła to fałszywe poczucie porządku, nie brak problemu.
- **Dane terenowe i laboratoryjne z PSI nigdy nie są mieszane** w jednej liczbie.
- **Żadna liczba z trackera AI bez przedziału ufności** (D24). Pojedynczy przebieg
  promptu to próba Bernoulliego, nie pomiar.
- **Istotność wymaga dwóch warunków naraz** (D26): przedział mija zero **i** zmiana
  przekracza rozdzielczość pomiaru. Sam bootstrap nie widzi szumu wewnątrz promptu.
- **Porównanie tylko w obrębie tej samej trójki** silnik/wersja modelu/tryb dostępu
  (D27), tego samego zestawu promptów (D25) i tej samej wersji definicji encji (D29).
  W przeciwnym razie **odmowa z powodem**, nigdy cicho policzona różnica.
- **Cytowanie z groundingu i cytowanie z treści nigdy się nie sumują** (D32).
- **Bramki anty-slop są typem, nie sprawdzeniem** (D34, D37, D39). Funkcja
  publikująca przyjmuje `ApprovedDraft`, JSON-LD przyjmuje `VerifiedAuthor` —
  obu nie da się złożyć poza modułem bramek.
- **Draft bez unikalnego zasobu nie istnieje** (D37). Brak własnych danych,
  cytatu z pierwszej ręki, autorskiego diagramu albo podpisu eksperta = odrzucenie.
- **Nigdy nie generujemy encji autorskich** (D39). Zmyślony autor to fałszowanie
  E-E-A-T, nie szara strefa optymalizacji.
- **Publikacja zawsze przez pull request na osobnej gałęzi** (D35, D36). Commit
  na gałęzi chronionej jest odmawiany. Merge jest decyzją człowieka.
- **Metoda klastrowania jest nazwana i nie miesza się w jednym zestawie** (D33).
  Bez źródła SERP działa `lexical-overlap` i mówi o sobie wprost.
- **Domyślną akcją dla pokrytego klastra jest `refresh`, nie `create`** (D38).
- **Bez grupy kontrolnej nie ma pomiaru, tylko odmowa** (D48). Zejście do
  porównania „przed/po" jest zakazane — mierzyłoby sumę wszystkiego, co się
  wydarzyło, i przypisywało to naszej zmianie.
- **Grupa kontrolna dobierana przed zmianą** (D49). `selectControlGroup` nie ma
  dostępu do danych „po" i to jest wymuszone kształtem typu.
- **Typ akcji bez wpisu w politykach to `never`, nie `approve`** (D47).
- **Wyłącznik bije politykę**, także `approve` (D52). Wyłącznik, który da się
  ominąć zatwierdzeniem, jest ostrzeżeniem, a nie wyłącznikiem.
- **Zadanie nie może być `done` bez werdyktu** (D53). „Nie da się zmierzyć"
  też jest werdyktem.

## Konwencje pracy

- **Commit po każdym zadaniu, push od razu.** Praca niewypchnięta w chwili
  wyczerpania limitu jest pracą do powtórzenia.
- **Wiadomości commitów po polsku**, w trybie `typ: opis`.
- **Aktualizuj STAN PRAC razem z commitem** — następna sesja startuje z tabeli,
  nie z rozmowy.
- **Sekrety nigdy nie trafiają do repozytorium.** Klucz konta serwisowego GSC
  leży w `~/.seo/gsc.sa.json` (`chmod 600`); `.gitignore` łapie `*.sa.json`.
- **Nie sprawdzaj tego samego dwa razy.** Jeśli `pnpm test` przeszło po zmianie,
  nie uruchamiaj go ponownie „dla pewności" przed commitem tej samej zmiany.

---

## Preferencje właściciela

Tu ląduje to, czego uczę się o właścicielu między sesjami — rozmowy się urywają,
kontener jest tymczasowy, więc wiedza musi być w pliku, nie w pamięci rozmowy.

**Jak dopisywać:** dodaj punkt dopiero wtedy, gdy zmieniłby sposób działania
w przyszłej sesji. Jednorazowy fakt (adres, data, liczba) to konfiguracja, nie
preferencja — nie tutaj. Sprzeczność rozstrzygaj na korzyść nowszej obserwacji
i odnotuj, że się zmieniło. **Nigdy nie zapisuj tu sekretów ani danych
osobowych.** Jeśli lista rośnie ponad ~20 punktów, scal pokrewne zamiast dopisywać.

### Język i forma

- Rozmawiamy **po polsku**, nieformalnie. Dokumentacja, komentarze i commity
  po polsku.
- Chce **konkretu i decyzji, nie listy opcji**. „Rób" znaczy rób — nie pytaj
  o zgodę na rzeczy odwracalne.
- Gdy coś **nie jest jeszcze ustalone, ma to usłyszeć wprost** — prosił o to
  sam. Nie udawaj, że plan istnieje, jeśli istnieje tylko akapit opisu.

### Sposób pracy

- Pracuje **pod limitem tokenów** i rozmowy bywają ucinane w połowie. Stąd
  cała dyscyplina: stan w pliku, commit po każdym zadaniu, czytanie zakresami.
  To nie jest teoria — to się realnie zdarza co kilka sesji.
- **Specyfikacja przed kodem opłaciła się w Fazie 0** — kod powstał bez
  większych zawrotek. Domyślnie proponuj tę samą kolejność dla kolejnych faz.
- Raportuje postęp na poziomie „zrobiłem swoje"; szczegóły administracyjne
  potrafią zostać otwarte (np. klucz utworzony, ale API nieaktywne).
  **Sprawdzaj stan u źródła jednym wywołaniem, zamiast prosić go
  o potwierdzenie** — jest szybciej i nikogo nie odrywa.
- Zależy mu, żeby **jakość rosła z czasem** — dlatego ten plik. Gdy coś
  skoryguje, dopisz wniosek tutaj, zanim zniknie razem z rozmową.

### Czego nie zapisujemy

- **To repozytorium jest publiczne.** Nie trafiają do niego cudze strony,
  klienci ani oceny ich pracy — nawet gdy adres jest jawny, a ocena życzliwa.
  Zauważona 2026-09-01: opisałem w `docs/` stronę, którą właściciel robi
  dla klienta. Adres był publiczny, ale opis w jego repozytorium to już
  relacja z klientem, nie notatka projektowa.
- **Strony widziane przy okazji nie są tematem pracy.** Jeśli coś pojawi się
  na zrzucie ekranu albo w konfiguracji, a właściciel o to nie prosił — nie
  analizuj tego i nie proponuj tego jako poligonu.

### Decyzje trwałe

- **Zakup domen odłożony na sam koniec** (2026-08-28). Do tego czasu pracujemy
  wyłącznie na tym, co darmowe — żadnej pracy nad domeną, hostingiem ani stroną
  wizerunkową. Nazwa poniżej zostaje zapisana jako ustalenie, ale **nie jest
  tematem do dalszej pracy**, dopóki właściciel sam do niego nie wróci.

- **Marka: `mentiometry`, domena `mentiometry.com`** (decyzja 2026-08-27).
  Od łac. *mentio* — „wzmianka" — plus *-metria*, pomiar. Nazwa opisuje produkt
  dosłownie: mierzenie wzmianek marki w odpowiedziach AI.
  - **Bez frazy „seo" w domenie i marce.** Keyword stuffing obniża widoczność
    w AI o ~10% (Princeton GEO, KDD 2024), a nazwa generyczna jest niemierzalna
    dla naszego własnego trackera share of voice z Fazy 2 — marka musi być encją,
    którą da się policzyć.
  - **Jedna domena, jeden autorytet.** Angielski w `/`, polski w `/pl/`, `hreflang`
    między wersjami. `mentiometry.pl` i `mentiomentry.com` (literówka) tylko jako
    przekierowania 301 — nigdy jako osobne serwisy.
  - Znane ryzyko: podobieństwo do marki Mentimeter (ankiety na żywo). Inna
    kategoria i inny klient, ryzyko ocenione jako niskie i zaakceptowane.

- **Własna strona najpierw, klienci potem.** Nie sprzedajemy obietnicy —
  case study ma powstać na jego własnym ruchu.
- **Zero budżetu** jest granicą projektu, nie preferencją do negocjacji.
