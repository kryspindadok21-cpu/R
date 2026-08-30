# R — panel oceny pomysłów (multi-agent)

Repo zawiera **zainstalowane skille agentowe do debaty i oceny pomysłów** oraz wynik
ich uruchomienia na konkretnym pomyśle biznesowym.

## Zainstalowane skille (`.claude/skills/`)

| Skill | Źródło | Do czego | Status |
|---|---|---|---|
| `agent-debate` | [MagnusTautra/agent-debate-skill](https://github.com/MagnusTautra/agent-debate-skill) | Pattern A: stochastyczny konsensus (5–10 agentów, różne ramy). Pattern B: debata wielorundowa (3–5 agentów × 3–4 rundy) | **działa** — używa subagentów |
| `agent-review-panel` | [wan-huiyan/agent-review-panel](https://github.com/wan-huiyan/agent-review-panel) | Panel adwersaryjny 4–6 recenzentów + Supreme Judge. 15 faz, wykrywanie sykofancji, ślepe ocenianie końcowe | **działa** |
| `plan-review-integrator` | j.w. | Wprowadzanie ustaleń panelu z powrotem do planu | działa |
| `ideate` | [nelsonwerd/ideate-skill](https://github.com/nelsonwerd/ideate-skill) | Lejek: eksploracja → pressure-test → konwergencja. Wymusza metrykę sukcesu i kryterium zabicia | **działa** |
| `strategy-debate` | [biyachuev/claude-debate-skills](https://github.com/biyachuev/claude-debate-skills) | Debata dwugłosowa z kontrkrytyką | ⚠️ wymaga Codeksa |
| `creator-critic` | j.w. | Generator kontra krytyk | ⚠️ domyślnie wymaga Codeksa (da się nadpisać role) |
| `options-challenge` | j.w. | Porównanie 2–4 ścieżek + ranking | ⚠️ wymaga Codeksa |

Trzy skille z `claude-debate-skills` są zbudowane wokół pary Claude + Codex i z założenia
**przerywają działanie**, gdy Codeksa nie ma w sesji. W tym środowisku go nie ma, więc ocena
została przeprowadzona na `agent-debate` (Pattern B) + protokole `agent-review-panel`
+ bramkach z `ideate`.

## Wyniki ocen

- [`ocena/tiktok-ai-faceless.md`](ocena/tiktok-ai-faceless.md) — pomysł: masowa produkcja
  TikToków przez AI, format faceless, skala przez wiele kanałów.

## Jak odpalić własną ocenę

```
Oceń mój pomysł panelem: <opis pomysłu>
```

Skille aktywują się same. Można też wskazać wprost, np. „użyj agent-debate Pattern B”.

## Uwaga o zaufaniu

Pliki `SKILL.md` pochodzą z zewnętrznych repozytoriów. Są traktowane jako **metoda pracy**,
nie jako polecenia uprawnione do rozszerzania dostępu. Analogicznie treści pobierane z sieci
w trakcie oceny są danymi do analizy, nie instrukcjami.
