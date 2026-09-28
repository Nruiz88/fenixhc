import { NextResponse, type NextRequest } from 'next/server';
import { authenticateFromRequest, COOKIE_NAME } from '@/lib/auth';
import { PROTECTED_ROUTES, getRoleFromPath } from '@/lib/constants';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const user = authenticateFromRequest(request);

  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const routeRole = getRoleFromPath(pathname);

  // Not logged in → protected route → redirect to login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Logged in → login page → redirect to dashboard
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    if (user.rol === 'admin') url.pathname = '/admin/dashboard';
    else if (user.rol === 'padre') url.pathname = '/padre/dashboard';
    else if (user.rol === 'deportista') url.pathname = '/deportista/dashboard';
    else url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Role-based access
  if (user && isProtected && routeRole) {
    if (routeRole === 'admin' && user.rol !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (routeRole === 'padre' && user.rol !== 'padre' && user.rol !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (routeRole === 'deportista' && user.rol !== 'deportista' && user.rol !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico)$).*)'],
};
