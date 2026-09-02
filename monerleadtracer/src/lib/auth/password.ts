import { constantTimeEqual } from './session';

/**
 * Sprawdzenie hasła metodą podwójnego HMAC-a: porównujemy skróty, nie surowe teksty.
 * Dzięki temu czas porównania nie zależy od tego, ile znaków hasła się zgadzało,
 * ani od jego długości.
 */
async function digest(value: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(salt),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const out = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(out)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isPasswordConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD?.length);
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;

  // Losowa sól na jedno porównanie — uniemożliwia porównywanie skrótów między próbami.
  const salt = crypto.randomUUID();
  const [a, b] = await Promise.all([digest(input, salt), digest(expected, salt)]);
  return constantTimeEqual(a, b);
}

/** Limit prób logowania. */
export const AUTH_MAX_ATTEMPTS = 5;
export const AUTH_WINDOW_MINUTES = 15;
