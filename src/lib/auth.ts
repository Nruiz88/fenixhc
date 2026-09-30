import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import type { NextRequest, NextResponse } from 'next/server';
import { isRol, esDirectiva, tieneModulo, type Rol, type Modulo } from './roles';
import { queryOne } from './db';

// El secreto es obligatorio: con uno fijo o débil cualquiera podría forjar tokens.
const SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';
  if (!secret) {
    if (isProd) {
      throw new Error('JWT_SECRET no está definido. Configuralo en las variables de entorno.');
    }
    return 'dev-only-insecure-secret-cambiar-en-produccion';
  }
  if (isProd && secret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
  }
  if (isProd && secret === 'dev-only-insecure-secret-cambiar-en-produccion') {
    throw new Error('JWT_SECRET sigue siendo el valor de desarrollo.');
  }
  return secret;
})();
const COOKIE_NAME = 'fenix_token';
const EXPIRES_IN = '7d';

export interface AuthUser {
  id: string;
  rol: Rol;
  nombre: string;
  apellido: string;
  email: string;
  /**
   * Momento del último cambio de clave, en segundos, según el token que se
   * emitió. Es lo que hace revocables las sesiones sin tabla de sesiones.
   *
   * UN TOKEN SIN ESTE CAMPO SE RECHAZA. Nació de una clave que el sistema no
   * puede confirmar que siga vigente, y aceptarlo dejaría abierta justo la
   * puerta de los tokens más viejos — los que un ladrón viene teniendo desde
   * antes de que existiera esta protección. Cuesta un cierre de sesión general
   * al desplegar, y es el canje correcto.
   */
  pc?: number;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create JWT token
//
// `passwordChangedAt` va DENTRO del token. Con eso, comparar contra la base
// después permite descartar el token sin tocar la firma: si la clave cambió
// después de que el token se emitió, el token nació de una clave que ya no
// existe.
export function createToken(user: AuthUser, passwordChangedAt?: Date | string | null): string {
  const pc = aSegundos(passwordChangedAt);
  return jwt.sign(
    { ...user, pc },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/**
 * Cualquier cosa que venga de la base a epoch en segundos.
 *
 * El driver devuelve las DATE y los TIMESTAMP como objeto Date, así que esto
 * tiene que aceptar los tres: Date, texto ISO y número. Un `new Date(valor)`
 * a secas con `undefined` da `Invalid Date`, y un token con `pc: NaN` pasa
 * cualquier comparación — o sea, ningún token se revocaría nunca.
 */
export function aSegundos(valor: Date | string | number | null | undefined): number {
  if (valor == null) return 0;
  if (typeof valor === 'number') return Math.floor(valor);
  if (valor instanceof Date) {
    const t = valor.getTime();
    return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
  }
  const t = new Date(valor).getTime();
  return Number.isNaN(t) ? 0 : Math.floor(t / 1000);
}

// Verify JWT token
//
// Se valida que el rol siga siendo uno del catalogo actual: los JWT emitidos
// antes de la migracion 05 llevan 'padre'/'deportista' y se rechazan, lo que
// obliga a volver a iniciar sesion (que era el costo de renombrar el ENUM).
//
// Y se exige el sello de clave, por lo antes explicado en AuthUser.pc.
//
// ESTA FUNCIÓN ES SINCRÓNICA A PROPÓSITO. Corre en el proxy, en cada request,
// y no puede consultar la base. Por eso solo hace la comprobación barata —
// firma, expiración, rol, presencia del sello—. La comparación con la clave
// actual va en getCurrentUser(), que es async y es la puerta de los DATOS.
// La diferencia: si el proxy se equivoca, se ve un cascarón de página vacío;
// ningún dato sale.
export function verifyToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, SECRET) as AuthUser;
    if (!payload || typeof payload.id !== 'string' || !isRol(payload.rol)) {
      return null;
    }
    if (typeof payload.pc !== 'number' || !Number.isFinite(payload.pc)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Set auth cookie in response
export function setAuthCookie(response: NextResponse, token: string) {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

// Clear auth cookie
export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
}

// Get token from request (cookie or Authorization header)
export function getTokenFromRequest(request: NextRequest): string | null {
  const cookie = request.cookies.get(COOKIE_NAME)?.value;
  if (cookie) return cookie;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

// Get current user from request (server-side)
export async function getCurrentUser(request?: NextRequest): Promise<AuthUser | null> {
  let token: string | null = null;

  if (request) {
    token = getTokenFromRequest(request);
  } else {
    // For API routes without explicit request
    const store = await cookies();
    token = store.get(COOKIE_NAME)?.value || null;
  }

  if (!token) return null;

  const user = verifyToken(token);
  if (!user) return null;

  // Acá va la comprobación cara, y es la que hace TODO el trabajo de la
  // revocación.
  //
  // Se compara el sello que el token trae con la clave vigente en la base. Si
  // la clave se cambió después de que el token se emitió, el token nació de una
  // clave que ya no existe y se descarta acá.
  //
  // POR QUÉ ACA Y NO EN EL PROXY
  //
  // Porque el proxy no puede: `verifyToken` es sincrónica y corre en cada
  // request. Acá hay una consulta, sí, pero es un SELECT por clave primaria.
  //
  // Y si el proxy se queda con un token viejo, lo que pasa es que se renderiza
  // el cascarón de la página y todas las llamadas por API.devuelven 401. No
  // sale ningún dato. Un panel donde no se ven datos no es una brecha: es un
  // error de permisos que se traduce en pantalla vacía.
  //
  // POR QUÉ NO SE CACHEA
  //
  // Un caché de 30 segundos abriría una ventana en la que la revocación no
  // surte efecto: se cambia la clave y el ladrón entra treinta segundos más.
  // Una consulta por primary key es sub-milimisegundo. Optimizar esto después
  // vale, pero solo con la basura a la vista.
  const actual = await queryOne<{ pc: string | Date | null }>(
    'SELECT password_changed_at AS pc FROM usuarios WHERE id = ? LIMIT 1',
    [user.id]
  );

  // Si el usuario no existe, el token no sirve: la baja anonimiza el perfil
  // pero la cuenta desactivada puede seguir existiendo, y si desaparece el
  // usuario tampoco puede autenticarse.
  if (!actual) return null;

  if (aSegundos(actual.pc) > user.pc!) {
    return null;
  }

  return user;
}

// Require authentication - returns user or error
export async function requireAuth(roles?: string[]): Promise<{ user: AuthUser } | { error: string; status: number }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: 'No autenticado', status: 401 };
  }
  if (roles && !roles.includes(user.rol)) {
    return { error: 'Sin permisos', status: 403 };
  }
  return { user };
}

/**
 * Exige entrar al panel: cualquier cargo de directiva o el admin.
 * Los socios no pasan por aca.
 */
export async function requireDirectiva(): Promise<
  { user: AuthUser } | { error: string; status: number }
> {
  const user = await getCurrentUser();
  if (!user) return { error: 'No autenticado', status: 401 };
  if (!esDirectiva(user.rol)) return { error: 'Sin permisos', status: 403 };
  return { user };
}

/**
 * Exige permiso sobre un modulo del panel. Cada cargo tiene un subconjunto
 * distinto (ver PERMISOS en lib/roles.ts).
 */
export async function requireModulo(modulo: Modulo): Promise<
  { user: AuthUser } | { error: string; status: number }
> {
  const auth = await requireDirectiva();
  if ('error' in auth) return auth;
  if (!tieneModulo(auth.user.rol, modulo)) {
    return { error: 'Sin permisos para este módulo', status: 403 };
  }
  return auth;
}

// Authenticate from request (for middleware)
export function authenticateFromRequest(request: NextRequest): AuthUser | null {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

export { COOKIE_NAME };
