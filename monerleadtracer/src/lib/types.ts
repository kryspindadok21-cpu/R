/**
 * MonerLeadTracer — WSPÓLNY KONTRAKT TYPÓW.
 *
 * Ten plik jest źródłem prawdy dla wszystkich modułów (scout / analyst / copywriter / UI).
 * Zmiana czegokolwiek tutaj dotyka całej aplikacji — patrz CLAUDE.md przed edycją.
 */

/* ------------------------------------------------------------------ */
/* Klasyfikacja obecności w sieci                                      */
/* ------------------------------------------------------------------ */

/**
 * Jak wygląda "strona" firmy. To jest sedno całego narzędzia:
 * szukamy firm, które NIE mają własnej strony.
 */
export type WebsiteStatus =
  | 'none' // brak jakiegokolwiek adresu
  | 'social' // facebook / instagram / tiktok / linktree
  | 'marketplace' // olx / allegro / oferteo / gowork / pkt.pl
  | 'booking' // booksy / moment.pl / versum — płaci za cudzą platformę
  | 'weak' // subdomena kreatora: wix.com, wordpress.com, business.site
  | 'real'; // prawdziwa własna strona — to NIE jest lead

/** Statusy, które trafiają do bazy jako `website_status`, jeśli nie włączono szerszego skanu. */
export const LEAD_WEBSITE_STATUSES: readonly WebsiteStatus[] = [
  'none',
  'social',
  'marketplace',
  'weak',
] as const;

/* ------------------------------------------------------------------ */
/* Nisze                                                               */
/* ------------------------------------------------------------------ */

export type NicheId =
  | 'beauty'
  | 'auto'
  | 'gastro'
  | 'budowlanka'
  | 'zdrowie'
  | 'edukacja'
  | 'handel'
  | 'inne';

export interface Niche {
  id: NicheId;
  /** Nazwa pokazywana w UI. */
  label: string;
  /** Frazy wysyłane do Places Text Search (bez miasta — miasto dokleja scout). */
  queries: string[];
  /** Waga w scoringu (0-20). */
  scoreWeight: number;
  /**
   * Słowa-klucze wyłapywane z opinii jako hook personalizacyjny.
   * Np. gastro: 'tarty', 'pizza', 'ciasto'.
   */
  reviewKeywords: string[];
  /** Typy Google Places mapowane na tę niszę (primaryType / types). */
  placeTypes: string[];
}

/* ------------------------------------------------------------------ */
/* Miasta                                                              */
/* ------------------------------------------------------------------ */

export type CityPresetId = 'duze' | 'srednie' | 'aglomeracje';

export interface CityPreset {
  id: CityPresetId;
  label: string;
  description: string;
  cities: string[];
}

/* ------------------------------------------------------------------ */
/* Lead                                                                */
/* ------------------------------------------------------------------ */

export type LeadStatus =
  | 'nowy'
  | 'skontaktowany'
  | 'odpowiedzial'
  | 'klient'
  | 'odrzucony';

export const LEAD_STATUSES: readonly LeadStatus[] = [
  'nowy',
  'skontaktowany',
  'odpowiedzial',
  'klient',
  'odrzucony',
] as const;

/** Etykiety terminalowe pokazywane w UI. */
export const LEAD_STATUS_TOKEN: Record<LeadStatus, string> = {
  nowy: 'NEW',
  skontaktowany: 'PINGED',
  odpowiedzial: 'REPLIED',
  klient: 'CLIENT$',
  odrzucony: 'DEAD',
};

export type BusinessStatus =
  | 'OPERATIONAL'
  | 'CLOSED_TEMPORARILY'
  | 'CLOSED_PERMANENTLY'
  | 'UNKNOWN';

export interface OpeningHours {
  /** Gotowe do wyświetlenia linie, np. "poniedziałek: 09:00–17:00". */
  weekdayDescriptions: string[];
  openNow?: boolean;
}

export interface Review {
  id?: number;
  leadId?: number;
  author: string | null;
  rating: number | null;
  text: string;
  /** ISO 8601. Po tym polu sortujemy, żeby wziąć 3 NAJNOWSZE. */
  publishTime: string | null;
}

/** Lead w formie znormalizowanej — tak wygląda w całej aplikacji. */
export interface Lead {
  id: number;
  placeId: string;
  name: string;
  /** Surowy primaryType z Google, np. "nail_salon". */
  category: string | null;
  /** Nasza nisza biznesowa — po niej idzie scoring i copy. */
  niche: NicheId;
  types: string[];
  address: string | null;
  phone: string | null;
  websiteUri: string | null;
  websiteStatus: WebsiteStatus;
  rating: number | null;
  reviewsCount: number;
  openingHours: OpeningHours | null;
  businessStatus: BusinessStatus;
  lat: number | null;
  lng: number | null;
  mapsUri: string | null;
  city: string;
  score: number;
  scoreBreakdown: ScoreBreakdown[];
  status: LeadStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Lead świeżo po scoucie, jeszcze bez id z bazy i bez scoringu. */
export type ScoutedLead = Omit<
  Lead,
  'id' | 'score' | 'scoreBreakdown' | 'status' | 'notes' | 'createdAt' | 'updatedAt'
> & {
  reviews: Review[];
};

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export type ScoreComponent =
  | 'website_gap'
  | 'social_proof'
  | 'rating_quality'
  | 'niche_value'
  | 'modifiers';

/** Jedna linijka wyjaśnienia "dlaczego tyle punktów". Pokazywana w UI. */
export interface ScoreBreakdown {
  component: ScoreComponent;
  /** Punkty przyznane (może być ujemne dla modyfikatorów). */
  points: number;
  /** Maksimum możliwe dla tej składowej (0 dla modyfikatorów). */
  max: number;
  /** Wyjaśnienie po polsku, np. "brak strony WWW". */
  reason: string;
}

export type ScoreTier = 'A' | 'B' | 'C' | 'D';

export interface ScoreResult {
  score: number; // 0-100
  tier: ScoreTier;
  breakdown: ScoreBreakdown[];
}

/** Wejście scoringu — działa też na leadzie prosto od scouta (bez id). */
export interface ScorableLead {
  niche: NicheId;
  websiteStatus: WebsiteStatus;
  rating: number | null;
  reviewsCount: number;
  phone: string | null;
  openingHours: OpeningHours | null;
  businessStatus: BusinessStatus;
}

/* ------------------------------------------------------------------ */
/* Copywriter                                                          */
/* ------------------------------------------------------------------ */

export type Tone = 'bezposredni' | 'cieply' | 'biznesowy' | 'biznesowy_cieply';

export const TONES: readonly Tone[] = [
  'biznesowy_cieply',
  'bezposredni',
  'cieply',
  'biznesowy',
] as const;

export const DEFAULT_TONE: Tone = 'biznesowy_cieply';

export const TONE_LABEL: Record<Tone, string> = {
  biznesowy_cieply: 'BIZNES+CIEPŁO',
  bezposredni: 'BEZPOŚREDNI',
  cieply: 'CIEPŁY',
  biznesowy: 'BIZNESOWY',
};

export type Channel = 'dm' | 'call';

export const CHANNELS: readonly Channel[] = ['dm', 'call'] as const;

export const CHANNEL_LABEL: Record<Channel, string> = {
  dm: 'WIADOMOŚĆ',
  call: 'SKRYPT ROZMOWY',
};

/** Twardy limit długości wiadomości DM. */
export const DM_MAX_CHARS = 300;

/** Skrypt telefoniczny ma mieć dokładnie tyle zdań. */
export const CALL_SENTENCES = 5;

/** Skąd wzięła się personalizacja — pokazujemy to w UI, żeby było widać, na czym stoi wiadomość. */
export type HookKind =
  | 'review_quote' // konkret wyjęty z najnowszej opinii
  | 'rating_fact' // "4.9 z 87 opinii"
  | 'category_fact'; // nisza + miasto (fallback dla firm bez opinii)

export interface Hook {
  kind: HookKind;
  /** Fragment wstawiany do wiadomości. */
  text: string;
  /** Skąd pochodzi — do pokazania w UI ("z opinii z 12.03.2026"). */
  source: string | null;
}

export interface GeneratedMessage {
  id?: number;
  leadId?: number;
  tone: Tone;
  channel: Channel;
  body: string;
  /** true = użytkownik edytował ręcznie; regeneracja NIE nadpisuje takich wiadomości. */
  isEdited: boolean;
  hookUsed: HookKind | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Wynik walidacji tekstu. Ten sam walidator chodzi po szablonach i po wyjściu z LLM. */
export interface ValidationResult {
  ok: boolean;
  /** Kody problemów, np. 'too_long', 'no_question', 'banned_phrase:szanowni państwo'. */
  problems: string[];
}

/* ------------------------------------------------------------------ */
/* Oferta (kto pisze i co sprzedaje)                                   */
/* ------------------------------------------------------------------ */

export interface OfferConfig {
  /** Imię, którym podpisujesz wiadomości. */
  senderName: string;
  /** Co sprzedajesz, jednym zdaniem. */
  product: string;
  /** Cena w złotych — używana w HUD do liczenia pipeline'u. */
  price: number;
  /** Ile trwa realizacja, np. "3-5 dni". */
  leadTime: string;
  /** Co dajesz za darmo przed płatnością (dźwignia wzajemności). */
  freebie: string;
}

/* ------------------------------------------------------------------ */
/* Scout / skan                                                        */
/* ------------------------------------------------------------------ */

export interface ScanRequest {
  niches: NicheId[];
  /** Konkretne miasta albo pusto, gdy użyto presetu. */
  cities: string[];
  cityPreset?: CityPresetId;
  /** Ile maksymalnie wyników na jedną parę (nisza, miasto). */
  maxPerQuery: number;
  /** Czy brać też firmy siedzące na Booksy i na kreatorach stron. */
  includeBooking: boolean;
}

/** Jeden krok chunkowanego skanu — jedna para (fraza, miasto), jedna strona wyników. */
export interface ScanStep {
  niche: NicheId;
  query: string;
  city: string;
  /** nextPageToken z Places; null = ta fraza wyczerpana. */
  pageToken: string | null;
}

/** Kursor przenoszony między krokami skanu. Trzymany po stronie klienta. */
export interface ScanCursor {
  steps: ScanStep[];
  index: number;
  apiCalls: number;
  cacheHits: number;
  found: number;
  saved: number;
}

export type LogLevel = 'info' | 'hit' | 'skip' | 'warn' | 'error' | 'done';

/** Linia logu rysowana w terminalu na dashboardzie. */
export interface ScanLogLine {
  level: LogLevel;
  text: string;
}

export interface ScanStepResult {
  cursor: ScanCursor;
  log: ScanLogLine[];
  finished: boolean;
}

/* ------------------------------------------------------------------ */
/* Filtry tabeli                                                       */
/* ------------------------------------------------------------------ */

export type SortKey =
  | 'score'
  | 'name'
  | 'city'
  | 'niche'
  | 'rating'
  | 'reviewsCount'
  | 'status'
  | 'createdAt';

export interface LeadFilters {
  status?: LeadStatus;
  tier?: ScoreTier;
  city?: string;
  niche?: NicheId;
  /** Szukajka po nazwie. */
  q?: string;
  sort: SortKey;
  dir: 'asc' | 'desc';
}

export const DEFAULT_FILTERS: LeadFilters = { sort: 'score', dir: 'desc' };
