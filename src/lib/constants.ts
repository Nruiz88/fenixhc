// User roles
export const ROLES = {
  ADMIN: 'admin',
  PADRE: 'padre',
  DEPORTISTA: 'deportista',
} as const;

export type UserRole = typeof ROLES[keyof typeof ROLES];

// Allowed tables per role
export const TABLES_BY_ROLE: Record<UserRole, string[]> = {
  admin: [
    'perfiles', 'deportistas', 'familias', 'cuotas', 'finanzas',
    'notificaciones', 'notificaciones_usuarios', 'mensajes_chat',
    'fotos_galeria', 'canchas', 'reservas', 'push_subscriptions',
    'contacto_publico', 'partidos', 'comunicados', 'horarios_entrenamiento', 'sponsors',
  ],
  padre: [
    'perfiles', 'deportistas', 'familias', 'cuotas', 'notificaciones',
    'notificaciones_usuarios', 'fotos_galeria', 'reservas', 'contacto_publico',
  ],
  deportista: [
    'perfiles', 'notificaciones', 'notificaciones_usuarios',
    'mensajes_chat', 'fotos_galeria', 'reservas',
  ],
};

// Allowed operations
export const ALLOWED_OPERATIONS = ['select', 'insert', 'upsert', 'update', 'delete'] as const;

// Validation rules
export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 6,
  MAX_QUERY_LIMIT: 1000,
  MAX_FILE_SIZE_MB: 10,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/webm'],
  ALLOWED_PDF_TYPES: ['application/pdf'],
} as const;

// Route protection
export const PROTECTED_ROUTES = ['/admin', '/padre', '/deportista'];

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => pathname.startsWith(route));
}

export function getRoleFromPath(pathname: string): UserRole | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/padre')) return 'padre';
  if (pathname.startsWith('/deportista')) return 'deportista';
  return null;
}

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
