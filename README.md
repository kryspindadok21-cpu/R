# Platforma SEO/GEO — Faza 0

Narzędzie wiersza poleceń, które pobiera dane z Google Search Console do lokalnej
bazy SQLite, sprawdza ich poprawność i generuje statyczny raport HTML.

Faza 0 celowo robi jedną rzecz porządnie: **dane z GSC dla jednej strony, policzalne
i weryfikowalne co do jednego kliknięcia**. Bez hostingu, bez płatnych usług, bez
kont w zewnętrznych narzędziach.

## Wymagania

- Node 22 lub nowszy
- pnpm (wersja z pola `packageManager` w `package.json`)
- Konto Google z dostępem do property w Search Console

## Instalacja

```bash
pnpm install
pnpm test        # musi być zielone przed pierwszym uruchomieniem
```

## Konfiguracja dostępu do Search Console

Dane pobiera **konto serwisowe** — jego token nie wygasa po tygodniu i nie wymaga
weryfikacji aplikacji u Google.

1. W Google Cloud Console: nowy projekt → włącz „Google Search Console API".
2. Utwórz konto serwisowe i wygeneruj dla niego klucz JSON.
3. Zapisz klucz **poza repozytorium**, np. `~/.seo/gsc.sa.json`, i ustaw `chmod 600`.
4. W Search Console → Ustawienia → Użytkownicy i uprawnienia dodaj adres e-mail
   konta serwisowego. Zacznij od poziomu „Ograniczony"; jeśli API zwróci `403`,
   podnieś do „Pełny".
5. Wskaż plik klucza: `export SEO_GSC_KEY_FILE=~/.seo/gsc.sa.json`.

Klucz nigdy nie trafia do repozytorium — pilnuje tego `pnpm check:secrets`, a
`.gitignore` odrzuca `*.sa.json` i katalog `credentials/`.

## Polecenia

```bash
seo init                                        # baza + migracje
seo gsc sync   --site sc-domain:twojastrona.pl  # pobranie danych
seo gsc verify --site sc-domain:twojastrona.pl --date 2026-03-07
seo gsc smoke  --site sc-domain:twojastrona.pl  # jedno prawdziwe wywołanie API
seo report     --site sc-domain:twojastrona.pl --out raport.html
```

Dopóki pakiet nie jest zbudowany, każde polecenie uruchamiasz przez
`pnpm exec tsx apps/cli/src/bin.ts <polecenie>`.

`--site` przyjmuje identyfikator property dokładnie w formacie z Search Console:
`sc-domain:twojastrona.pl` dla właściwości domenowej albo `https://twojastrona.pl/`
dla właściwości z prefiksem URL.

Domyślny zakres synchronizacji to 90 dni kończące się **3 dni przed dzisiaj** —
świeższe dni w Search Console są niekompletne i zmieniają się jeszcze przez kilka dni.

### Weryfikacja danych

`seo gsc verify` drukuje liczby do ręcznego porównania z interfejsem Search Console.
Kliknięcia muszą zgadzać się **co do jednego**. Różnica między sumą dzienną a sumą
po hasłach to dane, które Google celowo ukrywa dla ochrony prywatności wyszukujących
— narzędzie ją mierzy i pokazuje, zamiast udawać, że jej nie ma.

## Zmienne środowiskowe

| Zmienna | Znaczenie | Domyślnie |
|---|---|---|
| `SEO_DB_PATH` | ścieżka pliku bazy | `~/.seo/seo.db` |
| `SEO_GSC_KEY_FILE` | klucz JSON konta serwisowego | brak (polecenia `gsc` nie zadziałają) |
| `SEO_TENANT` | identyfikator tenanta | `local` |

## Układ repozytorium

| Pakiet | Odpowiedzialność |
|---|---|
| `packages/core` | czyste funkcje: normalizacja URL, ULID, zakres tenanta, arytmetyka dat, uzgodnienie |
| `packages/db` | jedyne wejście do bazy; każda funkcja wymaga `TenantScope` |
| `packages/providers` | jedyne wyjście na zewnątrz; każde wywołanie trafia do tabeli `provider_call` |
| `packages/report` | czysty silnik HTML — dostaje dane, zwraca tekst |
| `apps/cli` | skleja warstwy w polecenia |

Reguł pilnuje `pnpm check:deps`: czyste silniki nie mogą importować wejścia/wyjścia,
bazy dotyka wyłącznie `packages/db`, do sieci wychodzi wyłącznie `packages/providers`.

## Dobór umiejętności pod zadanie (plugin `dobor-narzedzi`)

Repozytorium wiezie piętnaście umiejętności w `.agents/skills` — wczytanie
wszystkich to około 48 tys. tokenów samych `SKILL.md`. Plugin dobiera te, które
pasują do konkretnego zadania, i pilnuje budżetu:

```bash
pnpm skills:index                                   # przelicz katalog i koszty
pnpm skills:pick "test się wywala, znajdź przyczynę" # dobierz umiejętności
```

W Claude Code, z katalogu nadrzędnego wobec repozytorium:

```
/plugin marketplace add ./R
/plugin install dobor-narzedzi@seo-platform
/skille chcę dodać dane strukturalne do stron produktów
```

Szczegóły działania i ograniczenia: `plugins/dobor-narzedzi/README.md`.
Katalog `skills-index.json` jest wersjonowany, a test pilnuje, żeby nie
rozjechał się z zawartością `.agents/skills`.

## Bramka jakości

```bash
pnpm typecheck && pnpm test && pnpm test:tz-east && pnpm test:tz-west \
  && pnpm check:deps && pnpm check:secrets
```

Testy w trzech strefach czasowych są obowiązkowe: daty z Search Console są tekstem
w kalendarzu `America/Los_Angeles` i nigdy nie wolno ich przepuszczać przez `new Date()`.
Różnica wyników między strefami oznacza, że gdzieś w ścieżce danych powstaje `Date`.

Żaden test nie sięga do sieci. Jedynym poleceniem wykonującym prawdziwe wywołanie
API jest `seo gsc smoke` — świadomie nieobecne w CI.

## Dokumentacja

- Specyfikacja: `docs/superpowers/specs/2026-08-27-faza-0-fundament-design.md`
- Plan wykonawczy i stan prac: `docs/superpowers/plans/2026-08-27-faza-0-fundament.md`
- Analiza rynku i plan platformy: `docs/analiza-seo-geo-i-plan-budowy.md`
