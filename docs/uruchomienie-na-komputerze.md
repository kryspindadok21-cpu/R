# Uruchomienie na własnym komputerze

Ten dokument istnieje z jednego powodu: **trzy rzeczy da się sprawdzić wyłącznie
poza piaskownicą**, w której powstał ten kod. Na własnej maszynie działają
od ręki.

| Co | W piaskownicy | Na Twoim komputerze |
|---|---|---|
| Crawl i audyt przez HTTPS | ✅ działa | ✅ działa |
| **Renderowanie w Chromium** | ❌ proxy zrywa tunel TLS | ✅ działa |
| **Prawdziwe dane z Search Console** | ❌ brak klucza | ✅ działa |
| **PageSpeed Insights na żywo** | ❌ nie sprawdzone | ✅ działa |

Reszta — 662 testy, crawl, audyt, raport — jest już zweryfikowana i nie wymaga
powtórki. Powtarzasz tylko to, czego nie dało się sprawdzić.

---

## 1. Czego potrzebujesz

- **Node 22 lub nowszy** — `node --version`
- **pnpm** — `npm install -g pnpm`
- **git**

**Windows:** `better-sqlite3` kompiluje się natywnie. Jeśli `pnpm install`
wysypie się na kompilacji, najprostsze wyjście to **WSL** (Ubuntu) i praca
w nim — nie warto walczyć z narzędziami budowania w Windows.

---

## 2. Pobranie i sprawdzenie

```bash
git clone https://github.com/kryspindadok21-cpu/R.git
cd R
pnpm install
pnpm test
```

**`pnpm test` musi być zielone.** Powinno pokazać ponad 660 testów.
Jeśli nie jest — to jest pierwsza rzecz do naprawy i nic dalej nie ma sensu.

```bash
pnpm typecheck      # typy
pnpm check:deps     # reguły warstw
pnpm check:secrets  # skan sekretów
```

---

## 3. Renderowanie — to, czego nie dało się sprawdzić

Pobierz przeglądarkę **raz**:

```bash
npx playwright install chromium
```

Potem crawl z renderowaniem:

```bash
npx tsx apps/cli/src/bin.ts init
npx tsx apps/cli/src/bin.ts crawl --site https://kryspindadok21-cpu.github.io/R/ --render 4
npx tsx apps/cli/src/bin.ts audit --site https://kryspindadok21-cpu.github.io/R/
npx tsx apps/cli/src/bin.ts report --site https://kryspindadok21-cpu.github.io/R/ --audit
```

**Czego szukać w wyjściu:** linii `Strony wyrenderowane: 4`. Jeśli zamiast niej
zobaczysz `Renderowanie nieudane`, powód jest zapisany w tabeli `provider_call`
w bazie — narzędzie nie ukrywa porażek.

Sprawdzian, że wykrywanie treści wymagającej JavaScriptu naprawdę działa:
wypuść crawl na dowolnym sklepie zbudowanym w React albo Vue. Strona, która
bez JS jest pusta, dostanie ustalenie `ai.js-required-for-content` o wysokiej wadze.

---

## 4. Search Console — dostęp krok po kroku

To jest jedyna rzecz, której nie da się zrobić za Ciebie: konto serwisowe musi
istnieć i mieć dostęp do property. Bez tego nie ma klastrów, briefów ani pomiaru
różnicą w różnicach — te warstwy liczą na prawdziwych wyświetleniach i pozycjach.

Wszystko poniżej jest **darmowe**. Search Console API nie ma płatnego progu,
a konto serwisowe nie wymaga karty.

### 4.1. Konto serwisowe i klucz

1. Wejdź na <https://console.cloud.google.com> i zaloguj się tym kontem Google,
   które ma dostęp do Search Console.
2. U góry, obok logo, kliknij listę projektów → **Nowy projekt**. Nazwa dowolna,
   np. `seo-lokalnie`. Utwórz i przełącz się na niego.
3. **Włącz API.** Menu ☰ → *Interfejsy API i usługi* → *Biblioteka*. Wpisz
   `Google Search Console API`, wejdź w wynik i kliknij **Włącz**.
   Bez tego kroku klucz powstanie, ale każde wywołanie zwróci błąd 403.
4. **Utwórz konto serwisowe.** Menu ☰ → *Interfejsy API i usługi* → *Dane
   logowania* → **Utwórz dane logowania** → *Konto usługi*. Nazwa dowolna,
   np. `seo-czytnik`. Kliknij **Utwórz i kontynuuj**, potem **Dalej** i **Gotowe**.
   **Nie nadawaj żadnej roli IAM** — dostęp do danych nadaje się w Search Console,
   nie tutaj.
5. **Pobierz klucz.** Kliknij na utworzone konto → zakładka *Klucze* → **Dodaj
   klucz** → *Utwórz nowy klucz* → **JSON** → *Utwórz*. Plik pobierze się sam.

### 4.2. Klucz na dysku

Przenieś pobrany plik dokładnie tutaj i odetnij prawa innym:

```bash
mkdir -p ~/.seo
mv ~/Downloads/<nazwa-pobranego-pliku>.json ~/.seo/gsc.sa.json
chmod 600 ~/.seo/gsc.sa.json
```

W PowerShell na Windowsie:

```powershell
mkdir -Force $HOME\.seo
Move-Item $HOME\Downloads\<nazwa-pobranego-pliku>.json $HOME\.seo\gsc.sa.json
```

**Nic nie musisz eksportować.** Narzędzie samo szuka klucza pod
`~/.seo/gsc.sa.json`. Zmienna `SEO_GSC_KEY_FILE` nadal działa i nadpisuje
tę ścieżkę, ale jest potrzebna tylko wtedy, gdy trzymasz klucz gdzie indziej.

Sekret **nigdy** nie trafia do repozytorium — `.gitignore` łapie `*.sa.json`,
a `pnpm check:secrets` to sprawdza.

### 4.3. Adres konta serwisowego

Jest w pobranym pliku, w polu `client_email`. Wygląda tak:
`seo-czytnik@seo-lokalnie.iam.gserviceaccount.com`.

```bash
grep -o '"client_email": *"[^"]*"' ~/.seo/gsc.sa.json
```

### 4.4. Dostęp w Search Console

1. Wejdź na <https://search.google.com/search-console> i wybierz property.
2. Lewe menu → **Ustawienia** → *Użytkownicy i uprawnienia*.
3. **Dodaj użytkownika** → wklej adres z punktu 4.3 → uprawnienie **Pełny**.

Uprawnienie *Ograniczony* też wystarcza do czytania danych o skuteczności,
ale *Pełny* oszczędza niespodzianek przy kolejnych komendach.

### 4.5. Sprawdzenie

`smoke` to **jedno** prawdziwe wywołanie API — jedyne w całym projekcie,
które wychodzi do sieci poza crawlem. Jeśli przejdzie, reszta przejdzie też.

```bash
pnpm seo gsc smoke --site <adres-property>
pnpm seo gsc sync  --site <adres-property>
```

Adres property wpisujesz **dokładnie tak, jak widnieje w Search Console**:

- property typu *domena* → `sc-domain:twojadomena.pl`
- property typu *prefiks adresu* → pełny adres z ukośnikiem na końcu,
  np. `https://kryspindadok21-cpu.github.io/R/`

Kontrola uczciwości danych: liczba kliknięć z `pnpm seo gsc verify --site …
--date <RRRR-MM-DD>` musi zgadzać się z tym, co pokazuje interfejs Search Console
dla tego samego dnia. Różnica oznacza błąd, nie zaokrąglenie.

### 4.6. Property bez własnej domeny

Domeny są odłożone na koniec, ale Search Console **nie wymaga własnej domeny**.
Strona na GitHub Pages nadaje się w pełni:

1. W Search Console → *Dodaj property* → **Prefiks adresu URL** →
   `https://kryspindadok21-cpu.github.io/R/`.
   Typ *Domena* tu nie zadziała — wymaga wpisu DNS, którego na `github.io` nie masz.
2. Google poprosi o potwierdzenie własności. Wybierz **Tag HTML** i skopiuj
   podaną linijkę `<meta name="google-site-verification" content="…">`.
3. Wklej ją w `site/index.html`, zaraz pod `<meta name="viewport" …>`,
   i wypchnij zmianę. Workflow `Strona` wdraża `site/` sam po każdym pushu.
4. Poczekaj na zakończenie wdrożenia (zakładka *Actions* w repozytorium),
   dopiero potem kliknij **Zweryfikuj**.

**Czego się spodziewać:** Search Console **nie ma danych wstecz**. Zbieranie
zaczyna się w dniu dodania property, a pierwsze wiersze pojawiają się po dwóch–trzech
dniach — i tylko wtedy, gdy strona jest zaindeksowana i ktoś ją w ogóle wyświetla.
Świeża strona bez ruchu zwróci zero wierszy i panel powie o tym wprost. To nie jest
usterka: to brak danych, a nie brak dostępu. Im wcześniej dodasz property, tym
wcześniej będzie co liczyć.

---

## 5. PageSpeed Insights

Działa bez klucza, tylko z niższym limitem:

```bash
npx tsx apps/cli/src/bin.ts psi --site <adres-property> --limit 5
```

Klucz podnosi limit i ustawia się przez `SEO_PSI_KEY`.

---

## 6. Sesja Claude Code na komputerze

Nic nie musisz streszczać. Repozytorium samo niesie kontekst:

- `CLAUDE.md` wczytuje się na starcie każdej sesji
- Tabela **STAN PRAC** w `docs/superpowers/plans/2026-08-28-faza-1-crawler-audyt.md`
  mówi, co zrobione i gdzie wznowić

Wystarczy otworzyć katalog `R` i napisać, co chcesz zrobić. Dobrym pierwszym
poleceniem jest:

> sprawdź stan prac i powiedz, co zostało do zrobienia

---

## 7. Czego **nie** trzeba powtarzać

Te rzeczy są zweryfikowane i mają testy — powtórka niczego nie doda:

- 662 testy jednostkowe i integracyjne
- crawl, audyt i raport przez HTTPS na żywej stronie
- reguły warstw, skan sekretów, izolacja tenantów
- wykrywanie treści wymagającej JS na fixture'ach

Powtarza się **tylko to, co miało kontakt z prawdziwym światem**: renderowanie
prawdziwej przeglądarki, prawdziwe API Google i prawdziwe dane Twojej strony.
