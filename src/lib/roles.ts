// Roles del club y permisos por modulo.
//
// Fuente UNICA de verdad: el enum `usuarios.rol` de la base usa estos mismos
// valores. Si se agrega un rol, se agrega aca y en la migracion del ENUM.
//
// Antes el enum de la BD era ('admin','padre','deportista'). Los cargos de
// directiva se incorporateon como roles propios y los dos socios se
// renombraron (ver mariadb/05_roles_directiva.sql).

export const ROLES = [
  // Direccion / administracion
  'admin',
  'presidente',
  'secretario',
  'tesorero',
  'vocal_titular',
  'vocal_suplente',
  // Socios
  'socio_benefactor',
  'socio_cadete',
] as const;

export type Rol = (typeof ROLES)[number];

/** Etiquetas para mostrar en la interfaz. */
export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administración',
  presidente: 'Presidente',
  secretario: 'Secretario',
  tesorero: 'Tesorero',
  vocal_titular: 'Vocal Titular',
  vocal_suplente: 'Vocal Suplente',
  socio_benefactor: 'Socio Benefactor',
  socio_cadete: 'Socio Cadete',
};

/** Roles que pueden entrar al panel de administracion. */
export const ROLES_DIRECTIVA: Rol[] = [
  'admin',
  'presidente',
  'secretario',
  'tesorero',
  'vocal_titular',
  'vocal_suplente',
];

/** Roles que el publico puede elegir al registrarse (nunca un cargo). */
export const ROLES_PUBLICOS: Rol[] = ['socio_benefactor', 'socio_cadete'];

/** Colores para el badge del rol en el panel. */
export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: 'Acceso total, incluido el panel de configuración.',
  presidente: 'Acceso total a todos los módulos del club.',
  secretario: 'Socios, agenda, comunicados y notificaciones.',
  tesorero: 'Cuotas, pagos, finanzas y reportes.',
  vocal_titular: 'Consulta de socios, jugadores y partidos.',
  vocal_suplente: 'Igual que Vocal Titular.',
  socio_benefactor: 'Gestiona las cuotas de sus hijos y sus reservas.',
  socio_cadete: 'Su ficha, DNI, reservas y galería.',
};

export function isRol(v: unknown): v is Rol {
  return typeof v === 'string' && (ROLES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Varios roles por persona
// ---------------------------------------------------------------------------
//
// Una persona puede ser, por ejemplo, socio benefactor y secretario a la vez.
// `usuarios.rol` y `perfiles.rol` siguen existiendo como rol PRINCIPAL (para
// compatibilidad y para el login), y `roles` (JSON) guarda la lista completa.
// El rol principal es el de mayor jerarquía de la lista; ver ORDEN_PRINCIPAL.

/**
 * Orden de prioridad para elegir el rol principal.
 *
 * No es alfabético a propósito: si alguien es secretario y socio benefactor,
 * al entrar tiene que ir al panel (secretario), no al portal de socio. El
 * orden también define qué rol se muestra primero en las listas.
 */
export const ORDEN_PRINCIPAL: readonly Rol[] = [
  'admin',
  'presidente',
  'secretario',
  'tesorero',
  'vocal_titular',
  'vocal_suplente',
  'socio_benefactor',
  'socio_cadete',
];

/**
 * Normaliza lo que venga de la base o del cliente a una lista de roles válidos.
 *
 * Acepta un array, un string JSON (MariaDB puede devolver así una columna JSON)
 * o un rol suelto. Descarta valores desconocidos y duplicados. Si no queda
 * ninguno usa `fallback` (normalmente el rol principal de la fila) y, como
 * último recurso, socio_benefactor: una cuenta sin roles válidos no puede
 * quedar sin portal.
 */
export function normalizarRoles(valor: unknown, fallback?: string | null): Rol[] {
  let crudo: unknown = valor;

  if (typeof crudo === 'string') {
    try {
      crudo = JSON.parse(crudo);
    } catch {
      crudo = [crudo];
    }
  }

  const vistos = new Set<Rol>();
  if (Array.isArray(crudo)) {
    for (const r of crudo) if (isRol(r)) vistos.add(r);
  }
  if (vistos.size === 0 && isRol(fallback)) vistos.add(fallback);
  if (vistos.size === 0) vistos.add('socio_benefactor');

  return ORDEN_PRINCIPAL.filter((r) => vistos.has(r));
}

/** Rol principal de una lista: el de mayor jerarquía. */
export function rolPrincipal(roles: readonly Rol[]): Rol {
  return ORDEN_PRINCIPAL.find((r) => roles.includes(r)) ?? 'socio_benefactor';
}

/** Lista de roles de un usuario de sesión, con compatibilidad para tokens viejos. */
export function rolesDeUsuario(user: { rol?: string | null; roles?: unknown }): Rol[] {
  return normalizarRoles(user.roles, user.rol);
}

/** ¿El usuario tiene este rol puntual? Acepta un rol suelto o una lista. */
export function tieneRol(
  valor: string | readonly string[] | null | undefined,
  objetivo: Rol
): boolean {
  const lista = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return lista.includes(objetivo);
}

/** Etiquetas legibles de varios roles, para mostrar en una línea. */
export function etiquetasDeRoles(roles: readonly Rol[]): string {
  return roles.map((r) => ROL_LABEL[r]).join(' · ');
}

// ---------------------------------------------------------------------------
// Modulos del panel
// ---------------------------------------------------------------------------

export const MODULOS = [
  'dashboard',
  'usuarios',
  'partidos',
  'socios',
  'jugadores',
  'legajos',
  'familias',
  'pagos',
  'finanzas',
  'reservas',
  'notificaciones',
  'horarios',
  'comunicados',
  'sponsors',
  'reportes',
  // Suite contable: estado de resultados, balance, cuentas por cobrar.
  'contabilidad',
  'configuracion',
  // Sección de junta directiva: comunicaciones internas, partes, legajos,
  // seguros, recibos e inventario.
  //
  // Tener el módulo NO alcanza para entrar a todo: adentro se decide con
  // capacidades (src/lib/capacidades.ts). El módulo es la puerta; la capacidad
  // es qué se ve una vez adentro.
  'junta',
] as const;

export type Modulo = (typeof MODULOS)[number];

// Modulo -> ruta del panel, para poder proteger tambien del lado del router.
export const MODULO_RUTA: Record<Modulo, string> = {
  dashboard: '/admin/dashboard',
  usuarios: '/admin/usuarios',
  partidos: '/admin/partidos',
  socios: '/admin/socios',
  jugadores: '/admin/jugadores',
  legajos: '/admin/legajos',
  familias: '/admin/links-familia',
  pagos: '/admin/pagos',
  finanzas: '/admin/finanzas',
  reservas: '/admin/reservas',
  notificaciones: '/admin/notificaciones',
  horarios: '/admin/horarios',
  comunicados: '/admin/comunicados',
  sponsors: '/admin/sponsors',
  reportes: '/admin/reportes',
  contabilidad: '/admin/contabilidad',
  configuracion: '/admin/configuracion',
  junta: '/admin/junta',
};

const TODOS = MODULOS;

const PERMISOS_PRESIDENTE: readonly Modulo[] = TODOS;

const PERMISOS_SECRETARIO: readonly Modulo[] = [
  'dashboard',
  'socios',
  'jugadores',
  'legajos',
  'familias',
  'notificaciones',
  'horarios',
  'comunicados',
  'partidos',
  'reservas',
  'junta',
];

const PERMISOS_TESORERO: readonly Modulo[] = [
  'dashboard',
  'socios',
  'jugadores',
  'pagos',
  'finanzas',
  'reportes',
  'contabilidad',
  'junta',
];

const PERMISOS_VOCAL: readonly Modulo[] = [
  'dashboard',
  'socios',
  'jugadores',
  'legajos',
  'partidos',
  // El vocal entra a la sección de junta, pero adentro solo ve fotos y
  // comunicación interna. Eso lo resuelve la matriz de capacidades, no esta:
  // acá se decide si puede entrar a la puerta.
  'junta',
];

// Los socios no tienen NINGÚN módulo del panel, ni siquiera el dashboard: el
// suyo está en su portal (/socio-benefactor/dashboard). Incluir 'dashboard'
// acá no era un problema de seguridad — el proxy bloquea /admin antes de
// llegar al chequeo de módulo — pero dejaba la matriz de permisos diciendo
// una cosa y el comportamiento otra.
const SIN_PERMISOS: readonly Modulo[] = [];

export const PERMISOS: Record<Rol, readonly Modulo[]> = {
  admin: PERMISOS_PRESIDENTE,
  presidente: PERMISOS_PRESIDENTE,
  secretario: PERMISOS_SECRETARIO,
  tesorero: PERMISOS_TESORERO,
  vocal_titular: PERMISOS_VOCAL,
  vocal_suplente: PERMISOS_VOCAL,
  socio_benefactor: SIN_PERMISOS,
  socio_cadete: SIN_PERMISOS,
};

/**
 * ¿Alguno de los roles es de directiva?
 *
 * Acepta un rol suelto o la lista completa. Con varios roles alcanza con que
 * UNO sea de directiva: un socio benefactor que además es secretario entra al
 * panel por el rol de secretario y conserva su portal de socio.
 */
export function esDirectiva(rol: string | readonly string[] | null | undefined): boolean {
  const lista = Array.isArray(rol) ? rol : rol ? [rol] : [];
  return lista.some((r) => ROLES_DIRECTIVA.includes(r as Rol));
}

/** ¿Alguno de los roles tiene permiso sobre el módulo? */
export function tieneModulo(
  rol: string | readonly string[] | null | undefined,
  modulo: Modulo
): boolean {
  const lista = Array.isArray(rol) ? rol : rol ? [rol] : [];
  return lista.some((r) => !!PERMISOS[r as Rol]?.includes(modulo));
}

/** Modulo al que pertenece una ruta del panel, para protegerla. */
export function moduloDeRuta(pathname: string): Modulo | null {
  for (const m of MODULOS) {
    const ruta = MODULO_RUTA[m];
    if (pathname === ruta || pathname.startsWith(ruta + '/')) return m;
  }
  return null;
}

// Rutas del panel que cuelgan de un módulo pero no son la ruta canónica de
// ese módulo. Sin esta lista, /admin/privacidad no estaría protegida por el
// proxy: caería en `null` y cualquiera de la directiva podría entrar, y la
// pantalla que muestra quién abrió los DNI de los socios quedaría abierta a
// los vocales.
const RUTAS_ADICIONALES: Record<string, Modulo> = {
  '/admin/privacidad': 'configuracion',
};

/**
 * Pantallas del panel que no dependen de un módulo.
 *
 * TODAS las demás pasan por la matriz de permisos. Estas no, y está dicho acá a
 * propósito en vez de dejarlo implícito: una pantalla que se cuelga de esta
 * lista queda protegida solo por `esDirectiva`, que el proxy ya aplica a todo lo
 * que empieza con `/admin`.
 *
 * Hoy está acá el manual, `/admin/ayuda`.
 *
 * Va sin módulo aunque el club lo haya reservado al admin en el menú lateral.
 * Son dos cosas distintas: el ENLACE se muestra solo al admin, en
 * `admin/layout.tsx` con `soloAdmin`. La RUTA queda abierta a toda la
 * directiva, porque no hay motivo para negarle el manual a un tesorero que lo
 * está buscando justo cuando lo necesita. Se llega escribiendo la dirección o
 * pasándosela.
 *
 * Si alguna vez entra una pantalla más, tiene que entrar con una razón escrita
 * acá. La alternativa —ponerla en un módulo cualquiera— es peor: el chequeo
 * parecería morder más de lo que muerde.
 */
export const RUTAS_SIN_MODULO: readonly string[] = ['/admin/ayuda'];

/** Módulo al que pertenece una ruta del panel, incluidas las no canónicas. */
export function moduloDeRutaCompleto(pathname: string): Modulo | null {
  for (const ruta of RUTAS_SIN_MODULO) {
    if (pathname === ruta || pathname.startsWith(ruta + '/')) return null;
  }
  for (const [ruta, modulo] of Object.entries(RUTAS_ADICIONALES)) {
    if (pathname === ruta || pathname.startsWith(ruta + '/')) return modulo;
  }
  return moduloDeRuta(pathname);
}

/** Portal propio de cada tipo de socio (los cargos van a /admin). */
export const PORTAL_POR_ROL: Record<Rol, string> = {
  admin: '/admin/dashboard',
  presidente: '/admin/dashboard',
  secretario: '/admin/dashboard',
  tesorero: '/admin/dashboard',
  vocal_titular: '/admin/dashboard',
  vocal_suplente: '/admin/dashboard',
  socio_benefactor: '/socio-benefactor/dashboard',
  socio_cadete: '/socio-cadete/dashboard',
};

/**
 * Portal de entrada según la lista completa de roles.
 *
 * Si hay un cargo de directiva, entra al panel. Si no, al portal del rol de
 * socio que tenga. Con ambos roles puede navegar a los dos portales: el proxy
 * valida por la lista, no por un único rol.
 */
export function portalDeRoles(roles: readonly Rol[]): string {
  if (esDirectiva(roles)) return PORTAL_POR_ROL[rolPrincipal(roles)];
  if (roles.includes('socio_benefactor')) return PORTAL_POR_ROL.socio_benefactor;
  if (roles.includes('socio_cadete')) return PORTAL_POR_ROL.socio_cadete;
  return '/';
}
