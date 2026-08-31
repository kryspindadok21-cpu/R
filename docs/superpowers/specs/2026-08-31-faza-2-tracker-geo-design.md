# Faza 2 — Tracker widoczności w AI. Dokument decyzji

**Data:** 2026-08-31
**Status:** zatwierdzony do napisania planu wykonawczego
**Poprzednik:** `2026-08-28-faza-1-crawler-audyt-design.md` (decyzje D11–D22)
**Numeracja decyzji:** kontynuacja, od D23.

---

## 1. Streszczenie po ludzku

Faza 1 odpowiada na pytanie „co na mojej stronie jest zepsute". Faza 2 odpowiada
na inne: **„czy modele AI w ogóle o mnie wspominają, gdy ktoś pyta o to, czym się
zajmuję"**.

Mechanizm jest prosty: bierzemy listę pytań, jakie zadaje klient, zadajemy je
kilku modelom, i sprawdzamy, czy w odpowiedzi pada nasza marka — a jeśli tak,
to w którym miejscu i obok kogo.

Cała trudność siedzi w jednym zdaniu: **odpowiedź modelu jest losowa**. Ten sam
prompt puszczony dwa razy da dwie różne odpowiedzi. Narzędzie, które puszcza
prompt raz w tygodniu i rysuje z tego wykres „widoczności", pokazuje szum
i nazywa go trendem.

### Dlaczego to jest problem arytmetyczny, nie filozoficzny

Pojedynczy przebieg promptu to **próba Bernoulliego** — albo wspomniał, albo nie.
Przy prawdziwym prawdopodobieństwie wzmianki *p* = 0,3 i *n* = 3 przebiegach błąd
standardowy wynosi:

```
SE = √(p(1−p)/n) = √(0,3 · 0,7 / 3) ≈ 0,264  →  ±26 punktów procentowych
```

Czyli: przy trzech przebiegach zmierzone 30% może naprawdę być 10% albo 55%.
Cotygodniowy wykres z takich pomiarów **musi** skakać, nawet gdy nic się nie
zmienia. To jest główna wada całej kategorii narzędzi GEO i nie zamierzamy jej
powtarzać.

### Czego Faza 2 świadomie **nie** robi

| Kuszące | Werdykt | Dlaczego |
|---|---|---|
| Wykres „widoczności" tydzień do tygodnia z surowych poziomów | **nie** | Wariancja między promptami dominuje. Porównujemy różnice sparowane (D25). |
| Jedna liczba „AI Visibility Score" | **nie** | To samo co ocena 0–100 z Fazy 1 (D18). Nieweryfikowalne. |
| Mieszanie odpowiedzi z API i z przechwytywania interfejsu | **nie** | To dwa różne procesy. Jedna linia trendu z obu jest kłamstwem (D27). |
| Budowanie narracji na `llms.txt` | **nie** | Żaden duży dostawca nie zobowiązał się go czytać. Generujemy, nie obiecujemy (D31). |
| Scraping interfejsów konsumenckich | **nie w tej fazie** | Łamie regulaminy i psuje powtarzalność. Zostajemy przy API. |

---

## 2. Cel Fazy 2

Doprowadzić do stanu, w którym **wiadomo, w których pytaniach marka jest
niewidoczna, i czy zmiana między dwoma pomiarami jest realna, czy mieści się
w szumie.**

Kamień milowy jest falsyfikowalny: `seo geo run` wykonuje zestaw promptów na
co najmniej dwóch silnikach, `seo geo report` pokazuje dla każdego promptu odsetek
wzmianek **z przedziałem ufności**, a porównanie dwóch przebiegów oznacza każdą
zmianę jako istotną albo **jeszcze nieistotną** — i to drugie jest widoczne
na pierwszy rzut oka.

---

## 3. Decyzje

### D23 — Jednostką analizy jest prompt, nie pojedynczy przebieg

**Decyzja:** liczymy odsetek wzmianek **osobno dla każdego promptu** (z *n*
przebiegów), a dopiero potem agregujemy po promptach.

**Uzasadnienie:** przebiegi tego samego promptu nie są niezależne od przebiegów
innego promptu. Są prompty, w których marka pada zawsze, i takie, w których nie
pada nigdy — wariancja **między** promptami jest duża i systematyczna, a nie
losowa. Wrzucenie wszystkich 150 przebiegów (50 promptów × 3) do jednego worka
i policzenie „mamy 34% wzmianek ±4 pp" zawyża pewność o rząd wielkości, bo
udaje 150 niezależnych prób tam, gdzie jest ich 50.

**Konsekwencja:** `n` (przebiegi na prompt) poprawia precyzję *w obrębie promptu*,
`m` (liczba promptów) poprawia precyzję *agregatu*. To dwie różne dźwignie
i raport pokazuje obie.

### D24 — Przedział Wilsona dla odsetka, bootstrap dla różnic

**Decyzja:**
- **Odsetek wzmianek dla jednego promptu** → przedział **Wilsona**.
- **Różnica między dwoma pomiarami** → **bootstrap percentylowy** na różnicach
  sparowanych, z **ziarnem zapisanym w bazie**.

**Uzasadnienie Wilsona:** klasyczny przedział normalny (`p ± 1,96·SE`) przy małym
*n* i odsetku blisko 0 lub 1 daje granice poza przedziałem [0, 1] i realne pokrycie
znacznie poniżej deklarowanego. Przy `n = 3` to nie jest subtelność — to jest
regułą. Wilson zachowuje się poprawnie na krańcach i nie wymaga poprawek.

**Uzasadnienie bootstrapu:** dla różnic sparowanych alternatywą jest rozkład *t*,
który wymaga niepełnej funkcji beta i założenia o normalności różnic. Bootstrap
nie zakłada rozkładu, jest krótszy w kodzie i uczciwszy przy `m` rzędu
kilkunastu promptów. **Ziarno generatora zapisujemy razem z wynikiem** — inaczej
dwa uruchomienia tego samego raportu dałyby dwa różne przedziały, a to jest
dokładnie ten rodzaj niedeterminizmu, który zwalczamy od Fazy 0.

### D25 — Raportujemy różnice sparowane, nigdy surowe poziomy

**Decyzja:** porównanie dwóch przebiegów **musi** iść prompt po prompcie —
ten sam prompt przed i po, różnica, dopiero potem średnia z różnic.

**Uzasadnienie:** wariancja między promptami jest duża, ale **stała przy stałym
zestawie promptów**. Porównanie sparowane ją usuwa. Porównanie surowych
poziomów („w zeszłym tygodniu 34%, w tym 39%") ją zawiera i dlatego prawie nigdy
nie wykryje realnej zmiany o kilka punktów.

**Konsekwencja praktyczna:** zestaw promptów jest bytem trwałym z własnym
identyfikatorem. Dodanie promptu w środku okresu **unieważnia porównywalność** —
i raport ma to powiedzieć wprost, a nie po cichu policzyć średnią z różnych
zbiorów.

### D26 — Bramka istotności pokazuje się, a nie ukrywa

**Decyzja:** jeśli przedział ufności różnicy obejmuje zero, zmiana jest oznaczona
jako **„jeszcze nieistotna"** — szarym, wyłączonym wskaźnikiem, bez strzałki
i bez koloru. Liczba jest nadal pokazana, ale bez sugestii kierunku.

**Uzasadnienie:** narzędzie, które przy zmianie z 34% na 36% rysuje zieloną
strzałkę w górę, uczy klienta reagować na szum. To nie jest kosmetyka — to jest
różnica między pomiarem a teatrem. Ukrywanie takich zmian też jest złe: klient
ma widzieć, że pomiar był, i że jest za wcześnie na wniosek.

**Ile trzeba, żeby zobaczyć zmianę:** przy `m = 50` promptach i `n = 3`
przebiegach rozdzielczość tydzień do tygodnia to około **11 punktów
procentowych** — i to przy założeniu optymistycznym. Raport podaje tę
rozdzielczość wprost, żeby nikt nie oczekiwał czułości, której nie ma.

> **Poprawka po policzeniu (2026-08-31).** Pierwsza wersja tego akapitu mówiła
> „8–10 punktów" i „mniejsze zmiany wymagają większego `m`, a nie większego `n`".
> Obie liczby były szacunkiem przy biurku i obie są nieścisłe. Błąd standardowy
> średniej różnicy sparowanej wynosi `sqrt((2p(1−p)/n + σ²) / m)`, gdzie `σ` to
> rozrzut samego efektu między promptami. Stąd:
>
> - Sam szum próbkowania zależy od **iloczynu** `m·n`. Dodatkowy przebieg i
>   dodatkowy prompt kosztują tyle samo wywołań i dają tyle samo — `m = 100, n = 3`
>   i `m = 50, n = 6` to ta sama rozdzielczość (8,0 pp).
> - Różnica jest w drugim składniku. `σ²/m` zbija **wyłącznie** większy zestaw
>   promptów. Większe `n` ma podłogę, poniżej której nie zejdzie; większe `m` jej
>   nie ma.
>
> Wniosek praktyczny zostaje ten sam — przy wyborze idziemy w `m` — ale z innego
> powodu niż napisałem, i przy 11 pp zamiast 8. `packages/geo/detectableDifference`
> liczy przypadek `σ = 0`, bo tylko ten da się policzyć przed pomiarem, więc
> raportowana liczba jest granicą, nie obietnicą.

### D27 — `access_mode` i `model_version` nigdy nie mieszają się w jednej linii

**Decyzja:** każdy pomiar niesie `engine`, `model_version` i `access_mode`
(`api` albo `api_grounded`). Porównanie sparowane jest **dozwolone wyłącznie**
w obrębie tej samej trójki. Zmiana wersji modelu jest **adnotacją na wykresie**,
tak samo jak core update.

**Uzasadnienie:** model z groundingiem (z dostępem do wyszukiwarki) i model
odpowiadający z pamięci to dwa różne procesy, nie dwa ustawienia. Upgrade wersji
modelu to skokowa zmiana procesu. Zestawienie ich w jednej linii trendu daje
wykres, na którym nie da się odróżnić poprawy strony od zmiany po stronie
dostawcy — a to jest jedyna rzecz, którą ten tracker ma mierzyć.

### D28 — Silniki przez warstwę providerów, darmowe tiery, wszystko w rejestrze

**Decyzja:** każdy silnik to adapter `LlmEngineProvider` w `packages/providers`,
z tym samym rygorem co GSC i PSI: każde wywołanie w `provider_call`, budżet
i limity liczone od pierwszego dnia.

Startujemy z tym, co darmowe: **Gemini** (darmowy tier), **Groq** (14 400 żądań
dziennie), **OpenRouter** (modele darmowe). To unosi 50 promptów × 3 przebiegi
× kilka silników tygodniowo z dużym zapasem.

**Klucze są opcjonalne per silnik.** Brak klucza do jednego silnika nie blokuje
przebiegu — ten silnik melduje się jako pominięty, dokładnie tak jak reguła bez
spełnionych `requires` w Fazie 1 (D17).

### D29 — Wzmianka to dopasowanie encji, nie podciągu

**Decyzja:** wykrywanie wzmianki działa na **granicach słów i wariantach encji**,
nigdy przez `includes()`. Encja marki niesie nazwę główną, warianty (odmiana,
skrót, domena) i **listę wykluczeń**.

**Uzasadnienie:** to jest miejsce, w którym najłatwiej o cichy fałsz. Marka
o krótkiej lub pospolitej nazwie złapie się w każdym zdaniu i wygeneruje
widoczność, której nie ma. Odwrotnie: odmiana przez przypadki w polszczyźnie
(„Mentiometry" → „Mentiometrym") umknie naiwnemu porównaniu. Obie pomyłki dają
liczby wyglądające na pomiar.

**Konsekwencja:** definicja encji jest danymi w bazie, wersjonowanymi. Zmiana
wariantów unieważnia porównywalność wstecz, tak samo jak `NORMALIZER_VERSION`
w Fazie 0 (D4).

### D30 — Pozycja wzmianki liczona na znormalizowanym tekście

**Decyzja:** pozycja to **udział znaków przed pierwszą wzmianką w całej
odpowiedzi** (0 = na samym początku, 1 = na końcu), liczona na tekście
po normalizacji białych znaków. Dodatkowo zapisujemy numer akapitu.

**Uzasadnienie:** „pozycja w odpowiedzi" bywa raportowana jako numer pozycji
na liście — ale modele nie zawsze odpowiadają listą. Udział znaków działa
dla każdej formy odpowiedzi i jest porównywalny między silnikami.

### D32 — Cytowania z groundingu i z tekstu nigdy nie sumują się w jedną liczbę

**Decyzja:** cytowanie ma dwa źródła i są one rozdzielne na stałe:
`grounding` — adresy z metadanych dostawcy, oraz `inline` — adresy wypisane
w treści odpowiedzi. Raport pokazuje je osobno. Nie istnieje „liczba cytowań".

**Uzasadnienie:** to są dwa różne byty. Adres z metadanych groundingu jest
świadectwem, że model **pobrał** ten dokument. Adres w treści odpowiedzi jest
tym, co model **napisał** — i bywa zmyślony, bo generowanie adresu URL to
generowanie tekstu, nie odczyt. Zsumowane dają liczbę, w której nie da się
odróżnić realnego źródła od halucynacji.

To jest ta sama zasada, co rozdzielenie danych terenowych i laboratoryjnych
z PSI w Fazie 1: dwa pomiary tej samej rzeczy różnymi metodami zestawia się
obok siebie, nie dodaje.

**Konsekwencja:** silnik bez groundingu ma zero cytowań `grounding` i to jest
poprawny wynik, a nie brak danych. `access_mode` już to rozróżnia (D27).

**Dopasowanie „to nasza strona"** idzie po hoście, po odcięciu wiodącego `www.`.
To jest złagodzenie **wyłącznie** na potrzeby cytowań: model piszący
`www.przyklad.pl` cytuje ten sam serwis. Tożsamość strony w bazie pozostaje
nietknięta — `url_hash` z D4 nadal traktuje `www` jako część hosta.

### D31 — `llms.txt` generujemy, ale nie obiecujemy

**Decyzja:** generator `llms.txt` powstaje, a audyt zgłasza jego brak jako
ustalenie o wadze **`info`**, nie wyżej.

**Uzasadnienie:** Google oświadczyło, że nie jest potrzebny dla AI Overviews ani
AI Mode i nie planuje wsparcia. Żaden duży dostawca nie zobowiązał się czytać go
w otwartym webie. Klienci będą pytać, więc generator ma być — ale wysiłek idzie
w czynniki strukturalne, które realnie wpływają na retrieval: dostępność bez JS,
samodzielność fragmentów, odpowiedź wprost, znaczniki encji. Wszystkie cztery
są już mierzone w Fazie 1.

---

## 4. Zakres

**W zakresie:**
1. `packages/geo` — statystyka, wykrywanie wzmianek, share of voice, ekstrakcja
   cytowań (czysty, zero wejścia/wyjścia).
2. `packages/providers` — adaptery `gemini`, `groq`, `openrouter`.
3. `packages/db` — migracja `0003`: zestawy promptów, przebiegi, odpowiedzi,
   wzmianki, cytowania.
4. `apps/cli` — `seo geo prompts`, `seo geo run`, `seo geo report`, `seo llms-txt`.
5. `packages/report` — sekcja GEO z przedziałami ufności i bramką istotności.

**Poza zakresem:** scraping interfejsów konsumenckich, śledzenie AI Overviews
w wynikach Google, analiza logów crawlerów AI (wymaga dostępu do logów serwera —
osobna faza), automatyczne działania na podstawie wyników (Faza 4).

---

## 5. Kryteria akceptacji

- **AC1.** Przedział Wilsona dla `k = 1, n = 3` mieści się w [0, 1] i jest
  szerszy niż przedział normalny — test na wartościach wyliczonych ręcznie.
- **AC2.** Bootstrap z tym samym ziarnem daje **identyczny** przedział przy
  dwóch uruchomieniach.
- **AC3.** Porównanie sparowane na zestawach różniących się składem promptów
  **odmawia** policzenia i mówi dlaczego.
- **AC4.** Zmiana mieszcząca się w przedziale jest oznaczona jako „jeszcze
  nieistotna" i nie dostaje kierunku.
- **AC5.** Porównanie pomiarów o różnym `model_version` albo `access_mode`
  jest odmawiane.
- **AC6.** Wykrywanie wzmianki nie łapie nazwy wewnątrz dłuższego słowa
  i łapie odmianę zadeklarowaną jako wariant.
- **AC7.** Brak klucza do silnika pomija ten silnik i melduje to wprost,
  nie przerywa przebiegu.
- **AC8.** Każde wywołanie silnika ma wiersz w `provider_call`.
- **AC9.** Testy przechodzą bez sieci — silniki mają atrapy na fixture'ach.

---

## 6. Ryzyka

| Ryzyko | Reakcja |
|---|---|
| Darmowe tiery zmieniają limity albo znikają | Adapter per silnik; brak jednego nie blokuje przebiegu (D28). |
| Modele odmawiają odpowiedzi na prompt komercyjny | Odmowa jest **danymi** — zapisujemy ją jako odpowiedź pustą z powodem, nie jako błąd. |
| Właściciel oczekuje czułości, której nie ma | Raport podaje rozdzielczość wprost (D26). |
| Kuszenie, by dodać jedną liczbę zbiorczą | Zakazane wprost w D18 i powtórzone tutaj. |

---

## 7. Co ten dokument zostawia otwarte

- **Liczba promptów na start.** 50 to wartość z analizy rynku, nie z pomiaru na
  własnej stronie. Pierwszy przebieg pokaże, ile z nich w ogóle wywołuje wzmianki.
- **Dobór silników.** Zaczynamy od trzech darmowych. Który daje najbardziej
  stabilne odpowiedzi, rozstrzygnie pomiar, nie wybór przy biurku.
- **Częstotliwość.** Tygodniowo jest hipotezą. Jeśli wariancja okaże się większa
  niż zakładana, częstszy pomiar nie pomoże — pomoże większy zestaw promptów.
