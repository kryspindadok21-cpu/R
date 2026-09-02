import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * Bramka hasłowa na CAŁĄ stronę.
 * Wszystko poza ekranem logowania i jego endpointem wymaga ważnej sesji.
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPublic =
    pathname === '/login' || pathname === '/api/auth' || pathname === '/favicon.ico';
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySessionToken(token)) return NextResponse.next();

  // API odpowiada kodem, nie przekierowaniem — inaczej fetch dostałby HTML logowania.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Pomijamy zasoby statyczne — bramka dotyczy stron i API.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
};
