import { NextResponse, type NextRequest } from 'next/server';
import { authenticateFromRequest } from '@/lib/auth';
import { isProtectedRoute } from '@/lib/constants';
import { esDirectiva, moduloDeRuta, tieneModulo, PORTAL_POR_ROL } from '@/lib/roles';

// URLs viejas -> nuevas. Se redirige con 308 para no romper links guardados
// ni perder el metodo en un POST.
const RUTAS_VIEJAS: Record<string, string> = {
  '/padre': '/socio-benefactor',
  '/deportista': '/socio-cadete',
};

function redirigirSiVieja(pathname: string, request: NextRequest): NextResponse | null {
  for (const [vieja, nueva] of Object.entries(RUTAS_VIEJAS)) {
    if (pathname === vieja || pathname.startsWith(vieja + '/')) {
      const url = request.nextUrl.clone();
      url.pathname = nueva + pathname.slice(vieja.length);
      return NextResponse.redirect(url, 308);
    }
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const user = authenticateFromRequest(request);

  // URLs renombradas: /socio-benefactor/* -> /socio-benefactor/*, etc.
  const redir = redirigirSiVieja(pathname, request);
  if (redir) return redir;

  // Sin sesion y en ruta protegida -> login (con a donde queria ir).
  if (isProtectedRoute(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // Con sesion en /login -> su portal.
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL(PORTAL_POR_ROL[user.rol] ?? '/', request.url));
  }

  if (!user) return NextResponse.next();

  // El panel es solo para la directiva.
  if (pathname.startsWith('/admin')) {
    if (!esDirectiva(user.rol)) {
      return NextResponse.redirect(new URL(PORTAL_POR_ROL[user.rol] ?? '/', request.url));
    }
    // Recorte por modulo: un tesorero no entra a /admin/usuarios.
    const modulo = moduloDeRuta(pathname);
    if (modulo && !tieneModulo(user.rol, modulo)) {
      return NextResponse.redirect(new URL('/admin/dashboard?sinPermiso=1', request.url));
    }
    return NextResponse.next();
  }

  // Portales de socios.
  if (
    pathname.startsWith('/socio-benefactor') &&
    user.rol !== 'socio_benefactor' &&
    !esDirectiva(user.rol)
  ) {
    return NextResponse.redirect(new URL(PORTAL_POR_ROL[user.rol] ?? '/', request.url));
  }
  if (
    pathname.startsWith('/socio-cadete') &&
    user.rol !== 'socio_cadete' &&
    !esDirectiva(user.rol)
  ) {
    return NextResponse.redirect(new URL(PORTAL_POR_ROL[user.rol] ?? '/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Node.js runtime: jsonwebtoken necesita crypto de Node; en Edge la
  // verificación falla y todos los usuarios quedarían sin sesión.
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico)$).*)'],
};
