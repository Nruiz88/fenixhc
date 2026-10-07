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
  // Solo para el estado de verificación de las cuentas. El acceso a columnas
  // sensibles lo restringe la whitelist de /api/admin/query, y la escritura
  // va por endpoints propios que hashean la contraseña.
  'usuarios',
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

// Route protection: los socios van a su portal, la directiva al panel.
export const PROTECTED_ROUTES = ['/admin', '/socio-benefactor', '/socio-cadete'];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}
// Se fueron VALIDATION, getRoleFromPath y MESES, que nadie importaba.
//
// VALIDATION era una trampa: sus limites viven donde se aplican, no en un
// objeto que nadie leia. El minimo de contrasena esta en schemas.ts
// (MIN_PASSWORD_LENGTH), el tope de consulta en la whitelist de tablas, y el
// limite de tamano y los tipos de archivo en la ruta que valida la subida.
// Tenerlos en un solo objeto daba la falsa impresion de que cambiar ahi
// alcanzaba.
//
// getRoleFromPath quedo reemplazado por moduloDeRutaCompleto en lib/roles.ts,
// que ademas no tiene el caso "ruta que no es de un portal".
//
// MESES nunca se importo: cada modulo que necesita meses tiene su lista
// local, con el formato que necesita (mayusculas o minusculas).

export { ROLES, ROLES_DIRECTIVA };
export type { Rol };


/**
 * Datos de contacto del club.
 *
 * FUENTE ÚNICA. Antes cada página tenía su copia, y por eso el sitio mostraba
 * direcciones distintas según dónde se mirara: la de acá, la del pie de la
 * home (escrito a mano dentro de page.tsx) y las de /contacto y /entrenamientos.
 * Cuando un dato del club cambia hay que cambiarlo acá y en ningún otro lado.
 */
/**
 * Convierte el teléfono mostrado en un enlace de wa.me.
 *
 * El "9" que se pone después del código de país (+54 9 299...) es solo para
 * discado nacional: dentro del país se marca 0299 416-9607. En la URL de
 * WhatsApp sobra, y si se deja el enlace mal armado el club deja de recibir
 * mensajes.
 *
 * Se deriva del teléfono en vez de escribirse aparte para que cambiar uno
 * cambie el otro.
 */
function whatsappDe(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  // "54" + "9" + "299..." -> se saca el 9, que ocupa el índice 2.
  const sinPrefijoMovil = digitos.startsWith('549') ? digitos.slice(0, 2) + digitos.slice(3) : digitos;
  return `https://wa.me/${sinPrefijoMovil}`;
}

const TELEFONO = '+54 9 299 416-9607';

export const CLUB_INFO = {
  name: 'Fenix Roller Hockey',
  /** Domicilio del club. Es donde se lo contacta por correo. */
  address: 'Castelli 4306, Neuquén Capital',
  /** Sede de los entrenamientos. NO es del club: por eso su historia habla de
   *  "contar con un espacio deportivo propio" como objetivo pendiente. */
  trainingVenue: 'Estadio Ruca Che',
  phone: TELEFONO,
  email: 'accfenixroller@gmail.com',
  whatsapp: whatsappDe(TELEFONO),
  foundedYear: 2026,
  discipline: 'Hockey sobre patines en línea',
};
