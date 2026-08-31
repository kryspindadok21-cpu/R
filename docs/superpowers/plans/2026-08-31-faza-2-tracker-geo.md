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
| 3. `packages/geo` — wykrywanie wzmianek i share of voice | ukończone, AC6 zielone; 710 testów zielonych łącznie | `44779a4` |
| 4. `packages/geo` — ekstrakcja cytowań (D32) | ukończone; 728 testów zielonych łącznie | `00bb337` |
| 5. `packages/db` — migracja `0003` + repozytoria GEO | ukończone, izolacja najemców zielona; 762 testy zielone łącznie | `7905917` |
| 6. `packages/providers` — adaptery silników (gemini, groq, openrouter) | ukończone, AC7/AC8/AC9 zielone; 779 testów zielonych łącznie | `8923340` |
| 7. `apps/cli` — `seo geo prompts`, `seo geo entity`, `seo geo run` | ukończone, uruchomione na żywo; 797 testów zielonych łącznie | `2551c21` |
| 8. `packages/report` — raport GEO + `seo geo report` | ukończone; 826 testów zielonych łącznie | `fc8ba11` |
| 9. `apps/cli` — `seo llms-txt` (D31) | **generator ukończony**, reguła audytu świadomie odłożona (niżej); 840 testów zielonych | — |
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
- **Cytowania nie miały decyzji w specyfikacji — dopisana jako D32.** Zakres
  Fazy 2 wymieniał „ekstrakcję cytowań", ale nic nie mówił, czym cytowanie jest.
  Bez tego kod podjąłby decyzję po cichu. Rozstrzygnięcie: adres z metadanych
  groundingu (model **pobrał** dokument) i adres wypisany w treści (model go
  **napisał**, więc może być zmyślony) to dwa różne byty i nigdy nie sumują się
  w jedną liczbę — ta sama zasada, co rozdział danych terenowych i laboratoryjnych
  z PSI. `ourCitationRate` przyjmuje źródło jako argument, więc sygnatura funkcji
  nie pozwala ich zsumować jednym wywołaniem.
- **Dopasowanie „to nasza strona" odcina wiodące `www.`** — złagodzenie wyłącznie
  dla cytowań. Tożsamość strony w bazie (`url_hash`, D4) zostaje nietknięta.
- **Adres nie do sparsowania jest danymi, nie błędem.** Model potrafi napisać
  śmieć; to obserwacja o jego zachowaniu i trafia do raportu z `normalized: null`,
  zamiast ginąć w wyjątku.
- **Obcinanie ogona adresu rozstrzyga bilans nawiasów w samym adresie**, a nie
  sam znak. Inaczej albo tniemy poprawne adresy (`.../Delta_(rzeka)`), albo
  doklejamy składnię markdownu z `[tekst](adres)`.
- **Zamrożenie zestawu promptów jest wymuszone kodem, nie regulaminem.**
  `startGeoRun` ustawia `prompt_set.frozen_at`, a `addPrompts` rzuca wtedy
  `FrozenPromptSetError`. D25 mówi, że dodanie promptu w środku okresu unieważnia
  porównywalność — bez tego byłby to akapit, o którym ktoś zapomni za trzy
  miesiące. Zmiana składu wymaga nowej wersji zestawu (`supersedes_id`).
- **`listCitations` wymaga źródła jako argumentu.** Nie ma odczytu, który zwraca
  oba naraz — sygnatura pilnuje D32 tam, gdzie komentarz by nie wystarczył.
- **Test schematu miał wpisaną na sztywno listę tabel** i psuł się przy każdej
  migracji — dokładnie ta sama klasa błędu, co lista migracji w `migrate.test.ts`
  w Fazie 1. Porównuje teraz model drizzle z faktyczną zawartością bazy po
  migracjach, więc łapie oba kierunki rozjazdu: tabelę bez modelu i model bez
  tabeli. Test, który „się poprawia" przy każdej zmianie, niczego nie pilnuje.
- **`packages/db` zależy teraz od `@seo/geo`** — po typy `Mention`, `Citation`
  i `EntityDefinition`. To ta sama zależność co od `@seo/parse` w Fazie 1: czysty
  silnik definiuje kształt, baza go zapisuje.
- **Groq i OpenRouter dzielą jedną implementację.** Oba mówią protokołem
  `chat/completions` zgodnym z OpenAI i różnią się wyłącznie adresem, modelem
  i nagłówkami. Dwa osobne pliki byłyby dwiema kopiami tego samego błędu do
  poprawienia.
- **Odmowy nie rozpoznajemy po treści odpowiedzi.** Tylko po sygnale, który API
  podaje samo (`finishReason`, `blockReason`, `finish_reason`). Heurystyka na
  frazie „nie mogę pomóc" oznaczyłaby prawdziwą odpowiedź jako odmowę i zaniżyła
  widoczność bez śladu w danych — jest na to osobny test z odpowiedzią, która
  brzmi jak odmowa, a odmową nie jest.
- **`DEFAULT_MODELS` nie jest `as const`.** Literalny typ zawęziłby `models`
  w `selectEngines` do tych trzech napisów, czyli nadpisać model dałoby się
  wyłącznie tą samą wartością. Złapał to typecheck po napisaniu testu, który
  robi dokładnie to, po co ta opcja istnieje.
- **Nieznany powód blokady melduje się dosłownie** (`zablokowane: COS_NOWEGO`)
  zamiast wpaść do `null`. Dostawcy dokładają nowe kody i cicha zmiana w `null`
  wyglądałaby jak udzielona odpowiedź.
- **Zamrożony zestaw nie blokuje pracy — zakłada nową wersję.** `seo geo prompts`
  na zamrożonym zestawie kopiuje dotychczasowy skład do wersji `n+1`, dopisuje
  nowy prompt i wskazuje poprzednika przez `supersedes_id`. Stara wersja zostaje
  nietknięta, więc pomiar sprzed zmiany nadal da się odtworzyć. Alternatywa —
  odmowa dodania promptu — byłaby wierna D25, ale zmuszałaby właściciela do
  ręcznego przepisywania zestawu, żeby dopisać jedno pytanie.
- **Nieudane wywołanie nie liczy się jako próba.** Odmowa modelu tak: to jest
  odpowiedź, w której marki nie było (`hits: 0, trials: 1`). Błąd sieci daje
  `trials: 0`, bo inaczej awaria łącza wyglądałaby jak spadek widoczności.
- **`listEntities` zwraca `isOwn` jawnie.** Pierwsza wersja rozpoznawała własną
  markę po kolejności sortowania — działało, ale w sposób niewidoczny w typie.
  Od tego pola zależy, co w ogóle znaczy „widoczność", więc musi być polem.
- **`seo geo run` bez żadnego klucza kończy się kodem 1** i wypisuje wszystkie
  trzy pominięte silniki z nazwą brakującej zmiennej. Sprawdzone na żywo.
- **Bramka istotności z samego bootstrapu kłamała — to była realna wada, nie zła
  asercja w teście.** Bootstrap losuje z różnic **między** promptami i traktuje
  odsetek każdego promptu jak liczbę dokładną. Przy trzech przebiegach ten
  odsetek sam ma błąd standardowy rzędu 29 pp. Gdy różnice na promptach są
  zgodne, przedział robi się wąski albo punktowy — i zmiana zostaje uznana za
  istotną, choć zestaw fizycznie nie jest w stanie jej zmierzyć. Wyszło to na
  fikstur ze zerowym rozrzutem: przedział zerowej szerokości wyglądał jak
  pewność. Istotność wymaga teraz **obu** warunków: przedział mija zero
  **i** `|średnia różnica| ≥ detectableDifference(prompty, przebiegi)`.
  D26 dopisane.
- **`compareMeasurements` bierze liczbę przebiegów z danych**, jako minimum
  `trials` w obu zestawach — najsłabszy punkt porównania wyznacza jego dokładność.
  Nie trzeba jej podawać osobno i nie da się jej podać niezgodnie z danymi.
- **Bez `runsPerPrompt` przy zerowym rozrzucie nie orzekamy w ogóle.** Nie ma
  wtedy czym zmierzyć szumu wewnątrz promptu, a zgadywanie w tym miejscu byłoby
  dokładnie tym, przed czym broni cała ta warstwa.
- **Ziarno bootstrapu wyprowadzone z pary identyfikatorów przebiegów** (FNV-1a),
  więc ten sam raport wygenerowany dwa razy daje identyczny przedział — jest na
  to test.
- **Raport nie ma jednej liczby „widoczności w AI".** Każdy silnik to osobny
  wiersz, bo model z groundingiem i model bez to dwa procesy. Cytowania też są
  rozdzielone na źródła i nie sumują się.
- **Generator `llms.txt` bierze dane z zapisanego crawla, nie z nowego pobrania.**
  Strony, które już znamy, mają tytuł, opis i informację o indeksowalności.
  Drugie przejście po stronie tylko po to, żeby złożyć plik, byłoby ruchem
  sieciowym bez nowej informacji.
- **Reguła audytu „brak `llms.txt`" świadomie nie powstała.** Żeby ją napisać
  uczciwie, crawler musiałby dodatkowo pobrać `{root}/llms.txt` i zapisać stan
  w nowej kolumnie — migracja, zmiana crawlera i nowa zdolność w silniku reguł.
  D31 mówi wprost, że wysiłek ma iść w czynniki strukturalne, nie tutaj, więc
  ta praca jest odłożona, a nie zrobiona po łebkach. **Nie ma reguły, która
  udaje, że sprawdza plik, a naprawdę sprawdza tylko, czy crawl na niego trafił** —
  to byłaby dokładnie ta cicha nieprawda, przed którą broni D17.
- Do pliku nie trafiają strony z `noindex`. Wpisanie tam adresu, który sam
  własnym nagłówkiem prosi o nieindeksowanie, byłoby sprzecznością.
- Sprawdzone na żywo na `kryspindadok21-cpu.github.io/R/`: 4 strony, cztery
  sekcje wg pierwszego segmentu ścieżki, opisy z `meta description`.
