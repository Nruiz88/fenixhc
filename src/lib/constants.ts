import { ROLES, ROLES_DIRECTIVA, type Rol } from './roles';

// Tablas a las que cada rol puede acceder via /api/user/query.
// Los roles de directiva y el admin usan /api/admin/query, asi que acá solo
// importan los dos roles de socio (y el admin, que tambien usa este endpoint
// para algunas pantallas).
//
// La autorizacion por fila (que un socio solo vea lo suyo) vive en
// api/user/query/route.ts, en ownerCondition().

const TABLAS_SOCIO: string[] = [
  'perfiles',
  'notificaciones',
  'notificaciones_usuarios',
  'fotos_galeria',
  'reservas',
  'canchas',
];

const TABLAS_BENEFACTOR: string[] = [
  ...TABLAS_SOCIO,
  'deportistas',
  'familias',
  'cuotas',
  'contacto_publico',
];

const TABLAS_CADETE: string[] = [
  ...TABLAS_SOCIO,
  // Su propia ficha (el ownerCondition la acota a perfil_id = su id).
  'deportistas',
];

const TABLAS_ADMIN: string[] = [
  'perfiles', 'deportistas', 'familias', 'cuotas', 'finanzas',
  'notificaciones', 'notificaciones_usuarios',
  'fotos_galeria', 'canchas', 'reservas', 'push_subscriptions',
  'contacto_publico', 'partidos', 'comunicados', 'horarios_entrenamiento', 'sponsors',
];

// Los cargos de directiva Acceden al panel como el admin, pero cada uno con
// un subconjunto de modulos (ver lib/roles.ts). A nivel de tablas siguen
// teniendo el acceso completo del panel: el recorte fino por modulo se hace
// con requireModulo() en cada endpoint.
const TABLAS_DIRECTIVA: string[] = TABLAS_ADMIN;

export const TABLES_BY_ROLE: Record<Rol, string[]> = {
  admin: TABLAS_ADMIN,
  presidente: TABLAS_DIRECTIVA,
  secretario: TABLAS_DIRECTIVA,
  tesorero: TABLAS_DIRECTIVA,
  vocal_titular: TABLAS_DIRECTIVA,
  vocal_suplente: TABLAS_DIRECTIVA,
  socio_benefactor: TABLAS_BENEFACTOR,
  socio_cadete: TABLAS_CADETE,
};

// Validacion rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_QUERY_LIMIT: 1000,
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
  ALLOWED_PDF_TYPES: ['application/pdf'],
} as const;

// Route protection: los socios van a su portal, la directiva al panel.
export const PROTECTED_ROUTES = ['/admin', '/socio-benefactor', '/socio-cadete'];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

/** Que tipo de portal corresponde a una ruta. */
export function getRoleFromPath(pathname: string): Rol | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/socio-benefactor')) return 'socio_benefactor';
  if (pathname.startsWith('/socio-cadete')) return 'socio_cadete';
  return null;
}

export { ROLES, ROLES_DIRECTIVA };
export type { Rol };

// Month names
export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// Club info
export const CLUB_INFO = {
  name: 'Fenix Roller Hockey',
  whatsapp: 'https://wa.me/+541155512345',
  email: 'info@clubhockey.com.ar',
  address: 'Av. Libertador 1234, CABA',
  phone: '+54 11 5551 2345',
};
