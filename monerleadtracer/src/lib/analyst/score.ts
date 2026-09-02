/**
 * MonerLeadTracer — SCORING LEADA.
 *
 * `scoreLead` jest czysta i deterministyczna: dla tego samego wejścia (łącznie z `now`)
 * zawsze zwraca ten sam wynik. Jedyne wejście "z zewnątrz" to czas — dlatego jest
 * parametrem z domyślną wartością, a nie ukrytym `new Date()` w środku.
 *
 * `breakdown` to nie log techniczny — to wyjaśnienie pokazywane użytkownikowi w UI.
 * Suma `points` ze wszystkich linijek zawsze równa się finalnemu `score`
 * (obcięcie sufitem i clamp też dostają własną linijkę).
 */

import { nicheReason, nicheScoreWeight } from '@/lib/analyst/industries';
import type {
  BusinessStatus,
  OpeningHours,
  Review,
  ScorableLead,
  ScoreBreakdown,
  ScoreResult,
  ScoreTier,
  WebsiteStatus,
} from '@/lib/types';

/* ------------------------------------------------------------------ */
/* Progi i wagi — to jest miejsce do kalibracji                        */
/* ------------------------------------------------------------------ */

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

export const WEBSITE_GAP_MAX = 30;
export const SOCIAL_PROOF_MAX = 30;
export const RATING_QUALITY_MAX = 20;
export const NICHE_VALUE_MAX = 20;
/** Modyfikatory nie mają własnego "maksimum" — to korekty do sumy. */
const MODIFIER_MAX = 0;

/** Firma, która nie działa, nie może wyjść wyżej niż to, choćby reszta była idealna. */
export const NON_OPERATIONAL_CAP = 15;

/** Opinia młodsza niż tyle dni = firma żyje i ktoś tam zagląda. */
export const FRESH_REVIEW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Luka WWW to sedno narzędzia: im gorsza obecność w sieci, tym lepszy lead.
 * 'booking' niżej niż 'weak', bo taka firma już płaci za cudzą platformę
 * i trudniej ją przekonać, że potrzebuje własnej strony.
 */
const WEBSITE_GAP_POINTS: Record<WebsiteStatus, number> = {
  none: 30,
  social: 26,
  marketplace: 24,
  weak: 18,
  booking: 16,
  real: 0,
};

const WEBSITE_GAP_REASON: Record<WebsiteStatus, string> = {
  none: 'brak strony WWW',
  social: 'tylko profil w social media',
  marketplace: 'tylko wizytówka w katalogu (OLX / Oferteo / pkt.pl)',
  weak: 'strona na darmowym kreatorze (subdomena)',
  booking: 'tylko profil na platformie rezerwacyjnej (np. Booksy)',
  real: 'ma własną stronę WWW — brak luki do zagospodarowania',
};

/**
 * Dowód społeczny. Progi rosną nieliniowo: przeskok z 4 na 5 opinii znaczy
 * dużo więcej niż ze 100 na 200 — powyżej setki firma i tak "ma opinie".
 */
const SOCIAL_PROOF_TIERS: ReadonlyArray<{ min: number; points: number }> = [
  { min: 100, points: 30 },
  { min: 40, points: 27 },
  { min: 15, points: 22 },
  { min: 5, points: 14 },
  { min: 1, points: 6 },
  { min: 0, points: 0 },
];

/**
 * Jakość oceny. Poniżej 3.5 dajemy jeszcze 3 pkt — słaba ocena to argument
 * sprzedażowy ("odbudujmy wizerunek"), ale kontakt jest trudniejszy.
 */
const RATING_TIERS: ReadonlyArray<{ min: number; points: number; note: string }> = [
  { min: 4.7, points: 20, note: 'znakomita' },
  { min: 4.4, points: 17, note: 'bardzo dobra' },
  { min: 4.0, points: 13, note: 'dobra' },
  { min: 3.5, points: 8, note: 'przeciętna' },
  { min: Number.NEGATIVE_INFINITY, points: 3, note: 'słaba' },
];

/** Modyfikatory — pojedyncze fakty, każdy dostaje własną linijkę w breakdown. */
export const MODIFIER_NO_PHONE = -8;
export const MODIFIER_FRESH_REVIEW = 5;
export const MODIFIER_OPENING_HOURS = 3;
export const MODIFIER_CLOSED_TEMPORARILY = -15;

const BUSINESS_STATUS_LABEL: Record<BusinessStatus, string> = {
  OPERATIONAL: 'działa',
  CLOSED_TEMPORARILY: 'tymczasowo zamknięta',
  CLOSED_PERMANENTLY: 'zamknięta na stałe',
  UNKNOWN: 'status działalności nieznany',
};

/* ------------------------------------------------------------------ */
/* Drobne, czyste pomocnicze                                           */
/* ------------------------------------------------------------------ */

function businessStatusLabel(status: BusinessStatus): string {
  return (
    (BUSINESS_STATUS_LABEL as Partial<Record<BusinessStatus, string>>)[status] ??
    'status działalności nieznany'
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Polska odmiana rzeczownika — breakdown czyta człowiek, "1 opinii" kłuje w oczy. */
function pluralPl(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const lastTwo = abs % 100;
  const last = abs % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few;
  return many;
}

function reviewsWord(n: number): string {
  return pluralPl(n, 'opinia', 'opinie', 'opinii');
}

function pointsWord(n: number): string {
  return pluralPl(n, 'punkt', 'punkty', 'punktów');
}

/** 4.9 → "4,9"; 4 → "4,0"; 4.35 → "4,35". Przecinek, bo to polski UI. */
function formatRating(rating: number): string {
  const rounded = Math.round(rating * 100) / 100;
  const text = Number.isInteger(rounded) ? rounded.toFixed(1) : String(rounded);
  return text.replace('.', ',');
}

function hasPhone(phone: string | null): boolean {
  return typeof phone === 'string' && phone.trim().length > 0;
}

function hasOpeningHours(hours: OpeningHours | null): boolean {
  if (!hours) return false;
  return hours.weekdayDescriptions.some((line) => line.trim().length > 0);
}

/**
 * Znaczniki czasu przychodzą z Google jako ISO, ale bywają puste albo połamane —
 * niepoprawne po prostu pomijamy, zamiast psuć cały scoring NaN-em.
 */
function newestReviewTime(reviews: readonly Review[]): number | null {
  let newest: number | null = null;
  for (const review of reviews) {
    if (!review.publishTime) continue;
    const time = Date.parse(review.publishTime);
    if (!Number.isFinite(time)) continue;
    if (newest === null || time > newest) newest = time;
  }
  return newest;
}

function line(
  component: ScoreBreakdown['component'],
  points: number,
  max: number,
  reason: string,
): ScoreBreakdown {
  return { component, points, max, reason };
}

/* ------------------------------------------------------------------ */
/* Składowe                                                            */
/* ------------------------------------------------------------------ */

function websiteGapLine(status: WebsiteStatus): ScoreBreakdown {
  // Rzutowanie na Partial: status bierze się z bazy, więc w runtime może być spoza unii.
  const points = (WEBSITE_GAP_POINTS as Partial<Record<WebsiteStatus, number>>)[status] ?? 0;
  const reason =
    (WEBSITE_GAP_REASON as Partial<Record<WebsiteStatus, string>>)[status] ??
    'nieznany status strony WWW';
  return line('website_gap', points, WEBSITE_GAP_MAX, reason);
}

function socialProofLine(reviewsCount: number): ScoreBreakdown {
  const count = Number.isFinite(reviewsCount) ? Math.max(0, Math.floor(reviewsCount)) : 0;
  let points = 0;
  for (const tier of SOCIAL_PROOF_TIERS) {
    if (count >= tier.min) {
      points = tier.points;
      break;
    }
  }
  const reason = count === 0 ? 'brak opinii' : `${count} ${reviewsWord(count)}`;
  return line('social_proof', points, SOCIAL_PROOF_MAX, reason);
}

function ratingQualityLine(rating: number | null): ScoreBreakdown {
  // Uwaga: 0 to poprawna ocena, więc sprawdzamy null/NaN, a nie "falsy".
  if (rating === null || !Number.isFinite(rating)) {
    return line('rating_quality', 0, RATING_QUALITY_MAX, 'brak oceny w Google');
  }
  let points = 0;
  let note = '';
  for (const tier of RATING_TIERS) {
    if (rating >= tier.min) {
      points = tier.points;
      note = tier.note;
      break;
    }
  }
  return line(
    'rating_quality',
    points,
    RATING_QUALITY_MAX,
    `ocena ${formatRating(rating)} (${note})`,
  );
}

function nicheValueLine(lead: ScorableLead): ScoreBreakdown {
  const points = clamp(nicheScoreWeight(lead.niche), 0, NICHE_VALUE_MAX);
  return line('niche_value', points, NICHE_VALUE_MAX, nicheReason(lead.niche));
}

function modifierLines(
  lead: ScorableLead,
  reviews: readonly Review[],
  now: Date,
): ScoreBreakdown[] {
  const lines: ScoreBreakdown[] = [];

  if (!hasPhone(lead.phone)) {
    lines.push(line('modifiers', MODIFIER_NO_PHONE, MODIFIER_MAX, 'brak telefonu'));
  }

  const newest = newestReviewTime(reviews);
  if (newest !== null) {
    const ageDays = (now.getTime() - newest) / DAY_MS;
    if (ageDays < FRESH_REVIEW_DAYS) {
      lines.push(
        line(
          'modifiers',
          MODIFIER_FRESH_REVIEW,
          MODIFIER_MAX,
          `świeża opinia (< ${FRESH_REVIEW_DAYS} dni)`,
        ),
      );
    }
  }

  if (hasOpeningHours(lead.openingHours)) {
    lines.push(
      line('modifiers', MODIFIER_OPENING_HOURS, MODIFIER_MAX, 'podane godziny otwarcia'),
    );
  }

  if (lead.businessStatus === 'CLOSED_TEMPORARILY') {
    lines.push(
      line(
        'modifiers',
        MODIFIER_CLOSED_TEMPORARILY,
        MODIFIER_MAX,
        'firma tymczasowo zamknięta',
      ),
    );
  }

  return lines;
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

/** A >= 80 · B 60-79 · C 40-59 · D < 40. */
export function tierOf(score: number): ScoreTier {
  if (!Number.isFinite(score)) return 'D';
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

/**
 * Liczy wynik leada 0-100 wraz z wyjaśnieniem.
 *
 * @param reviews opinie tej firmy — potrzebne wyłącznie do modyfikatora świeżości
 * @param now     punkt odniesienia dla świeżości; wstrzykiwalny, żeby testy były deterministyczne
 */
export function scoreLead(
  lead: ScorableLead,
  reviews: readonly Review[] = [],
  now: Date = new Date(),
): ScoreResult {
  const breakdown: ScoreBreakdown[] = [
    // Cztery główne składowe pokazujemy zawsze — także z zerem punktów.
    // Użytkownik ma widzieć, czego leadowi zabrakło, a nie tylko za co dostał.
    websiteGapLine(lead.websiteStatus),
    socialProofLine(lead.reviewsCount),
    ratingQualityLine(lead.rating),
    nicheValueLine(lead),
    ...modifierLines(lead, reviews, now),
  ];

  const raw = breakdown.reduce((sum, entry) => sum + entry.points, 0);

  // Sufit dla firm, które nie działają — stosowany PO zsumowaniu wszystkiego,
  // razem ze zwykłym przycięciem skali do 0-100.
  const notOperational = lead.businessStatus !== 'OPERATIONAL';
  const cap = notOperational ? NON_OPERATIONAL_CAP : SCORE_MAX;
  const score = clamp(Math.min(raw, cap), SCORE_MIN, SCORE_MAX);

  const adjustment = score - raw;
  if (adjustment !== 0) {
    const cut = Math.abs(adjustment);
    const reason =
      notOperational && raw > cap
        ? `firma nie działa (${businessStatusLabel(lead.businessStatus)}) — sufit ${cap} pkt, odjęto ${cut} ${pointsWord(cut)}`
        : adjustment < 0
          ? `górna granica skali — odjęto ${cut} ${pointsWord(cut)} (maks. ${SCORE_MAX})`
          : `dolna granica skali — dodano ${cut} ${pointsWord(cut)} (min. ${SCORE_MIN})`;
    // Dopisujemy korektę jako osobną linijkę, żeby suma breakdown zawsze dawała score.
    breakdown.push(line('modifiers', adjustment, MODIFIER_MAX, reason));
  }

  return { score, tier: tierOf(score), breakdown };
}
