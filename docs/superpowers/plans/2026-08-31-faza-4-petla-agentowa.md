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
| 4. `packages/agent` — silnik polityk, wyłączniki i tablica zadań | ukończone, AC3/AC4/AC9/AC10 zielone; 1119 testów zielonych | — |
| 5. `packages/db` — migracja `0005` + repozytoria agenta | niezaczęte | — |
| 6. `apps/cli` — `seo agent plan`, `board`, `verdicts` | niezaczęte | — |
| 7. `packages/report` — tablica zadań i werdykty | niezaczęte | — |
| 8. Odbiór Fazy 4 | niezaczęte | — |

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
