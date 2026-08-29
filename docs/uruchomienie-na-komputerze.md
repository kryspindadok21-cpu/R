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

## 4. Search Console — domknięcie Fazy 0

Faza 0 czeka na jedną rzecz po Twojej stronie: konto serwisowe musi mieć dostęp
do property w Search Console.

1. Klucz konta serwisowego (JSON) zapisz jako `~/.seo/gsc.sa.json`
   i ogranicz uprawnienia: `chmod 600 ~/.seo/gsc.sa.json`
2. W Search Console → *Ustawienia* → *Użytkownicy i uprawnienia* dodaj adres
   e-mail konta serwisowego jako użytkownika
3. Ustaw ścieżkę i sprawdź jednym wywołaniem:

```bash
export SEO_GSC_KEY_FILE=~/.seo/gsc.sa.json
npx tsx apps/cli/src/bin.ts gsc smoke --site <adres-property>
```

`smoke` to **jedno** prawdziwe wywołanie API. Jeśli przejdzie, reszta przejdzie też:

```bash
npx tsx apps/cli/src/bin.ts gsc sync   --site <adres-property>
npx tsx apps/cli/src/bin.ts gsc verify --site <adres-property> --date <RRRR-MM-DD>
```

**Sprawdzian uczciwości danych:** liczba kliknięć z `gsc verify` musi zgadzać się
z tym, co pokazuje interfejs Search Console dla tego samego dnia. Różnica oznacza
błąd, nie zaokrąglenie.

Sekret **nigdy** nie trafia do repozytorium — `.gitignore` łapie `*.sa.json`,
a `pnpm check:secrets` to sprawdza.

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
