import type {
  BusinessStatus,
  Channel,
  GeneratedMessage,
  HookKind,
  Lead,
  LeadFilters,
  LeadStatus,
  NicheId,
  OpeningHours,
  Review,
  ScoreBreakdown,
  ScoreResult,
  ScoreTier,
  ScoutedLead,
  SortKey,
  Tone,
  WebsiteStatus,
} from '../types';
import { getDb, type SqlValue } from './client';
import { ensureSchema } from './migrate';

async function db() {
  await ensureSchema();
  return getDb();
}

/* ------------------------------------------------------------------ */
/* Mapowanie wiersz → obiekt                                           */
/* ------------------------------------------------------------------ */

interface LeadRow {
  id: number;
  place_id: string;
  name: string;
  category: string | null;
  niche: string;
  types_json: string;
  address: string | null;
  phone: string | null;
  website_uri: string | null;
  website_status: string;
  rating: number | null;
  reviews_count: number;
  opening_hours_json: string | null;
  business_status: string;
  lat: number | null;
  lng: number | null;
  maps_uri: string | null;
  city: string;
  score: number;
  score_breakdown_json: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** JSON.parse, który nie wysadza aplikacji na uszkodzonym wierszu. */
function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    placeId: row.place_id,
    name: row.name,
    category: row.category,
    niche: row.niche as NicheId,
    types: parseJson<string[]>(row.types_json, []),
    address: row.address,
    phone: row.phone,
    websiteUri: row.website_uri,
    websiteStatus: row.website_status as WebsiteStatus,
    rating: row.rating,
    reviewsCount: row.reviews_count,
    openingHours: parseJson<OpeningHours | null>(row.opening_hours_json, null),
    businessStatus: row.business_status as BusinessStatus,
    lat: row.lat,
    lng: row.lng,
    mapsUri: row.maps_uri,
    city: row.city,
    score: row.score,
    scoreBreakdown: parseJson<ScoreBreakdown[]>(row.score_breakdown_json, []),
    status: row.status as LeadStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------------------------------------------------------------ */
/* Zapis leadów (scout)                                                */
/* ------------------------------------------------------------------ */

export interface UpsertResult {
  id: number;
  isNew: boolean;
}

/**
 * Wrzuca leada do bazy albo aktualizuje istniejącego (po place_id).
 * Świadomie NIE dotyka `status` ani `notes` — to praca użytkownika,
 * powtórny skan nie ma prawa jej skasować.
 */
export async function upsertLead(
  lead: ScoutedLead,
  score: ScoreResult,
): Promise<UpsertResult> {
  const conn = await db();

  const existing = await conn.execute<{ id: number }>(
    'SELECT id FROM leads WHERE place_id = ?',
    [lead.placeId],
  );
  const found = existing.rows[0];

  const args: SqlValue[] = [
    lead.name,
    lead.category,
    lead.niche,
    JSON.stringify(lead.types),
    lead.address,
    lead.phone,
    lead.websiteUri,
    lead.websiteStatus,
    lead.rating,
    lead.reviewsCount,
    lead.openingHours ? JSON.stringify(lead.openingHours) : null,
    lead.businessStatus,
    lead.lat,
    lead.lng,
    lead.mapsUri,
    lead.city,
    score.score,
    JSON.stringify(score.breakdown),
  ];

  if (found) {
    await conn.execute(
      `UPDATE leads SET
         name = ?, category = ?, niche = ?, types_json = ?, address = ?, phone = ?,
         website_uri = ?, website_status = ?, rating = ?, reviews_count = ?,
         opening_hours_json = ?, business_status = ?, lat = ?, lng = ?, maps_uri = ?,
         city = ?, score = ?, score_breakdown_json = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [...args, found.id],
    );
    return { id: found.id, isNew: false };
  }

  const inserted = await conn.execute(
    `INSERT INTO leads
       (place_id, name, category, niche, types_json, address, phone, website_uri,
        website_status, rating, reviews_count, opening_hours_json, business_status,
        lat, lng, maps_uri, city, score, score_breakdown_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [lead.placeId, ...args],
  );

  // libSQL potrafi nie zwrócić lastInsertRowid — wtedy dopytujemy.
  if (inserted.lastInsertRowid) return { id: inserted.lastInsertRowid, isNew: true };
  const again = await conn.execute<{ id: number }>(
    'SELECT id FROM leads WHERE place_id = ?',
    [lead.placeId],
  );
  return { id: again.rows[0]?.id ?? 0, isNew: true };
}

/** Podmienia komplet opinii leada (trzymamy tylko 3 najnowsze). */
export async function replaceReviews(
  leadId: number,
  reviews: Review[],
): Promise<void> {
  const conn = await db();
  await conn.execute('DELETE FROM reviews WHERE lead_id = ?', [leadId]);
  if (reviews.length === 0) return;
  await conn.batch(
    reviews.map((r) => ({
      sql: 'INSERT INTO reviews (lead_id, author, rating, text, publish_time) VALUES (?, ?, ?, ?, ?)',
      args: [leadId, r.author, r.rating, r.text, r.publishTime] as SqlValue[],
    })),
  );
}

/* ------------------------------------------------------------------ */
/* Odczyt                                                              */
/* ------------------------------------------------------------------ */

const SORT_COLUMN: Record<SortKey, string> = {
  score: 'score',
  name: 'name',
  city: 'city',
  niche: 'niche',
  rating: 'rating',
  reviewsCount: 'reviews_count',
  status: 'status',
  createdAt: 'created_at',
};

const TIER_RANGE: Record<ScoreTier, [number, number]> = {
  A: [80, 100],
  B: [60, 79],
  C: [40, 59],
  D: [0, 39],
};

export async function listLeads(filters: LeadFilters): Promise<Lead[]> {
  const conn = await db();
  const where: string[] = [];
  const args: SqlValue[] = [];

  if (filters.status) {
    where.push('status = ?');
    args.push(filters.status);
  }
  if (filters.city) {
    where.push('city = ?');
    args.push(filters.city);
  }
  if (filters.niche) {
    where.push('niche = ?');
    args.push(filters.niche);
  }
  if (filters.tier) {
    const [lo, hi] = TIER_RANGE[filters.tier];
    where.push('score BETWEEN ? AND ?');
    args.push(lo, hi);
  }
  if (filters.q) {
    where.push('(LOWER(name) LIKE ? OR LOWER(address) LIKE ?)');
    const needle = `%${filters.q.toLowerCase()}%`;
    args.push(needle, needle);
  }

  // Kolumna i kierunek pochodzą z zamkniętej listy — nigdy z surowego inputu.
  const column = SORT_COLUMN[filters.sort] ?? 'score';
  const dir = filters.dir === 'asc' ? 'ASC' : 'DESC';
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await conn.execute<LeadRow>(
    `SELECT * FROM leads ${clause} ORDER BY ${column} ${dir}, id DESC LIMIT 1000`,
    args,
  );
  return res.rows.map(toLead);
}

export async function getLead(id: number): Promise<Lead | null> {
  const conn = await db();
  const res = await conn.execute<LeadRow>('SELECT * FROM leads WHERE id = ?', [id]);
  const row = res.rows[0];
  return row ? toLead(row) : null;
}

export async function getReviews(leadId: number): Promise<Review[]> {
  const conn = await db();
  const res = await conn.execute<{
    id: number;
    author: string | null;
    rating: number | null;
    text: string;
    publish_time: string | null;
  }>(
    'SELECT id, author, rating, text, publish_time FROM reviews WHERE lead_id = ? ORDER BY publish_time DESC',
    [leadId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    leadId,
    author: r.author,
    rating: r.rating,
    text: r.text,
    publishTime: r.publish_time,
  }));
}

/** Wartości do rozwijanych filtrów — tylko to, co realnie siedzi w bazie. */
export async function listFacets(): Promise<{ cities: string[]; niches: NicheId[] }> {
  const conn = await db();
  const cities = await conn.execute<{ city: string }>(
    "SELECT DISTINCT city FROM leads WHERE city <> '' ORDER BY city",
  );
  const niches = await conn.execute<{ niche: string }>(
    'SELECT DISTINCT niche FROM leads ORDER BY niche',
  );
  return {
    cities: cities.rows.map((r) => r.city),
    niches: niches.rows.map((r) => r.niche as NicheId),
  };
}

export interface DashboardStats {
  total: number;
  hot: number; // tier A
  contacted: number;
  clients: number;
}

export async function getStats(): Promise<DashboardStats> {
  const conn = await db();
  const res = await conn.execute<{
    total: number;
    hot: number;
    contacted: number;
    clients: number;
  }>(
    `SELECT
       COUNT(*)                                                   AS total,
       SUM(CASE WHEN score >= 80 THEN 1 ELSE 0 END)               AS hot,
       SUM(CASE WHEN status <> 'nowy' THEN 1 ELSE 0 END)          AS contacted,
       SUM(CASE WHEN status = 'klient' THEN 1 ELSE 0 END)         AS clients
     FROM leads`,
  );
  const row = res.rows[0];
  return {
    total: Number(row?.total ?? 0),
    hot: Number(row?.hot ?? 0),
    contacted: Number(row?.contacted ?? 0),
    clients: Number(row?.clients ?? 0),
  };
}

/* ------------------------------------------------------------------ */
/* Mutacje leada                                                       */
/* ------------------------------------------------------------------ */

export async function setLeadStatus(id: number, status: LeadStatus): Promise<void> {
  const conn = await db();
  await conn.execute(
    "UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?",
    [status, id],
  );
}

export async function setLeadStatusBulk(
  ids: number[],
  status: LeadStatus,
): Promise<void> {
  if (ids.length === 0) return;
  const conn = await db();
  await conn.batch(
    ids.map((id) => ({
      sql: "UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id = ?",
      args: [status, id] as SqlValue[],
    })),
  );
}

export async function setLeadNotes(id: number, notes: string): Promise<void> {
  const conn = await db();
  await conn.execute(
    "UPDATE leads SET notes = ?, updated_at = datetime('now') WHERE id = ?",
    [notes, id],
  );
}

/* ------------------------------------------------------------------ */
/* Wiadomości                                                          */
/* ------------------------------------------------------------------ */

interface MessageRow {
  id: number;
  lead_id: number;
  tone: string;
  channel: string;
  body: string;
  is_edited: number;
  hook_used: string | null;
  created_at: string;
  updated_at: string;
}

function toMessage(row: MessageRow): GeneratedMessage {
  return {
    id: row.id,
    leadId: row.lead_id,
    tone: row.tone as Tone,
    channel: row.channel as Channel,
    body: row.body,
    isEdited: row.is_edited === 1,
    hookUsed: (row.hook_used as HookKind | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getMessages(leadId: number): Promise<GeneratedMessage[]> {
  const conn = await db();
  const res = await conn.execute<MessageRow>(
    'SELECT * FROM messages WHERE lead_id = ?',
    [leadId],
  );
  return res.rows.map(toMessage);
}

/**
 * Zapisuje wygenerowaną wiadomość.
 * Wiadomości oznaczonych `is_edited` nie ruszamy — ręczna edycja wygrywa z generatorem.
 */
export async function saveGenerated(
  leadId: number,
  message: Omit<GeneratedMessage, 'id' | 'leadId' | 'isEdited'>,
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `INSERT INTO messages (lead_id, tone, channel, body, is_edited, hook_used)
     VALUES (?, ?, ?, ?, 0, ?)
     ON CONFLICT (lead_id, tone, channel) DO UPDATE SET
       body = excluded.body,
       hook_used = excluded.hook_used,
       updated_at = datetime('now')
     WHERE messages.is_edited = 0`,
    [leadId, message.tone, message.channel, message.body, message.hookUsed],
  );
}

/** Ręczna edycja użytkownika — od teraz chroniona przed regeneracją. */
export async function saveEditedMessage(
  leadId: number,
  tone: Tone,
  channel: Channel,
  body: string,
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `INSERT INTO messages (lead_id, tone, channel, body, is_edited)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT (lead_id, tone, channel) DO UPDATE SET
       body = excluded.body,
       is_edited = 1,
       updated_at = datetime('now')`,
    [leadId, tone, channel, body],
  );
}

/** Zdejmuje ochronę edycji, żeby "Regeneruj" mogło nadpisać tekst. */
export async function clearEditedFlag(
  leadId: number,
  tone: Tone,
  channel: Channel,
): Promise<void> {
  const conn = await db();
  await conn.execute(
    'UPDATE messages SET is_edited = 0 WHERE lead_id = ? AND tone = ? AND channel = ?',
    [leadId, tone, channel],
  );
}

/* ------------------------------------------------------------------ */
/* Cache odpowiedzi Places                                             */
/* ------------------------------------------------------------------ */

export async function cacheGet(key: string): Promise<unknown | null> {
  const conn = await db();
  const res = await conn.execute<{ response_json: string }>(
    "SELECT response_json FROM api_cache WHERE key = ? AND expires_at > datetime('now')",
    [key],
  );
  const row = res.rows[0];
  return row ? parseJson<unknown>(row.response_json, null) : null;
}

export async function cacheSet(
  key: string,
  endpoint: string,
  payload: unknown,
  ttlDays: number,
): Promise<void> {
  const conn = await db();
  await conn.execute(
    `INSERT INTO api_cache (key, endpoint, response_json, expires_at)
     VALUES (?, ?, ?, datetime('now', ?))
     ON CONFLICT (key) DO UPDATE SET
       response_json = excluded.response_json,
       expires_at = excluded.expires_at,
       created_at = datetime('now')`,
    [key, endpoint, JSON.stringify(payload), `+${ttlDays} days`],
  );
}

/* ------------------------------------------------------------------ */
/* Log skanów                                                          */
/* ------------------------------------------------------------------ */

export async function logSearch(entry: {
  niche: string;
  city: string;
  query: string;
  apiCalls: number;
  cacheHits: number;
  results: number;
  newLeads: number;
}): Promise<void> {
  const conn = await db();
  await conn.execute(
    `INSERT INTO searches (niche, city, query, api_calls, cache_hits, results, new_leads)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.niche,
      entry.city,
      entry.query,
      entry.apiCalls,
      entry.cacheHits,
      entry.results,
      entry.newLeads,
    ],
  );
}

/* ------------------------------------------------------------------ */
/* Rate-limit logowania                                                */
/* ------------------------------------------------------------------ */

export async function countRecentAuthAttempts(
  ip: string,
  windowMinutes: number,
): Promise<number> {
  const conn = await db();
  const res = await conn.execute<{ n: number }>(
    "SELECT COUNT(*) AS n FROM auth_attempts WHERE ip = ? AND created_at > datetime('now', ?)",
    [ip, `-${windowMinutes} minutes`],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function recordAuthAttempt(ip: string): Promise<void> {
  const conn = await db();
  await conn.execute('INSERT INTO auth_attempts (ip) VALUES (?)', [ip]);
  // Sprzątanie, żeby tabela nie puchła w nieskończoność.
  await conn.execute(
    "DELETE FROM auth_attempts WHERE created_at < datetime('now', '-1 day')",
  );
}

export async function clearAuthAttempts(ip: string): Promise<void> {
  const conn = await db();
  await conn.execute('DELETE FROM auth_attempts WHERE ip = ?', [ip]);
}
