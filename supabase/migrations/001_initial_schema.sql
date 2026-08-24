-- ============================================================
-- Migración inicial: Schema completo del Club Deportivo
-- ============================================================

-- Tipos personalizados
CREATE TYPE rol_usuario AS ENUM ('admin', 'padre', 'deportista');
CREATE TYPE tipo_vinculo AS ENUM ('padre', 'madre', 'tutor');
CREATE TYPE tipo_socio AS ENUM ('cadete', 'activo', 'benefactor');
CREATE TYPE estado_cuota AS ENUM ('pendiente', 'pagada', 'vencida');
CREATE TYPE metodo_pago AS ENUM ('mercadopago', 'transferencia');
CREATE TYPE tipo_finanza AS ENUM ('ingreso', 'egreso');
CREATE TYPE tipo_notificacion AS ENUM ('pago', 'deportivo', 'general', 'urgente');
CREATE TYPE destinatario_notificacion AS ENUM ('padre', 'deportista', 'todos');
CREATE TYPE tipo_contenido_chat AS ENUM ('texto', 'imagen', 'video');
CREATE TYPE estado_reserva AS ENUM ('confirmada', 'cancelada', 'completada');

-- ============================================================
-- Tabla: perfiles (extendida desde auth.users)
-- ============================================================
CREATE TABLE perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol rol_usuario NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  cuil TEXT,
  correo TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: deportistas (info adicional del jugador)
-- ============================================================
CREATE TABLE deportistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE UNIQUE,
  dni_frente_url TEXT,
  dni_fondo_url TEXT,
  club_activo BOOLEAN DEFAULT TRUE,
  fecha_inscripcion DATE DEFAULT CURRENT_DATE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: familias (vínculo padre ↔ hijo)
-- ============================================================
CREATE TABLE familias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padre_perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  deportista_perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo_vinculo tipo_vinculo NOT NULL DEFAULT 'padre',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(padre_perfil_id, deportista_perfil_id)
);

-- ============================================================
-- Tabla: cuotas
-- ============================================================
CREATE TABLE cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id UUID REFERENCES familias(id) ON DELETE CASCADE,
  tipo_socio tipo_socio NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL,
  estado estado_cuota DEFAULT 'pendiente',
  metodo_pago metodo_pago,
  comprobante_url TEXT,
  fecha_pago TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: finanzas (ingresos/egresos extra del club)
-- ============================================================
CREATE TABLE finanzas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_finanza NOT NULL,
  concepto TEXT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  categoria TEXT,
  comprobante_url TEXT,
  created_by UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: notificaciones
-- ============================================================
CREATE TABLE notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo tipo_notificacion DEFAULT 'general',
  destinatario_rol destinatario_notificacion DEFAULT 'todos',
  enviada_email BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: notificaciones_usuarios (tracking de lectura)
-- ============================================================
CREATE TABLE notificaciones_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id UUID REFERENCES notificaciones(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notificacion_id, usuario_id)
);

-- ============================================================
-- Tabla: mensajes_chat
-- ============================================================
CREATE TABLE mensajes_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emisor_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  tipo_contenido tipo_contenido_chat DEFAULT 'texto',
  archivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: fotos_galeria
-- ============================================================
CREATE TABLE fotos_galeria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subido_por UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  descripcion TEXT,
  es_video BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: canchas
-- ============================================================
CREATE TABLE canchas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  capacidad INTEGER DEFAULT 1,
  activa BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- Tabla: reservas
-- ============================================================
CREATE TABLE reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado estado_reserva DEFAULT 'confirmada',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cancha_id, fecha, hora_inicio)
);

-- ============================================================
-- Tabla: push_subscriptions
-- ============================================================
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Tabla: contacto_publico
-- ============================================================
CREATE TABLE contacto_publico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT,
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Índices para performance
-- ============================================================
CREATE INDEX idx_perfiles_rol ON perfiles(rol);
CREATE INDEX idx_perfiles_dni ON perfiles(dni);
CREATE INDEX idx_familias_padre ON familias(padre_perfil_id);
CREATE INDEX idx_familias_deportista ON familias(deportista_perfil_id);
CREATE INDEX idx_cuotas_familia ON cuotas(familia_id);
CREATE INDEX idx_cuotas_estado ON cuotas(estado);
CREATE INDEX idx_cuotas_mes_anio ON cuotas(mes, anio);
CREATE INDEX idx_finanzas_tipo ON finanzas(tipo);
CREATE INDEX idx_finanzas_fecha ON finanzas(fecha);
CREATE INDEX idx_mensajes_chat_created ON mensajes_chat(created_at);
CREATE INDEX idx_reservas_fecha ON reservas(fecha);
CREATE INDEX idx_reservas_cancha ON reservas(cancha_id);

-- ============================================================
-- Row Level Security (RLS)
-- ========================
