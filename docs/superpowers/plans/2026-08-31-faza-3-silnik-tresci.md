# Faza 3 — Silnik treści. Plan wykonawczy

**Cel:** jedno polecenie zamienia klaster fraz w gotowy do przeglądu artykuł
i otwiera pull request — z bramkami, których nie da się obejść.

**Spec:** `docs/superpowers/specs/2026-08-31-faza-3-silnik-tresci-design.md` (decyzje D33–D44)

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 1. Specyfikacja Fazy 3 (D33–D44) | ukończone | — |
| 2. `packages/keywords` — klastrowanie i pokrycie tematu | niezaczęte | — |
| 3. `packages/content` — bramka oryginalności i scoring | niezaczęte | — |
| 4. `packages/content` — generator briefów i linkowanie wewnętrzne | niezaczęte | — |
| 5. `packages/db` — migracja `0004` + repozytoria treści | niezaczęte | — |
| 6. `packages/providers` — generowanie draftu i adapter `git-pr` | niezaczęte | — |
| 7. `apps/cli` — `seo keywords cluster`, `seo brief` | niezaczęte | — |
| 8. `apps/cli` — `seo draft`, `seo publish` | niezaczęte | — |
| 9. Odbiór Fazy 3 na własnej stronie | niezaczęte | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone),
potem pierwsze zadanie ze stanem innym niż „ukończone".

## Kolejność i uzasadnienie

Bramki idą **przed** generowaniem. To nie jest kwestia porządku, tylko tego,
że bramka dopisana po generatorze zawsze jest sprawdzeniem w czasie wykonania,
które da się pominąć — a bramka napisana pierwsza staje się typem, przez który
generator musi przejść. D34 i D37 są egzystencjalne dla tej fazy, więc powstają
jako pierwsze i to one dyktują kształt reszty.

Klastrowanie idzie przed briefem, bo brief bez klastra jest briefem o jednej
frazie, a to nie jest jednostka, w której myśli wyszukiwarka.

Publikacja idzie ostatnia i celowo jako `git-pr` — najwęższy możliwy adapter,
za to z darmowym rollbackiem.

## Odstępstwa od planu odnotowane w trakcie

*(dopisywane w miarę pracy)*
