# Faza 3 — Silnik treści. Dokument decyzji

**Data:** 2026-08-31
**Poprzednie decyzje:** D1–D22 (Fazy 0–1), D23–D32 (Faza 2)
**Numeracja tutaj:** D33–D44

---

## 1. Streszczenie po ludzku

Faza 1 mówi, co jest zepsute technicznie. Faza 2 mówi, czy modele w ogóle o nas
wiedzą. Faza 3 ma **napisać to, czego brakuje** — i tu zaczyna się jedyna część
platformy, która potrafi wyrządzić klientowi realną szkodę.

Strony publikujące duże wolumeny nieredagowanej treści AI dostały **50–80%
spadków ruchu** przy egzekwowaniu polityki scaled content abuse. To nie jest
ryzyko teoretyczne i nie jest to coś, co da się załatwić lepszym promptem.
Dlatego ta faza jest zbudowana wokół jednej zasady:

> **System ma strukturalnie nie móc opublikować bezwartościowej strony.**

Nie „ma tego unikać". Nie „ma ostrzegać". Ma nie móc — bo bramki są w typach
i w kodzie, a nie w instrukcji dla modelu.

### Czego Faza 3 świadomie **nie** robi

- **Nie publikuje bez człowieka.** Rozstrzygnięcie sprzeczności — patrz D35.
- **Nie buduje sieci wymiany linków.** To jest link scheme i jedyna funkcja
  z całej analizy konkurencji z bezpośrednim ryzykiem kary manualnej.
- **Nie generuje stron programatycznych.** Szablon bez prawdziwego źródła danych
  to dokładnie ta maszyna do slopu, przed którą broni cała ta faza.
- **Nie tłumaczy i nie robi hreflang.** Osobna faza, inne ryzyko.

---

## 2. Cel Fazy 3

Jedno polecenie zamienia klaster fraz w gotowy do przeglądu artykuł: brief
oparty na tym, co już wiemy o serwisie, draft z nazwanym autorem i unikalnym
zasobem, wstawione linkowanie wewnętrzne, JSON-LD — a wynik ląduje jako
**pull request**, nie jako opublikowana strona.

---

## 3. Decyzje

### D33 — Klastrowanie po overlapie SERP; bez SERP-a metoda jest **nazwana**, nie podmieniona po cichu

**Decyzja:** podstawową metodą klastrowania jest overlap SERP — jeśli dwie frazy
dzielą ≥3 te same adresy w top10, Google uważa je za tę samą intencję. Każdy
klaster niesie pole `method` i **nie wolno mieszać metod w jednym zestawie**.

**Problem, który trzeba powiedzieć wprost:** *nie mamy darmowego źródła SERP.*
Search Console podaje nasze własne frazy i naszą pozycję — nigdy adresów
konkurencji. Bing Webmaster Tools daje dane o naszej witrynie. Autocomplete daje
rozszerzenia fraz. **Żadne z nich nie daje top10 dla frazy.** Overlap SERP jest
więc dziś niepoliczalny za zero złotych i tak zostanie, dopóki nie pojawi się
budżet na `serper` albo `dataforseo`.

**Konsekwencja:** silnik klastrowania przyjmuje migawki SERP **jako wejście**
(czysta funkcja, zero sieci) i jest gotowy w dniu, w którym pojawi się dostawca.
Do tego czasu działa metoda zapasowa, oznaczona jako `lexical-overlap`, nigdy
podana jako to samo co `serp-overlap`.

> **Poprawka po implementacji (2026-08-31).** Pierwsza wersja tego akapitu
> mówiła o metodzie `gsc-cooccurrence` opartej na wspólnych wystąpieniach fraz
> na tych samych naszych stronach. **Takich danych nie zbieramy** —
> `gsc_query_daily` niesie wymiar `query`, ale nie `page`, więc nie wiadomo,
> która strona odebrała wyświetlenia dla której frazy. Metoda zapasowa jest
> więc czysto leksykalna i tak się nazywa. Dopisanie wymiaru `page` do synchronizacji
> GSC jest osobną, wąską robotą po stronie Fazy 0 i dopiero ona odblokuje
> `gsc-cooccurrence`. Nazwanie słabszej metody nazwą mocniejszej byłoby dokładnie
> tym, przed czym broni ta decyzja.

**Uzasadnienie:** cicha podmiana metody jest gorsza niż jej brak. Klient, który
dostaje „klastry" i nie wie, że powstały z podobieństwa napisów, podejmie na tej
podstawie decyzje redakcyjne warte tygodni pracy.

### D34 — Bramka oryginalności liczy się lokalnie i jest **blokująca**

**Decyzja:** draft o podobieństwie kosinusowym **>0,85** do jakiejkolwiek strony
z top10 albo do istniejącej treści serwisu jest **odrzucany**. Nie oznaczany —
odrzucany. Podobieństwo liczymy lokalnie: TF-IDF na n-gramach słownych, czysta
funkcja, zero sieci, zero kosztu.

**Uzasadnienie:** wektory z API kosztują i wymagają konta, a tu nie chodzi
o subtelną semantykę, tylko o wykrycie, że tekst jest przepisaniem cudzego.
Do tego TF-IDF wystarcza i ma tę zaletę, że wynik da się wytłumaczyć: można
pokazać, które n-gramy się pokrywają.

**Konsekwencja:** bramka jest typem, nie flagą. Funkcja publikująca przyjmuje
`ApprovedDraft`, a jedyną drogą do tego typu jest przejście bramek.

### D35 — „Opublikowany automatycznie" znaczy **pull request otwarty automatycznie**

**Decyzja:** pipeline biegnie bez człowieka od klastra do gotowego pliku, ale
kończy się **otwarciem pull requesta**. Merge jest decyzją człowieka.

**Uzasadnienie — to rozstrzyga sprzeczność w analizie.** Kamień milowy Fazy 3
mówi „pierwszy artykuł opublikowany automatycznie". Tabela bezpieczników w tej
samej analizie mówi „publikacja nowego artykułu — **zatwierdzenie**, auto dopiero
po 10 akceptacjach ≥90%". Obie nie mogą być prawdziwe naraz.

Rozstrzygamy na korzyść bezpiecznika, bo koszt pomyłki jest asymetryczny:
niepotrzebne kliknięcie „merge" kosztuje dziesięć sekund, a opublikowany slop
kosztuje ruch całej domeny. **Pull request jest bramką zatwierdzenia** — i przy
okazji daje darmowy rollback (revert), historię i diff. To nie jest obejście
kamienia milowego, tylko jego uczciwe odczytanie: automat robi całą robotę,
człowiek mówi „tak".

### D36 — Publikacja przez PR do repo jest ścieżką **domyślną**, nie awaryjną

**Decyzja:** pierwszym i jedynym adapterem publikacji w Fazie 3 jest
`git-pr`. WordPress REST, webhook i reszta CMS-ów — później, gdy pojawi się
klient, który ich używa.

**Uzasadnienie:** własna strona właściciela to GitHub Pages, czyli repozytorium.
Koszt zero, bramka zatwierdzenia darmowa, rollback darmowy. Budowanie adaptera
do WordPressa, zanim istnieje klient z WordPressem, to pisanie kodu pod
wyobrażonego użytkownika.

### D37 — Bez unikalnego zasobu nie ma artykułu

**Decyzja:** każdy draft musi nieść co najmniej jeden **unikalny zasób**:
własne dane lub analizę, cytat z pierwszej ręki, autorski diagram albo zrzut,
albo podpis nazwanego eksperta. Pole jest wymagane w typie i puste nie przejdzie.

**Uzasadnienie:** to jest różnica między artykułem a streszczeniem cudzych
artykułów. Model potrafi napisać jedno i drugie; tylko pierwsze ma powód, żeby
istnieć. Wymóg w typie znaczy, że pipeline **zatrzyma się i zapyta**, zamiast
wyprodukować kolejną stronę bez treści.

### D38 — Najpierw konsoliduj, potem twórz

**Decyzja:** jeśli istniejąca strona serwisu pokrywa klaster (podobieństwo
tematyczne powyżej progu), domyślną akcją jest **`refresh`**, nie `create`.
`create` wymaga jawnego powodu zapisanego w briefie.

**Uzasadnienie:** dwie strony o tym samym to kanibalizacja — konkurują ze sobą
o tę samą frazę i obie tracą. Domyślne „twórz nowy" jest tym, co zamienia
narzędzie SEO w maszynę do rozcieńczania własnego serwisu.

### D39 — Autor jest prawdziwy, nazwany i ma `sameAs`

**Decyzja:** JSON-LD `author` wskazuje na istniejącą osobę z rozwiązywalnym
`sameAs`. **Nigdy nie generujemy encji autorskich.**

**Uzasadnienie:** zmyślony autor z biogramem to fałszowanie E-E-A-T. To nie jest
szara strefa optymalizacji — to jest wprowadzanie czytelnika w błąd co do tego,
kto za tekstem stoi.

### D40 — Model i wersja są metadanymi draftu, jak `model_version` w D27

**Decyzja:** każdy draft zapisuje silnik, wersję modelu i identyfikator promptu,
którym powstał. Draft z innego modelu to inny proces, nie inny wynik.

**Uzasadnienie:** dokładnie ta sama zasada, co przy trackerze GEO. Gdy za pół
roku okaże się, że artykuły z jednego modelu radzą sobie lepiej, jedyną drogą do
tego wniosku jest zapisana wersja. Bez niej mamy anegdotę.

### D41 — Brief powstaje z tego, co **już wiemy**, nie z tego, co model zgadnie

**Decyzja:** brief składa się z danych zebranych w Fazach 0–2: fraz z Search
Console z pozycją i wyświetleniami, istniejących stron z crawla, luk w pokryciu
tematu, wzmianek i cytowań z trackera GEO. Model **redaguje** brief, nie
wymyśla go.

**Uzasadnienie:** LLM poproszony o brief bez danych wyprodukuje wiarygodnie
wyglądający zestaw ogólników. Wartość briefu leży w tym, że zna pozycję 11
na frazie, która ma 400 wyświetleń miesięcznie — a tego model nie wie.

### D42 — Linkowanie wewnętrzne z prawdziwego grafu, maksymalnie trzy na artykuł

**Decyzja:** sugestie linków biorą się z grafu linków zbudowanego w Fazie 1 —
istniejących stron, ich głębokości i liczby linków przychodzących. Limit **trzy**
linki wstawiane automatycznie, tak jak w tabeli bezpieczników.

**Uzasadnienie:** graf mamy i jest prawdziwy. Model proszony o linki wewnętrzne
zmyśla adresy — nie dlatego, że jest zły, tylko dlatego, że generuje tekst.
Adresy do wstawienia mają pochodzić z bazy, a model ma tylko wybrać miejsce.

### D43 — Limit tempa publikacji obowiązuje od pierwszego dnia

**Decyzja:** `max(3 dziennie, 10% zaindeksowanych stron miesięcznie)`. Licznik
jest w bazie i egzekwuje go kod, nie dyscyplina.

**Uzasadnienie:** limit dopisany „później" nigdy nie powstaje. A to jest jeden
z trzech wyłączników, które mają działać wtedy, gdy wszystko inne zawiedzie.

### D44 — Draft jest Markdownem, nie HTML-em

**Decyzja:** pipeline produkuje Markdown z front matterem. Renderowanie do HTML
jest sprawą docelowej strony.

**Uzasadnienie:** repozytorium własnej strony to statyczny generator; PR
z Markdownem czyta się w diffie, PR z HTML-em nie. Do tego Markdown wymusza
strukturę nagłówków, którą i tak chcemy kontrolować.

---

## 4. Zakres

**W zakresie:**
1. `packages/keywords` — klastrowanie (overlap SERP + metoda zapasowa), pokrycie
   tematu, decyzja `refresh` vs `create` (czysty, zero wejścia/wyjścia).
2. `packages/content` — scoring treści, generator briefów, bramka oryginalności,
   sugestie linków wewnętrznych, JSON-LD (czysty, zero wejścia/wyjścia).
3. `packages/providers` — `ContentProvider`: generowanie draftu przez silnik LLM,
   w rejestrze wywołań jak wszystko inne; adapter publikacji `git-pr`.
4. `packages/db` — migracja `0004`: klastry, briefy, drafty, publikacje, licznik tempa.
5. `apps/cli` — `seo keywords cluster`, `seo brief`, `seo draft`, `seo publish`.

**Poza zakresem:** strony programatyczne, tłumaczenia i hreflang, adaptery CMS
inne niż `git-pr`, generowanie obrazów, outreach, bulk refresh.

---

## 5. Kryteria akceptacji

- **AC1.** Klaster niesie nazwę metody; zestaw zmieszanych metod jest **odmawiany**.
- **AC2.** Klastrowanie po overlapie SERP na fikstur z ≥3 wspólnymi adresami łączy
  frazy; przy 2 wspólnych nie łączy.
- **AC3.** Draft o podobieństwie >0,85 do istniejącej treści jest **odrzucony**,
  a powód wskazuje pokrywające się n-gramy.
- **AC4.** Draft bez unikalnego zasobu **nie da się** przekazać do publikacji —
  blokuje to typ, nie sprawdzenie w czasie wykonania.
- **AC5.** Klaster pokryty istniejącą stroną dostaje domyślnie `refresh`;
  `create` wymaga zapisanego powodu.
- **AC6.** Sugerowane linki wewnętrzne istnieją w grafie z crawla; maksymalnie trzy.
- **AC7.** JSON-LD ma nazwanego autora z `sameAs`; brak autora blokuje publikację.
- **AC8.** Przekroczony limit tempa wstrzymuje publikację i mówi, kiedy wolno wrócić.
- **AC9.** Każde wywołanie modelu ma wiersz w `provider_call`; draft niesie silnik
  i wersję modelu.
- **AC10.** Testy przechodzą bez sieci — generowanie na atrapach, publikacja na
  lokalnym repozytorium git.

---

## 6. Ryzyka

| Ryzyko | Reakcja |
|---|---|
| Brak darmowego źródła SERP blokuje klastrowanie | Silnik gotowy, metoda zapasowa nazwana wprost (D33). |
| Model generuje slop mimo bramek | Bramki są w typach; dochodzi wymóg unikalnego zasobu (D37). |
| Właściciel zmerguje PR bez czytania | Poza zasięgiem kodu. PR pokazuje diff i wynik bramek — reszta to jego decyzja. |
| Adapter `git-pr` psuje repozytorium | Publikacja zawsze na osobnej gałęzi, nigdy na domyślnej. |
| Kuszenie, żeby dorobić auto-merge po N akceptacjach | Zapisane w D35 jako świadomie odłożone; wymaga danych, których jeszcze nie ma. |

---

## 7. Co ten dokument zostawia otwarte

- **Próg podobieństwa tematycznego dla `refresh` vs `create`.** 0,85 dla
  oryginalności bierze się z analizy; próg konsolidacji nie ma źródła i pierwszy
  przebieg na własnej stronie go ustawi.
- **Który silnik pisze lepiej.** Rozstrzygnie pomiar z Fazy 2, nie wybór przy biurku.
- **Format unikalnego zasobu.** Wiadomo, że jest wymagany; jego struktura
  (dane? cytat? diagram?) ustali się na pierwszych trzech artykułach.
