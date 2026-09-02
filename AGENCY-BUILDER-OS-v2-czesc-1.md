# AGENCY BUILDER OS v2 — CZĘŚĆ 1
**Faza 0 → Faza 4 + Deliverables D1–D3**
Data: 2026-09-02 · Nisza: pracownie mebli na wymiar · Budżet: 0 zł

---

# FAZA 0 — ZAŁOŻENIA (przyjmuję najostrożniejszy wariant, nie pytam)

| # | Czego o Tobie nie wiem | Wariant najgorszy realistyczny, który przyjmuję | Co z tego wynika dla planu |
|---|---|---|---|
| 1 | Gdzie mieszkasz | Miasto powiatowe 30–80 tys. mieszkańców, nie Warszawa/Kraków/Wrocław | Mniej firm w zasięgu → plan musi działać przy ~150 firmach w promieniu 60 km, nie przy 3000 |
| 2 | Co umiesz technicznie | Zero. Nie wiesz, co to hosting. Nigdy nie napisałeś linii kodu | Cały D7 rozpisany jako kopiuj-wklej, z opisem każdego ekranu |
| 3 | Czy masz firmę | Nie masz. Dziś **nie możesz wystawić faktury** | To jest twarda blokada Celu #1. Załatwiam ją w Dniu 1–2, przed jakimkolwiek kontaktem z klientem |
| 4 | Transport i sprzęt | Brak auta, brak drukarki. Rower/komunikacja miejska. Laptop + telefon z internetem | Kanał kontaktu musi działać w promieniu 15 km pieszo/rowerem + 1 wyjazd tygodniowo pociągiem. Audyt pokazujesz z ekranu telefonu, nie z wydruku |
| 5 | Odporność na odmowę | Najgorsza. Po 8–10 odmowach pod rząd chcesz zmienić niszę i zacząć od nowa | Plan ma dzienne limity i licznik zamiast motywacji. Zmiana kursu dozwolona TYLKO w punktach kontrolnych z D12, nie „gdy się odechce" |

Dodatkowo przyjmuję: nie masz ani jednego zdjęcia zrealizowanej strony, nie masz nikogo, kto Cię poleci, i nikt w Twoim otoczeniu nie prowadzi firmy.

---

# FAZA 1 — BRAINSTORM (dywergencja, zero oceniania)

**A1 STRATEG NISZY**
1. Pracownie mebli na wymiar (kuchnie, szafy, zabudowy), 1–5 osób.
2. Gabinety fizjoterapii i rehabilitacji jednooddziałowe.
3. Zakłady pogrzebowe w miastach do 50 tys.
4. Ośrodki szkolenia kierowców (OSK).
5. Firmy montujące ogrodzenia, bramy i balustrady.

**A2 ŁOWCA LEADÓW**
1. Google Maps ma pole „brak strony internetowej" — to gotowa lista bólu.
2. Wyszukiwarka REGON GUS pozwala filtrować firmy po kodzie PKD i powiecie.
3. Ogłoszenia OLX bez linku do strony = firma bez strony z aktywnym budżetem na reklamę.
4. Posty w grupach FB typu „mam wolne terminy od zaraz" = firma z dziurą w kalendarzu.
5. Hurtownia płyt meblowych i okuć w mieście — fizyczne miejsce, gdzie stolarze są w środę rano.

**A3 AUDYTOR TECH/SEO**
1. PageSpeed Insights daje liczbę 0–100 — liczba działa na człowieka mocniej niż opinia.
2. Zrzut ekranu jego strony na telefonie obok strony konkurenta = dowód bez słów.
3. Sprawdzenie, na którym miejscu w Google jest na frazę „kuchnie na wymiar + miasto".
4. Sprawdzenie, czy wizytówka Google jest przejęta („Czy to Twoja firma?" = nie jest).
5. Sprawdzenie certyfikatu HTTPS — brak kłódki to jednozdaniowy argument.

**A4 COPYWRITER OUTREACH**
1. Nie wysyłać oferty — wysyłać wynik cudzej analizy jego firmy.
2. Temat wiadomości nazywa jego firmę i jedną konkretną liczbę.
3. Pierwsze zdanie mówi, dlaczego akurat do niego, żeby nie wyglądać na masówkę.
4. Zamiast „czy jesteś zainteresowany" — „czy mogę Ci to wysłać".
5. Pytanie zamykające ma być pytaniem o zgodę, nie o pieniądze.

**A5 CLOSER**
1. Wejście tanie i szybkie, żeby decyzja mieściła się w jednej rozmowie.
2. Cena zakotwiczona w jego zysku z jednego zlecenia, nie w cenniku agencji.
3. Zaliczka 50% przed startem — bez wyjątków.
4. Abonament wpisany w umowę od 2. miesiąca, nie sprzedawany osobno później.
5. Termin oddania jako element oferty: sztywny termin dzienny bije „skontaktujemy się".

**A6 ARCHITEKT UX/PSYCHOLOG**
1. Nagłówek strony ma nazywać stratę, nie zysk.
2. Twoje zdjęcie i numer telefonu w pierwszym ekranie — obcy człowiek kupuje od twarzy.
3. Jedno wezwanie do działania na cały ekran.
4. Zamiast fałszywych opinii — publiczny licznik „ile stron zrobiłem" od zera.
5. Formularz na dwa pola: telefon i nazwa firmy.

**A7 BUILDER**
1. Jeden plik HTML, zero systemu zarządzania treścią, zero wtyczek.
2. Netlify Drop: przeciągasz folder, w 30 sekund masz żywą stronę z HTTPS.
3. Zdjęcia klienta kompresowane do formatu WebP — strona ładuje się poniżej sekundy.
4. Darmowa subdomena do czasu pierwszej faktury, własna domena z pieniędzy klienta.
5. Ten sam szablon dla każdego klienta — różnią się tylko zdjęcia i teksty.

**A8 OFICER RODO/PRAWO**
1. Masowy cold mail do firm to dziś prosta droga do skargi i kary — weto.
2. Kontakt osobisty i list papierowy nie podlegają przepisom o komunikacji elektronicznej.
3. Zgodę na maila trzeba zebrać ZANIM wyślesz maila — da się to zrobić twarzą w twarz.
4. Obowiązek informacyjny (skąd masz dane) trzeba pokazać przy pierwszym kontakcie.
5. Bez wpisu do CEIDG nie ma faktury — a bez faktury nie ma Celu #1.

**A9 AUTOMATYZATOR**
1. Arkusz Google jako cały CRM — jedna zakładka, jeden wiersz na firmę.
2. Google Apps Script pobiera wynik PageSpeed dla 50 stron naraz.
3. Szablon audytu w Dokumentach Google, podmieniasz 6 pól i eksportujesz PDF.
4. Formularz na stronie wysyła SMS-a/maila na Twój telefon w 10 sekund.
5. Automatyczne przypomnienia o dotknięciach follow-up z kalendarza Google.

**A10 NAUCZYCIEL**
1. Każde zadanie ma mieć dokładny opis ekranu po poprawnym wykonaniu.
2. Do każdej instrukcji dopisany czas w minutach, żeby dało się zaplanować dzień.
3. Słownik pojęć na końcu, jedno zdanie na pojęcie.
4. Zasada: jeśli krok trwa dłużej niż 10 minut, jest rozpisany za grubo.
5. Skrypty rozmów w formie „on mówi / Ty mówisz", nie w formie porad.

---

# FAZA 2 — EGZEKUCJA (RED TEAM)

**Zabite (32 z 50 = 64%). Powód przy każdym: „nie zadziała w Polsce w 2026 przy budżecie 0 zł, bo…"**

| Pomysł | Wyrok RED TEAMu |
|---|---|
| A1.2 Fizjoterapia | …bo to najmocniej obrobiona nisza w polskim marketingu lokalnym; wchodzisz bez portfolio przeciwko 20 agencjom, które mają case studies. |
| A1.3 Zakłady pogrzebowe | …bo decyzja zapada wolno, właściciel jest nieufny wobec obcych, a sprzedaż wymaga referencji, których nie masz. |
| A1.4 OSK | …bo one kupują reklamę, nie stronę; budżet idzie w Facebook Ads, a nie w SEO, i cykl decyzyjny to cały semestr. |
| A1.5 Ogrodzenia | …bo szczyt sezonu to marzec–czerwiec; we wrześniu wchodzą w zjazd i przekładają wydatki na wiosnę. |
| A2.5 Hurtownia płyt | …bo zaczepianie ludzi na parkingu hurtowni to sprzedaż w najgorszym możliwym momencie — człowiek jedzie po materiał, ma 15 minut i ciężarówkę za sobą. |
| A3.2 Zrzut obok konkurenta | …bo pokazywanie właścicielowi, że konkurent jest lepszy, wywołuje wstyd i obronę, nie zakup — chyba że robisz to bardzo ostrożnie (patrz: ocalało warunkowo). |
| A4.2 Liczba w temacie maila | …bo maila i tak nie wyślesz jako pierwszego dotknięcia (weto A8), więc temat maila jest bezużyteczny na pierwszym kroku. |
| A5.1 „Tanie wejście" bez liczby | …bo „tanie" to wydmuszka; bez konkretnej kwoty nie ma decyzji. |
| A5.5 Termin jako element oferty | Ocalało, ale RED TEAM ostrzega: obiecasz 7 dni i nie dowieziesz, bo pierwszą stronę będziesz robił 3 dni dłużej niż myślisz. |
| A6.4 Publiczny licznik od zera | …bo „strona nr 0" komunikuje, że nie masz klientów; licznik ma sens dopiero od 5. realizacji. |
| A7.4 Darmowa subdomena | Ocalało warunkowo — ale adres `twojaagencja.netlify.app` obniża wiarygodność u klienta, który sam ma domenę `.pl`. |
| A9.2 Apps Script na 50 stron | …bo osoba z Fazy 0, założenie 2, nie napisze skryptu w dniu 1; to zadanie na dzień 12, nie na start. |
| A9.4 SMS z formularza | …bo darmowe bramki SMS w Polsce praktycznie nie istnieją bez karty; zostaje powiadomienie mailowe i push z Gmaila. |
| A10.3 Słownik na końcu | …bo laik nie przewija do słownika; pojęcie musi być wyjaśnione w miejscu użycia. |
| + 18 dalszych pomysłów o mniejszym ciężarze | Zabite jako „ładne, ale nie do wykonania jutro bez pieniędzy": Instagram jako kanał główny, targi, izby rzemieślnicze, Allegro Lokalnie, cold call na zimno, portfolio fikcyjne, blog jako źródło leadów w 30 dni, reklama płatna w jakiejkolwiek formie, chatbot na stronie, newsletter, webinar, „darmowa strona za opinię" (zabija cenę na starcie), wideo-audyt na YouTube, LinkedIn (stolarz tam nie bywa), grupy dyskusyjne branżowe agencyjne, TikTok, ulotki (koszt druku ≠ 0 zł), plakaty. |

**Test ocalałych: „da się to zrobić jutro, bez pieniędzy?"** — przeszły 18 pomysłów, wchodzą do scoringu.

---

## ⚔️ SPORY (rozstrzygam ja, BOSS)

**SPÓR 1 — A2 ŁOWCA vs A8 OFICER RODO.**
A2: „Wyciągam 400 maili z Map Google i wysyłam spersonalizowany audyt. Firmowy mail to nie dane osobowe, jedziemy."
A8: **WETO.** Po pierwsze: `jan.kowalski@stolarstwo.pl` oraz mail jednoosobowej działalności to dane osobowe — jednoosobowa firma to osoba fizyczna. Po drugie, i ważniejsze: przepisy o wysyłaniu informacji handlowej drogą elektroniczną w Polsce wymagają **uprzedniej zgody odbiorcy**, a od listopada 2024 r. materia ta została przeniesiona z art. 10 ustawy o świadczeniu usług drogą elektroniczną i art. 172 Prawa telekomunikacyjnego do ustawy Prawo komunikacji elektronicznej (art. 398) [DANE — stan mojej wiedzy; **zweryfikuj brzmienie przepisu na isap.sejm.gov.pl, wpisując „Prawo komunikacji elektronicznej", i przeczytaj art. 398**]. „Prawnie uzasadniony interes" z RODO uzasadnia **przetwarzanie** danych, ale **nie zastępuje zgody na wysyłkę** informacji handlowej. To dwie różne ustawy i dwa różne obowiązki.
**MOJA DECYZJA: racja A8.** Ale nie przyjmuję jej biernie — A8 ma obowiązek dać wariant o podobnej skuteczności i go dał: **pierwsze dotknięcie offline (wizyta osobista lub list), podczas którego zbierasz ustną/pisemną zgodę na kontakt elektroniczny. Dopiero to odblokowuje maila i SMS-a.** Uzasadnienie biznesowe, nie tylko prawne: przy zerowym portfolio Twój współczynnik odpowiedzi na zimnego maila wynosi [SZACUNEK] 0,5–2% (założenie: brak marki, brak dowodu społecznego, adres nadawcy bez historii). Na wizycie osobistej u mikrofirmy rozmowę realnie odbędziesz z [SZACUNEK] 30–50% odwiedzonych (założenie: warsztat jest otwarty, właściciel na miejscu, przychodzisz w oknie 8:00–15:00). Zimny mail jest jednocześnie nielegalny i słabszy. Nie ma czego bronić.

**SPÓR 2 — A5 CLOSER vs A1 STRATEG + A9 AUTOMATYZATOR.**
A5: „Sprzedajemy od razu abonament 990 zł/mies. Jednorazówka za 1490 zł to samobójstwo — zrobisz 10 stron i dalej nie masz przychodu powtarzalnego."
A1 + A9: „Nikt nie podpisze abonamentu z człowiekiem bez ani jednej realizacji. Cel #1 to faktura w 30 dni, nie idealny model biznesowy."
**MOJA DECYZJA: podzielona, na korzyść A1 co do kolejności, na korzyść A5 co do konstrukcji.** Wejście jest jednorazowe i tanie (żeby decyzja mieściła się w jednej rozmowie), **ale abonament jest wpisany w tę samą umowę, startuje automatycznie od 31. dnia po odbiorze strony, z prawem wypowiedzenia w każdej chwili z miesięcznym okresem.** Nie sprzedajesz abonamentu drugi raz — sprzedajesz go raz, przy tej samej podpisie. Powód: druga sprzedaż temu samemu klientowi 3 miesiące później wymaga ponownej rozmowy, na którą nie będziesz miał czasu, bo będziesz szukał nowych klientów.

**SPÓR 3 — RED TEAM wskazuje leniwego.**
RED TEAM: „A10 NAUCZYCIEL nie zgłosił ani jednego pomysłu operacyjnego. Zgłosił pięć postulatów o formatowaniu. To nie jest praca, to jest komentarz do pracy innych."
A10 wraca z zadaniem i dostarcza brakujący element: **„Zanim wyjdziesz do pierwszej firmy, przećwicz rozmowę na dwóch firmach spoza niszy, których nie chcesz jako klientów — kwiaciarnia, zakład szewski. Spalisz na nich swój najgorszy występ."** To wchodzi do planu jako Dzień 4.

---

# FAZA 3 — SCORING OCALAŁYCH

Wzór: WYNIK = (Wpływ × Pewność × Łatwość) ÷ 10. Maksimum 100.

| # | Pomysł | Wpływ | Pewność | Łatwość | Czas do 1. zł | WYNIK | Ryzyko |
|---|---|---|---|---|---|---|---|
| 1 | Google Maps + filtr „brak strony" jako lista leadów | 8 | 9 | 9 | 7 dni | **64,8** | Część firm ma stronę, ale nie jest podpięta do wizytówki |
| 2 | Nisza: pracownie mebli na wymiar 1–5 osób | 9 | 8 | 9 | 14 dni | **64,8** | Jesienią bywają zapełnieni zleceniami — rozstrzygnięte w Części 3, poprawka P1b: zajętość staje się kryterium doboru, nie ryzykiem |
| 3 | Wizyta osobista w warsztacie z gotowym audytem | 10 | 8 | 8 | 10 dni | **64,0** | Wymaga przełamania oporu przed odmową |
| 4 | Audyt 1-stronicowy z liczbą z PageSpeed Insights | 8 | 9 | 8 | 10 dni | **57,6** | Liczba może być dobra — trzeba mieć drugi argument w zanadrzu |
| 5 | Oferta wejściowa: strona + wizytówka Google, 10 dni, stała cena | 9 | 8 | 8 | 10 dni | **57,6** | Ryzyko przekroczenia terminu przy pierwszym kliencie |
| 6 | Zgoda na kontakt elektroniczny zbierana na wizycie | 8 | 9 | 8 | — | **57,6** | Klient może uznać podpis za „papierologię" |
| 7 | Sygnał „wolne terminy" w grupach FB jako priorytet leada | 9 | 7 | 9 | 5 dni | **56,7** | Takich postów jest mało, kilka tygodniowo |
| 8 | Arkusz Google jako jedyny CRM | 6 | 10 | 9 | — | **54,0** | Rozjedzie się przy 300+ firmach, ale wtedy będziesz miał pieniądze |
| 9 | Wyszukiwarka REGON/CEIDG po kodzie PKD | 7 | 9 | 8 | 7 dni | **50,4** | Dużo firm martwych i zawieszonych w rejestrze |
| 10 | Zaliczka 50% przed rozpoczęciem pracy | 9 | 8 | 7 | 10 dni | **50,4** | Część klientów odpadnie na tym warunku — i dobrze |
| 11 | Abonament wpisany w umowę od 31. dnia | 9 | 7 | 8 | 45 dni | **50,4** | Klient może wypowiedzieć po pierwszym miesiącu |
| 12 | Jeden plik HTML zamiast systemu CMS | 8 | 9 | 7 | — | **50,4** | Klient nie edytuje treści sam — to argument ZA abonamentem |
| 13 | Netlify Drop jako hosting startowy | 7 | 9 | 8 | — | **50,4** | Subdomena obniża wiarygodność do czasu kupna domeny |
| 14 | Trening rozmowy na 2 firmach spoza niszy | 6 | 8 | 10 | — | **48,0** | Brak — to czysty zysk |
| 15 | OLX jako źródło firm bez strony | 7 | 8 | 8 | 7 dni | **44,8** | Ogłoszeniodawcą bywa pracownik, nie właściciel |
| 16 | Nagłówek strony oparty na stracie, nie na zysku | 7 | 7 | 9 | — | **44,1** | Przesadzony straszak odpycha |
| 17 | Zdjęcia realizacji klienta jako całe portfolio strony | 8 | 8 | 6 | — | **38,4** | Zdjęcia z telefonu bywają fatalne — trzeba je poprawić |
| 18 | List papierowy jako dotknięcie #4 | 6 | 7 | 6 | 21 dni | **25,2** | Znaczek i papier kosztują (nie 0 zł) |

---

# FAZA 4 — DECYZJA BOSSA

## 🎯 Wybieram dokładnie jedno. Nie trzy.

> **NISZA:** pracownie mebli na wymiar — kuchnie, szafy wnękowe i zabudowy — zatrudniające 1–5 osób, w promieniu 60 km od Twojego miejsca zamieszkania.
>
> **KANAŁ POZYSKIWANIA:** wizyta osobista w warsztacie, z gotowym, wydrukowanym lub pokazanym z ekranu audytem jego firmy, przygotowanym ZANIM ktokolwiek o niego poprosił.
>
> **OFERTA WEJŚCIOWA:** „**Warsztat w Google w 7 dni**" — jednostronicowa strona z galerią jego realizacji + założona i zweryfikowana wizytówka Google, za **1 490 zł**, płatne 50% zaliczki / 50% przy odbiorze, z abonamentem **390 zł/mies.** startującym automatycznie 31. dnia po odbiorze.

**Uzasadnienie w pięciu zdaniach.**
Wybieram stolarzy, bo jako jedyni z listy mają obie rzeczy naraz: bardzo wysoką wartość pojedynczego zlecenia (kuchnia na wymiar to [SZACUNEK] 18 000–45 000 zł przychodu przy marży rzędu 25–35% — założenie oparte na typowej strukturze kosztów: płyta, okucia, AGD, robocizna; **zweryfikuj to pytając samego stolarza podczas pierwszej rozmowy — to jest pytanie, które i tak musisz zadać**) oraz gotowy materiał, którego potrzebujesz do zbudowania strony w jeden dzień, czyli setki zdjęć własnych realizacji w telefonie. Wybieram wizytę osobistą, bo to jedyny kanał, który jest jednocześnie legalny bez zgody (A8 zawetował cold mail) i który działa, gdy nie masz portfolio, marki ani nazwiska — człowiek, który przyszedł osobiście z analizą Twojej firmy, jest w Polsce zjawiskiem rzadkim i to samo w sobie jest dowodem rzetelności. Wybieram cenę 1 490 zł, bo mieści się w kwocie, którą właściciel mikrofirmy decyduje sam, na miejscu, bez rady rodzinnej i bez księgowej, a jednocześnie odpowiada [SZACUNEK] 20% zysku z jednego dodatkowego zlecenia kuchennego — co daje Ci najprostszą matematykę sprzedażową, jaka istnieje: „jedna dodatkowa kuchnia w roku zwraca to siedmiokrotnie". Wybieram promień 60 km, bo poniżej tego nie zbierzesz wystarczającej liczby firm, a powyżej — przy braku auta z Fazy 0 — nie dojedziesz. Wybieram abonament wpisany w tę samą umowę, bo trzeci klient abonamentowy w 90 dni jest matematycznie nieosiągalny, jeśli każdą sprzedaż abonamentu trzeba prowadzić osobno.

**Co świadomie odrzucam i dlaczego.**

| Odrzucam | Dlaczego |
|---|---|
| Cold mailing na skalę | Nielegalny bez zgody (art. 398 Prawa komunikacji elektronicznej), a przy zerowej marce daje [SZACUNEK] 0,5–2% odpowiedzi. Podwójna strata. |
| Facebook Ads, Google Ads, jakąkolwiek reklamę płatną | Budżet 0 zł. Koniec tematu. Wracamy do tego przy 3. kliencie abonamentowym. |
| Blog, treści, budowanie marki osobistej | Pierwsze efekty w [SZACUNEK] 4–9 miesięcy. Cel to 30 dni. Wykluczone. |
| Drugą i trzecią niszę „na wszelki wypadek" | Dwie nisze = dwa audyty, dwa skrypty, dwie strony, połowa uwagi. To jest najczęstsza przyczyna zerowego wyniku po 90 dniach. |
| Sprzedaż samego SEO | Nie sprzedajesz czegoś, czego klient nie widzi, zanim sprzedasz mu coś, co widzi. Strona jest dowodem. SEO jest abonamentem. |
| Klientów spoza promienia 60 km | Bez auta i bez portfolio zdalna sprzedaż nie zadziała. Wracamy przy 5. kliencie. |
| Duże firmy meblarskie (10+ osób) | Mają marketingowca albo agencję. Decyzja idzie przez trzy osoby. Nie zdążysz w 30 dni. |

---

# FAZA 5 — PRODUKCJA

## D1 — NISZA I KLIENT IDEALNY

### 1.1 Definicja mikroniszy (kopiuj to sobie, to jest Twój filtr na wszystko)

```
Pracownia mebli na wymiar: kuchnie, szafy wnękowe, zabudowy,
łazienki i garderoby na indywidualne zamówienie.
Wielkość: 1-5 osób (właściciel + 0-4 pracowników).
Forma: jednoosobowa działalność gospodarcza lub spółka cywilna.
Lokalizacja: promień 60 km od mojego miejsca zamieszkania.
Klient końcowy pracowni: osoba prywatna remontująca mieszkanie lub
   wykańczająca dom, w wieku 28-50 lat.
NIE wchodzą: fabryki mebli, sklepy meblowe z gotowym towarem,
   montażyści mebli z sieciówek, stolarze budowlani (schody, okna, tarasy).
```

### 1.2 Ekonomia tej firmy — czyli dlaczego on ma pieniądze

| Pozycja | Wartość | Znacznik |
|---|---|---|
| Przychód roczny pracowni 1–5 osób | 300 000 – 900 000 zł | [SZACUNEK] — założenie: 12–30 realizacji rocznie przy średniej wartości 25 000 zł. **Zweryfikuj**: w wyszukiwarce REGON (`wyszukiwarkaregon.stat.gov.pl`) sprawdzisz wielkość zatrudnienia; przychód pytasz wprost na rozmowie: „ile kuchni robicie w miesiącu?" |
| Wartość jednego zlecenia (kuchnia na wymiar) | 18 000 – 45 000 zł | [SZACUNEK] — założenie: 4–7 mb zabudowy, płyta laminowana lub fornir, okucia średniej klasy, bez AGD. **Zweryfikuj**: wpisz w Google „kuchnia na wymiar cennik" i zobacz 5 pierwszych pracowni z Twojego województwa |
| Zysk pracowni z jednego zlecenia | 5 000 – 13 000 zł | [SZACUNEK] — założenie: marża 25–35% po materiale i robociźnie |
| Ile kosztuje go pozyskanie jednego klienta dziś | 0 zł (polecenia) lub 200–600 zł (portale ofertowe) | [SZACUNEK] — założenie: portale typu Oferteo/Fixly sprzedają kontakty na sztuki. **Zweryfikuj**: załóż darmowe konto wykonawcy na `oferteo.pl` i zobacz cennik kontaktów w kategorii meblowej |
| Ile z tego zostaje Ci jako pole na cenę | 1 490 zł to [SZACUNEK] 11–30% zysku z jednego zlecenia | To jest cała Twoja argumentacja cenowa |

**Pojęcie, które musisz rozumieć, zanim pójdziesz dalej: LEAD.**
Lead (czytaj: lid) to nazwisko lub firma, o której wiesz dwie rzeczy: że ma problem, który umiesz rozwiązać, i jak się z nią skontaktować. To jak numer telefonu do człowieka, któremu przecieka dach, w sytuacji gdy jesteś dekarzem. Sam numer to jeszcze nie pieniądze, ale bez numeru nie ma nawet rozmowy.

### 1.3 Dlaczego akurat on płaci za stronę I za SEO

1. **Jego klient końcowy kupuje oczami.** Nikt nie zamawia kuchni za 25 000 zł, nie zobaczywszy wcześniej zdjęć wcześniejszych robót. Stolarz bez strony ma zdjęcia w telefonie i na Facebooku, gdzie po tygodniu znikają w dół osi czasu.
2. **Jego klient końcowy szuka lokalnie i w konkretnym momencie.** Frazy typu „kuchnie na wymiar [miasto]" są wpisywane przez ludzi, którzy mają już mieszkanie w stanie deweloperskim i pieniądze na wykończenie. To jest najgorętszy możliwy ruch.
3. **On sam nie zrobi tego nigdy.** Ma piłę panelową, nie laptopa. Wieczorem jest zmęczony. To nie jest niechęć — to jest brak czasu i brak umiejętności, czyli dokładnie definicja usługi, którą sprzedajesz.
4. **Jego konkurencja też tego nie ma.** [SZACUNEK] W miastach do 100 tys. mieszkańców w wynikach na frazę „kuchnie na wymiar + miasto" połowa wyników to profile z Facebooka i katalogi firm, nie własne strony — założenie na podstawie struktury tego rynku. **Zweryfikuj to dziś w 10 minut: wpisz tę frazę w Google z nazwą swojego miasta i policz, ile z pierwszych 10 wyników to własne strony firm.**
5. **Ma sezonowość i to jest Twoja karta.** Grudzień–luty to zjazd zleceń [SZACUNEK — założenie: remonty mieszkań kumulują się wiosną i latem]. Strona zrobiona we wrześniu pracuje na sezon wiosenny. To jest gotowy argument na obiekcję „mam robotę na pół roku".

### 1.4 Profil decydenta

| Cecha | Ustalenie |
|---|---|
| **Kto podpisuje** | Właściciel. Jedna osoba. Nie ma zarządu, nie ma działu marketingu, nie ma „muszę to skonsultować" poza ewentualnie małżonkiem/małżonką, którzy często prowadzą księgowość i odbierają telefon. |
| **Wiek** | [SZACUNEK] 32–52 lata. Założenie: wystarczająco długo w branży, by mieć własny warsztat, wystarczająco młodo, by używać smartfona. |
| **Gdzie fizycznie jest** | W warsztacie: hala lub garaż na obrzeżach miasta, w strefie przemysłowej, przy trasie wylotowej. Rzadko w biurze. Prawie nigdy przy komputerze. |
| **O której odbiera telefon** | [SZACUNEK] 7:00–8:00 (przed uruchomieniem maszyn), 12:00–12:30 (przerwa), 15:30–17:30 (po robocie, w aucie). Założenie: dzień pracy warsztatu 7:00–16:00, przy pracujących maszynach nie słyszy telefonu. **Nie dzwoń między 8:30 a 11:30.** |
| **Czego się boi (kolejność ma znaczenie)** | 1. Że zapłaci i nic z tego nie będzie — bo zna kogoś, kto zapłacił 4 000 zł i „strona leży". 2. Że będzie musiał się tym zajmować, wysyłać teksty, wybierać kolory, uczyć się obsługi. 3. Że podpisze coś, z czego nie wyjdzie. 4. Że go ktoś oszuka, bo nie zna się na tym i nie ma jak sprawdzić. 5. Wyjścia na frajera przed konkurencją. |
| **Na co reaguje** | Na konkretną liczbę o jego firmie. Na własne zdjęcia pokazane mu na ekranie. Na sztywny termin („dziesięć dni roboczych", nie „szybko"). Na zdanie „nie musisz nic robić, potrzebuję od Ciebie tylko zdjęć". Na człowieka, który przyszedł osobiście. |
| **Na co NIE reaguje** | Na słowa: optymalizacja, konwersja, funnel, branding, responsywność, „obecność w sieci", „wizerunek". Na PDF-a na 20 stron. Na ofertę mailową bez wcześniejszej rozmowy. Na rabat (rabat = „czyli normalnie to jest przepłacone"). |
| **Czego chce naprawdę** | Nie „strony". Chce **droższych zleceń od klientów, którzy nie targują się o każde 500 zł**. To zdanie masz powiedzieć na rozmowie dosłownie. |

**SPRAWDŹ, ŻE JEST DOBRZE:** otwórz Mapy Google, wpisz „meble na wymiar" i nazwę swojego miasta. Jeśli w ciągu 10 minut znajdziesz **co najmniej 12 firm**, z których **co najmniej 4 nie mają w wizytówce linku do strony internetowej** — nisza jest potwierdzona i idziesz dalej. Jeśli znajdziesz mniej niż 12 firm, rozszerz wyszukiwanie o dwa najbliższe miasta powiatowe i policz ponownie.

---

## D2 — ŹRÓDŁA LEADÓW ZA 0 ZŁ

### 2.1 Piętnaście źródeł. Wszystkie darmowe, wszystkie polskie, wszystkie legalne do przeglądania.

| # | Źródło | Adres | Ile firm wyciągniesz | Ile to trwa |
|---|---|---|---|---|
| 1 | **Mapy Google** | `maps.google.com` | 30–80 na miasto | 45 min na miasto |
| 2 | **Wyszukiwarka REGON (GUS)** | `wyszukiwarkaregon.stat.gov.pl` | 50–300 na powiat | 60 min |
| 3 | **CEIDG** | `ceidg.gov.pl` | 40–200 na miasto | 45 min |
| 4 | **Facebook — strony firmowe** | `facebook.com`, wyszukiwarka | 20–60 na miasto | 40 min |
| 5 | **Facebook — grupy lokalne i remontowe** | j.w., zakładka „Grupy" | 5–15 gorących sygnałów tygodniowo | 15 min dziennie |
| 6 | **OLX** | `olx.pl`, kategoria Usługi → Budowa i remont | 15–50 na miasto | 30 min |
| 7 | **Oferteo** | `oferteo.pl` | 20–60 na województwo | 30 min |
| 8 | **Fixly** | `fixly.pl` | 15–40 na województwo | 30 min |
| 9 | **Panorama Firm** | `panoramafirm.pl` | 20–80 na miasto | 30 min |
| 10 | **pkt.pl** | `pkt.pl` | 15–60 na miasto | 30 min |
| 11 | **Google — wyniki ze stron 2–5** | `google.pl` | 15–30 na miasto | 25 min |
| 12 | **Instagram — hasztagi** | `instagram.com` | 10–40 | 30 min |
| 13 | **Aleo** | `aleo.com` | 20–70 na województwo | 30 min |
| 14 | **Tablice ogłoszeń w marketach budowlanych** | fizycznie, przy wejściu | 3–10 na sklep | 15 min przy okazji |
| 15 | **Lokalne portale i grupy „Polecane firmy"** | wyszukaj w Google: `polecane firmy [Twoje miasto] grupa` | 5–20 | 20 min |

> **Uwaga do wszystkich liczb powyżej: [SZACUNEK].** Założenie: miasto powiatowe 30–80 tys. mieszkańców z Fazy 0. W mieście wojewódzkim pomnóż przez 3–5. Nie znam Twojego miasta, więc **pierwszą godzinę w Dniu 5 poświęcasz na policzenie tego u siebie i wpisanie prawdziwych liczb w kolumnę obok.**

### 2.2 Procedura krok po kroku — źródło nr 1 (Mapy Google). To jest źródło, od którego zaczynasz.

**CO:** zbudować listę 40 firm w jednym mieście.
**JAK:**
1. Otwórz przeglądarkę. W pasku adresu (biały pasek na samej górze okna) wpisz `maps.google.com` i naciśnij Enter.
2. W polu wyszukiwania po lewej stronie u góry wpisz dokładnie: `meble na wymiar Ostrów Mazowiecka` — zamiast nazwy w przykładzie wpisz swoje miasto. Naciśnij Enter.
3. Po lewej stronie pojawi się lista firm z ocenami i adresami. **Ekran po poprawnym wykonaniu:** mapa po prawej z czerwonymi pinezkami, po lewej lista pozycji, każda z nazwą, gwiazdkami i adresem.
4. Kliknij pierwszą firmę na liście. Panel po lewej zmieni się w kartę firmy.
5. Patrz na sekcję z ikonami pod nazwą. Szukasz ikony globusa z podpisem `Strona internetowa`.
   - **Jeśli tej ikony NIE MA** → to jest Twój najlepszy typ leada. Zapisz.
   - **Jeśli ikona JEST** → kliknij ją. Strona otworzy się w nowej karcie. Oceniasz ją według listy z punktu 2.3.
6. Przewiń kartę firmy w dół do sekcji z opiniami. Zanotuj liczbę opinii.
7. Zanotuj, czy widnieje napis `Czy jesteś właścicielem tej firmy?` — jeżeli tak, oznacza to, że **nikt nie zarządza tą wizytówką**. To najsilniejszy sygnał bólu na całej liście.
8. Wróć strzałką wstecz i powtórz dla kolejnej firmy. Rób to 40 razy.
9. Powtórz całość dla fraz: `kuchnie na wymiar [miasto]`, `szafy na wymiar [miasto]`, `stolarz [miasto]`, `zabudowy wnękowe [miasto]`. Te same firmy będą się powtarzać — to normalne, usuwasz duplikaty po nazwie.

**PO CO:** bo Mapy Google to jedyne miejsce, w którym Polska mikrofirma sama, dobrowolnie i publicznie deklaruje, czy ma stronę internetową. Jeśli tego nie zrobisz, będziesz zgadywał, kto ma problem, zamiast to wiedzieć — i spalisz połowę wizyt na firmy, które mają wszystko dopięte.

### 2.3 Procedura — źródło nr 2 (Wyszukiwarka REGON). To jest źródło, które daje listę pełną, nie tylko tych, którzy są w Google.

**CO:** wyciągnąć z rejestru państwowego wszystkie zarejestrowane pracownie meblowe w Twoim powiecie.
**JAK:**
1. Wejdź na `wyszukiwarkaregon.stat.gov.pl`.
2. Kliknij zakładkę `Wyszukiwanie zaawansowane` (u góry, obok pola wyszukiwania).
3. W polu `Województwo` wybierz swoje. W polu `Powiat` wybierz swój.
4. W polu `PKD` wpisz `31.02` (produkcja mebli kuchennych) — [DANE: to jest kod z Polskiej Klasyfikacji Działalności; **od 2025 r. obowiązuje zaktualizowana wersja klasyfikacji, więc jeśli kod nie zwróci wyników, kliknij ikonę lupy przy polu PKD i wyszukaj słowo „meble" — narzędzie samo pokaże aktualne kody**].
5. Powtórz to samo dla kodu `31.09` (produkcja pozostałych mebli).
6. Kliknij `Szukaj`. **Ekran po poprawnym wykonaniu:** tabela z kolumnami REGON, nazwa, adres, forma prawna.
7. Zaznacz wyniki i skopiuj je do arkusza (instrukcja arkusza w D11).

**PO CO:** bo w Mapach Google są tylko firmy, które same się tam dodały. W REGON są wszystkie. Różnica między tymi dwiema listami — czyli firmy, które istnieją w rejestrze, a nie istnieją w Google — to jest lista ludzi z największym możliwym bólem, o którym jeszcze nie wiedzą.

**Uwaga prawna od A8, przeczytaj zanim skopiujesz cokolwiek:** dane z rejestrów publicznych (REGON, CEIDG) i z Map Google możesz zbierać i przechowywać na potrzeby kontaktu handlowego, opierając się na przesłance prawnie uzasadnionego interesu [art. 6 ust. 1 lit. f RODO — DANE]. **Ale to nie jest zgoda na wysyłanie im maili.** To pozwala Ci mieć listę i przyjść osobiście. Do kontaktu elektronicznego potrzebujesz osobnej zgody, którą zbierasz na wizycie (formularz w D5). Dodatkowo: musisz mieć gotowy obowiązek informacyjny — jednostronicowy tekst mówiący, skąd masz dane i co z nimi robisz — który pokazujesz przy pierwszym kontakcie. **Gotowy tekst dostaniesz w D5.**

### 2.4 Jak rozpoznać firmę z REALNYM bólem — lista kontrolna na 90 sekund

Sprawdzasz każdą firmę według tej listy. Każdy „TAK" to punkt bólu.

| # | Sygnał | Jak to sprawdzisz dosłownie | Waga |
|---|---|---|---|
| 1 | **Brak strony w ogóle** | W wizytówce w Mapach Google nie ma ikony `Strona internetowa`, albo prowadzi ona do profilu na Facebooku | ⬛⬛⬛⬛⬛ |
| 2 | **Zamiast strony — martwy Facebook** | Wejdź na profil, spójrz na datę ostatniego posta. Ostatni post starszy niż 6 miesięcy = martwy | ⬛⬛⬛⬛⬛ |
| 3 | **Strona nieresponsywna** | Otwórz jego stronę **na telefonie**. Jeśli musisz szczypać palcami, żeby przeczytać tekst — jest nieresponsywna. („Responsywna" = taka, która sama dopasowuje układ do szerokości ekranu telefonu, jak woda przelana do innej szklanki.) | ⬛⬛⬛⬛ |
| 4 | **Brak HTTPS** | Spójrz na pasek adresu w przeglądarce. Jeśli zamiast kłódki widzisz napis `Nie zabezpieczona` albo trójkąt ostrzegawczy — nie ma HTTPS. (HTTPS = szyfrowane połączenie; jak koperta zamiast pocztówki. Przeglądarki od lat ostrzegają przy jego braku, co odstrasza odwiedzających.) | ⬛⬛⬛⬛ |
| 5 | **Wolna strona** | Wejdź na `pagespeed.web.dev`, wklej adres jego strony, kliknij `Analizuj`. Wynik poniżej 50 na czerwonym tle w zakładce `Telefon` = wolna. | ⬛⬛⬛⬛ |
| 6 | **Wizytówka Google nieprzejęta** | W karcie firmy w Mapach widnieje `Czy jesteś właścicielem tej firmy?` | ⬛⬛⬛⬛⬛ |
| 7 | **Mniej niż 10 opinii** | Widoczne pod nazwą w Mapach | ⬛⬛⬛ |
| 8 | **Brak zdjęć w wizytówce lub zdjęcia tylko od klientów** | W karcie firmy zakładka `Zdjęcia` — jeśli jest ich mniej niż 5 albo wszystkie oznaczone jako dodane przez użytkowników | ⬛⬛⬛ |
| 9 | **Strona zrobiona przed 2020** | Otwórz jej stopkę (sam dół strony). Jeśli widzisz `© 2017` albo `© 2019` — nikt jej nie dotykał od lat | ⬛⬛⬛ |
| 10 | **Nie ma go w Google na własną frazę** | Wpisz w Google `kuchnie na wymiar [jego miasto]`. Jeśli nie ma go w pierwszych 10 wynikach, mimo że działa w tym mieście — to jest strata, którą możesz mu policzyć | ⬛⬛⬛⬛ |
| 11 | **Sygnał wolnych mocy** | W grupie na Facebooku albo w opisie OLX pojawia się: „wolne terminy", „przyjmę zlecenia", „mam wolny termin od zaraz" | ⬛⬛⬛⬛⬛ |

**Zasada odsiewu:** firma musi mieć **minimum 3 sygnały z wagą ⬛⬛⬛⬛ lub wyższą**, żeby w ogóle trafić do karty oceny z D3. Firma z jednym sygnałem to nie jest ból, to jest drobiazg — nie zapłaci.

**SPRAWDŹ, ŻE JEST DOBRZE:** po wykonaniu D2 masz w arkuszu **minimum 60 wierszy**, w każdym: nazwa firmy, miasto, telefon, adres warsztatu, adres strony (albo słowo BRAK), liczba opinii Google, i kolumna z wypisanymi numerami sygnałów bólu. Jeśli masz mniej niż 60 wierszy po dwóch dniach zbierania — nie szukaj lepszych źródeł, tylko rozszerz promień o kolejne miasto powiatowe.

---

## D3 — KARTA OCENY LEADA 0–100

### 3.1 Tabela punktacji

> **Wagi po korekcie z Części 3 (P1b):** kryterium D spadło z 15 na 10 punktów, kryterium G wzrosło z 10 na 15. Powód: we wrześniu decyduje wolna moc przerobowa warsztatu, a nie sama aktywność firmy — te dwa kryteria częściowo się dublowały. Suma nadal wynosi 100.

Każdą firmę oceniasz raz. Zajmuje to 90 sekund. Nie oceniasz z pamięci — wpisujesz punkty do arkusza.

| Kryterium | Co dokładnie sprawdzasz | Punktacja | Max |
|---|---|---|---|
| **A. Stan strony WWW** | Brak strony = 20 pkt. Tylko Facebook, ostatni post >6 mies. = 18 pkt. Strona sprzed 2020 lub nieresponsywna = 14 pkt. Strona działa, ale PageSpeed <50 = 10 pkt. Strona nowa i szybka = 0 pkt | 0–20 | 20 |
| **B. Wizytówka Google** | Brak wizytówki = 15 pkt. Wizytówka nieprzejęta („Czy jesteś właścicielem") = 15 pkt. Przejęta, ale <10 opinii i <5 zdjęć = 9 pkt. Przejęta, 10–30 opinii = 4 pkt. Przejęta, 30+ opinii, aktywna = 0 pkt | 0–15 | 15 |
| **C. Materiał na stronę (zdjęcia realizacji)** | Widzisz 20+ zdjęć jego prac na FB/Instagramie/OLX = 15 pkt. 8–19 zdjęć = 10 pkt. 3–7 zdjęć = 5 pkt. Mniej niż 3 = 0 pkt | 0–15 | 15 |
| **D. Dowód, że firma żyje** | Post, ogłoszenie lub opinia z ostatnich 30 dni = 10 pkt. Z ostatnich 90 dni = 6 pkt. Z ostatnich 12 mies. = 3 pkt. Nic od ponad roku = 0 pkt | 0–10 | 10 |
| **E. Wartość zlecenia** | Robi kuchnie na wymiar = 10 pkt. Szafy i zabudowy = 7 pkt. Drobne meble, półki, blaty = 3 pkt. Naprawy i montaż = 0 pkt | 0–10 | 10 |
| **F. Dostępność decydenta** | Publiczny numer komórkowy + adres warsztatu w promieniu 15 km = 10 pkt. Numer + warsztat 15–40 km = 7 pkt. Numer + warsztat 40–60 km = 4 pkt. Tylko formularz kontaktowy lub numer stacjonarny bez adresu = 0 pkt | 0–10 | 10 |
| **G. Sygnał wolnych mocy** | „Wolne terminy" / „przyjmę zlecenia" w ostatnich 30 dniach = 15 pkt. Aktywnie płaci za leady na Oferteo/Fixly/OLX = 10 pkt. Brak sygnału = 0 pkt | 0–15 | 15 |
| **H. Słabość konkurencji w Google** | W top10 na frazę „kuchnie na wymiar [jego miasto]" jest 5+ katalogów/profili FB zamiast stron firmowych = 5 pkt. 2–4 = 3 pkt. 0–1 = 0 pkt | 0–5 | 5 |
| | | **RAZEM** | **100** |

### 3.2 Progi decyzyjne — to jest reguła, nie sugestia

| Wynik | Nazwa | Co robisz | Ile czasu wolno Ci na to poświęcić |
|---|---|---|---|
| **80–100** | 🔥 GORĄCY | Audyt robisz dziś, wizytę składasz w ciągu 48 godzin | Do 90 min na firmę |
| **65–79** | ✅ DOBRY | Audyt i wizyta w tym tygodniu, po wyczerpaniu gorących | Do 45 min na firmę |
| **50–64** | ⏳ DRUGA FALA | Wpisujesz do arkusza, wracasz po 30 dniach. Żadnego audytu teraz | 0 min |
| **poniżej 50** | 🗑️ KOSZ | Usuwasz wiersz. Nie „może kiedyś". Usuwasz | 0 min |

### 3.3 Czerwone flagi — automatyczny kosz niezależnie od punktacji

1. Warsztat dalej niż 60 km — nie dojedziesz, a zdalnie bez portfolio nie sprzedasz.
2. Strona zrobiona w ostatnich 12 miesiącach i mająca PageSpeed powyżej 70 — nie masz czego naprawiać, a wchodzenie w cudzą świeżą inwestycję to spalona godzina.
3. W stopce jego strony widnieje nazwa agencji, a strona jest dobra — ma dostawcę, którym jest zadowolony.
4. Brak jakiegokolwiek numeru telefonu w internecie — nie ma jak zamknąć sprzedaży.
5. Firma zawieszona lub wykreślona w CEIDG — sprawdzasz na `ceidg.gov.pl` po nazwie. Zawieszona firma nie wystawi Ci przelewu.
6. Ostatni ślad życia starszy niż 18 miesięcy — to firma-widmo w rejestrze.
7. Więcej niż 15 pracowników — poza niszą, decyzja przechodzi przez kilka osób.
8. Negatywne opinie o niepłaceniu podwykonawcom — wpisz w Google `[nazwa firmy] opinie` i przeczytaj pierwsze 5 wyników. Klient, który nie płaci stolarzom, nie zapłaci i Tobie.

### 3.4 Dlaczego to jest najważniejsza tabela w całym dokumencie

Twoim jedynym prawdziwym ograniczeniem jest 4 godziny dziennie. Jeden audyt + jedna wizyta to [SZACUNEK] 75–100 minut łącznie z dojazdem (założenie: 15 min audyt, 20 min dojazd w jedną stronę, 20 min rozmowa, 10 min notatki). To znaczy, że w ciągu 30 dni wykonasz [SZACUNEK] **60–75 pełnych podejść** i ani jednego więcej. Jeśli 30 z nich pójdzie na firmy z wynikiem poniżej 50 punktów, straciłeś połowę miesiąca i nie osiągniesz Celu #1. Karta oceny nie jest biurokracją — ona jest jedynym mechanizmem, który stoi między Tobą a przepaleniem miesiąca.

**SPRAWDŹ, ŻE JEST DOBRZE:** oceń tą kartą 10 pierwszych firm z arkusza. Jeśli **wszystkie dziesięć** wyszły powyżej 65 punktów — oceniasz zbyt łagodnie, wróć i policz jeszcze raz surowo, bo w prawdziwej próbie [SZACUNEK] 25–40% firm ląduje w koszu. Jeśli **żadna** nie przekroczyła 50 — masz źle dobrane miasto albo źle dobrane frazy wyszukiwania; wróć do D2 i dodaj frazy `stolarz` oraz `zabudowy wnękowe`.

---

**CIĄG DALSZY: napisz /dalej**

Następne w kolejce: **D4 (audyt-magnes wraz z pełnym przykładem od pierwszego do ostatniego słowa)**, D5 (sekwencja 5 dotknięć + zgoda RODO), D6 (architektura strony i psychologia), D7 (wdrożenie technicznie, kod), D8 (SEO), D9 (cennik), D10 (rozmowa sprzedażowa), D11 (automatyzacja), D12 (plan 30 dni), bramka QA i 3 pierwsze ruchy na najbliższe 60 minut.
