import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Rutas que requieren autenticación
const protectedRoutes = ['/padre', '/deportista', '/admin'];

// Rutas solo para admin
const adminRoutes = ['/admin'];

// Rutas solo para padre
const padreRoutes = ['/padre'];

// Rutas solo para deportista
const deportistaRoutes = ['/deportista'];

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.pathname;
  const isPublic = ['/login', '/registro', '/club', '/entrenamientos', '/contacto', '/'].some(r => url === r) || (!url.startsWith('/padre') && !url.startsWith('/deportista') && !url.startsWith('/admin') && !url.startsWith('/api'));

  // If no Supabase configured, allow public routes only
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Si la ruta requiere autenticación y no hay usuario
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Obtener el rol del usuario desde los metadatos
  const userRole = user?.user_metadata?.rol || user?.app_metadata?.rol;

  // Verificar permisos por rol
  if (user && isProtected) {
    // Admin puede acceder a todo
    if (adminRoutes.some((route) => pathname.startsWith(route))) {
      if (userRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    // Padre solo puede acceder a rutas de padre
    if (padreRoutes.some((route) => pathname.startsWith(route))) {
      if (userRole !== 'padre' && userRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }

    // Deportista solo puede acceder a rutas de deportista
    if (deportistaRoutes.some((route) => pathname.startsWith(route))) {
      if (userRole !== 'deportista' && userRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
