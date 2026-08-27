---
description: Dobiera umiejętności pod opisane zadanie w ramach budżetu tokenów
argument-hint: <opis zadania>
allowed-tools: Bash(pnpm -s skills:pick:*), Bash(pnpm -s skills:index:*), Read
---

Uruchom dobór umiejętności dla zadania: **$ARGUMENTS**

```bash
pnpm -s skills:pick "$ARGUMENTS"
```

Następnie:

1. Dla każdego kandydata sprawdź `description` w `skills-index.json`.
2. Odrzuć trafienia przypadkowe — pojedyncze pospolite słowo albo trafność poniżej 3.
3. Wczytaj `SKILL.md` tylko tych, które zostały po weryfikacji, i wypisz decyzję:
   co bierzesz, czego nie bierzesz i dlaczego, oraz ile tokenów to kosztuje.

Nie wczytuj plików z `references/` — ich koszt jest w indeksie, sięgasz po nie
dopiero, gdy praca ich wymaga.
