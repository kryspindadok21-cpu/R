# Dobór narzędzi i dyscyplina limitów

Plugin do Claude Code dla tego repozytorium. Robi dwie rzeczy:

1. **Dobiera umiejętności pod zadanie.** Zamiast wczytywać wszystkie piętnaście
   umiejętności z `.agents/skills` (~48 tys. tokenów), wybiera te, które pasują
   do opisu zadania, i mieści się w budżecie.
2. **Narzuca zasady pracy pod limitem.** Czytanie zakresami, commit i push po
   każdym zadaniu, stan prac w pliku zamiast w pamięci rozmowy.

## Instalacja

Z katalogu nadrzędnego wobec repozytorium:

```
/plugin marketplace add ./R
/plugin install dobor-narzedzi@seo-platform
```

## Użycie

```
/skille chcę dodać dane strukturalne do stron produktów
```

albo bezpośrednio:

```bash
pnpm -s skills:pick "test się wywala, znajdź przyczynę błędu"
pnpm -s skills:index    # po zmianie katalogu umiejętności
```

## Jak działa dobór

`scripts/skills-index.ts` czyta frontmatter każdego `SKILL.md`, mierzy koszt
pliku i materiałów dodatkowych, zapisuje `skills-index.json`.

`scripts/skills-pick.ts` liczy trafność każdej umiejętności wobec zadania:

- fraza w cudzysłowie z opisu, obecna w zadaniu — 5 punktów (autor umiejętności
  wypisał ten wyzwalacz wprost),
- słowo z nazwy umiejętności — 3 punkty,
- słowo z opisu — 1 punkt,
- każdy punkt mnożony przez wagę rzadkości słowa: „test" występuje w połowie
  opisów i nie rozróżnia niczego, „ulid" występuje w jednym i jest mocną
  wskazówką.

Zadania po polsku przechodzą przez słownik pojęć dziedzinowych — opisy
umiejętności są po angielsku, więc bez tego mostka „dane strukturalne" nie
trafiłoby w „structured data".

Wybór jest deterministyczny: przy remisie wygrywa tańsza umiejętność, potem
kolejność alfabetyczna. Ten sam opis zadania zawsze daje ten sam zestaw.

## Ograniczenia

- Dopasowanie jest leksykalne, nie znaczeniowe. Synonim spoza słownika nie
  zostanie rozpoznany. Dlatego narzędzie zwraca **kandydatów** z uzasadnieniem,
  a decyzję podejmuje model po sprawdzeniu opisów.
- Koszt w tokenach to szacunek (~3,5 znaku na token), nie rachunek dostawcy.
- Polecenia wymagają zainstalowanych zależności repozytorium (`pnpm install`).
