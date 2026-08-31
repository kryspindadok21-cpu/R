# Faza 3 — Silnik treści. Plan wykonawczy

**Cel:** jedno polecenie zamienia klaster fraz w gotowy do przeglądu artykuł
i otwiera pull request — z bramkami, których nie da się obejść.

**Spec:** `docs/superpowers/specs/2026-08-31-faza-3-silnik-tresci-design.md` (decyzje D33–D44)

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 1. Specyfikacja Fazy 3 (D33–D44) | ukończone | — |
| 2. `packages/keywords` — klastrowanie i pokrycie tematu | ukończone, AC1/AC2/AC5 zielone; 913 testów zielonych łącznie | `30a564a` |
| 3. `packages/content` — bramki anty-slop (D34, D37, D39) | ukończone, AC3/AC4/AC7 zielone; 879 testów zielonych łącznie | `fab4527` |
| 4. `packages/content` — brief, linkowanie wewnętrzne, JSON-LD | ukończone, AC6/AC7 zielone; 947 testów zielonych łącznie | — |
| 5. `packages/db` — migracja `0004` + repozytoria treści | niezaczęte | — |
| 6. `packages/providers` — generowanie draftu i adapter `git-pr` | niezaczęte | — |
| 7. `apps/cli` — `seo keywords cluster`, `seo brief` | niezaczęte | — |
| 8. `apps/cli` — `seo draft`, `seo publish` | niezaczęte | — |
| 9. Odbiór Fazy 3 na własnej stronie | niezaczęte | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone),
potem pierwsze zadanie ze stanem innym niż „ukończone".

## Kolejność i uzasadnienie

Bramki idą **przed** generowaniem. To nie jest kwestia porządku, tylko tego,
że bramka dopisana po generatorze zawsze jest sprawdzeniem w czasie wykonania,
które da się pominąć — a bramka napisana pierwsza staje się typem, przez który
generator musi przejść. D34 i D37 są egzystencjalne dla tej fazy, więc powstają
jako pierwsze i to one dyktują kształt reszty.

Klastrowanie idzie przed briefem, bo brief bez klastra jest briefem o jednej
frazie, a to nie jest jednostka, w której myśli wyszukiwarka.

Publikacja idzie ostatnia i celowo jako `git-pr` — najwęższy możliwy adapter,
za to z darmowym rollbackiem.

## Odstępstwa od planu odnotowane w trakcie

- **Bramki powstały przed klastrowaniem, wbrew numeracji w tabeli.** Kolejność
  w planie jest po zadaniach, nie po czasie — a bramki musiały być pierwsze,
  żeby stać się typem, przez który generator przechodzi. Gdyby powstały po
  generatorze, byłyby sprawdzeniem w czasie wykonania, które da się pominąć.
- **`ApprovedDraft` ma znacznik `unique symbol` niedostępny poza modułem.**
  Funkcja publikująca przyjmuje ten typ, więc jedyną drogą do publikacji jest
  `approveDraft`. Obejście istnieje (`as ApprovedDraft`), ale jest widoczne
  w przeglądzie kodu jako rzutowanie, a nie jako zwykłe wywołanie. Jest na to
  test z `@ts-expect-error`.
- **Pusty zestaw porównawczy NIE znaczy „przeszło".** Wraca jako `undecidable`
  i blokuje. Cicha zgoda przy braku danych jest dokładnie tym mechanizmem,
  który ta bramka ma zablokować — ta sama zasada, co D17 w Fazie 1.
- **Tekst za krótki, żeby ocenić oryginalność, też nie przechodzi.** Poniżej
  10 n-gramów nie da się orzec, a orzekanie bez danych jest tym, czego cała
  ta warstwa ma nie robić.
- **TF-IDF liczone na całym korpusie, nie na parze.** Efekt uboczny jest tym,
  o co chodzi: stopka i nawigacja obecne we wszystkich dokumentach dostają wagę
  bliską zeru, więc nie napompują podobieństwa. Jest na to osobny test.
- **Tokenizacja przez `\p{L}\p{N}` z flagą `u`.** `\w` z JavaScriptu zna tylko
  ASCII i rozbiłoby „właściwość" na trzy tokeny — ten sam błąd co `\b`
  w wykrywaniu wzmianek w Fazie 2.
- **Wszystkie niepowodzenia zbierane naraz**, nie pierwsze. Redaktor poprawiający
  draft ma zobaczyć całą listę od razu, zamiast wracać trzy razy.
- **Metoda zapasowa nazywa się `lexical-overlap`, nie `gsc-cooccurrence`.**
  D33 zakładało wspólne wystąpienia fraz na tych samych naszych stronach, ale
  `gsc_query_daily` nie ma wymiaru `page` — nie wiemy, która strona odebrała
  wyświetlenia dla której frazy. Metoda jest więc czysto leksykalna i tak się
  nazywa. Spec poprawiony. Dopisanie wymiaru `page` do synchronizacji GSC to
  osobna, wąska robota po stronie Fazy 0.
- **Klastrowanie idzie schematem piasta-szprychy, nie składowymi spójnymi.**
  Przy składowych fraza A łączy się z B, B z C, C z D — i A ląduje w jednym
  klastrze z D, choć nie dzielą ani jednego adresu. To jest znany sposób, w jaki
  klastrowanie SERP produkuje jeden klaster obejmujący pół serwisu. Jest na to
  osobny test.
- **Klaster jednoelementowy z migawką ma `sharedUrls: 0`, bez migawki `null`.**
  „Nie dzieli adresów z nikim" i „nie wiemy, jakie ma adresy" to dwie różne
  informacje i raport musi je rozróżniać.
- **Pokrycie ważone wyświetleniami, nie liczbą fraz.** Fraza z 400 wyświetleniami
  i fraza z 2 to nie to samo zobowiązanie. Liczenie „ile fraz na ilu" dałoby
  stronie zaliczenie za pokrycie ogona przy zignorowaniu frazy niosącej ruch.
- **`create` nigdy nie jest bez powodu.** Gdy nikt go nie poda, powstaje powód
  domyślny, który mówi, która strona była najbliżej i o ile nie sięgnęła progu.
  Za pół roku ma się dać sprawdzić, czy decyzja była dobra.
- **Próg pokrycia 0,6 jest zgadnięty i jest to napisane w kodzie.** W przeciwieństwie
  do 0,85 przy oryginalności, ta liczba nie ma źródła — pierwszy przebieg na
  własnej stronie ma ją poprawić.
- **Kierunek zależności poprawiony: `content → keywords`, nie odwrotnie.**
  Przy zakładaniu `packages/keywords` wpisałem mu zależność od `@seo/content`,
  której nic nie używało. Brief potrzebuje typu `Cluster`, więc strzałka idzie
  w drugą stronę — i tylko w jedną, bo inaczej byłby cykl.
- **Linki wewnętrzne wybierają stronę o **mniejszej** liczbie linków przychodzących
  przy zbliżonym dopasowaniu.** Link do strony głównej, która i tak ma ich setki,
  nie zmienia nic; link do strony z dwoma zmienia jej pozycję w grafie. To jest
  jedyny powód, dla którego warto wstawiać linki automatycznie.
- **Naciągany link nie jest wstawiany wcale.** Poniżej 15% pokrycia słów klastra
  sugestia nie powstaje — trzy słabe linki są gorsze niż jeden dobry.
- **Brief jest jednym Markdownem dla promptu i dla pull requesta.** Rozjazd między
  „co model wiedział" a „co pokazaliśmy w przeglądzie" jest sposobem na ukrycie
  słabego briefu.
- **Brief ostrzega, gdy klaster powstał metodą leksykalną.** Ostrzeżenie idzie
  do tego samego Markdownu, więc widzi je i model, i recenzent.
- **`buildArticleSchema` przyjmuje `ApprovedDraft`, nie `DraftInput`.** Nie da się
  zbudować JSON-LD dla draftu, który nie przeszedł bramki autora — AC7 jest
  spełnione przez typ, tak samo jak AC4.
- **`<` w JSON-LD jest eskejpowane jako `\u003c`.** Parser HTML kończy blok
  skryptu na `</script>` także wewnątrz ciągu znaków, więc tytuł zawierający
  ten ciąg rozwaliłby stronę. Jest na to test.
