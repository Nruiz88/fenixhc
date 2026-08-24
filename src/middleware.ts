import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase not configured, allow public routes only
  if (!supabaseUrl || !supabaseKey) {
    const pathname = request.nextUrl.pathname;
    const isProtected = pathname.startsWith('/padre') || pathname.startsWith('/deportista') || pathname.startsWith('/admin');
    if (isProtected) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // Protected routes
    const isProtected = pathname.startsWith('/padre') || pathname.startsWith('/deportista') || pathname.startsWith('/admin');

    // If trying to access protected route without user
    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // If logged in and trying to visit login, redirect to dashboard
    if (pathname === '/login' && user) {
      const rol = user.user_metadata?.rol;
      const url = request.nextUrl.clone();
      if (rol === 'admin') url.pathname = '/admin/dashboard';
      else if (rol === 'padre') url.pathname = '/padre/dashboard';
      else if (rol === 'deportista') url.pathname = '/deportista/dashboard';
      else url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // Role-based access control
    if (user && isProtected) {
      const userRole = user.user_metadata?.rol;

      if (pathname.startsWith('/admin') && userRole !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (pathname.startsWith('/padre') && userRole !== 'padre' && userRole !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      if (pathname.startsWith('/deportista') && userRole !== 'deportista' && userRole !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }

    return supabaseResponse;
  } catch (error) {
    // If middleware crashes, let the request through
    // The page itself will handle auth
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
