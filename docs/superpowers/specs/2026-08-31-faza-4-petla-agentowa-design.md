# Faza 4 — Pętla agentowa. Dokument decyzji

**Data:** 2026-08-31
**Poprzednie decyzje:** D1–D22 (Fazy 0–1), D23–D32 (Faza 2), D33–D44 (Faza 3)
**Numeracja tutaj:** D45–D54

---

## 1. Streszczenie po ludzku

Fazy 1–3 dają narzędzia. Faza 4 daje **pętlę**: system sam znajduje okazję,
proponuje działanie, czeka na zgodę tam, gdzie musi, wykonuje, a potem **mierzy,
czy to w ogóle pomogło** — i wraca z wnioskiem.

To jest jedyna faza, której żadne z dwudziestu przeanalizowanych narzędzi nie ma
w komplecie. I jedyna, w której da się popełnić błąd, którego nikt nie zauważy
przez trzy miesiące: **policzyć poprawę, której nie było.**

### Dlaczego naiwne „przed/po" jest bezwartościowe

Opublikowałeś artykuł 1 marca. W kwietniu ruch wzrósł o 18%. Co to znaczy?

Nic. W marcu był core update. Kwiecień to sezon. Konkurent zdjął stronę.
Wszystkie trzy działy się jednocześnie i każda z nich sama tłumaczy te 18%.
Porównanie „przed/po" mierzy **sumę wszystkiego, co się wydarzyło**, i przypisuje
ją Twojej zmianie.

Dlatego mierzymy metodą różnicy w różnicach:

```
efekt = (zmienione_po − zmienione_przed) − (kontrolne_po − kontrolne_przed)
```

Strony kontrolne przeżyły ten sam core update, ten sam sezon i tego samego
konkurenta. To, co je odróżnia od zmienionych, to **wyłącznie nasza zmiana**.

### Czego Faza 4 świadomie **nie** robi

- **Nie wykonuje niczego, czego nie wolno jej wykonać.** Planer emituje wnioski,
  nie akcje (D46).
- **Nie mierzy tam, gdzie nie ma grupy kontrolnej.** Odmawia z powodem (D48).
- **Nie działa dalej, gdy ruch leci w dół.** Hamulec regresji (D52).
- **Nie uczy się na jednym pomiarze.** Priors aktualizuje dopiero werdykt
  z przedziałem, który mija zero.

---

## 2. Cel Fazy 4

System przez tydzień pracuje bez właściciela i na koniec mówi jednym zdaniem
na akcję: **co zrobił, co z tego wyszło i czy to na pewno przez niego**.

---

## 3. Decyzje

### D45 — Scoring okazji to arytmetyka, nie wywołanie modelu

**Decyzja:** ranking okazji liczy deterministyczna funkcja
`score = (impact × confidence × fit) / (effort × risk)`. Model dostaje **jedno
wąskie zadanie**: ułożyć top 30 w spójny plan (kolejność, grupowanie, wykrycie
konfliktów). Nie liczy i nie przestawia rankingu.

**Uzasadnienie:** modele są dobre w układaniu narracji i złe w konsekwentnym
rankingu liczbowym — ta sama lista podana dwa razy wraca w innej kolejności.
Ranking, który zmienia się bez zmiany danych, nie jest rankingiem.

**Konsekwencja:** każdy z pięciu czynników ma **zapisane źródło**. Czynnik bez
danych jest wartością zadeklarowaną i raport ma to pokazywać, a nie chować
w jednej liczbie.

### D46 — Planer nie może niczego wykonać

**Decyzja:** planer emituje wyłącznie wiersze `agent_task` w stanie `proposed`.
Wykonanie idzie przez policy engine i deterministyczny kod. Nie istnieje ścieżka,
w której wynik działania modelu zmienia stan świata bez przejścia przez politykę.

**Uzasadnienie:** agent, który może proponować, ale nie wykonywać, ma **z definicji
ograniczony zasięg rażenia**. To jest jedyne zabezpieczenie, które działa
niezależnie od tego, jak dobrze albo źle model się zachowa.

### D47 — Polityka ma trzy stany i domyślny jest najostrożniejszy

**Decyzja:** każdy typ akcji ma politykę `auto | approve | never`. Typ akcji,
który nie ma wpisu w tabeli polityk, jest traktowany jako **`never`** — nie jako
`approve` i tym bardziej nie jako `auto`.

**Uzasadnienie:** nowy typ akcji pojawi się kiedyś w kodzie wcześniej niż w tabeli
polityk. Domyślne `approve` znaczyłoby, że nieznana akcja trafia przed oczy
właściciela z sugestią, że ktoś ją przemyślał. Domyślne `never` znaczy, że ktoś
musi ją świadomie włączyć.

### D48 — Bez grupy kontrolnej nie ma pomiaru, tylko odmowa

**Decyzja:** różnica w różnicach wymaga grupy kontrolnej o rozmiarze co najmniej
`MIN_CONTROL_PAGES`. Poniżej tego progu werdykt brzmi **„nie da się zmierzyć"**
i podaje, czego zabrakło. Nigdy nie schodzimy po cichu do porównania „przed/po".

**Uzasadnienie:** to jest ten sam mechanizm, co odmowa porównania w D25 i D27 —
i z tego samego powodu. Liczba policzona ze złej metody wygląda identycznie jak
liczba policzona z dobrej.

**Konsekwencja, którą trzeba powiedzieć wprost:** na stronie mającej kilka
podstron **nie da się zrobić DiD**. Pętla pomiarowa zacznie działać dopiero, gdy
serwis urośnie. Do tego czasu werdykty będą brzmiały „za mało danych" i to jest
poprawne zachowanie, nie awaria.

### D49 — Grupa kontrolna jest dobierana przed zmianą, nie po niej

**Decyzja:** strony kontrolne wybiera się **w chwili planowania akcji**, na
podstawie podobieństwa okresu przed (ruch, pozycja, głębokość), i zapisuje razem
z eksperymentem. Dobór po zobaczeniu wyników jest zakazany.

**Uzasadnienie:** grupa kontrolna dobrana po fakcie to nie grupa kontrolna, tylko
sposób na uzyskanie wyniku, którego się oczekuje. Zapis przed zmianą czyni to
sprawdzalnym.

### D50 — Okna pomiaru są trzy i każde ma własny werdykt

**Decyzja:** 14, 30 i 60 dni po zmianie, każde porównane z oknem **tej samej
długości** przed zmianą. Trzy werdykty, nie jeden uśredniony.

**Uzasadnienie:** 14 dni łapie zmiany techniczne (indeksacja, CTR z tytułu),
60 dni łapie treść, która musi się dopiero wypozycjonować. Uśrednienie ich
w jedną liczbę gubi tę różnicę, a to ona mówi, **jakiego rodzaju** zmiana
zadziałała.

### D51 — Werdykt niesie przedział i nie ma kierunku, gdy przedział mija zero

**Decyzja:** dokładnie ta sama bramka, co w D26. Efekt DiD z przedziałem
bootstrapowym; przedział obejmujący zero to werdykt **„jeszcze nieistotne"** —
liczba widoczna, bez strzałki i bez koloru.

**Uzasadnienie:** to jest ta sama zasada i ten sam kod. Rozjazd między bramką
w trackerze GEO a bramką w pętli agentowej znaczyłby, że dwie części tego samego
systemu mają różne pojęcie o tym, co znaczy „zadziałało".

### D52 — Trzy wyłączniki globalne, nie do obejścia z poziomu polityki

**Decyzja:**
1. **Limit tempa publikacji** — już egzekwowany w D43.
2. **Limit zasięgu rażenia** — żadna akcja `auto` nie dotyka więcej niż 5% stron.
3. **Hamulec regresji** — spadek kliknięć tydzień do tygodnia o więcej niż 20%
   wstrzymuje **wszystkie** akcje zapisujące.

Wyłącznik zadziałał = akcja nie powstaje. Polityka `auto` go nie omija.

**Uzasadnienie:** „nie pozwól robotowi kopać szybciej, gdy jesteś w dole".
Wyłącznik, który da się wyłączyć konfiguracją, nie jest wyłącznikiem.

### D53 — Task board pokazuje stan, a nie postęp

**Decyzja:** cztery stany: `needs-you` (czeka na zgodę), `in-flight` (wykonywane),
`measuring` (czeka na okno pomiaru), `done` (jest werdykt). Zadanie nie może być
`done` bez werdyktu — także wtedy, gdy werdykt brzmi „nie da się zmierzyć".

**Uzasadnienie:** tablica, na której „done" znaczy „wykonano", uczy patrzeć na
aktywność zamiast na wynik. To jest dokładnie ten nawyk, przed którym broni cała
ta faza.

### D54 — Governor budżetu liczy w jednostkach, nie w złotówkach

**Decyzja:** budżet jest liczony w wywołaniach i jednostkach limitu z tabeli
`provider_call`, per dostawca i per okno czasu. Koszt w złotówkach pojawi się
dopiero wtedy, gdy pojawi się płatny dostawca.

**Uzasadnienie:** wszystkie darmowe tiery mają limity liczby żądań, nie kwoty.
Governor liczący złotówki pokazywałby zera przy wyczerpanym limicie Groq — czyli
byłby ślepy dokładnie na to, co ma pilnować.

---

## 4. Zakres

**W zakresie:**
1. `packages/agent` — scoring okazji, dobór grupy kontrolnej, różnica w różnicach
   z przedziałem, silnik polityk, wyłączniki (czysty, zero wejścia/wyjścia).
2. `packages/db` — migracja `0005`: okazje, zadania agenta, eksperymenty, werdykty.
3. `apps/cli` — `seo agent plan`, `seo agent run`, `seo agent board`, `seo agent verdicts`.
4. `packages/report` — tablica zadań i werdykty w raporcie.

**Poza zakresem:** autonomiczny scheduler jako demon (na razie wywołanie z crona),
uczenie priors, panel webowy, wykonywanie akcji innych niż te z Faz 1–3.

---

## 5. Kryteria akceptacji

- **AC1.** Ranking okazji policzony dwa razy na tych samych danych jest **identyczny**.
- **AC2.** Każda okazja niesie źródło każdego z pięciu czynników; czynnik
  zadeklarowany jest oznaczony jako zadeklarowany.
- **AC3.** Planer nie ma drogi do zmiany stanu świata — emituje wyłącznie `proposed`.
- **AC4.** Typ akcji bez wpisu w politykach jest traktowany jako `never`.
- **AC5.** DiD przy zbyt małej grupie kontrolnej **odmawia** i podaje, ile stron
  zabrakło.
- **AC6.** Grupa kontrolna zapisana przed zmianą; próba dobrania jej po fakcie
  jest odrzucana.
- **AC7.** Trzy okna (14/30/60) dają trzy osobne werdykty.
- **AC8.** Efekt z przedziałem obejmującym zero nie dostaje kierunku.
- **AC9.** Spadek kliknięć >20% tydzień do tygodnia wstrzymuje akcje zapisujące,
  także przy polityce `auto`.
- **AC10.** Zadanie nie przechodzi w `done` bez werdyktu.
- **AC11.** Testy przechodzą bez sieci.

---

## 6. Ryzyka

| Ryzyko | Reakcja |
|---|---|
| Za mała strona, żeby zrobić DiD | Odmowa z powodem (D48). Pętla czeka, nie zmyśla. |
| Grupa kontrolna dobrana tendencyjnie | Zapis przed zmianą, dobór po podobieństwie okresu przed (D49). |
| Model przestawia ranking | Model nie dotyka rankingu (D45). |
| Nowy typ akcji wykonany bez zgody | Domyślne `never` (D47). |
| Kuszenie, żeby „done" znaczyło „wykonano" | Zakazane wprost w D53. |

---

## 7. Co ten dokument zostawia otwarte

- **Minimalny rozmiar grupy kontrolnej.** Liczba musi wyjść z mocy testu przy
  realnej wariancji ruchu, a tej jeszcze nie zmierzyliśmy. Do tego czasu wartość
  jest jawna w kodzie i oznaczona jako zgadnięta.
- **Skale czynników scoringu.** `impact` i `confidence` mają dane; `fit`, `effort`
  i `risk` będą na start deklarowane per typ akcji.
- **Częstotliwość przebiegu pętli.** Tygodniowo jest hipotezą, tak samo jak
  w Fazie 2.
