# Co teraz — lista dla właściciela

Krótka lista rzeczy, których **nie da się zrobić za Ciebie**, w kolejności
wykonania. Reszta projektu na nie czeka. Po odhaczeniu wszystkiego skasuj ten
plik albo zostaw jako ślad.

Stan na 2026-09-01. Kod: Fazy 0–4 zamknięte, panel obsługuje wszystkie cztery
warstwy, 1201 testów zielonych.

---

## 0. Na komputerze, zanim cokolwiek

```bash
git pull origin claude/kodowanie-projektu-vuxkes
pnpm install
```

Gałąź ma cztery commity, których Twój lokalny klon jeszcze nie widział.

---

## 1. ~~Search Console — potwierdź własność~~  ✅ ZROBIONE 2026-09-01

Property `https://kryspindadok21-cpu.github.io/R/` jest zweryfikowana i widoczna
na liście. Plik potwierdzający leży pod
`https://kryspindadok21-cpu.github.io/R/google87481e6c21f429cf.html` — **nie
kasuj go**, Google sprawdza go ponownie i skasowanie unieważnia weryfikację.

---

## 2. Zgłoś mapę witryny ręcznie  ⟶ telefon albo komputer

Search Console → **Mapy witryn** → wklej:

```
https://kryspindadok21-cpu.github.io/R/sitemap.xml
```

**To nie jest opcjonalne.** Nasz audyt zgłasza to jako `sitemap.not-discoverable`:
`robots.txt` z repozytorium ląduje pod `/R/robots.txt`, a wyszukiwarki czytają
wyłącznie korzeń hosta, którego nie kontrolujesz. Linia `Sitemap:` w naszym pliku
jest martwa. Ręczne zgłoszenie to jedyna droga, żeby Google dowiedział się o tych
czterech stronach.

---

## 3. Konto serwisowe w Google Cloud  ⟶ telefon albo komputer

<https://console.cloud.google.com>, konto Google to samo, co w Search Console.

1. Nowy projekt, nazwa dowolna.
2. ☰ → *Interfejsy API i usługi* → **Biblioteka** → `Google Search Console API` →
   **Włącz**. ← ten krok najczęściej się pomija, a bez niego wszystko zwraca 403.
3. ☰ → *Dane logowania* → **Utwórz dane logowania** → *Konto usługi* → nazwa →
   Utwórz → **Dalej** → **Gotowe**. **Żadnej roli IAM.**

Klucza **jeszcze nie pobieraj** — patrz punkt 5.

---

## 4. Nadaj temu kontu dostęp  ⟶ telefon albo komputer

Skopiuj adres konta serwisowego (widoczny na liście kont, kończy się na
`.iam.gserviceaccount.com`).

Search Console → **Ustawienia** → *Użytkownicy i uprawnienia* →
**Dodaj użytkownika** → wklej adres → uprawnienie **Pełny**.

---

## 5. Klucz JSON  ⟶ TYLKO komputer

Google Cloud → Twoje konto usługi → *Klucze* → **Dodaj klucz** →
*Utwórz nowy klucz* → **JSON**. Pobierze się sam.

```powershell
mkdir -Force $HOME\.seo
Move-Item $HOME\Downloads\<pobrany-plik>.json $HOME\.seo\gsc.sa.json
```

**Nie rób tego z telefonu** i nie wysyłaj sobie tego pliku mailem ani przez
Drive'a. To jest klucz prywatny konta serwisowego — przepuszczenie go przez cudzy
serwer to dokładnie ten rodzaj wycieku, którego pilnuje `pnpm check:secrets`.

Nic nie eksportujesz — narzędzie samo szuka klucza pod `~/.seo/gsc.sa.json`.

---

## 6. Sprawdź, że działa  ⟶ komputer

```bash
pnpm seo gsc smoke --site https://kryspindadok21-cpu.github.io/R/
pnpm seo gsc sync  --site https://kryspindadok21-cpu.github.io/R/
```

`smoke` to **jedno** prawdziwe wywołanie API — jedyne w całym projekcie poza
crawlem. Przejdzie ono, przejdzie reszta.

**Czego się spodziewać:** `sync` zwróci **zero wierszy** i to jest poprawne.
Search Console liczy od dnia weryfikacji property, pierwsze dane pojawiają się po
dwóch–trzech dniach i tylko wtedy, gdy strona jest zaindeksowana i ktoś ją
wyświetla. Panel powie o tym wprost, zamiast udawać. To brak danych, nie brak
dostępu.

---

## 7. Darmowy klucz do silnika AI  ⟶ komputer, opcjonalne, ale warte kwadransa

Tego **nie blokuje Search Console**. Odblokowuje całą warstwę pomiaru
widoczności w AI, która działa od razu i nie czeka na żadne dane historyczne.

<https://console.groq.com> → załóż konto → *API Keys* → utwórz klucz.
Darmowy limit to 14 400 żądań dziennie, na tygodniowy pomiar z ogromnym zapasem.

```powershell
setx SEO_GROQ_KEY "gsk_..."
```

Potem otwórz nową konsolę, `pnpm panel`, wejdź w swoją stronę → **Widoczność w
AI**: ustaw markę, dopisz pytania klientów, kliknij *Zmierz*.

---

## Czego NIE musisz robić

- **Kupować domeny.** GitHub Pages wystarcza do wszystkiego powyżej.
- **Płacić za nic.** Search Console API nie ma płatnego progu, Groq ma darmowy
  limit, konto serwisowe nie wymaga karty.
- **Wystawiać panelu na sieć.** Nasłuchuje wyłącznie na pętli zwrotnej i tak ma
  zostać — uruchamia crawler na dowolny adres i ma pełny dostęp do bazy.
