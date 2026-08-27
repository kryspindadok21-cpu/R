# R — platforma auto-SEO/GEO

Czytane automatycznie na starcie każdej sesji. Trzymaj krótkie — każda linia
kosztuje kontekst w każdej rozmowie.

## Zacznij tutaj

1. **Tabela STAN PRAC** w `docs/superpowers/plans/2026-08-27-faza-0-fundament.md`
   — mówi, co zrobione i gdzie wznowić. Plan ma ~3000 linii, **nigdy nie czytaj
   go w całości**; sekcje znajdź przez `grep -n '^### Zadanie'` i czytaj zakresami
   (`sed -n '880,1212p'`).
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
- `apps/cli` — skleja warstwy. Komendy: `init`, `gsc sync`, `verify`, `smoke`, `report`.

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

### Decyzje trwałe

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
