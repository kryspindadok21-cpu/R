import type { GeneratedMessage, Lead, Tone } from '../types';
import { DEFAULT_TONE } from '../types';

/**
 * Eksport do CSV pod polski Excel.
 *
 * Dwie rzeczy, bez których Excel psuje plik:
 *  - separator średnik (przy przecinku polski Excel wrzuca wszystko do jednej kolumny),
 *  - BOM UTF-8 (bez niego "ą" i "ł" wychodzą jako krzaki).
 */
const SEP = ';';
const BOM = '﻿';

/** Escapuje pojedynczą komórkę. */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Formuła zaczynająca się od =, +, -, @ potrafi się w Excelu wykonać — neutralizujemy.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (safe.includes(SEP) || safe.includes('"') || /[\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

const WEBSITE_LABEL: Record<string, string> = {
  none: 'brak strony',
  social: 'tylko social media',
  marketplace: 'tylko katalog/marketplace',
  booking: 'tylko system rezerwacji',
  weak: 'kreator stron',
  real: 'ma własną stronę',
};

const HEADERS = [
  'Nazwa',
  'Nisza',
  'Miasto',
  'Adres',
  'Telefon',
  'Obecność w sieci',
  'Adres WWW',
  'Ocena',
  'Liczba opinii',
  'Score',
  'Tier',
  'Status',
  'Notatki',
  'Google Maps',
  'Wiadomość (DM)',
  'Skrypt rozmowy',
] as const;

function tierOf(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export interface CsvExportOptions {
  /** Który wariant tonu trafia do kolumn z tekstami. */
  tone?: Tone;
}

export function leadsToCsv(
  leads: Lead[],
  messagesByLead: Map<number, GeneratedMessage[]>,
  options: CsvExportOptions = {},
): string {
  const tone = options.tone ?? DEFAULT_TONE;

  const lines = [HEADERS.map(cell).join(SEP)];

  for (const lead of leads) {
    const messages = messagesByLead.get(lead.id) ?? [];
    const dm = messages.find((m) => m.tone === tone && m.channel === 'dm')?.body ?? '';
    const call = messages.find((m) => m.tone === tone && m.channel === 'call')?.body ?? '';

    lines.push(
      [
        cell(lead.name),
        cell(lead.niche),
        cell(lead.city),
        cell(lead.address),
        cell(lead.phone),
        cell(WEBSITE_LABEL[lead.websiteStatus] ?? lead.websiteStatus),
        cell(lead.websiteUri),
        cell(lead.rating === null ? '' : String(lead.rating).replace('.', ',')),
        cell(lead.reviewsCount),
        cell(lead.score),
        cell(tierOf(lead.score)),
        cell(lead.status),
        cell(lead.notes),
        cell(lead.mapsUri),
        cell(dm),
        cell(call),
      ].join(SEP),
    );
  }

  // CRLF — tego oczekuje Excel.
  return BOM + lines.join('\r\n') + '\r\n';
}

export function csvFilename(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
  return `monerleadtracer-${stamp}.csv`;
}
