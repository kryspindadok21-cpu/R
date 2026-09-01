# Faza 4 — Pętla agentowa. Plan wykonawczy

**Cel:** system przez tydzień pracuje bez właściciela i mówi jednym zdaniem na
akcję: co zrobił, co z tego wyszło i czy to na pewno przez niego.

**Spec:** `docs/superpowers/specs/2026-08-31-faza-4-petla-agentowa-design.md` (decyzje D45–D54)

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 1. Specyfikacja Fazy 4 (D45–D54) | ukończone | — |
| 2. `packages/agent` — różnica w różnicach i werdykty (D48–D51) | ukończone, AC5/AC8 zielone; 1051 testów zielonych łącznie | `0f7cf58` |
| 3. `packages/agent` — scoring okazji i dobór kontroli (D45, D49) | ukończone, AC1/AC2/AC6 zielone; 1087 testów zielonych łącznie | `11eabcf` |
| 4. `packages/agent` — silnik polityk, wyłączniki i tablica zadań | ukończone, AC3/AC4/AC9/AC10 zielone; 1119 testów zielonych | `704b21d` |
| 5. `packages/db` — migracja `0005` + repozytoria agenta | ukończone, izolacja najemców zielona; 1143 testy zielone | `ac40eaf` |
| 6. `apps/cli` — `seo agent plan`, `board`, `measure` | ukończone, AC7 zielone | — |
| 7. **`apps/web` — panel w przeglądarce** (poza pierwotnym planem) | ukończone, 23 testy przez prawdziwy HTTP | `c6d91df` |
| 8. `packages/db` — migracja `0006`: wymiar `page` z GSC | ukończone (odkryty brak, patrz niżej) | — |
| 9. Odbiór Fazy 4 | **ukończony w zakresie, jaki da się sprawdzić bez GSC**; 1180 testów zielonych | `20e19a0` |
| 10. **Panel: tracker AI, silnik treści i `llms.txt`** (poza pierwotnym planem) | ukończone, 29 testów panelu przez prawdziwy HTTP; 1191 testów zielonych | `cc0d2ac` |
| 11. **Instrukcja dostępu do GSC + klucz w domyślnym miejscu** | ukończone, 1196 testów zielonych | `ce18881` |
| 12. **Dogfooding: audyt własnej strony, reguła `sitemap.not-discoverable`, `llms.txt`** | ukończone, 62 reguły, 1201 testów zielonych | `86ff7cc`, `e9d7f7c` |
| **DO ZROBIENIA PRZEZ WŁAŚCICIELA** | punkty 1–4 zamknięte 2026-09-01 (property, mapa, API, konto `seo-bot`); zostaje klucz JSON i `gsc smoke` na komputerze — `docs/co-teraz.md` | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone),
potem pierwsze zadanie ze stanem innym niż „ukończone".

## Kolejność i uzasadnienie

**Pomiar idzie pierwszy**, przed scoringiem i przed politykami. Powód jest ten
sam, co przy bramkach w Fazie 3: warstwa, która powstaje ostatnia, dopasowuje się
do tego, co już jest, zamiast dyktować kształt. A tu chodzi o jedyną rzecz, której
konkurencja nie ma — jeśli pomiar będzie kiepski, cała reszta jest zwykłym
narzędziem do publikowania.

Polityki i wyłączniki idą przed bazą, bo to one decydują, jakie stany zadania
w ogóle istnieją.

## Odstępstwa od planu odnotowane w trakcie

- **Panel dostał warstwy, które były wyłącznie w linii poleceń.** Tracker
  widoczności w AI, silnik treści i `llms.txt` istniały jako komendy, ale
  właściciel pracuje w przeglądarce — więc dla niego nie istniały wcale.
  Trzy nowe sekcje (`/geo/:id`, `/tresc/:id`, `/llms-txt/:id`) wołają
  **te same funkcje**, co CLI, przez `@seo/cli/lib`; własna kopia sklejania
  rozjechałaby się przy pierwszej zmianie. Pisanie draftu i publikacja
  **zostają w terminalu świadomie**: draft kosztuje wywołania modelu,
  a publikacja dotyka repozytorium — jedno i drugie ma wymagać wpisania
  polecenia, a nie przypadkowego kliknięcia.

- **Każda sekcja panelu degraduje się z podaniem powodu, a nie po cichu.**
  Bez klucza silnika strona GEO wypisuje, czego brakuje (marki, promptów,
  klucza), i **nie pokazuje przycisku pomiaru**. Bez danych z Search Console
  strona treści mówi „ta warstwa nie ma z czego liczyć" zamiast wyświetlać
  formularz, który i tak zwróciłby zero. To ta sama zasada, co reguła milcząca
  bez `requires` (D17): cicha pustka jest fałszywym poczuciem porządku.

- **Testy panelu zdejmują klucze silników z otoczenia.** Bez tego suita
  zachowywałaby się inaczej na maszynie, gdzie właściciel wyeksportował
  `SEO_GROQ_KEY`, a trasa `/geo/:id/run` poszłaby **naprawdę do sieci**.
  Testy działają bez sieci i to nie jest wygoda, tylko warunek.

- **Trasy z segmentem w środku dostały dopasowanie wzorcem.** Wcześniej
  `/agent/:id/measure` wycinało się arytmetyką na indeksach
  (`slice(7, length - 8)`). Działało, ale każda nowa trasa była nową okazją
  do pomyłki o jeden znak — a taka pomyłka daje 404 na trasie, która istnieje.

- **`HEAD` obsługiwane jak `GET`.** Znalezione przy sprawdzaniu panelu przez
  `curl -I`: każde narzędzie sprawdzające adres dostawało 404 na stronie,
  która istnieje, i meldowało panel jako zepsuty.

- **Data z Search Console sprawdzana kształtem, nie parsowaniem.** Formularz
  klastrowania odrzuca wszystko poza `RRRR-MM-DD`. Przepuszczenie tego przez
  `new Date()` przesunęłoby część dat o dzień i nikt by tego nie zobaczył (D3).


- **Znaleziony i naprawiony błąd: strażnik przed zdegenerowanym bootstrapem
  przestawał działać przez szum zmiennoprzecinkowy.** Gdy każda strona zmienia się
  o dokładnie tyle samo, bootstrap nie widzi żadnej zmienności i przedział powinien
  być punktowy. Ale poziomy stron są różne, więc średnie liczą się w innej
  kolejności przy każdym losowaniu i wychodzą różne na ostatnich bitach — przedział
  `[39.999999999999986, 40.000000000000014]` wyglądał jak zmienność i przepuszczał
  werdykt „istotny" tam, gdzie bootstrap nie zobaczył niczego. Porównanie ma teraz
  tolerancję skalowaną wielkością efektu (`|effect| × 1e-9`), daleko powyżej szumu
  bitowego i daleko poniżej jakiegokolwiek realnego sygnału. Jest na to osobny
  test regresyjny odtwarzający dokładnie tę fiksturę.
- **D51 mówi „dokładnie ta sama bramka, co w D26" i to nie może być prawdą co do
  litery.** W D26 drugim warunkiem była rozdzielczość pomiaru, bo bootstrap po
  promptach nie widział szumu **wewnątrz** promptu. Tutaj szum wewnątrz strony
  siedzi już w obserwowanej zmianie, więc ten składnik nie ma czego domykać.
  Zostaje warunek niezerowej szerokości przedziału, a rolę „dość danych, żeby
  mierzyć" przejmuje minimalny rozmiar grupy kontrolnej z D48. Ta sama zasada,
  inny mechanizm — i lepiej to napisać, niż udawać, że kod jest identyczny.
- **Liczniki (kliknięcia, wyświetlenia) liczą się jako średnia na stronę, nie
  suma.** Suma zmieniałaby się z rozmiarem grupy, więc trzystronicowa grupa
  zmieniona i pięćdziesięciostronicowa kontrolna dawałyby zmiany nieporównywalne
  co do rzędu wielkości — i „efekt" mówiłby o liczności grup, a nie o zmianie.
- **CTR i pozycja liczą się na sumach i wagach wyświetleń**, nie jako średnia
  po stronach. Strona z dwoma wyświetleniami nie może ważyć tyle samo, co strona
  z dwoma tysiącami. Są na to dwa osobne testy.
- **Bootstrap losuje strony, nie obserwacje.** Każda strona wnosi swoje „przed"
  i „po" razem; rozdzielenie ich zerwałoby parowanie i zawyżyło precyzję.
- **Spadek pozycji to poprawa.** Jedyna metryka, w której mniej znaczy lepiej —
  `direction` liczy się z uwzględnieniem metryki, a nie ze znaku efektu.
- **Fikstury testowe muszą mieć rozrzut w *zmianie*, nie w poziomie.** Pierwsza
  wersja dawała każdej stronie identyczny przyrost i cztery testy oczekujące
  werdyktu dostawały odmowę — słusznie. Wzorce rozrzutu mają sumę zero, więc
  średnia zostaje dokładna i test może sprawdzać efekt co do dziesiątego miejsca.
- **Krzywa CTR według pozycji jest branżowa, nie nasza — i tak jest opisana
  w każdym uzasadnieniu.** Wpływ okazji z klastra wychodzi z prawdziwych
  wyświetleń i prawdziwej pozycji z Search Console, ale przelicznik „ile kliknięć
  dałby awans do trójki" pochodzi z branżowych szacunków. `basis` mówi o tym
  wprost (`krzywa CTR branżowa, nie własna`). Gdy uzbieramy dość własnych danych,
  krzywa ma zostać zastąpiona i wtedy czynnik przejdzie z opisu na pomiar.
- **Wagi ustaleń audytu są `declared`, nie `measured`.** Wynikają z definicji wag
  z Fazy 1, a nie z pomiaru wpływu na ruch. Kuszące byłoby oznaczyć je jako
  zmierzone, bo liczba ustaleń jest policzona — ale policzona jest *liczba*,
  nie *wpływ*.
- **Metoda leksykalna obniża `confidence` z 0,8 do 0,45.** D33 mówi, że to
  hipoteza, a nie pomiar opinii wyszukiwarki — więc okazja z takiego klastra
  ma spaść w rankingu wobec identycznej okazji z overlapu SERP. To jedyne
  miejsce, gdzie ostrzeżenie z D33 wpływa na decyzję, a nie tylko na tekst.
- **`selectControlGroup` nie ma dostępu do danych „po" i to jest celowe.**
  Nie da się napisać funkcji dobierającej kontrolę po wynikach, bo nie ma ich
  czym zobaczyć. D49 egzekwowane przez kształt typu, nie przez dyscyplinę.
- **Dobór idzie rundami, nie „najlepsze N dla każdej po kolei".** Inaczej pierwsza
  strona zmieniona zabrałaby wszystkich dobrych kandydatów, a druga dostałaby
  resztki — i porównanie mówiłoby o kolejności w pętli.
- **Strona nie może być kontrolą dwa razy.** Powtórzenie zawyżałoby liczebność
  grupy, a więc i precyzję przedziału — przedział z powtórzeń jest węższy, niż
  dane na to pozwalają.
- **Odległość między stronami normalizowana logarytmicznie.** Ruch ma rozkład
  skrajnie skośny: różnica 10 → 100 wyświetleń znaczy więcej niż 10 000 → 10 090,
  choć w liczbach bezwzględnych jest identyczna.
- **⚠️ Odstępstwo od tabeli bezpieczników: wymiana linków to `never`, nie
  `approve`.** Tabela mówi „zawsze zatwierdzenie", ale dwie strony dalej ta sama
  analiza nazywa to link scheme z **bezpośrednim ryzykiem kary manualnej** i jedyną
  funkcją, która zatruje wiarygodność wszystkiego innego. Te dwa zdania nie mogą
  być prawdziwe naraz. Akcja, której nie wolno wykonać nigdy, nie powinna dać się
  zatwierdzić jednym kliknięciem o drugiej w nocy. Outreach zostaje na `approve`.
  Spec poprawiony.
- **Wyłącznik bije politykę, także `approve`.** Pierwsza wersja blokowała tylko
  `auto` — a to znaczyłoby, że hamulec regresji da się ominąć klikając
  „zatwierdź". Wyłącznik, który da się ominąć zatwierdzeniem, jest ostrzeżeniem,
  nie wyłącznikiem. Są na to dwa osobne testy.
- **Wyłączniki dotyczą wyłącznie akcji zapisujących do strony.** Crawl i audyt
  mają chodzić także wtedy, gdy ruch leci w dół — to wtedy są najbardziej
  potrzebne. `writesSite` jest polem definicji akcji, nie zgadywane z nazwy.
- **Brak ruchu w zeszłym tygodniu nie liczy się jako spadek o 100%.** Dzielenie
  przez zero dałoby nieskończoność i zablokowałoby nowy serwis na zawsze — czyli
  dokładnie ten, który dopiero zaczyna publikować.
- **`proposed` jest osobnym stanem tablicy**, poprzedzającym `needs-you`. D46
  mówi, że planer emituje wyłącznie wnioski; bez tego stanu „wniosek" i „czeka
  na zgodę" byłyby tym samym, a to dwie różne rzeczy: pierwsza jest wynikiem
  arytmetyki, druga decyzją, że warto o to pytać.
- **Odrzucenie przez człowieka też jest werdyktem.** `needs-you → done` jest
  dozwolone, o ile werdykt jest niepusty — „odrzucone przez właściciela" liczy
  się tak samo jak „nie da się zmierzyć".
- **`proposeTask` nie ma parametru stanu.** Zadanie powstaje zawsze jako
  `proposed` — planer emitujący od razu `in-flight` obchodziłby politykę, a to
  jedyne zabezpieczenie działające niezależnie od zachowania modelu (D46).
- **Drugi eksperyment dla tego samego zadania odrzuca baza** (unikalny indeks na
  `tenant_id, task_id`). Nadpisanie grup po fakcie byłoby doborem kontroli po
  zobaczeniu wyników — D49 egzekwowane przez schemat, nie przez dyscyplinę.
- **Odmowa pomiaru też trafia do `agent_verdict`.** Bez tego nie da się
  odpowiedzieć, ile pomiarów nie doszło do skutku i dlaczego — a to jest pierwsza
  rzecz, którą trzeba wiedzieć o małym serwisie.
- **Bramka i jej powód są zapisane razem z zadaniem.** Zablokowana akcja zostaje
  w bazie z wyjaśnieniem, zamiast zniknąć — inaczej „nic się nie stało" wyglądałoby
  identycznie jak „wyłącznik zadziałał".
- **Panel webowy powstał wcześniej niż sekcja agenta w raporcie HTML — świadomie.**
  Właściciel poprosił wprost o możliwość wejścia na stronę, dodania witryny
  i zobaczenia analizy. Raport agenta w pliku HTML byłby powtórzeniem tego, co
  panel pokazuje na żywo, więc idzie po nim, a nie przed nim.
- **Panel nie ma ani jednej nowej zależności.** Wbudowany `node:http` plus
  istniejące pakiety. Narzędzie, które sprawdza niezależność stron od zewnętrznych
  zasobów, samo ich nie wymaga — także w swoim własnym interfejsie.
- **Nasłuch wyłącznie na `127.0.0.1`.** Panel uruchamia crawler na dowolny podany
  adres i ma pełny dostęp do bazy; wystawienie go na sieć byłoby oddaniem obu
  tych rzeczy komukolwiek w tej samej sieci. Jest to zapisane w kodzie i w README.
- **Znaleziony i naprawiony błąd: crawl bez ani jednej pobranej strony raportował
  „Gotowe".** Technicznie się kończył, więc kod szedł ścieżką sukcesu — a panel
  mówił „gotowe" o czymś, czego użytkownik właśnie nie dostał. Teraz zerowy
  wynik to błąd zadania z przyczyną pierwszego nieudanego pobrania. Złapał to
  test z adresem na porcie 1.
- **Zadanie chodzi w tle, strona odświeża się sama.** Crawler czeka sekundę
  między żądaniami (D15), więc 25 stron to ponad pół minuty — synchroniczna
  odpowiedź HTTP byłaby zakręconym kołem bez żadnej informacji.
- **Rejestr zadań jest w pamięci i to jest świadome.** Stan trwały siedzi
  w bazie; zadanie przerwane restartem panelu gubi pasek postępu, nie dane.
- **`buildAuditReportData` wydzielone z `runAuditReport`.** Panel potrzebuje HTML-a
  w odpowiedzi, nie ścieżki na dysku. Kopia tych sześćdziesięciu linii w drugim
  miejscu rozjechałaby się przy pierwszej zmianie raportu — a wtedy raport
  z przeglądarki mówiłby co innego niż raport z terminala.
- **`apps/cli` ma teraz wejście biblioteczne (`@seo/cli/lib`).** Panel składa te
  same warstwy co linia poleceń i musi wołać dokładnie te funkcje.

## Odstępstwa — runda domykająca Fazę 4

- **⚠️ Odkryty brak, bez którego cała pętla pomiarowa nie miała czego liczyć:
  nie zbieraliśmy metryk per strona.** Różnica w różnicach porównuje strony
  zmienione ze stronami kontrolnymi, więc potrzebuje kliknięć, wyświetleń
  i pozycji **dla pojedynczego adresu**. Faza 0 synchronizowała wymiary `date`
  i `date,query` — żaden z nich tego nie daje. Dopisany wymiar `date,page`,
  migracja `0006` z tabelą `gsc_page_daily` i odczyt `pageMetricsInRange`
  z pozycją ważoną wyświetleniami. Bez tego `seo agent measure` byłby komendą,
  która zawsze mówi „brak danych".
- **`runSync` brał `keys[1]!` bez sprawdzenia.** Wiersz o innej liczbie kluczy
  niż zamówiona wchodził do bazy jako `undefined` i kończył się surowym błędem
  SQLite, który nie mówił ani który wymiar, ani która odpowiedź zawiniła.
  Teraz jest jawny błąd z nazwą wymiaru i zawartością kluczy. Wyszło przy
  dopisywaniu trzeciego wymiaru — dwa poprzednie żyły z tą samą kruchością.
- **Okno, które jeszcze trwa, nie jest mierzone.** Policzenie go dałoby wynik
  z niepełnego okresu i nikt by się nie dowiedział, że był niepełny.
  `runAgentMeasure` liczy tylko okna domknięte i osobno raportuje, ile czeka.
- **Zadanie kończy się dopiero, gdy domknie się najdłuższe okno.** Inaczej `done`
  znaczyłoby „zmierzone częściowo" — a to ta sama pułapka, przed którą broni D53.
- **Fikstury pomiaru musiały mieć rozrzut w *zmianie*, nie w poziomie** — dokładnie
  ten sam błąd, co przy testach DiD w `packages/agent`. Fikstura, w której każda
  strona rośnie o tyle samo, daje bootstrapowi przedział punktowy i bramka
  słusznie odmawia orzekania, więc test sprawdzałby co innego, niż obiecuje.
- **Panel dostał przycisk „Zmierz"** i pokazuje wynik na tablicy agenta. Bez
  danych z Search Console mówi wprost „nie było czego mierzyć" zamiast pustej listy.

## Odbiór Fazy 4 — co sprawdzone, a co nie

**Sprawdzone.** Cały rdzeń: DiD z przedziałem i bramką istotności, scoring okazji,
dobór kontroli przed zmianą, polityki z domyślnym `never`, trzy wyłączniki,
tablica zadań z zakazem `done` bez werdyktu, migracje `0005` i `0006`, komendy
`plan`/`board`/`measure` oraz obsługa w panelu. Testy pokrywają wszystkie
kryteria akceptacji AC1–AC11 poza AC6, które egzekwuje kształt typu.

**Niesprawdzone i nie da się bez danych.** Czy pomiar na **prawdziwym** ruchu
daje sensowne werdykty. Wymaga `seo gsc sync` z wymiarem `page`, czyli
dokończenia uprawnienia w Search Console — jedyna rzecz otwarta od Fazy 0.
Do tego czasu `seo agent measure` uczciwie mówi „nie ma czego mierzyć".
