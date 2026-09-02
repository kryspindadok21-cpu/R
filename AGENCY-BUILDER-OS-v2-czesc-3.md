# AGENCY BUILDER OS v2 — CZĘŚĆ 3
**Poprawki 1–6 + Deliverables D7 · D8 · D9**
Data: 2026-09-02 · Plik strony: `strona-agencji/index.html` (jeden plik, 518 linii)

---

# POPRAWKI

## P1a. FAZA 3 — poprawna kolejność malejąca

Kryterium rozstrzygania remisów: krótszy **Czas do 1. zł** wyżej.

| Msc | Pomysł | WYNIK |
|---|---|---|
| 1 | Google Maps + filtr „brak strony" jako lista leadów | 64,8 |
| 2 | Nisza: pracownie mebli na wymiar 1–5 osób | 64,8 |
| 3 | Wizyta osobista w warsztacie z gotowym audytem | 64,0 |
| 4 | Audyt 1-stronicowy z liczbą z PageSpeed Insights | 57,6 |
| 5 | Oferta wejściowa: strona + wizytówka, stała cena | 57,6 |
| 6 | Zgoda na kontakt elektroniczny zbierana na wizycie | 57,6 |
| 7 | Sygnał „wolne terminy" w grupach FB jako priorytet leada | 56,7 |
| 8 | Arkusz Google jako jedyny CRM | 54,0 |
| 9 | Wyszukiwarka REGON/CEIDG po kodzie PKD | 50,4 |
| 10 | Zaliczka 50% przed rozpoczęciem pracy | 50,4 |
| 11 | Abonament wpisany w umowę od 31. dnia | 50,4 |
| 12 | Jeden plik HTML zamiast systemu CMS | 50,4 |
| 13 | Netlify Drop jako hosting startowy | 50,4 |
| 14 | Trening rozmowy na 2 firmach spoza niszy | 48,0 |
| 15 | OLX jako źródło firm bez strony | 44,8 |
| 16 | Nagłówek strony oparty na stracie | 44,1 |
| 17 | Zdjęcia realizacji klienta jako całe portfolio | 38,4 |
| 18 | List papierowy jako dotknięcie #4 | 25,2 |

## P1b. Sprzeczność sezonowa — rozstrzygnięcie

**Miałeś rację, że to sprzeczność, ale to nie jest ta sama sprzecz­ność w obu miejscach.** Rozróżnienie, którego zabrakło:

- **Ogrodzenia (A1.5):** we wrześniu znika **popyt jego klientów**. Nikt nie stawia ogrodzenia w mrozie. Strona zrobiona we wrześniu nie ma czego obsłużyć przez 6 miesięcy, więc klient nie ma powodu płacić dziś. **Kill utrzymany, ale z poprawnym uzasadnieniem.**
- **Meble na wymiar:** popyt jego klientów **nie znika** — kuchnia to robota wewnątrz budynku, a wykończeniówka trwa jesienią i zimą [SZACUNEK — założenie: montaże kuchni idą za odbiorami mieszkań i remontami, które nie zależą od mrozu. **Zweryfikuj u pierwszych pięciu stolarzy jednym pytaniem: „który miesiąc jest u Pana najsłabszy?" i zapisz odpowiedzi w arkuszu** — po pięciu odpowiedziach będziesz wiedział więcej niż ja]. Ryzyko, które wpisałem, jest inne: **on jest zajęty teraz**, a nie „nie ma rynku".

**Decyzja: zajętość zamieniam z ryzyka na kryterium targetowania.** Zmiany operacyjne, dwie:

1. **Karta D3 — nowe wagi.** Kryterium **G (sygnał wolnych mocy) rośnie z 0–10 na 0–15**. Kryterium **D (dowód, że firma żyje) spada z 0–15 na 0–10** (firma z sygnałem „wolne terminy" i tak dowodzi, że żyje — te dwa kryteria częściowo się dublowały). Suma nadal 100. Skutek: we wrześniu na górę listy wychodzą warsztaty z dziurą w kalendarzu, a nie te najbardziej widoczne.
2. **D5.2 — zmiana otwarcia rozmowy.** Zdanie „Robię strony dla pracowni meblowych" zostaje, ale **drugi akapit skryptu do drzwi zmienia się dla firmy bez sygnału wolnych mocy**:

```
Nie przychodzę, żeby dać Panu więcej roboty - zakładam, że roboty
Pan ma. Przychodzę, żeby wiosną miał Pan z czego wybierać.
Dziś bierze Pan zlecenie, które akurat trafi. Chodzi o to, żeby
za pół roku odmawiał Pan tym za osiem tysięcy, bo w kolejce stoi
kuchnia za trzydzieści.
```

Dla firmy **z** sygnałem wolnych mocy skrypt zostaje bez zmian — tam działa pilność, nie marża.

## P2. D5 i D6 są dziś niewykonalne — potwierdzam. Rozstrzygnięcia.

Sprawdziłem i masz rację: karta zgody z 5.3 wymaga pełnej nazwy z CEIDG i NIP-u, stopka strony i checkbox w formularzu też, a w FAZIE 0 sam ustaliłem, że firmy nie masz. **Bez rozstrzygnięcia poniżej nie mógłbyś odbyć ani jednej wizyty ani opublikować strony. To był błąd konstrukcyjny, nie drobiazg.**

### Decyzja: **działalność nierejestrowana na start. CEIDG dopiero wtedy, gdy wymusi to limit albo drugi abonament.**

Uzasadnienie w liczbach: CEIDG od pierwszego dnia oznacza obowiązkową **składkę zdrowotną już w pierwszym miesiącu**, także przy zerowym przychodzie — ulga na start zwalnia ze składek społecznych, ale **nie ze zdrowotnej** [DANE]. To jest stały wypływ gotówki w miesiącu, w którym możesz jeszcze nie mieć klienta, i łamie zasadę „pierwszy wydatek z pieniędzy pierwszego klienta".

### Limit działalności nierejestrowanej

| Pozycja | Wartość | Znacznik |
|---|---|---|
| Reguła | Przychód należny **w żadnym miesiącu** nie może przekroczyć **75% minimalnego wynagrodzenia** (art. 5 Prawa przedsiębiorców) | [DANE — stan mojej wiedzy; próg 75% obowiązuje od 1 lipca 2023 r.] |
| Minimalne wynagrodzenie 2026 | **Nie znam pewnej kwoty na 2026 r.** | Nie zgaduję. **Sprawdź:** `biznes.gov.pl`, wyszukaj „działalność nierejestrowana" — na tej stronie podana jest aktualna kwota limitu wprost, bez liczenia |
| Limit miesięczny — rząd wielkości do planowania | ok. **3 500–3 700 zł** | [SZACUNEK] — założenie: minimalne wynagrodzenie 2026 w przedziale 4 700–4 900 zł. **Zanim wystawisz pierwszy rachunek, zastąp to prawdziwą liczbą z biznes.gov.pl** |
| Dodatkowe warunki | Nie prowadziłeś działalności gospodarczej w ciągu ostatnich 60 miesięcy; działalność nie wymaga koncesji ani zezwolenia (tworzenie stron nie wymaga) | [DANE] |

### Co się dzieje, gdy drugi klient przekroczy limit w jednym miesiącu

To nie jest teoria — **przy cenie 1 490 zł trafisz na to w drugim albo trzecim miesiącu**:

| Sprzedaż w jednym miesiącu | Przychód | Mieści się? |
|---|---|---|
| 1 × START | 1 490 zł | tak |
| 2 × START | 2 980 zł | tak, z zapasem ok. 600 zł |
| 2 × START + 1 abonament | 3 370 zł | **na styk — policz to zanim wystawisz rachunek** |
| 3 × START | 4 470 zł | **NIE. Limit przekroczony** |

Mechanizm prawny po przekroczeniu: działalność **staje się działalnością gospodarczą od dnia przekroczenia limitu**, a Ty masz **7 dni na złożenie wniosku o wpis do CEIDG** [DANE — art. 5 ust. 3–4 Prawa przedsiębiorców; **zweryfikuj na `biznes.gov.pl`**].

**Reguła operacyjna, którą wpisujesz sobie do arkusza:** kolumna „przychód w tym miesiącu" z sumą na górze i warunkiem: **gdy suma przekroczy 80% limitu, trzecią sprzedaż w tym miesiącu przesuwasz terminem płatności na 1. dzień kolejnego miesiąca** (data wystawienia rachunku, nie data rozmowy, decyduje o miesiącu). To jest legalne planowanie terminu płatności, nie ukrywanie przychodu — ale **umów to z klientem otwarcie i zapisz w rachunku**.

### Koszt CEIDG w pierwszym roku

| Okres od rejestracji | Co płacisz | Kwota miesięcznie | Znacznik |
|---|---|---|---|
| Miesiąc 1–6 (**ulga na start**) | tylko składka zdrowotna, **bez społecznych** | ok. **300–420 zł** | [SZACUNEK] — założenie: skala podatkowa, dochód poniżej progu, więc obowiązuje minimalna zdrowotna. **Sprawdź:** `zus.pl` → „ulga na start", oraz kalkulator na `biznes.gov.pl` |
| Miesiąc 7–30 (**preferencyjne składki / mały ZUS**, 24 miesiące) | społeczne od podstawy 30% minimalnego wynagrodzenia + zdrowotna | ok. **650–800 zł** | [SZACUNEK] — założenie jak wyżej. **Sprawdź:** `zus.pl` → „preferencyjne składki" |
| Od 31. miesiąca | pełny ZUS + zdrowotna | ok. **1 700–2 000 zł** | [SZACUNEK]. **Sprawdź:** `zus.pl`, tabela składek na dany rok |

Wniosek dla decyzji: **rejestrujesz się w miesiącu, w którym masz podpisany drugi abonament** (2 × 390 zł = 780 zł powtarzalnie) **albo wcześniej, jeśli zmusi Cię limit.** Wtedy ulga na start startuje w momencie, w którym firma już zarabia, a nie w miesiącu zerowym.

### ⚠️ Pułapka VAT, o której musisz wiedzieć zanim wystawisz cokolwiek

Zwolnienie podmiotowe z VAT do 200 000 zł obrotu [DANE — art. 113 ustawy o VAT] **nie obejmuje usług doradztwa** [DANE — art. 113 ust. 13]. Jeśli na rachunku napiszesz „doradztwo SEO" albo „konsultacje marketingowe", możesz stracić zwolnienie od pierwszej złotówki.

**Reguła: na rachunku i w umowie nazywasz to zawsze wykonaniem i obsługą, nigdy doradztwem.** Dopuszczalne nazwy pozycji: `Wykonanie strony internetowej`, `Obsługa techniczna strony internetowej`, `Prowadzenie wizytówki w Mapach Google`. **Nie jestem doradcą podatkowym — zanim wystawisz pierwszy rachunek, zadzwoń na infolinię Krajowej Informacji Skarbowej (numer na `podatki.gov.pl`) i zadaj jedno pytanie: „czy usługa wykonania strony internetowej i jej obsługi technicznej jest wyłączona ze zwolnienia z art. 113 ustawy o VAT". Rozmowa jest bezpłatna.**

### Poprawiona karta zgody — wersja dla osoby BEZ firmy

Zastępuje całą kartę z 5.3 do momentu rejestracji w CEIDG. Trzy pola w nawiasach to Twoje dane osobowe, których nie mogę znać.

```
ZGODA NA KONTAKT ELEKTRONICZNY ORAZ INFORMACJA O DANYCH

Administratorem danych jest [IMIĘ I NAZWISKO], osoba fizyczna
prowadząca działalność nierejestrowaną w rozumieniu art. 5 ustawy
Prawo przedsiębiorców, adres do korespondencji: [MIASTO I KOD POCZTOWY],
e-mail: [E-MAIL], telefon: [TELEFON].

Nie jestem wpisany do CEIDG i nie posiadam numeru NIP. Rozliczam się
z przychodu z działalności nierejestrowanej w rocznym zeznaniu
podatkowym. Za wykonaną usługę wystawiam rachunek.

SKĄD MAM PAŃSTWA DANE
Dane kontaktowe Państwa firmy (nazwa, adres, telefon, adres e-mail)
pozyskałem ze źródeł publicznie dostępnych: z Map Google, z rejestru
CEIDG oraz ze strony internetowej Państwa firmy.

PO CO JE PRZETWARZAM I NA JAKIEJ PODSTAWIE
W celu przedstawienia oferty wykonania strony internetowej.
Podstawą jest mój prawnie uzasadniony interes - marketing bezpośredni
własnych usług, art. 6 ust. 1 lit. f RODO.

JAK DŁUGO
Do momentu wniesienia sprzeciwu, nie dłużej niż 24 miesiące
od dnia dzisiejszego.

PAŃSTWA PRAWA
Prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia
przetwarzania, przeniesienia oraz prawo sprzeciwu. Prawo wniesienia
skargi do Prezesa Urzędu Ochrony Danych Osobowych, ul. Stawki 2,
00-193 Warszawa. Aby skorzystać - wystarczy napisać na [E-MAIL].

Dane nie są przekazywane innym podmiotom ani poza Unię Europejską.
Nie podejmuję decyzji w sposób zautomatyzowany.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

ZGODA (proszę zaznaczyć i podpisać, jeśli Państwo chcą)

[ ] Wyrażam zgodę na otrzymywanie informacji handlowej dotyczącej
    wykonania strony internetowej i jej obsługi na podany niżej adres
    e-mail oraz numer telefonu. Zgodę mogę wycofać w każdej chwili,
    pisząc jedno zdanie na adres [E-MAIL]. Wycofanie zgody nic mnie
    nie kosztuje i nie wymaga uzasadnienia.

Firma: ..............................................................
E-mail: .............................................................
Telefon: ............................................................
Data i podpis: ......................................................
```

**Ważne, żeby nie było wątpliwości:** brak wpisu do CEIDG **nie zwalnia Cię z obowiązków administratora danych**. RODO stosuje się do Ciebie tak samo. Zmienia się tylko treść pola „kim jestem".

### Czym przyjmujesz pierwszą płatność

**Rachunkiem.** Nie fakturą VAT — nie jesteś czynnym podatnikiem VAT. Rachunek musi zawierać:

```
RACHUNEK nr 1/2026
Data wystawienia: [DATA]        Miejsce: [MIASTO]

Wystawiający: [IMIĘ NAZWISKO], [ADRES], PESEL [PESEL]
              działalność nierejestrowana (art. 5 Prawa przedsiębiorców)
Nabywca:      [NAZWA FIRMY KLIENTA], [ADRES], NIP [NIP KLIENTA]

Lp. Nazwa usługi                                Ilość  Cena      Wartość
1.  Wykonanie strony internetowej - I rata (50%)   1    745,00 zł  745,00 zł

RAZEM DO ZAPŁATY: 745,00 zł
Słownie: siedemset czterdzieści pięć złotych 00/100

Sprzedawca korzysta ze zwolnienia podmiotowego z VAT
na podstawie art. 113 ust. 1 ustawy o podatku od towarów i usług.

Termin płatności: 3 dni od daty wystawienia
Numer rachunku bankowego: [TWÓJ PRYWATNY NUMER KONTA]

Podpis wystawiającego: ..............................
```

Trzy rzeczy do zapamiętania:
1. **Konto prywatne wystarcza** — działalność nierejestrowana nie wymaga konta firmowego [DANE].
2. **Numeracja ciągła od 1** i prowadzisz **ewidencję sprzedaży** — prosty arkusz: data, numer rachunku, kwota, suma narastająco w miesiącu. Ten arkusz jest jednocześnie Twoim licznikiem limitu.
3. **Nie podpisuj z klientem umowy o dzieło ani zlecenia** — przy takiej konstrukcji firma-nabywca może zostać uznana za płatnika zaliczki na PIT i składek. Umowa ma się nazywać **umową o wykonanie strony internetowej** i wskazywać, że sprzedający prowadzi działalność nierejestrowaną. **Tu nie mam pewności co do wszystkich stanów faktycznych — potwierdź to u księgowej Twojego pierwszego klienta (jedno pytanie, on i tak ma księgową) albo na infolinii KIS.**

## P3. Cennik był pułapką na mnie — przeliczenie i przebudowa

Masz rację i liczby to potwierdzają. Podstawa przeliczenia: z 4 h dziennie realnie na **produkcję** zostaje ok. **2,5 h** (reszta to prospecting, dojazdy, telefony, papiery), czyli ok. **52 h miesięcznie** [SZACUNEK — założenie: 21 dni roboczych].

### Stary cennik w godzinach

| Pakiet | Cena | Moje godziny [SZACUNEK] | Stawka |
|---|---|---|---|
| START | 1 490 zł | 9,5 h | **157 zł/h** |
| WZROST | 3 900 zł | 20,5 h | **190 zł/h** |
| **MAKSIMUM** | **4 900 zł** | 20,5 h + 6 mies. × 3,5 h = **41,5 h** | **118 zł/h** |

Potwierdzone: MAKSIMUM było najgorzej płatnym pakietem w całym cenniku, miało etykietę „Najwięcej za złotówkę" i **blokowało 21 godzin w miesiącach, w których powinieneś sprzedawać**. Dwóch takich klientów = 83 h zobowiązań przy 52 h miesięcznej mocy.

### Zasada, której złamanie to spowodowało

> **Element odróżniający droższy pakiet musi być zasobem wielokrotnego użytku albo pozycją w kolejce — nigdy moimi godzinami.** W pakiet jednorazowy nie wliczam więcej niż **jeden** miesiąc abonamentu.

### Nowy cennik (już wdrożony w `index.html`)

| Pakiet | Cena | Godziny [SZACUNEK] | Stawka | Co go różni |
|---|---|---|---|---|
| **START** | 1 490 zł | **8,0 h** | **186 zł/h** | 1 strona, do 15 zdjęć, wizytówka, 2 rundy poprawek, 10 dni |
| **STANDARD** (wabik) | 2 900 zł | **15,0 h** | **193 zł/h** | + 3 podstrony, do 30 zdjęć, teksty pod 3 miasta, 15 dni, **bez opieki** |
| **KOMPLET** | 3 900 zł | **17,0 h** | **229 zł/h** | + wejście poza kolejnością (5 dni), gotowe opisy do Map/FB/OLX/Oferteo, nagranie wideo, **1 miesiąc opieki** |

Skąd 8,0 h w START: rozmowa i brief 0,5 · zdjęcia (wybór, kadr, kompresja 15 szt.) 1,5 · teksty 1,5 · złożenie strony z szablonu 1,5 · wizytówka Google 1,0 · wdrożenie i testy 0,5 · dwie rundy poprawek 1,0 · papiery i rachunek 0,5.

**Dlaczego wabik teraz działa na klienta, a nie na Ciebie:** STANDARD za 2 900 zł nie ma opieki, nie ma priorytetu i nie ma opisów. KOMPLET za 1 000 zł więcej dokłada rzeczy, które **kosztują Cię 2 godziny**, a klient wycenia je znacznie wyżej — bo dostaje pozycję w kolejce i gotowce, które sam musiałby pisać. Twoja stawka **rośnie** z każdym wyższym pakietem: 186 → 193 → 229 zł/h. To jest test, który każdy przyszły cennik musi przejść.

### Abonamenty — sufit godzin wpisany do oferty

| Abonament | Cena | Sufit godzin | Stawka |
|---|---|---|---|
| OPIEKA | 390 zł/mies. | **do 1,5 h** | 260 zł/h |
| WIDOCZNOŚĆ | 690 zł/mies. | **do 3,0 h** | 230 zł/h |
| WZROST+ | 1 190 zł/mies. | **do 6,0 h** | 198 zł/h |

Sufit jest teraz **napisany na stronie i w umowie**. Bez niego abonament za 390 zł zamienia się w etat.

### Sufit mocy przerobowych — reguła, której nie łamiesz

Przy 52 h miesięcznie: **maksymalnie 3 nowe wdrożenia START miesięcznie (24 h) + 8 abonamentów OPIEKA (12 h) = 36 h**, reszta to zapas na obsunięcia. Czwarty klient w miesiącu dostaje termin w kolejnym miesiącu — i **mówisz mu to wprost**, bo kolejka jest sygnałem, że masz robotę.

## P4. Termin — rozstrzygnięcie

RED TEAM miał rację, zignorowałem to. Poprawka:

| Kiedy | Co obiecujesz na zewnątrz | Twój cel wewnętrzny |
|---|---|---|
| Klienci **1–3** | **10 dni roboczych** | 6 dni |
| Klient **4 i dalej** | **7 dni roboczych** | 5 dni |
| KOMPLET (dowolny numer) | 5 dni roboczych — to jest jego przywilej, więc go pilnujesz przed innymi | 4 dni |

Bufor 4 dni na pierwszych trzech klientach jest po to, że **pierwsze wdrożenie zajmie Ci 2–3 razy więcej, niż zakładasz** [SZACUNEK — założenie: zero doświadczenia, pierwsze zderzenie z hostingiem, domeną i weryfikacją wizytówki]. Obietnica krótsza od możliwości to jedyny sposób, żeby spalić pierwszego klienta.

**Co robisz, gdy nie zdążasz — trzy zasady:**

1. **Zgłaszasz się w połowie terminu, nie w dniu terminu.** Piątego dnia z dziesięciu wiesz już, czy zdążysz. Klient poinformowany w połowie widzi człowieka, który panuje nad robotą. Klient poinformowany w dniu odbioru widzi wymówkę.
2. **Podajesz nową datę dzienną, nie „za kilka dni".**
3. **Sam nazywasz konsekwencję, zanim on o nią zapyta.** To jest jedyny moment, w którym rabat jest dobrym narzędziem — nie w negocjacji ceny, tylko w naprawie własnego błędu.

Gotowy tekst (SMS albo telefon, nie mail — mail wygląda na chowanie się):

```
Panie [IMIĘ], dzwonię z wyprzedzeniem, żeby Pan nie czekał.
Umawialiśmy się na czwartek 17-go. Nie zdążę - zdjęcia z warsztatu
wymagały więcej roboty, niż zakładałem, i wolę oddać dobrze
niż na czas.

Nowy termin: wtorek 22-go, do południa. To jest data, nie widełki.

Za obsunięcie: pierwszy miesiąc opieki jest u mnie gratis,
nic Pan za to nie płaci i nie musi Pan o to prosić.
```

## P5. Gwarancja — wersja do wyegzekwowania

Stara wersja („jak się nie spodoba, nie płacisz") nie miała ani liczby poprawek, ani kryteriów odbioru, ani terminu na zastrzeżenia — czyli klient mógł ją naciągać w nieskończoność, a Ty nie miałeś czym się bronić. Nowa wersja (już wdrożona na stronie, pełny zapis umowny w D9 § 4):

**Cztery mechanizmy, które ją domykają:**
1. **Punkt odniesienia:** szkic zatwierdzony mailem przed startem (lista sekcji + teksty + wybrane zdjęcia). Gwarancja dotyczy zgodności z tym szkicem, nie z nastrojem klienta.
2. **Dwie rundy poprawek w cenie**, każda zgłoszona **jednym** mailem z listą.
3. **5 dni roboczych** od przekazania linku na zgłoszenie zastrzeżeń. Brak zgłoszenia = odbiór milczący.
4. **Sześć mierzalnych kryteriów odbioru** — sprawdzacie je razem, przy kliencie: adres z kłódką HTTPS; wynik PageSpeed Insights dla telefonu **≥ 80**; formularz dostarcza testowe zgłoszenie na wskazany adres; numer telefonu klikalny na telefonie; wszystkie zatwierdzone sekcje obecne; teksty zgodne z zatwierdzonymi.

**Co się dzieje przy odstąpieniu:** klient nie płaci drugiej raty, strona jest zdejmowana w 24 h, prawa autorskie nie przechodzą, zdjęcia wracają do klienta, **zaliczka 745 zł zostaje u Ciebie jako zapłata za wykonaną pracę**. To zdanie musi paść w rozmowie i stać w umowie — bez niego gwarancja jest darmową opcją dla klienta i pułapką dla Ciebie.

## P6. Wizytówka Google — poprawione zdanie w mailu z D5.4

Zdanie „Trwa to kwadrans" było nieprawdziwe i sprawdzalne. Zastąp cały akapit tym:

```
Jedna rzecz, którą można zrobić samemu i za darmo, jeszcze w tym tygodniu:
zgłosić się po swoją wizytówkę w Mapach Google. Wchodzi się na
google.com/business, klika "Zarządzaj teraz", wpisuje nazwę firmy
i składa wniosek - to jest kwestia kwadransa.

Potem Google sprawdza, że firma faktycznie jest Państwa: kodem wysłanym
pocztą na adres firmy, telefonem albo krótkim nagraniem wideo z warsztatu.
Ten etap potrafi zająć od kilku dni do kilku tygodni i nie zależy ani
ode mnie, ani od Państwa. Warto złożyć wniosek teraz właśnie dlatego,
że czekanie zaczyna się od dnia złożenia.
```

---

# D7 — WDROŻENIE TECHNICZNE, KLIK PO KLIKU

> **Kod jest w pliku `strona-agencji/index.html`** — jeden plik, 518 linii, zero frameworków, zero bibliotek, zero czcionek z zewnątrz, zero ciasteczek. Cały wygląd (CSS) i całe działanie (JavaScript) siedzą w środku tego samego pliku. Nie przepisujesz kodu z tego dokumentu — otwierasz gotowy plik. Zawiera wszystkie 11 sekcji z D6, przebudowany cennik z P3, poprawioną gwarancję z P5, politykę prywatności jako sekcję i komunikat po wysłaniu formularza.

## 7.0 Stack — co dokładnie i ile kosztuje

| Element | Narzędzie | Co darmowe | Gdzie limit | Co po przekroczeniu | Kiedy realnie zapłacisz |
|---|---|---|---|---|---|
| Hosting | **Netlify** (`netlify.com`) | Darmowy plan: publikacja strony, HTTPS, subdomena `*.netlify.app`, własna domena | [DANE] 100 GB transferu/mies. i 300 minut budowania/mies. na planie darmowym. **Zweryfikuj aktualne progi na `netlify.com/pricing` — dostawcy je zmieniają** | Strona nie znika; Netlify prosi o przejście na plan płatny | Przy stronie wizytówkowej [SZACUNEK] nigdy w pierwszym roku — 100 GB to dziesiątki tysięcy odsłon |
| Formularz | **Netlify Forms** (wbudowane) | [DANE] 100 zgłoszeń/miesiąc na planie darmowym. **Zweryfikuj na stronie cennika** | 100 zgłoszeń | Kolejne zgłoszenia nie są zapisywane | Przy 100 zgłoszeniach miesięcznie masz już 5 klientów i to jest dobry problem |
| HTTPS | **Let's Encrypt przez Netlify** | W pełni, automatycznie | brak | — | nigdy |
| Domena na start | **subdomena `*.netlify.app`** | W pełni | brak | — | — |
| Domena własna `.pl` | rejestrator domen (np. `nazwa.pl`, `home.pl`, `ovh.pl`) | **nic — to jedyny płatny element** | — | — | **Kupujesz z pieniędzy pierwszego klienta.** [SZACUNEK] 10–60 zł za pierwszy rok w promocji, [SZACUNEK] 80–150 zł za odnowienie. **Sprawdź ceny bezpośrednio u trzech rejestratorów w dniu zakupu** |
| Kompresja zdjęć | **Squoosh** (`squoosh.app`) | W pełni, działa w przeglądarce | brak | — | nigdy |
| Edytor kodu | **Notatnik** (Windows) / **TextEdit** (Mac) | W pełni | — | — | nigdy |

## 7.1 Krok 1 — podmiana ośmiu pól w pliku (15 minut)

**CO:** wstawić swoje dane w miejsce ośmiu znaczników.
**JAK:**
1. Kliknij plik `index.html` **prawym** przyciskiem myszy → `Otwórz za pomocą` → `Notatnik`. (Nie klikaj dwa razy lewym — otworzy się przeglądarka, a w niej nie da się nic zmienić.)
2. Naciśnij **Ctrl+H** (Mac: Cmd+F, potem `Replace`). Otworzy się okienko z dwoma polami: `Znajdź` i `Zamień na`.
3. Podmieniasz kolejno osiem znaczników. Po każdym klikasz **`Zamień wszystko`**:

| Znajdź | Zamień na | Przykład |
|---|---|---|
| `[[IMIE_NAZWISKO]]` | Twoje imię i nazwisko | `Marcin Nowak` |
| `[[MIASTO]]` | Twoje miasto | `Ostrów Mazowiecka` |
| `[[TELEFON]]` | numer do wyświetlenia | `512 000 111` |
| `[[TELEFON_LINK]]` | ten sam numer bez spacji, z `+48` | `+48512000111` |
| `[[EMAIL]]` | Twój adres e-mail | `marcin@nowak-strony.pl` |
| `[[ADRES]]` | miasto i kod pocztowy | `07-300 Ostrów Mazowiecka` |
| `[[DOMENA]]` | adres strony bez `https://` | `nowak-strony.pl` |
| `[[DANE_FIRMY]]` | **przed CEIDG:** `Działalność nierejestrowana` — **po CEIDG:** `NIP 123-456-78-90` | |
4. Zapisz: **Ctrl+S**.
5. **Ekran po poprawnym wykonaniu:** naciśnij Ctrl+F i wpisz `[[`. Notatnik ma odpowiedzieć „Nie można odnaleźć". Jeśli coś znajdzie — został niepodmieniony znacznik.

**PO CO:** bo w pliku są miejsca, których nie mogłem wypełnić za Ciebie — Twoje nazwisko, numer i adres. Znaczniki w podwójnych nawiasach kwadratowych są celowo brzydkie, żeby żaden nie przeszedł niezauważony na żywą stronę.

> **Adres:** wpisz **kod pocztowy i miasto, bez ulicy i numeru domu**, jeśli pracujesz z mieszkania. RODO wymaga podania danych kontaktowych administratora, a nie adresu zamieszkania — e-mail i telefon to spełniają. Pełny adres podajesz dopiero w umowie z klientem.

## 7.2 Krok 2 — Twoje zdjęcie (10 minut)

**CO:** wstawić prawdziwe zdjęcie swojej twarzy do sekcji „Kto to robi".
**JAK:**
1. Poproś kogoś o zrobienie Ci zdjęcia telefonem: **stań bokiem do okna, twarzą do fotografa, patrz w obiektyw**. Bez garnituru. Kadr od klatki piersiowej w górę.
2. Wejdź na `squoosh.app`. Przeciągnij zdjęcie na środek ekranu.
3. Po prawej stronie w polu `Resize` zaznacz kwadracik i wpisz szerokość **640**.
4. Poniżej, w polu z formatem, wybierz **MozJPEG**, suwak `Quality` ustaw na **75**.
5. Na dole po prawej kliknij niebieską strzałkę pobierania. **Ekran po poprawnym wykonaniu:** przy strzałce widnieje rozmiar pliku i procent redukcji — celujesz **poniżej 120 kB**.
6. Zmień nazwę pobranego pliku na dokładnie **`zdjecie.jpg`** (małe litery, bez polskich znaków) i przenieś go do tego samego folderu, w którym leży `index.html`.

**PO CO:** zdjęcie prosto z aparatu waży 4–8 MB i na telefonie w warsztacie ładuje się kilkanaście sekund — człowiek wyjdzie, zanim je zobaczy. To samo zdjęcie po kompresji waży 100 kB i ładuje się natychmiast, a różnicy nie widać gołym okiem.

> **Ta sama procedura obowiązuje dla każdego zdjęcia kuchni od klienta.** Reguła: **żaden plik graficzny na stronie nie może przekraczać 200 kB.** Szerokość 1600 px dla zdjęć galerii, jakość 75.

## 7.3 Krok 3 — od pustego ekranu do żywej strony (12 minut)

**CO:** opublikować stronę w internecie.
**JAK:**
1. Wejdź na `app.netlify.com/drop`.
2. Zobaczysz duży przerywany prostokąt z napisem o przeciąganiu plików.
3. Otwórz folder ze stroną. **Zaznacz sam folder** (ten, w którym są `index.html` i `zdjecie.jpg`) i **przeciągnij go myszą na ten prostokąt**. Puść.
4. Poczekaj 20–40 sekund. **Ekran po poprawnym wykonaniu:** zielony napis i adres w rodzaju `https://random-slowa-12345.netlify.app`. **Twoja strona jest już w internecie i już ma HTTPS.**
5. Kliknij ten adres. Sprawdź, czy widzisz swoją stronę i swoje zdjęcie.
6. Netlify poprosi o założenie konta, żeby stronę zachować — załóż je adresem Gmail. Bez konta strona zniknie po kilku godzinach.
7. Zmień brzydki adres: w panelu Netlify wejdź w `Site configuration` → `Change site name` → wpisz np. `nowak-strony`. Adres zmieni się na `https://nowak-strony.netlify.app`.

**PO CO:** bo to jest cały hosting i cały HTTPS w jednym ruchu myszą, za darmo. („Hosting" to wynajęty komputer, który trzyma Twoją stronę włączoną 24 godziny na dobę — jak lokal, w którym stoi Twój towar. „HTTPS" to szyfrowane połączenie — jak zaklejona koperta zamiast pocztówki; bez niego przeglądarka wypisuje odwiedzającym ostrzeżenie.)

## 7.4 Krok 4 — sprawdzenie formularza (5 minut)

**CO:** upewnić się, że zgłoszenia do Ciebie docierają.
**JAK:**
1. Wejdź na swoją stronę, przewiń na sam dół, wypełnij formularz swoimi danymi, zaznacz zgodę i wyślij.
2. **Ekran po poprawnym wykonaniu:** strona przeładuje się i pokaże ramkę „Mam. Sprawdzę Twoją firmę w ciągu 24 godzin".
3. W panelu Netlify wejdź w zakładkę **`Forms`** → `audyt`. Twoje testowe zgłoszenie ma tam być.
4. **Włącz powiadomienia — bez tego zgłoszenia leżą, a Ty o nich nie wiesz:** `Forms` → `Form notifications` → `Add notification` → `Email notification` → wpisz swój adres → `Save`.
5. Wyślij drugie zgłoszenie testowe i sprawdź skrzynkę. **Zajrzyj też do spamu i oznacz wiadomość jako „nie spam".**

**PO CO:** formularz, który nie powiadamia, jest gorszy niż brak formularza — klient myśli, że się zgłosił, a Ty nie wiesz o jego istnieniu. To jest najczęstsza awaria stron wizytówkowych.

## 7.5 Krok 5 — własna domena (15 minut, pierwszy wydatek)

Robisz to **dopiero po wpłynięciu pierwszej zaliczki**. Do tego czasu adres `.netlify.app` w zupełności wystarcza — na wizycie i tak podajesz numer telefonu, nie adres strony.

**CO:** podpiąć kupioną domenę pod stronę.
**JAK:**
1. Kup domenę u dowolnego polskiego rejestratora. Wybierz `imienazwisko-strony.pl` albo `stronydlastolarzy.pl`. Unikaj myślników więcej niż jednego i cyfr.
2. W panelu Netlify: `Domain management` → `Add a domain` → wpisz kupioną domenę → `Verify` → `Add domain`.
3. Netlify wyświetli **cztery adresy serwerów nazw** w rodzaju `dns1.p01.nsone.net`. Zaznacz je i skopiuj (Ctrl+C).
4. Zaloguj się do panelu rejestratora, u którego kupiłeś domenę. Znajdź sekcję **`Serwery DNS`** albo `Serwery nazw` albo `Nameservery`. Wybierz opcję `własne serwery DNS` i wklej te cztery adresy, każdy w osobne pole. Zapisz.
5. Czekasz. **Zmiana rozchodzi się po świecie od kilku minut do 24 godzin** [DANE — tak działa system DNS].
6. **Ekran po poprawnym wykonaniu:** w Netlify przy domenie pojawia się zielony napis `Netlify DNS` i osobny wpis `HTTPS — certificate active`. Wpisz swoją domenę w przeglądarkę: ma otworzyć się Twoja strona, z kłódką przy adresie.

**PO CO:** („DNS" to książka telefoniczna internetu — zamienia nazwę `nowak-strony.pl` na adres komputera, który trzyma Twoją stronę. Zmiana serwerów DNS to przepisanie numeru w tej książce; dlatego świat potrzebuje chwili, żeby o tym usłyszeć.) Własna domena `.pl` jest jedynym elementem, który klient oceni od razu — stolarz z domeną `.pl` nie kupi strony od kogoś z adresem `.netlify.app`.

## 7.6 Aktualizacja strony później

Poprawiasz plik `index.html` w Notatniku, zapisujesz, wchodzisz w Netlify → zakładka `Deploys` → przeciągasz folder na pole `Drag and drop your site output folder here`. Nowa wersja jest na żywo w 30 sekund. Stara wersja zostaje w historii i można do niej wrócić jednym kliknięciem.

**SPRAWDŹ, ŻE JEST DOBRZE:** siedem testów, wszystkie muszą przejść. (1) Wpisz w Notatniku Ctrl+F `[[` — nic nie znajduje. (2) Otwórz stronę na telefonie — nie musisz nic powiększać palcami. (3) Przy adresie jest kłódka. (4) Wyślij testowe zgłoszenie — przychodzi mail. (5) Kliknij numer telefonu na telefonie — uruchamia dzwonienie. (6) Wejdź na `pagespeed.web.dev`, wklej adres swojej strony, zakładka `Telefon` — **wynik ma być 90 lub więcej**; jeśli jest niżej, winne jest zdjęcie: skompresuj je jeszcze raz. (7) Podaj telefon trzem obcym osobom na 5 sekund i zadaj trzy pytania z testu 5 sekund z D6.5.

---

# D8 — SEO STRONY I SEO LOKALNE

**Pojęcie na start: SEO** to zestaw czynności, które sprawiają, że Google pokazuje Twoją stronę wyżej, gdy ktoś czegoś szuka. To nie jest przycisk ani opłata — to jest sprzątanie i uzupełnianie, powtarzane co miesiąc. **Indeksacja** to moment, w którym Google w ogóle dowiaduje się, że Twoja strona istnieje, i wpisuje ją do swojego spisu — dopóki nie jest zaindeksowana, nie może się pokazać nigdzie.

## 8.1 Tytuł, opis i nagłówki — dla strony klienta (stolarza)

**Tytuł strony** (to, co widać w wynikach Google jako niebieski, klikalny napis): 50–60 znaków, zaczyna się od usługi, kończy nazwą firmy.

```
Kuchnie na wymiar Ostrów Mazowiecka | DREWNOSTYL
Meble na wymiar Ostrów Mazowiecka — kuchnie, szafy | DREWNOSTYL
```

**Opis** (szary tekst pod tytułem w wynikach): 140–158 znaków, musi zawierać miasto, konkret i wezwanie. Opis **nie wpływa na pozycję**, ale wpływa na to, czy ktoś kliknie.

```
Projektujemy i wykonujemy kuchnie, szafy wnękowe i zabudowy na wymiar
w Ostrowi Mazowieckiej i okolicy. Bezpłatny pomiar. Zobacz 40 realizacji.
```

**Nagłówki** — dokładnie jedna sztuka H1 na stronie, reszta H2:

```
H1:  Kuchnie i szafy na wymiar — Ostrów Mazowiecka i okolice
H2:  Nasze realizacje
H2:  Jak wygląda zamówienie krok po kroku
H2:  Ile kosztuje kuchnia na wymiar
H2:  Gdzie pracujemy
H2:  Kontakt i bezpłatny pomiar
```

Zasada, którą łamie większość: **H1 nie jest logo ani nazwą firmy.** H1 mówi, co robisz i gdzie.

## 8.2 Dane strukturalne

**Dane strukturalne** to notatka dla Google ukryta w kodzie strony, napisana w formacie, który maszyna czyta bez zgadywania — jak metryczka przyklejona z tyłu obrazu. Dzięki niej Google wie, że „DREWNOSTYL" to firma stolarska w Ostrowi Mazowieckiej, a nie przypadkowe słowo.

W pliku agencji taka notatka już jest (na samym dole `index.html`). **Dla strony klienta wklejasz tuż przed `</body>` to:**

```html
<script type="application/ld+json">
{
  "@context":"https://schema.org",
  "@type":"FurnitureStore",
  "name":"DREWNOSTYL Meble na Wymiar",
  "description":"Kuchnie, szafy wnękowe i zabudowy na wymiar.",
  "url":"https://drewnostyl-meble.pl/",
  "telephone":"+48500100200",
  "image":"https://drewnostyl-meble.pl/realizacje/kuchnia-01.jpg",
  "address":{
    "@type":"PostalAddress",
    "streetAddress":"ul. Warsztatowa 5",
    "addressLocality":"Ostrów Mazowiecka",
    "postalCode":"07-300",
    "addressCountry":"PL"
  },
  "areaServed":["Ostrów Mazowiecka","Małkinia Górna","Wyszków","Ostrołęka"],
  "openingHoursSpecification":{
    "@type":"OpeningHoursSpecification",
    "dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens":"07:00","closes":"16:00"
  }
}
</script>
```

Sprawdzenie: wejdź na `search.google.com/test/rich-results`, wklej adres strony, kliknij `Testuj adres URL`. **Ekran po poprawnym wykonaniu:** zielony napis i wykryty typ elementu, zero błędów.

## 8.3 Mapa witryny i plik robots

**Mapa witryny** (`sitemap.xml`) to spis wszystkich podstron — jak spis treści oddany bibliotekarzowi. Przy stronie jednostronicowej jest to plik na sześć linijek. Utwórz w Notatniku plik `sitemap.xml` obok `index.html`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://drewnostyl-meble.pl/</loc>
    <lastmod>2026-09-02</lastmod>
  </url>
</urlset>
```

Drugi plik, `robots.txt`, w tym samym miejscu:

```
User-agent: *
Allow: /
Sitemap: https://drewnostyl-meble.pl/sitemap.xml
```

Potem: `search.google.com/search-console` → `Dodaj zasób` → `Prefiks adresu URL` → wklej adres → potwierdź własność metodą „plik HTML" albo „znacznik HTML" → w menu po lewej `Mapy witryn` → wpisz `sitemap.xml` → `Prześlij`. Następnie w górnym pasku wklej adres strony i kliknij **`Poproś o zindeksowanie`**.

**PO CO:** bez tego Google znajdzie nową stronę [SZACUNEK] w ciągu kilku tygodni. Z tym — zwykle w ciągu kilku dni. **Zweryfikuj u siebie: zapisz datę zgłoszenia i sprawdzaj co drugi dzień, wpisując w Google `site:drewnostyl-meble.pl`.** Gdy strona się pojawi — masz swoją prawdziwą liczbę zamiast mojego szacunku.

## 8.4 Wizytówka Google — krok po kroku

To jest **najważniejszy pojedynczy element całej usługi** dla firmy lokalnej i to on sprzedaje abonament.

1. Wejdź na `google.com/business`, zaloguj się kontem Gmail **klienta** (nie swoim — wizytówka ma należeć do niego; Ty dostajesz dostęp jako menedżer).
2. Wpisz nazwę firmy. Jeśli podpowie się istniejąca wizytówka — wybierz ją i kliknij **`Zarządzaj tą firmą`** albo **`Przejmij`**.
3. Kategoria główna: **`Producent mebli na zamówienie`** albo `Stolarz` — wybierz tę, która najlepiej opisuje główną robotę. Kategorie dodatkowe: `Sklep meblowy`, `Usługi stolarskie`.
4. Adres: **jeśli klient przyjmuje w warsztacie — podaj adres.** Jeśli tylko dojeżdża — zaznacz `Obsługuję klientów w ich lokalizacji` i wpisz obszar działania (miasta w promieniu 40 km).
5. Godziny otwarcia, numer telefonu, adres strony.
6. **Weryfikacja.** Google sprawdza, że firma jest jego: kodem pocztą, telefonem albo nagraniem wideo z warsztatu. **Trwa od kilku dni do kilku tygodni i nie zależy od Ciebie** (patrz P6). Nagranie wideo jest zwykle najszybsze — trzeba na nim pokazać warsztat, narzędzia i dokument firmowy w jednym ujęciu, bez cięć.
7. Po weryfikacji, w kolejności: **20 zdjęć realizacji** (nie logo, nie wizytówki — kuchnie), opis firmy na 750 znaków z nazwą miasta w pierwszym zdaniu, wpisanie wszystkich usług, godziny.
8. **Opinie.** Ustal z klientem prosty tekst SMS-a, który wysyła każdemu odbierającemu kuchnię:

```
Panie Tomaszu, dziękuję za zaufanie. Gdyby zabudowa się sprawdzała,
bardzo pomoże mi krótka opinia w Google - to jeden klik:
[LINK]
Jeśli coś jest nie tak, proszę najpierw dzwonić do mnie.
```
Link bierzesz z panelu wizytówki: `Poproś o opinie` → `Skopiuj link`.

> **Nie kupuj opinii i nie pisz ich sam.** To jest ściema z §5.4, Google to wykrywa i kasuje całe wizytówki, a w małym mieście klienci rozpoznają zmyśloną opinię szybciej niż algorytm.

## 8.5 Dwadzieścia fraz dla niszy — z podziałem na łatwe i trudne

Podział na łatwe i trudne to **[SZACUNEK]** oparty na jednej zasadzie: im więcej słów i im mniejsza miejscowość, tym mniejsza konkurencja. **Zweryfikuj przed sprzedażą** — załóż darmowe konto w Google Ads (bez uruchamiania i opłacania kampanii), wejdź w `Narzędzia` → `Planer słów kluczowych` → `Poznaj liczbę wyszukiwań`, wklej całą listę naraz i ustaw lokalizację na województwo klienta. Dostaniesz prawdziwe liczby wyszukiwań w minutę.

**ŁATWE — realne do zdobycia w 3–6 miesięcy przy jednej stronie i wizytówce** [SZACUNEK]

| # | Fraza | Dlaczego łatwa |
|---|---|---|
| 1 | `kuchnie na wymiar [małe miasto]` | mała miejscowość, mało firm z własną stroną |
| 2 | `szafy wnękowe [małe miasto]` | węższa usługa, mniej konkurencji niż kuchnie |
| 3 | `zabudowa wnęki na wymiar [miasto]` | długa fraza, prawie nikt jej nie opisuje |
| 4 | `garderoba na wymiar [miasto]` | nisza w niszy |
| 5 | `meble łazienkowe na wymiar [miasto]` | rzadko obsługiwane osobno |
| 6 | `stolarz meblowy [miasto]` | ludzie szukają rzemieślnika, nie „firmy" |
| 7 | `zabudowa skosów poddasze [miasto]` | bardzo konkretna potrzeba, wysoka intencja zakupu |
| 8 | `kuchnie na wymiar [nazwa dzielnicy lub gminy obok]` | miejscowości satelickie prawie nikt nie opisuje |
| 9 | `meble na wymiar cennik [miasto]` | pytanie o cenę = klient blisko decyzji |
| 10 | `pomiar kuchni za darmo [miasto]` | fraza usługowa, praktycznie bez konkurencji |
| 11 | `szafa przesuwna na wymiar [miasto]` | konkretny produkt |
| 12 | `meble kuchenne na zamówienie [miasto]` | wariant sformułowania, którego konkurencja nie używa |

**TRUDNE — nie obiecuj ich klientowi w pierwszym roku** [SZACUNEK]

| # | Fraza | Dlaczego trudna |
|---|---|---|
| 13 | `meble na wymiar` (bez miasta) | cała Polska, walczą z tym duże firmy z budżetami |
| 14 | `kuchnie na wymiar Warszawa` (lub inne miasto wojewódzkie) | dziesiątki firm z historią i budżetem |
| 15 | `kuchnie na wymiar cena` | ogólnopolska, zdominowana przez porównywarki i portale |
| 16 | `meble na wymiar sklep internetowy` | inny model biznesowy, nie do wygrania stroną wizytówkową |
| 17 | `projekt kuchni online` | konkurencja to producenci oprogramowania |
| 18 | `kuchnie na wymiar opinie` | wyniki zajęte przez portale z opiniami |
| 19 | `tanie meble na wymiar` | przyciąga klientów, których i tak nie chcesz |
| 20 | `meble na wymiar producent` | fraza hurtowa, szuka jej branża, nie klient końcowy |

**Zasada, którą mówisz klientowi wprost:** pracujesz na frazach 1–12, a fraz 13–20 nie obiecujesz nigdy. Obietnica „będzie Pan pierwszy na meble na wymiar" to najkrótsza droga do utraty abonamentu w trzecim miesiącu.

## 8.6 Pierwsze linki za 0 zł

**Link (backlink)** to odnośnik do Twojej strony postawiony na cudzej stronie. Google traktuje go jak głos oddany na Ciebie — im bardziej wiarygodna strona głosuje, tym więcej ten głos waży.

Kolejność, w jakiej je zdobywasz — od najpewniejszego:

| # | Skąd | Jak dokładnie | Ile trwa |
|---|---|---|---|
| 1 | **Wizytówka Google** | pole `Strona internetowa` w panelu wizytówki | 2 min |
| 2 | **Profil na Facebooku** | Informacje → Strona internetowa | 3 min |
| 3 | **Katalogi firm: `panoramafirm.pl`, `pkt.pl`, `aleo.com`** | darmowa rejestracja firmy, w każdym wpisujesz **identyczną** nazwę, adres i telefon | 20 min łącznie |
| 4 | **`oferteo.pl`, `fixly.pl`** | darmowy profil wykonawcy z linkiem do strony | 20 min |
| 5 | **Lokalny portal informacyjny** | napisz do redakcji z konkretem: zdjęcia nietypowej realizacji + zdanie o firmie. Portale w małych miastach chętnie biorą lokalne treści | 30 min + czekanie |
| 6 | **Cech rzemiosł / izba rzemieślnicza w powiecie** | jeśli klient jest członkiem — spis firm członkowskich zawiera linki | 15 min |
| 7 | **Dostawcy i partnerzy** | producent blatów, hurtownia płyt, montażysta AGD, glazurnik, z którym pracuje — wzajemne wymienienie się na stronach „Współpracujemy z" | 30 min na kontakt |
| 8 | **Grupy na Facebooku** | link wklejony **wyłącznie** w odpowiedzi na czyjeś pytanie, nigdy w oderwanym poście | na bieżąco |

> **Czego NIE robisz nigdy:** nie kupujesz linków, nie wklejasz adresu w komentarzach pod cudzymi artykułami, nie rejestrujesz się w 200 katalogach naraz. To są sygnały, po których Google obniża stronę — a Ty nie masz drugiej domeny na wypadek pomyłki.

**Jedna zasada ważniejsza od wszystkich linków razem: NAP.** Nazwa, adres i telefon (ang. *Name, Address, Phone*) muszą być **identyczne co do znaku** we wszystkich miejscach. `ul. Warsztatowa 5` w jednym miejscu i `Warsztatowa 5` w drugim to dla Google potencjalnie dwie różne firmy. Zrób w arkuszu jedną komórkę z wzorcowym NAP i kopiuj ją wszędzie.

**SPRAWDŹ, ŻE JEST DOBRZE:** (1) Wpisz w Google `site:` i adres strony — strona ma być na liście. (2) Test wyników z elementami rozszerzonymi (`search.google.com/test/rich-results`) — zero błędów. (3) Wizytówka ma status zweryfikowanej, minimum 20 zdjęć i uzupełnione wszystkie pola. (4) Twój wzorcowy NAP występuje w minimum 5 miejscach w internecie, wszędzie tak samo. (5) Po 30 dniach od publikacji w Search Console w zakładce `Wyniki wyszukiwania` widać niezerową liczbę wyświetleń — to jest dowód, że strona żyje, i to jest liczba, którą pokazujesz klientowi w pierwszym raporcie.

---

# D9 — OFERTA, CENNIK I WARUNKI PŁATNOŚCI

## 9.1 Trzy pakiety jednorazowe

| | **START** | **STANDARD** | **KOMPLET** |
|---|---|---|---|
| **Cena** | **1 490 zł** | **2 900 zł** | **3 900 zł** |
| Etykieta na stronie | „Od tego zaczyna 9 na 10 warsztatów" | *brak — wabik się nie reklamuje* | „Najwięcej za złotówkę" |
| Strona | 1 strona z galerią | + 3 podstrony | + 3 podstrony |
| Zdjęcia | do 15 | do 30 | do 30 |
| Teksty pod miasta | 1 | 3 | 3 |
| Wizytówka Google | tak | tak | tak |
| Opisy do Map/FB/OLX/Oferteo | — | — | **tak** |
| Nagranie wideo „jak dodać zdjęcie" | — | — | **tak** |
| Opieka w cenie | — | — | **1 miesiąc (390 zł)** |
| Termin | 10 dni rob. (od 4. klienta: 7) | 15 dni rob. | **5 dni rob.** |
| Rundy poprawek | 2 | 2 | 3 |
| **Twoje godziny** [SZACUNEK] | 8,0 h | 15,0 h | 17,0 h |
| **Twoja stawka** | 186 zł/h | 193 zł/h | **229 zł/h** |

**Jak działa kotwica:** nad cennikiem na stronie stoi zdanie o cenach agencyjnych 6 000–12 000 zł [SZACUNEK — **nie podawaj tego jako pewnika; zdanie na stronie zawiera instrukcję sprawdzenia i klient może to zrobić w minutę**]. Pierwsza liczba, którą widzi klient, jest cudza i wysoka. Twoja 1 490 zł ląduje pod nią.

**Jak działa wabik:** STANDARD za 2 900 zł jest jawnie gorszy od KOMPLETU za 3 900 zł — za 1 000 zł różnicy klient dostaje priorytet w kolejce, komplet gotowych opisów i miesiąc opieki. Klient, który waha się między pakietami, wybiera KOMPLET i **płacisz za to 2 godzinami pracy**, nie sześcioma miesiącami.

## 9.2 Abonamenty

| | OPIEKA | WIDOCZNOŚĆ | WZROST+ |
|---|---|---|---|
| **Cena** | **390 zł/mies.** | **690 zł/mies.** | **1 190 zł/mies.** |
| Hosting, kopie zapasowe, certyfikat | ✔ | ✔ | ✔ |
| Poprawki treści | ✔ | ✔ | ✔ |
| Prowadzenie wizytówki (zdjęcia, posty, odpowiedzi na opinie) | ✔ | ✔ | ✔ |
| Praca nad pozycją w Google + raport miesięczny | — | ✔ | ✔ |
| Dwie nowe podstrony miesięcznie | — | — | ✔ |
| **Sufit mojej pracy** | **1,5 h** | **3,0 h** | **6,0 h** |
| **Moja stawka** | 260 zł/h | 230 zł/h | 198 zł/h |

Start: **31. dnia po odbiorze strony**, automatycznie, na podstawie tej samej umowy. Wypowiedzenie: w każdej chwili, z zachowaniem miesięcznego okresu, bez kar.

## 9.3 Dlaczego abonament jest ważniejszy od jednorazówki — liczby

| Scenariusz A: tylko jednorazówki | Scenariusz B: jednorazówki + abonament |
|---|---|
| Miesiąc 1: 2 × START = 2 980 zł | Miesiąc 1: 2 × START = 2 980 zł |
| Miesiąc 2: 2 × START = 2 980 zł | Miesiąc 2: 2 × START + 2 × 390 = **3 760 zł** |
| Miesiąc 6: 2 × START = 2 980 zł | Miesiąc 6: 2 × START + 10 × 390 = **6 880 zł** |
| Miesiąc 12: 2 × START = 2 980 zł | Miesiąc 12: 2 × START + 20 × 390 = **10 780 zł** |
| **Miesiąc, w którym przestajesz sprzedawać: 0 zł** | **Miesiąc, w którym przestajesz sprzedawać: 7 800 zł** |

[SZACUNEK — założenie: 2 sprzedaże miesięcznie, zero rezygnacji z abonamentu. Realnie część klientów zrezygnuje; **licz z odejściem 1 na 10 rocznie i i tak wychodzi kilkukrotnie lepiej**.]

Zdanie do powiedzenia klientowi: *„Strona bez opieki po pół roku przestaje działać albo przestaje być aktualna, a Pan się o tym dowiaduje od klienta, który nie mógł się dodzwonić. Trzysta dziewięćdziesiąt miesięcznie to jest cena tego, żeby Pan się o tym nie dowiadywał."*

## 9.4 Zapis gwarancji do umowy (punkt § 4)

```
§ 4. ODBIÓR I GWARANCJA ZADOWOLENIA

1. Przed rozpoczęciem prac Zamawiający zatwierdza pocztą elektroniczną
   szkic strony, obejmujący: listę sekcji, treść tekstów oraz listę
   wybranych zdjęć. Zatwierdzony szkic stanowi wyłączny punkt odniesienia
   dla oceny zgodności wykonanej strony z zamówieniem.

2. Wykonawca przekazuje Zamawiającemu link do gotowej strony.
   Zamawiającemu przysługują dwie rundy poprawek w cenie
   (w pakiecie KOMPLET - trzy). Każda runda zgłaszana jest w jednej
   wiadomości e-mail zawierającej pełną listę uwag.

3. Zamawiający ma 5 dni roboczych od dnia przekazania linku
   na zgłoszenie zastrzeżeń. Brak zgłoszenia w tym terminie oznacza
   odbiór strony bez zastrzeżeń.

4. Odbiór następuje po łącznym spełnieniu sześciu warunków,
   sprawdzanych wspólnie przez Strony:
   a) strona otwiera się pod uzgodnionym adresem z aktywnym
      certyfikatem HTTPS;
   b) wynik narzędzia Google PageSpeed Insights dla wersji mobilnej
      wynosi co najmniej 80 punktów;
   c) formularz kontaktowy dostarcza wiadomość testową na adres
      wskazany przez Zamawiającego;
   d) numer telefonu jest aktywnym odnośnikiem na urządzeniu mobilnym;
   e) strona zawiera wszystkie sekcje ze szkicu zatwierdzonego
      zgodnie z ust. 1;
   f) treści na stronie są zgodne z treściami zatwierdzonymi
      zgodnie z ust. 1.

5. Jeżeli po wykorzystaniu rund poprawek Zamawiający nie akceptuje
   strony, może odstąpić od umowy w terminie 3 dni roboczych.
   W takim przypadku:
   a) Zamawiający nie płaci drugiej raty wynagrodzenia;
   b) zaliczka pozostaje u Wykonawcy jako wynagrodzenie za pracę
      już wykonaną;
   c) Wykonawca usuwa stronę w ciągu 24 godzin;
   d) autorskie prawa majątkowe do strony nie przechodzą
      na Zamawiającego;
   e) Wykonawca zwraca materiały przekazane przez Zamawiającego.

6. Gwarancja z ust. 5 nie obejmuje: zmiany koncepcji strony
   po zatwierdzeniu szkicu, dodania sekcji nieujętych w szkicu,
   zmian zgłoszonych po odbiorze oraz braku efektów marketingowych,
   które nie są przedmiotem tej umowy.
```

## 9.5 Warunki płatności

| Element | Ustalenie |
|---|---|
| **Zaliczka** | **50% ceny pakietu, przed rozpoczęciem prac.** Bez wyjątków, także dla znajomych i „pewniaków". Nie zaczynasz projektu, dopóki przelew nie jest na koncie — nie „dopóki obiecał" |
| **Druga rata** | 50%, płatne **w ciągu 7 dni od odbioru** |
| **Abonament** | z góry, do 10. dnia miesiąca, za miesiąc bieżący |
| **Forma dokumentu** | rachunek (działalność nierejestrowana) albo faktura bez VAT (po CEIDG, przy zwolnieniu z art. 113) |
| **Termin płatności na dokumencie** | **3 dni** dla zaliczki, **7 dni** dla drugiej raty. Krótki termin jest normą u mikrofirm i nikt się nim nie obraża |
| **Metoda** | wyłącznie przelew. Zero gotówki — gotówka to brak dowodu wpłaty i problem przy ewidencji przychodu |
| **Kiedy oddajesz dostępy** | hasła do hostingu, domeny i wizytówki przekazujesz **po zapłaceniu drugiej raty**, nie wcześniej. To jest Twoje jedyne realne zabezpieczenie |

## 9.6 Co robisz, gdy klient nie zapłaci drugiej raty

Kolejność jest sztywna. Nie przeskakujesz kroków i nie robisz nic emocjonalnie.

| Dzień od terminu | Krok | Dokładnie co robisz |
|---|---|---|
| **+1** | Telefon, nie mail | *„Panie [imię], dzwonię w sprawie faktury z 12-go, termin minął wczoraj. Zakładam, że umknęło — czy wysłać jeszcze raz na inny adres?"* Zakładasz przeoczenie, bo w 9 na 10 przypadków to jest przeoczenie [SZACUNEK] |
| **+7** | Przypomnienie na piśmie | Mail z dokumentem w załączniku, jedno zdanie, bez emocji, z prośbą o podanie daty zapłaty |
| **+14** | **Wezwanie do zapłaty** | Pismo z: kwotą, numerem dokumentu, terminem 7 dni, numerem konta i zdaniem o skierowaniu sprawy na drogę sądową. Wysyłasz **mailem i listem poleconym za potwierdzeniem odbioru** — potwierdzenie odbioru jest tym, co potem liczy się w sądzie |
| **+21** | Zawieszenie usług | Wyłączasz hosting i zdejmujesz stronę. **Uprzedzasz o tym w wezwaniu z dnia +14** — nie wyłączasz bez zapowiedzi. Wizytówki Google **nie ruszasz**, bo należy do klienta |
| **+30** | Droga formalna | Elektroniczne Postępowanie Upominawcze — e-sąd (`e-sad.gov.pl`). Pozew składasz przez internet, bez prawnika. [SZACUNEK] opłata sądowa to niewielki procent wartości sporu, przy kwocie ~750 zł rzędu kilkudziesięciu złotych. **Zweryfikuj aktualną opłatę bezpośrednio na `e-sad.gov.pl` przed złożeniem** |

**Dwa uprawnienia, o których musisz wiedzieć, bo są Twoje z mocy prawa:**
1. **Odsetki ustawowe za opóźnienie w transakcjach handlowych** — należą Ci się od dnia następnego po terminie, bez wzywania. [DANE — ustawa o przeciwdziałaniu nadmiernym opóźnieniom w transakcjach handlowych. **Aktualną stawkę sprawdzisz na `gov.pl`, szukając „odsetki ustawowe za opóźnienie w transakcjach handlowych"**]
2. **Rekompensata za koszty odzyskiwania należności** — zryczałtowana kwota w euro, należna od dłużnika-przedsiębiorcy bez udowadniania kosztów. [DANE — ta sama ustawa; wysokość zależy od kwoty długu. **Sprawdź w tym samym miejscu, zanim wpiszesz ją do wezwania**]

**Reguła, która zapobiega 90% takich spraw:** dostępy po drugiej racie (9.5) i zaliczka bezwyjątkowo. Klient, który zapłacił 745 zł i ma stronę, której jeszcze nie posiada na własność, płaci resztę.

**SPRAWDŹ, ŻE JEST DOBRZE:** (1) Przelicz każdy pakiet na godziny na kartce — stawka za KOMPLET ma być **wyższa** niż za START; jeśli po Twoich zmianach w ofercie wyjdzie odwrotnie, oferta jest zepsuta i wracasz do zasady z P3. (2) Powiedz na głos cenę pakietu START i policz w myślach do pięciu, nie dodając ani słowa. (3) Sprawdź, czy kwoty w D9 zgadzają się z tymi na stronie (`index.html`, sekcja Cennik) — mają być identyczne co do złotówki: 1 490 / 2 900 / 3 900 oraz 390 / 690 / 1 190. (4) Wydrukuj § 4 i przeczytaj punkt 5 — jeśli po przeczytaniu nie wiesz dokładnie, ile pieniędzy zostaje u Ciebie przy odstąpieniu klienta, zapis jest za słaby.

---

**CIĄG DALSZY: napisz /dalej**

W Części 4: **D10** (skrypt rozmowy telefonicznej zdanie po zdaniu + 12 polskich obiekcji z gotowymi odpowiedziami), **D11** (tabela człowiek/automat, blueprint przepływu leada, brutalna lista tego, czego NIE da się zautomatyzować), **D12** (plan 30 dni dzień po dniu na 4 h, wskaźniki z wartościami docelowymi, próg opłacalności, sekcja ratunkowa „zero odpowiedzi po 14 dniach"), gotowy **szablon strony klienta** jako drugi plik HTML, bramka QA po całości, **10 błędów zabijających jednoosobowe agencje w pierwszych 90 dniach** oraz **TRZY PIERWSZE RUCHY** na najbliższe 60 minut.
