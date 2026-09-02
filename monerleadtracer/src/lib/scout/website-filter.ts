import type { WebsiteStatus } from '@/lib/types';

/**
 * Klasyfikacja "strony" firmy — serce całego narzędzia.
 *
 * Dopasowujemy po KOŃCÓWCE hosta, nigdy po substringu. Inaczej domena
 * `facebook.pl.mojafirma.pl` (własna strona!) wpadłaby do kosza jako social.
 */

/** Portale społecznościowe i agregatory linków. */
const SOCIAL_DOMAINS = [
  'facebook.com',
  'fb.com',
  'fb.me',
  'instagram.com',
  'instagr.am',
  'tiktok.com',
  'linktr.ee',
  'linktree.com',
  'twitter.com',
  'x.com',
  'youtube.com',
  'youtu.be',
] as const;

/** Katalogi firm i marketplace'y — firma jest tam lokatorem, nie właścicielem. */
const MARKETPLACE_DOMAINS = [
  'olx.pl',
  'allegro.pl',
  'allegrolokalnie.pl',
  'oferteo.pl',
  'gowork.pl',
  'pkt.pl',
  'panoramafirm.pl',
  'aleo.com',
  'fixly.pl',
  'oferia.pl',
] as const;

/** Systemy rezerwacji — firma płaci abonament za cudzą platformę zamiast mieć swoje. */
const BOOKING_DOMAINS = [
  'booksy.com',
  'booksy.net',
  'moment.pl',
  'versum.com',
  'moinsalon.pl',
  'moinsalon.com',
  'reservio.com',
] as const;

/**
 * Kreatory stron. Trafienie oznacza 'weak' TYLKO wtedy, gdy firma siedzi
 * na domenie kreatora (`firma.wixsite.com`). Własna domena podpięta pod Wixa
 * (`mojafirma.pl`) to normalna strona — domena należy do firmy, więc 'real'.
 */
const BUILDER_DOMAINS = [
  'wixsite.com',
  'wix.com',
  'wordpress.com',
  'business.site',
  'systeme.io',
  'weebly.com',
  'jimdosite.com',
  'jimdofree.com',
  'jimdo.com',
  'ownr.pl',
  'sites.google.com',
  'square.site',
  'godaddysites.com',
  'netlify.app',
  'vercel.app',
  'github.io',
] as const;

/** Marki występujące pod wieloma TLD (blogspot.com / blogspot.pl / webnode.com.pl). */
const BUILDER_PATTERNS = [
  /(^|\.)blogspot\.[a-z]{2,}(\.[a-z]{2,})?$/,
  /(^|\.)webnode\.[a-z]{2,}(\.[a-z]{2,})?$/,
] as const;

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
/** Host wygląda jak domena: co najmniej jedna kropka i literowy TLD. */
const DOMAIN_RE = /^[a-z0-9.-]+\.[a-z]{2,}$/;

function hostMatches(host: string, domains: readonly string[]): boolean {
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Zwraca [host, ścieżka] albo null, gdy adres nie nadaje się do niczego. */
function parseUri(uri: string): [string, string] | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;

  // Wizytówki Google bywają wypełniane ręcznie: "www.firma.pl", "//firma.pl".
  const withScheme = SCHEME_RE.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, '')}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!DOMAIN_RE.test(host)) return null;

  return [host, url.pathname.toLowerCase()];
}

/**
 * Mapuje websiteUri z Google Places na jedną z klas obecności w sieci.
 * Nigdy nie rzuca — śmieciowy adres to po prostu 'none'.
 */
export function classifyWebsite(uri: string | null | undefined): WebsiteStatus {
  if (uri === null || uri === undefined) return 'none';

  const parsed = parseUri(uri);
  if (!parsed) return 'none';
  const [host, path] = parsed;

  if (hostMatches(host, SOCIAL_DOMAINS)) return 'social';
  if (hostMatches(host, MARKETPLACE_DOMAINS)) return 'marketplace';
  if (hostMatches(host, BOOKING_DOMAINS)) return 'booking';
  if (hostMatches(host, BUILDER_DOMAINS)) return 'weak';
  if (BUILDER_PATTERNS.some((re) => re.test(host))) return 'weak';

  // Stare Google Sites żyją pod ścieżką, nie pod subdomeną.
  if (hostMatches(host, ['google.com']) && path.startsWith('/site')) return 'weak';

  return 'real';
}

/**
 * Czy firma z takim statusem jest leadem.
 * 'real' nigdy — ktoś, kto ma własną stronę, nie kupi od nas strony.
 */
export function isLeadWorthy(
  status: WebsiteStatus,
  includeBooking = false,
): boolean {
  if (status === 'real') return false;
  if (status === 'booking') return includeBooking;
  return true;
}

/** Krótki opis statusu do logu terminala (po angielsku, jak reszta logu). */
export const WEBSITE_STATUS_LABEL: Record<WebsiteStatus, string> = {
  none: 'no website',
  social: 'social only',
  marketplace: 'marketplace listing',
  booking: 'booking platform',
  weak: 'site builder page',
  real: 'has real site',
};
