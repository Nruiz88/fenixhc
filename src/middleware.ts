import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { PROTECTED_ROUTES, getRoleFromPath } from '@/lib/constants';

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    const pathname = request.nextUrl.pathname;
    const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
    if (isProtected) return NextResponse.redirect(new URL('/login', request.url));
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));
  const routeRole = getRoleFromPath(pathname);

  // No user → login
  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Logged in → login page redirect
  if (pathname === '/login' && user) {
    const rol = user.user_metadata?.rol;
    const url = request.nextUrl.clone();
    if (rol === 'admin') url.pathname = '/admin/dashboard';
    else if (rol === 'padre') url.pathname = '/padre/dashboard';
    else if (rol === 'deportista') url.pathname = '/deportista/dashboard';
    else url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Role-based access
  if (user && isProtected && routeRole) {
    const userRole = user.user_metadata?.rol;
    if (routeRole === 'admin' && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (routeRole === 'padre' && userRole !== 'padre' && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
    if (routeRole === 'deportista' && userRole !== 'deportista' && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
