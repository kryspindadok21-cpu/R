# Faza 2 — Tracker widoczności w AI. Plan wykonawczy

**Cel:** cotygodniowy pomiar tego, jak często i w jakim towarzystwie marka pojawia
się w odpowiedziach modeli językowych — z przedziałem ufności przy każdej liczbie
i z jawną odmową porównania tam, gdzie porównanie nie ma sensu.

**Spec:** `docs/superpowers/specs/2026-08-31-faza-2-tracker-geo-design.md` (decyzje D23–D31)

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 1. Specyfikacja Fazy 2 (D23–D31) | ukończone | `a0d8dda` |
| 2. `packages/geo` — warstwa statystyczna | ukończone, AC1/AC2/AC3/AC4/AC5 zielone; 687 testów zielonych łącznie | `a0d8dda` |
| 3. `packages/geo` — wykrywanie wzmianek i share of voice | ukończone, AC6 zielone; 710 testów zielonych łącznie | — |
| 4. `packages/geo` — ekstrakcja cytowań i pozycja wzmianki | niezaczęte | — |
| 5. `packages/db` — migracja `0003` + repozytoria GEO | niezaczęte | — |
| 6. `packages/providers` — adaptery silników (gemini, groq, openrouter) | niezaczęte | — |
| 7. `apps/cli` — `seo geo prompts`, `seo geo run` | niezaczęte | — |
| 8. `packages/report` — sekcja GEO z bramką istotności | niezaczęte | — |
| 9. `apps/cli` — `seo llms-txt` (D31) | niezaczęte | — |
| 10. Odbiór na własnej stronie | niezaczęte | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone),
potem pierwsze zadanie ze stanem innym niż „ukończone".

## Kolejność i uzasadnienie

Statystyka idzie **pierwsza**, przed silnikami i przed bazą. Powód jest praktyczny:
jeśli warstwa liczenia powstanie na końcu, dopasuje się do kształtu danych, które
akurat udało się zebrać — a powinno być odwrotnie. To liczby decydują, co w ogóle
warto zapisywać (D23: jednostką jest prompt, więc `run` musi mieć `prompt_id`
i `prompt_set_id`, inaczej różnica sparowana jest niepoliczalna po fakcie).

Wykrywanie wzmianek idzie drugie, bo jest czyste i testowalne na fixture'ach —
nie potrzebuje ani sieci, ani bazy. Dopiero potem baza, potem silniki, na końcu CLI.

## Odstępstwa od planu odnotowane w trakcie

- **Rozdzielczość pomiaru w D26 była zawyżona.** Specyfikacja mówiła „8–10 punktów
  procentowych przy `m = 50, n = 3`"; policzone wychodzi **11,3 pp**. Poprawka
  zapisana w D26 razem z powodem: błąd standardowy średniej różnicy sparowanej to
  `sqrt((2p(1−p)/n + σ²)/m)`, a nie sam pierwszy składnik. Przy okazji upadło
  drugie zdanie z tego akapitu — sam szum próbkowania zależy od **iloczynu** `m·n`,
  więc dodatkowy przebieg i dodatkowy prompt kosztują tyle samo i dają tyle samo.
  Argument za większym `m` zostaje, ale brzmi inaczej: składnik `σ²/m` (rozrzut
  samego efektu między promptami) zbija **wyłącznie** większy zestaw promptów.
  Więcej przebiegów ma podłogę, poniżej której nie zejdzie.
- `detectableDifference` liczy przypadek `σ = 0`, bo tylko ten da się policzyć
  **przed** pomiarem. Raportowana liczba jest więc granicą od dołu, nie obietnicą —
  i tak trzeba ją podpisać w raporcie.
- Odmowa porównania (AC3, AC5) jest **wynikiem**, nie wyjątkiem: `compareMeasurements`
  zwraca `{ kind: 'odmowa', reason, detail }`. Rzucony wyjątek kusi, żeby go złapać
  i pokazać zero; wynik trzeba obsłużyć w typie.
- `pairedComparison` przy jednym prompcie zwraca przedział o zerowej szerokości
  i `significant: false`. Bootstrap z jednej obserwacji zwróciłby przedział
  zerowej szerokości wyglądający jak precyzja — lepiej powiedzieć to wprost.
- **Wersja definicji encji odmawia porównania.** D29 mówi, że zmiana wariantów
  unieważnia porównywalność wstecz „tak samo jak `NORMALIZER_VERSION`", ale nie
  wskazywała mechanizmu. `MeasurementSet` niesie więc `entityVersion`, a
  `compareMeasurements` odmawia z powodem `rozna-wersja-encji`. Bez tego dopisanie
  jednego wariantu przesuwałoby cały szereg czasowy po cichu.
- **`\b` z JavaScriptu jest bezużyteczne dla polskiego.** Zna tylko
  `[A-Za-z0-9_]`, więc `\bŻak\b` nie dopasuje frazy w zdaniu: spacja i „Ż" są
  dla niego oba nie-słowne, czyli granicy tam nie ma. Granice liczymy
  lookaroundem na `\p{L}\p{N}_` z flagą `u`.
- **Nazwa główna w cudzej domenie liczy się jako wzmianka.** Kropka jest granicą
  słowa, więc „mentiometry" w „mentiometry.community" to prawdziwe wystąpienie.
  Uznanie, że akurat ta domena to nie my, jest polityką o konkretnym ciągu — i
  zgodnie z D29 mieszka w liście wykluczeń, czyli w danych. Wariant domenowy
  (`mentiometry.com`) zachowuje się poprawnie i wewnątrz dłuższej domeny **nie**
  łapie się w ogóle.
- **Share of voice liczy odpowiedzi ze wzmianką, nie wzmianki.** Marka wymieniona
  w jednej odpowiedzi pięć razy nie jest pięciokrotnie bardziej widoczna. Zliczanie
  wystąpień nagradzałoby gadatliwość modelu, a nie widoczność strony.
- **Odmiany nie zgadujemy.** Automatyczny stemmer polskiego dokładałby własne
  błędy do pomiaru, który ma te błędy wykrywać. Warianty są deklarowane —
  „Mentiometrom" bez wpisu na liście nie liczy się i to jest zachowanie testowane.
