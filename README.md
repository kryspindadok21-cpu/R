# Platforma SEO/GEO

Narzędzie wiersza poleceń, które:

- pobiera dane z **Google Search Console** do lokalnej bazy SQLite i weryfikuje
  ich poprawność co do jednego kliknięcia,
- **przechodzi stronę** jak robot wyszukiwarki i sprawdza ją zestawem
  **61 reguł audytu**,
- **wykrywa treść, która istnieje dopiero po wykonaniu JavaScriptu** — czyli
  jest niewidoczna dla części crawlerów, z których korzystają modele AI,
- mierzy wydajność przez **PageSpeed Insights**,
- składa to w **statyczny raport HTML**, w którym każde ustalenie ma adres
  i zmierzoną wartość.

Bez hostingu, bez płatnych usług, bez kont w zewnętrznych narzędziach.

## Stan prac

| Faza | Zakres | Stan |
|---|---|---|
| 0 | Fundament: dane z Search Console, baza, raport | kod gotowy; czeka na uprawnienie w GSC |
| 1 | Crawler, audyt, renderowanie, PSI, raport techniczny | **ukończona** |
| 2 | Pomiar widoczności w odpowiedziach modeli językowych | nie zaczęta |
| 3 | Silnik treści | nie zaczęta |
| 4 | Pętla agentowa — sama naprawia i mierzy efekt | nie zaczęta |
| 5 | Panel webowy | nie zaczęta |

Szczegóły i punkt wznowienia: tabela **STAN PRAC** w
`docs/superpowers/plans/2026-08-28-faza-1-crawler-audyt.md`.

## Uruchomienie na własnym komputerze

Renderowanie w Chromium, dane z Search Console i PageSpeed Insights da się
sprawdzić wyłącznie poza piaskownicą — instrukcja krok po kroku:
`docs/uruchomienie-na-komputerze.md`.

## Wymagania

- Node 22 lub nowszy
- pnpm (wersja z pola `packageManager` w `package.json`)
- Konto Google z dostępem do property w Search Console (tylko dla poleceń `gsc`)
- Chromium — **opcjonalnie**, wyłącznie dla `--render`

## Instalacja

```bash
pnpm install
pnpm test        # musi być zielone przed pierwszym uruchomieniem
```

## Polecenia

```bash
seo init                              # baza i migracje
seo gsc sync   --site <uri>           # dane z Search Console
seo gsc verify --site <uri> --date <YYYY-MM-DD>
seo crawl      --site <uri> [--render N]
seo audit      --site <uri>
seo psi        --site <uri> [--limit N]
seo report     --site <uri> [--audit]
```

Pełna lista flag: `seo help`.

## Architektura

Monorepo pnpm + Turborepo. Warstwy nie mieszają się i pilnuje tego
`scripts/check-deps.ts`:

| Pakiet | Rola | Wejście/wyjście |
|---|---|---|
| `core` | URL, daty, ULID, zakres tenanta | **zero** |
| `parse` | HTML → `PageFacts` | **zero** |
| `rules` | silnik reguł i 61 reguł audytu | **zero** |
| `crawler` | `robots.txt`, mapy, kolejka, graf linków | **zero** — źródło stron wstrzykiwane |
| `report` | generowanie raportów HTML | **zero** |
| `db` | jedyne wejście do bazy | SQLite |
| `providers` | jedyne wyjście na zewnątrz | sieć |
| `apps/cli` | skleja warstwy | — |

Silnik, który zaimportuje warstwę wejścia/wyjścia, przestaje być silnikiem —
i test to wyłapie.

## Zasady, które nie są kwestią gustu

- **Koszt 0 zł.** Żadnej zależności wymagającej płatnego konta.
- **Zero oceny zbiorczej 0–100.** Liczba, której nie da się sprawdzić, zachęca
  do poprawiania wskaźnika zamiast strony. Liczymy ustalenia według wagi.
- **Reguła bez danych milczy i melduje, że milczy.** Crawl ucięty limitem
  odbiera prawo głosu regułom serwisowym — „nikt tu nie linkuje" znaczyłoby
  wtedy „nie doszliśmy".
- **Crawler nie podszywa się pod przeglądarkę** i respektuje `robots.txt`,
  łącznie z prośbą o wolniejsze tempo. Nieosiągalny `robots.txt` zatrzymuje crawl.
- **Testy przechodzą bez sieci i bez przeglądarki.**
- **Dane terenowe i laboratoryjne z PSI nigdy nie są mieszane** w jednej liczbie.

## Strona testowa

`site/` — statyczna strona publikowana na GitHub Pages, żeby narzędzie miało
prawdziwy serwis do przejścia. Szczegóły: `site/README.md`.

## Skille dla agenta

`.agents/skills` wiezie piętnaście umiejętności; `.claude/skills` to dowiązania
do nich. Wczytanie wszystkich naraz to około 48 tysięcy tokenów, więc plugin
`dobor-narzedzi` wybiera tylko pasujące do zadania:

```bash
pnpm -s skills:pick "opis zadania"
pnpm -s skills:index    # po zmianie katalogu .agents/skills
```

## Kontrole

```bash
pnpm typecheck
pnpm check:deps      # reguły warstw
pnpm check:secrets   # skan sekretów
```
