# Co teraz — lista dla właściciela

Stan na 2026-09-01, 23:00. **Cała część do zrobienia z telefonu jest zamknięta.**
Zostały trzy rzeczy, wszystkie na komputerze.

---

## ✅ Zrobione 2026-09-01

| | Co | Dowód |
|---|---|---|
| 1 | Property `https://kryspindadok21-cpu.github.io/R/` dodana i zweryfikowana | „Jesteś zweryfikowanym właścicielem"; usługa dodana 1 września 2026 |
| 2 | Mapa witryny zgłoszona ręcznie w Search Console | — |
| 3 | Projekt w Google Cloud + `Google Search Console API` **włączone** | — |
| 4 | Konto serwisowe `seo-bot` dodane do property z uprawnieniem **Pełne** | widoczne na liście *Użytkownicy (2)* |

**Nie kasuj** `site/google87481e6c21f429cf.html` — Google sprawdza go ponownie
i usunięcie unieważnia weryfikację.

---

## 5. Klucz JSON  ⟶ komputer

Google Cloud → konto usługi `seo-bot` → *Klucze* → **Dodaj klucz** →
*Utwórz nowy klucz* → **JSON**. Pobierze się sam.

```powershell
mkdir -Force $HOME\.seo
Move-Item $HOME\Downloads\<pobrany-plik>.json $HOME\.seo\gsc.sa.json
```

Nie wysyłaj tego pliku mailem ani przez Drive'a — to klucz prywatny konta
serwisowego. Nic nie eksportujesz: narzędzie samo szuka klucza pod
`~/.seo/gsc.sa.json`.

---

## 6. Sprawdzenie  ⟶ komputer

```bash
git pull origin claude/kodowanie-projektu-vuxkes
pnpm install
pnpm seo gsc smoke --site https://kryspindadok21-cpu.github.io/R/
pnpm seo gsc sync  --site https://kryspindadok21-cpu.github.io/R/
```

**Czego się spodziewać:**

- `smoke` przechodzi → wszystko spięte poprawnie.
- `smoke` zwraca **403** → konto serwisowe i włączone API są w **dwóch różnych
  projektach** Google Cloud. To jedyna pułapka, jaka została: sprawdź, w którym
  projekcie leży `seo-bot`, i włącz `Google Search Console API` w tym samym.
- `sync` zwraca **zero wierszy** → poprawne, nie awaria. Property dodana
  1 września 2026, Search Console liczy od dnia dodania, pierwsze wiersze
  po dwóch–trzech dniach i tylko gdy strona jest zaindeksowana i ktoś ją
  wyświetla. Panel powie o tym wprost.

---

## 7a. Darmowy klucz PageSpeed Insights  ⟶ komputer, 2 minuty

Sprawdzone 2026-09-02: bez klucza PSI zwraca **429** przy pierwszym żądaniu.
Limit anonimowy jest praktycznie zerowy, więc `seo psi` nie ma jak działać.

Klucz jest darmowy i bierze się go z **tego samego projektu**, w którym
siedzi `seo-bot`: Google Cloud → *Dane logowania* → **Utwórz dane logowania**
→ *Klucz interfejsu API*. Włącz też `PageSpeed Insights API` w Bibliotece.

```powershell
setx SEO_PSI_KEY "AIza..."
```

Odblokowuje pomiar Core Web Vitals — dane terenowe i laboratoryjne osobno,
nigdy zmieszane w jednej liczbie.

---

## 7b. Darmowy klucz do silnika AI  ⟶ komputer, opcjonalne

**Jedyna warstwa, która da coś do oglądania tego samego wieczora** — nie czeka
na żadne dane historyczne.

<https://console.groq.com> → konto → *API Keys* → utwórz klucz.
Darmowy limit 14 400 żądań dziennie, na tygodniowy pomiar z ogromnym zapasem.

```powershell
setx SEO_GROQ_KEY "gsk_..."
```

Nowa konsola → `pnpm panel` → Twoja strona → **Widoczność w AI**: ustaw markę,
dopisz pytania klientów, kliknij *Zmierz*.

---

## Czego NIE musisz robić

- **Kupować domeny.** GitHub Pages wystarcza do wszystkiego powyżej.
- **Płacić za nic.** Search Console API nie ma płatnego progu, Groq ma darmowy
  limit, konto serwisowe nie wymaga karty.
- **Wystawiać panelu na sieć.** Nasłuchuje wyłącznie na pętli zwrotnej i tak ma
  zostać — uruchamia crawler na dowolny adres i ma pełny dostęp do bazy.
