# Faza 4 — Pętla agentowa. Plan wykonawczy

**Cel:** system przez tydzień pracuje bez właściciela i mówi jednym zdaniem na
akcję: co zrobił, co z tego wyszło i czy to na pewno przez niego.

**Spec:** `docs/superpowers/specs/2026-08-31-faza-4-petla-agentowa-design.md` (decyzje D45–D54)

## STAN PRAC — czytaj to najpierw

Aktualizowany po każdym ukończonym zadaniu. Nowa sesja zaczyna od tej tabeli.

| Zadanie | Stan | Commit |
|---|---|---|
| 1. Specyfikacja Fazy 4 (D45–D54) | ukończone | — |
| 2. `packages/agent` — różnica w różnicach i werdykty (D48–D51) | niezaczęte | — |
| 3. `packages/agent` — scoring okazji i dobór kontroli (D45, D49) | niezaczęte | — |
| 4. `packages/agent` — silnik polityk i wyłączniki (D47, D52) | niezaczęte | — |
| 5. `packages/db` — migracja `0005` + repozytoria agenta | niezaczęte | — |
| 6. `apps/cli` — `seo agent plan`, `board`, `verdicts` | niezaczęte | — |
| 7. `packages/report` — tablica zadań i werdykty | niezaczęte | — |
| 8. Odbiór Fazy 4 | niezaczęte | — |

**Jak wznowić po przerwie:** `pnpm install`, potem `pnpm test` (musi być zielone),
potem pierwsze zadanie ze stanem innym niż „ukończone".

## Kolejność i uzasadnienie

**Pomiar idzie pierwszy**, przed scoringiem i przed politykami. Powód jest ten
sam, co przy bramkach w Fazie 3: warstwa, która powstaje ostatnia, dopasowuje się
do tego, co już jest, zamiast dyktować kształt. A tu chodzi o jedyną rzecz, której
konkurencja nie ma — jeśli pomiar będzie kiepski, cała reszta jest zwykłym
narzędziem do publikowania.

Polityki i wyłączniki idą przed bazą, bo to one decydują, jakie stany zadania
w ogóle istnieją.

## Odstępstwa od planu odnotowane w trakcie

*(dopisywane w miarę pracy)*
