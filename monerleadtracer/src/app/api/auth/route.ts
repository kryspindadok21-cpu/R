import { NextResponse, type NextRequest } from 'next/server';
import {
  AUTH_MAX_ATTEMPTS,
  AUTH_WINDOW_MINUTES,
  checkPassword,
  isPasswordConfigured,
} from '@/lib/auth/password';
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from '@/lib/auth/session';
import {
  clearAuthAttempts,
  countRecentAuthAttempts,
  recordAuthAttempt,
} from '@/lib/db/queries';

export const runtime = 'nodejs';

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function POST(request: NextRequest) {
  if (!isPasswordConfigured()) {
    return NextResponse.json(
      { error: 'APP_PASSWORD nie jest ustawione na serwerze.' },
      { status: 500 },
    );
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  const ip = clientIp(request);

  const attempts = await countRecentAuthAttempts(ip, AUTH_WINDOW_MINUTES);
  if (attempts >= AUTH_MAX_ATTEMPTS) {
    return NextResponse.json(
      {
        error: `LOCKED — za dużo prób. Odczekaj ${AUTH_WINDOW_MINUTES} minut.`,
        locked: true,
      },
      { status: 429 },
    );
  }

  if (!(await checkPassword(password))) {
    await recordAuthAttempt(ip);
    const left = AUTH_MAX_ATTEMPTS - attempts - 1;
    return NextResponse.json(
      {
        error: 'ACCESS DENIED',
        attemptsLeft: Math.max(left, 0),
      },
      { status: 401 },
    );
  }

  await clearAuthAttempts(ip);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions());
  return response;
}

/** Wylogowanie — kasuje ciasteczko sesji. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
