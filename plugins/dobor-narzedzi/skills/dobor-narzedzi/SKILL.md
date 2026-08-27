---
name: dobor-narzedzi
description: Użyj na starcie każdego nietrywialnego zadania w tym repozytorium, żeby dobrać umiejętności pod to konkretne zadanie zamiast wczytywać wszystkie. Także gdy padnie "które skille wziąć", "dobierz narzędzia", "jakich umiejętności użyć", "kończy mi się limit", "oszczędzaj kontekst", "za dużo tokenów", albo gdy zadanie zmienia charakter w trakcie i poprzedni zestaw przestał pasować.
---

# Dobór narzędzi i dyscyplina limitów

Katalog `.agents/skills` ma piętnaście umiejętności. Wczytanie wszystkich to
~48 tys. tokenów samych `SKILL.md` i ~104 tys. materiałów dodatkowych — więcej
niż większość zadań w ogóle potrzebuje, i tyle kontekstu, że na pracę zostaje
resztka. Ta umiejętność zamienia „wczytaj wszystko" na „wczytaj to, co pasuje,
w ramach budżetu".

## Jak dobrać umiejętności

```bash
pnpm -s skills:pick "opis zadania własnymi słowami"
```

Narzędzie zwraca kandydatów posortowanych trafnością, z kosztem każdego w
tokenach i słowami, które zadecydowały o dopasowaniu. Zadanie można opisać po
polsku — słownik pojęć dokleja angielskie odpowiedniki, bo opisy umiejętności
są po angielsku.

Wynik to **kandydaci, nie werdykt**. Dopasowanie jest leksykalne: liczy
pokrycie słów ważone rzadkością. Zanim wczytasz umiejętność:

1. Przeczytaj jej `description` w `skills-index.json` — jedna linia, nie plik.
2. Odrzuć te, które trafiły przypadkiem (jedno pospolite słowo, trafność < 3).
3. Wczytaj `SKILL.md` tylko tych, które zostały.

Gdy narzędzie nie zwróci nic, pracuj bez umiejętności. Brak dopasowania to
odpowiedź, nie awaria.

## Budżet

- **12 000 tokenów** na `SKILL.md` w jednym zadaniu, **najwyżej 4** umiejętności.
  Wartości zmienia się flagami w `skills-pick.ts` albo konfiguracją pluginu.
- **Materiałów dodatkowych nie wczytuje się z góry.** `skills-index.json` podaje
  koszt każdego pliku `references/*`. Sięgasz po konkretny plik dopiero wtedy,
  gdy praca go wymaga — nie „na wszelki wypadek".
- Przy remisie trafności wygrywa tańsza umiejętność. Dwie po 1500 tokenów biją
  jedną za 8000, jeśli mówią to samo.
- Gdy zadanie zmienia charakter — z audytu na debugowanie, z planowania na
  kodowanie — przelicz dobór od nowa zamiast dokładać do poprzedniego zestawu.

## Praca pod limitem

Limit wyczerpuje się na czytaniu i powtarzaniu, nie na pisaniu kodu. W tym
repozytorium obowiązuje:

- **Zacznij od tabeli STAN PRAC** w `docs/superpowers/plans/2026-08-27-faza-0-fundament.md`.
  Mówi, co zrobione i gdzie wznowić. Plan ma 3000 linii — nigdy nie czytaj go w całości.
- **Czytaj zakresami.** `sed -n '880,1212p' plik` zamiast wczytywania całego pliku.
  Numery sekcji znajdziesz przez `grep -n '^### Zadanie'`.
- **Commituj po każdym zadaniu i od razu pushuj.** Praca niewypchnięta w chwili
  wyczerpania limitu jest pracą do powtórzenia.
- **Aktualizuj STAN PRAC razem z commitem.** Następna sesja startuje z tej tabeli
  i nie musi rekonstruować kontekstu z rozmowy.
- **Nie sprawdzaj tego samego dwa razy.** Jeśli `pnpm test` przeszło po zmianie,
  nie uruchamiaj go ponownie „dla pewności" przed commitem tej samej zmiany.

## Aktualizacja katalogu

Po dodaniu, usunięciu lub zmianie umiejętności:

```bash
pnpm -s skills:index
```

Przelicza `skills-index.json` — nazwy, opisy i koszty. Bez tego dobór opiera się
na nieaktualnych kosztach i może przekroczyć budżet, o którym myśli, że go trzyma.

## Czego to nie robi

Nie instaluje umiejętności ani nie ściąga ich z sieci. Katalog pochodzi z
`skills-lock.json` i jest wersjonowany razem z kodem — dobór działa na tym, co
w repozytorium już jest.
