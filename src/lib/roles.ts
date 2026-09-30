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

export const ROL_ICONO: Record<Rol, string> = {
  admin: '⚙️',
  presidente: '🎖️',
  secretario: '📋',
  tesorero: '💰',
  vocal_titular: '🗳️',
  vocal_suplente: '🗳️',
  socio_benefactor: '🤝',
  socio_cadete: '🏃',
};

/** Colores para el badge del rol en el panel. */
export const ROL_COLOR: Record<Rol, { bg: string; fg: string }> = {
  admin: { bg: 'bg-[#DC2626]/20', fg: 'text-[#DC2626]' },
  presidente: { bg: 'bg-[#DC2626]/15', fg: 'text-[#DC2626]' },
  secretario: { bg: 'bg-amber-500/20', fg: 'text-amber-400' },
  tesorero: { bg: 'bg-emerald-500/20', fg: 'text-emerald-400' },
  vocal_titular: { bg: 'bg-violet-500/20', fg: 'text-violet-400' },
  vocal_suplente: { bg: 'bg-violet-500/15', fg: 'text-violet-300' },
  socio_benefactor: { bg: 'bg-blue-500/20', fg: 'text-blue-400' },
  socio_cadete: { bg: 'bg-cyan-500/20', fg: 'text-cyan-400' },
};

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
];

const PERMISOS_TESORERO: readonly Modulo[] = [
  'dashboard',
  'socios',
  'jugadores',
  'pagos',
  'finanzas',
  'reportes',
  'contabilidad',
];

const PERMISOS_VOCAL: readonly Modulo[] = [
  'dashboard',
  'socios',
  'jugadores',
  'legajos',
  'partidos',
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

export function esDirectiva(rol: string): boolean {
  return ROLES_DIRECTIVA.includes(rol as Rol);
}

export function tieneModulo(rol: string, modulo: Modulo): boolean {
  const p = PERMISOS[rol as Rol];
  return !!p && p.includes(modulo);
}

/** Modulo al que pertenece una ruta del panel, para protegerla. */
export function moduloDeRuta(pathname: string): Modulo | null {
  for (const m of MODULOS) {
    const ruta = MODULO_RUTA[m];
    if (pathname === ruta || pathname.startsWith(ruta + '/')) return m;
  }
  return null;
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
