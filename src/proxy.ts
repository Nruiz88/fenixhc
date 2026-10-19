import { NextResponse, type NextRequest } from 'next/server';
import { authenticateFromRequest } from '@/lib/auth';
import { isProtectedRoute } from '@/lib/constants';
import {
  esDirectiva, moduloDeRutaCompleto, tieneModulo, tieneRol,
  rolesDeUsuario, portalDeRoles,
} from '@/lib/roles';

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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const user = authenticateFromRequest(request);

  // URLs renombradas: /padre/* -> /socio-benefactor/*, /deportista/* -> /socio-cadete/*
  const redir = redirigirSiVieja(pathname, request);
  if (redir) return redir;

  // Sin sesion y en ruta protegida -> login (con a donde queria ir).
  if (isProtectedRoute(pathname) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const roles = user ? rolesDeUsuario(user) : [];

  // Con sesion en /login -> su portal principal.
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL(portalDeRoles(roles), request.url));
  }

  if (!user) return NextResponse.next();

  // El panel es solo para la directiva. Con varios roles alcanza con que uno
  // sea de directiva.
  if (pathname.startsWith('/admin')) {
    if (!esDirectiva(roles)) {
      return NextResponse.redirect(new URL(portalDeRoles(roles), request.url));
    }
    // Recorte por modulo: un tesorero no entra a /admin/usuarios. Los permisos
    // se suman entre todos los roles de la persona.
    const modulo = moduloDeRutaCompleto(pathname);
    if (modulo && !tieneModulo(roles, modulo)) {
      return NextResponse.redirect(new URL('/admin/dashboard?sinPermiso=1', request.url));
    }
    return NextResponse.next();
  }

  // Portales de socios. Un secretario que además es socio benefactor puede
  // entrar a los dos: se mira la lista, no el rol principal.
  if (
    pathname.startsWith('/socio-benefactor') &&
    !tieneRol(roles, 'socio_benefactor') &&
    !esDirectiva(roles)
  ) {
    return NextResponse.redirect(new URL(portalDeRoles(roles), request.url));
  }
  if (
    pathname.startsWith('/socio-cadete') &&
    !tieneRol(roles, 'socio_cadete') &&
    !esDirectiva(roles)
  ) {
    return NextResponse.redirect(new URL(portalDeRoles(roles), request.url));
  }

  return NextResponse.next();
}

export const config = {
  // No se declara `runtime`: el proxy corre en Node.js y no es configurable.
  // Antes había que poner `runtime: 'nodejs'` explícito porque corría en Edge
  // por defecto, y ahí jsonwebtoken fallaba al verificar el token. Con proxy
  // eso ya no es un problema de configuración.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|ico)$).*)'],
};
