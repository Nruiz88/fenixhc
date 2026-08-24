// ============================================================
// Constantes del Club Deportivo
// ============================================================

export const CLUB_INFO = {
  nombre: 'Club Deportivo Hockey',
  nombreCorto: 'CDH',
  descripcion: 'Club de hockey sobre hierba dedicado a la formación deportiva y personal de nuestros jugadores.',
  direccion: 'Tu dirección aquí',
  telefono: '+54 9 XX XXXX-XXXX',
  correo: 'info@clubdeportivo.com',
  whatsapp: 'https://wa.me/549XXXXXXXXXX',
  redes: {
    instagram: 'https://instagram.com/tuclub',
    facebook: 'https://facebook.com/tuclub',
  },
} as const;

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const MESES_CORTO = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

export const CUOTAS_CONFIG = {
  cadete: { label: 'Cadete (Jugador)', montoBase: 50000 },
  activo: { label: 'Activo (Jugador + Comisión)', montoBase: 35000 },
  benefactor: { label: 'Benefactor (Padre/Tutor)', montoBase: 25000 },
} as const;

export const TIPO_SOCIO_LABELS = {
  cadete: 'Cadete',
  activo: 'Activo',
  benefactor: 'Benefactor',
} as const;

export const ESTADO_CUOTA_COLORS = {
  pagada: 'bg-green-100 text-green-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  vencida: 'bg-red-100 text-red-800',
} as const;

export const TIPO_NOTIFICACION_LABELS = {
  pago: '💰 Pago',
  deportivo: '🏆 Deportivo',
  general: '📢 General',
  urgente: '🚨 Urgente',
} as const;

export const NAV_LINKS = {
  public: [
    { label: 'Inicio', href: '/' },
    { label: 'El Club', href: '/club' },
    { label: 'Entrenamientos', href: '/entrenamientos' },
    { label: 'Contacto', href: '/contacto' },
  ],
  padre: [
    { label: 'Dashboard', href: '/padre/dashboard' },
    { label: 'Mi Perfil', href: '/padre/perfil' },
    { label: 'Mis Hijos', href: '/padre/hijos' },
    { label: 'Pagos', href: '/padre/pagos' },
    { label: 'Fotos', href: '/padre/fotos' },
    { label: 'Reservas', href: '/padre/reservas' },
    { label: 'Notificaciones', href: '/padre/notificaciones' },
  ],
  deportista: [
    { label: 'Dashboard', href: '/deportista/dashboard' },
    { label: 'Mi Perfil', href: '/deportista/perfil' },
    { label: 'Chat', href: '/deportista/chat' },
    { label: 'Galería', href: '/deportista/galeria' },
    { label: 'Reservas', href: '/deportista/reservas' },
    { label: 'Notificaciones', href: '/deportista/notificaciones' },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Socios', href: '/admin/socios' },
    { label: 'Jugadores', href: '/admin/jugadores' },
    { label: 'Legajos', href: '/admin/legajos' },
    { label: 'Finanzas', href: '/admin/finanzas' },
    { label: 'Pagos', href: '/admin/pagos' },
    { label: 'Reservas', href: '/admin/reservas' },
    { label: 'Familias', href: '/admin/links-familia' },
    { label: 'Notificaciones', href: '/admin/notificaciones' },
    { label: 'Reportes', href: '/admin/reportes' },
  ],
} as const;
