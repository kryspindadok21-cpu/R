/**
 * MonerLeadTracer — pomocnicze funkcje niszowe dla analityka.
 *
 * Ten plik NIE trzyma danych o niszach — źródłem prawdy jest src/config/niches.ts.
 * Tutaj jest tylko bezpieczny dostęp do tych danych i opis słowny użyty w breakdown.
 */

import { NICHES, nicheLabel } from '@/config/niches';
import type { Niche, NicheId } from '@/lib/types';

/** Nisza, na którą spadamy, gdy `niche` przyszło z bazy/API jako coś spoza unii. */
const FALLBACK_NICHE: Niche = NICHES.inne;

/**
 * Bezpieczny odczyt definicji niszy.
 * TypeScript uważa `NICHES[niche]` za zawsze obecne (Record po unii),
 * ale w runtime `niche` bierze się z bazy i z Google — tam może być śmieć.
 */
export function nicheOf(niche: NicheId): Niche {
  const found: Niche | undefined = (NICHES as Partial<Record<NicheId, Niche>>)[niche];
  return found ?? FALLBACK_NICHE;
}

/** Waga niszy w scoringu (0-20). Patrz `scoreWeight` w src/config/niches.ts. */
export function nicheScoreWeight(niche: NicheId): number {
  const weight = nicheOf(niche).scoreWeight;
  return Number.isFinite(weight) ? weight : FALLBACK_NICHE.scoreWeight;
}

/** Nazwa niszy do UI. Cienka nakładka na `nicheLabel` z configu — z tym samym fallbackiem co reszta pliku. */
export function nicheLabelFor(niche: NicheId): string {
  const known: Niche | undefined = (NICHES as Partial<Record<NicheId, Niche>>)[niche];
  // Dla nieznanej niszy config zwróciłby surowe id — w UI lepiej wygląda "Inne".
  return known ? nicheLabel(niche) : FALLBACK_NICHE.label;
}

/** Trzy szczeble wartości handlowej niszy — używane w opisie punktacji. */
export type NicheValueBand = 'wysoka' | 'srednia' | 'niska';

/**
 * Progi trzymają się wag z configu (20 / 16 / 10 / 6).
 * Jeżeli ktoś przestawi `scoreWeight`, opis nadal będzie się zgadzał z punktacją.
 */
export function nicheValueBand(niche: NicheId): NicheValueBand {
  const weight = nicheScoreWeight(niche);
  if (weight >= 20) return 'wysoka';
  if (weight >= 14) return 'srednia';
  return 'niska';
}

/** Krótkie uzasadnienie, dlaczego ta nisza jest warta tyle punktów. Ląduje w breakdown w UI. */
export function nicheValueNote(niche: NicheId): string {
  switch (nicheValueBand(niche)) {
    case 'wysoka':
      return 'wysoka wartość — decyduje jedna osoba, łatwo sprzedać stronę';
    case 'srednia':
      return 'średnia wartość — dłuższa decyzja, ale realna sprzedaż';
    case 'niska':
      return 'niska wartość — mała szansa na zamknięcie';
  }
}

/** Gotowa linijka do breakdown, np. "nisza: Beauty / barber (wysoka wartość — ...)". */
export function nicheReason(niche: NicheId): string {
  return `nisza: ${nicheLabelFor(niche)} (${nicheValueNote(niche)})`;
}
