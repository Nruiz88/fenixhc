// ============================================================
// Tipos para el sistema de gestión del Club Deportivo
// ============================================================

// --- Auth y Roles ---
export type Rol = 'admin' | 'padre' | 'deportista';
export type TipoVinculo = 'padre' | 'madre' | 'tutor';
export type TipoSocio = 'cadete' | 'activo' | 'benefactor';
export type EstadoCuota = 'pendiente' | 'pagada' | 'vencida';
export type MetodoPago = 'mercadopago' | 'transferencia';
export type TipoFinanza = 'ingreso' | 'egreso';
export type TipoNotificacion = 'pago' | 'deportivo' | 'general' | 'urgente';
export type DestinatarioNotificacion = 'padre' | 'deportista' | 'todos';
export type TipoContenido = 'texto' | 'imagen' | 'video';
export type EstadoReserva = 'confirmada' | 'cancelada' | 'completada';

// --- Perfil (extendido desde auth.users) ---
export interface Perfil {
  id: string;
  rol: Rol;
  nombre: string;
  apellido: string;
  dni: string;
  cuil?: string;
  correo: string;
  telefono?: string;
  direccion?: string;
  foto_url?: string;
  created_at: string;
  updated_at: string;
}

// --- Deportista (info adicional del jugador) ---
export interface Deportista {
  id: string;
  perfil_id: string;
  dni_frente_url?: string;
  dni_fondo_url?: string;
  club_activo: boolean;
  fecha_inscripcion: string;
  observaciones?: string;
  created_at: string;
  // Relación
  perfil?: Perfil;
}

// --- Familia (vínculo padre ↔ hijo) ---
export interface Familia {
  id: string;
  padre_perfil_id: string;
  deportista_perfil_id: string;
  tipo_vinculo: TipoVinculo;
  created_at: string;
  // Relaciones
  padre?: Perfil;
  deportista?: Perfil;
}

// --- Cuota ---
export interface Cuota {
  id: string;
  familia_id: string;
  tipo_socio: TipoSocio;
  monto: number;
  mes: number;
  anio: number;
  estado: EstadoCuota;
  metodo_pago?: MetodoPago;
  comprobante_url?: string;
  fecha_pago?: string;
  created_at: string;
  // Relación
  familia?: Familia;
}

// --- Finanzas (ingresos/egresos del club) ---
export interface Finanza {
  id: string;
  tipo: TipoFinanza;
  concepto: string;
  monto: number;
  fecha: string;
  categoria?: string;
  comprobante_url?: string;
  created_by?: string;
  created_at: string;
}

// --- Notificación ---
export interface Notificacion {
  id: string;
  titulo: string;
  mensaje: string;
  tipo?: TipoNotificacion;
  destinatario_rol?: DestinatarioNotificacion;
  enviada_email: boolean;
  created_by?: string;
  created_at: string;
  // Para tracking de lectura
  leida?: boolean;
}

// --- Mensaje de Chat ---
export interface MensajeChat {
  id: string;
  emisor_id: string;
  contenido: string;
  tipo_contenido: TipoContenido;
  archivo_url?: string;
  created_at: string;
  // Relación
  emisor?: Perfil;
}

// --- Foto de Galería ---
export interface FotoGaleria {
  id: string;
  subido_por: string;
  url: string;
  descripcion?: string;
  es_video: boolean;
  created_at: string;
  // Relación
  autor?: Perfil;
}

// --- Cancha ---
export interface Cancha {
  id: string;
  nombre: string;
  descripcion?: string;
  capacidad: number;
  activa: boolean;
}

// --- Reserva ---
export interface Reserva {
  id: string;
  cancha_id: string;
  usuario_id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoReserva;
  notas?: string;
  created_at: string;
  // Relaciones
  cancha?: Cancha;
  usuario?: Perfil;
}

// --- Contacto Público ---
export interface ContactoPublico {
  id: string;
  nombre: string;
  correo: string;
  telefono?: string;
  mensaje: string;
  leido: boolean;
  created_at: string;
}

// --- Push Subscription ---
export interface PushSubscription {
  id: string;
  usuario_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

// --- Balance Anual ---
export interface BalanceAnual {
  anio: number;
  total_ingresos: number;
  total_egresos: number;
  balance: number;
  desglose_mensual: DesgloseMensual[];
}

export interface DesgloseMensual {
  mes: number;
  ingresos: number;
  egresos: number;
  cuotas_cobradas: number;
  donaciones: number;
}

// --- Dashboard Stats ---
export interface DashboardStats {
  total_socios: number;
  total_jugadores: number;
  cuotas_pendientes: number;
  cuotas_pagadas_mes: number;
  ingresos_mes: number;
  egresos_mes: number;
}
