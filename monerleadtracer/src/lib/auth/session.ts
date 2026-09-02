/**
 * Sesja oparta na podpisanym ciasteczku.
 *
 * Celowo używamy WebCrypto (`crypto.subtle`), a nie `node:crypto` — ten sam kod
 * musi działać w middleware (runtime Edge) i w route handlerach (Node).
 *
 * Token ma postać `<expiry>.<hmac>`. Nie ma w nim żadnych danych użytkownika,
 * bo aplikacja ma dokładnie jednego użytkownika: właściciela hasła.
 */

export const SESSION_COOKIE = 'mlt_session';
export const SESSION_TTL_DAYS = 30;

function secret(): string {
  const value = process.env.SESSION_SECRET?.trim();
  if (!value || value.length < 16) {
    throw new Error(
      'Brak SESSION_SECRET (min. 16 znaków). Ustaw go w .env.local i w zmiennych Netlify.',
    );
  }
  return value;
}

async function hmac(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Porównanie odporne na atak czasowy.
 * Zawsze przechodzi przez całą dłuższą z wartości, więc czas nie zdradza,
 * ile początkowych znaków się zgadzało.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export async function createSessionToken(): Promise<string> {
  const expiry = Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
  const signature = await hmac(String(expiry));
  return `${expiry}.${signature}`;
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;

  const expiry = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expiryMs = Number(expiry);
  if (!Number.isFinite(expiryMs) || expiryMs < Date.now()) return false;

  try {
    return constantTimeEqual(signature, await hmac(expiry));
  } catch {
    // Brak SESSION_SECRET — traktujemy jak brak sesji, a nie jak 500.
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}
