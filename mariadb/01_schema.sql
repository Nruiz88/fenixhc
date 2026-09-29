-- ============================================================
-- FENIX ROLLER HOCKEY - MariaDB Schema
-- Ejecutar en Coolify Database Console
-- ============================================================

CREATE DATABASE IF NOT EXISTS club_fenix
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE club_fenix;

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','presidente','secretario','tesorero','vocal_titular','vocal_suplente','socio_benefactor','socio_cadete') NOT NULL DEFAULT 'socio_benefactor',
  -- Verificación de email: obligatoria para poder iniciar sesión.
  email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
  -- SHA-256 del token de verificación (nunca el token en claro).
  verification_token CHAR(64) NULL,
  verification_expires_at TIMESTAMP NULL,
  verification_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuarios_rol (rol),
  INDEX idx_usuarios_verif (verification_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS perfiles (
  id CHAR(36) PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL UNIQUE,
  rol ENUM('admin','presidente','secretario','tesorero','vocal_titular','vocal_suplente','socio_benefactor','socio_cadete') NOT NULL,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  dni VARCHAR(20) NOT NULL UNIQUE,
  cuil VARCHAR(20),
  correo VARCHAR(255) NOT NULL,
  telefono VARCHAR(30),
  direccion VARCHAR(255),
  foto_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_perfiles_rol (rol),
  INDEX idx_perfiles_dni (dni),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deportistas (
  id CHAR(36) PRIMARY KEY,
  perfil_id CHAR(36) NOT NULL UNIQUE,
  dni_frente_url TEXT,
  dni_fondo_url TEXT,
  club_activo BOOLEAN DEFAULT TRUE,
  fecha_inscripcion DATE DEFAULT (CURRENT_DATE),
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS familias (
  id CHAR(36) PRIMARY KEY,
  padre_perfil_id CHAR(36) NOT NULL,
  deportista_perfil_id CHAR(36) NOT NULL,
  tipo_vinculo ENUM('padre','madre','tutor') NOT NULL DEFAULT 'padre',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_familia (padre_perfil_id, deportista_perfil_id),
  FOREIGN KEY (padre_perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
  FOREIGN KEY (deportista_perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cuotas (
  id CHAR(36) PRIMARY KEY,
  familia_id CHAR(36) NOT NULL,
  tipo_socio ENUM('cadete','activo','benefactor') NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  mes INT NOT NULL,
  anio INT NOT NULL,
  estado ENUM('pendiente','pagada','rechazada') DEFAULT 'pendiente',
  metodo_pago ENUM('efectivo','transferencia','debito','credito','cheque') DEFAULT NULL,
  comprobante_url TEXT,
  fecha_pago TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cuotas_familia (familia_id),
  INDEX idx_cuotas_estado (estado),
  INDEX idx_cuotas_mes_anio (mes, anio),
  FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finanzas (
  id CHAR(36) PRIMARY KEY,
  tipo ENUM('ingreso','egreso') NOT NULL,
  concepto VARCHAR(255) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha DATE DEFAULT (CURRENT_DATE),
  categoria VARCHAR(50),
  metodo_pago VARCHAR(30) DEFAULT 'efectivo',
  descripcion TEXT,
  comprobante_url TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_finanzas_tipo (tipo),
  INDEX idx_finanzas_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones (
  id CHAR(36) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  mensaje TEXT NOT NULL,
  tipo ENUM('pago','deportivo','general','urgente') DEFAULT 'general',
  destinatario_rol ENUM('admin','presidente','secretario','tesorero','vocal_titular','vocal_suplente','socio_benefactor','socio_cadete','todos') DEFAULT 'todos',
  enviada_email BOOLEAN DEFAULT FALSE,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notif_rol (destinatario_rol),
  INDEX idx_notif_fecha (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notificaciones_usuarios (
  id CHAR(36) PRIMARY KEY,
  notificacion_id CHAR(36) NOT NULL,
  usuario_id CHAR(36) NOT NULL,
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notif_usuario (notificacion_id, usuario_id),
  FOREIGN KEY (notificacion_id) REFERENCES notificaciones(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fotos_galeria (
  id CHAR(36) PRIMARY KEY,
  subido_por CHAR(36) NOT NULL,
  url TEXT NOT NULL,
  descripcion TEXT,
  es_video BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fotos_fecha (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canchas (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  capacidad INT DEFAULT 1,
  activa BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservas (
  id CHAR(36) PRIMARY KEY,
  cancha_id CHAR(36) NOT NULL,
  usuario_id CHAR(36) NOT NULL,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado ENUM('confirmada','cancelada','completada') DEFAULT 'confirmada',
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reservas_fecha (fecha),
  INDEX idx_reservas_cancha (cancha_id),
  UNIQUE KEY uq_reserva (cancha_id, fecha, hora_inicio),
  FOREIGN KEY (cancha_id) REFERENCES canchas(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id CHAR(36) PRIMARY KEY,
  usuario_id CHAR(36) NULL,
  endpoint VARCHAR(700) NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_push_endpoint (endpoint(255)),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contacto_publico (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(255) NOT NULL,
  telefono VARCHAR(30),
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partidos (
  id CHAR(36) PRIMARY KEY,
  fecha DATE NOT NULL,
  hora TIME,
  rival VARCHAR(100) NOT NULL,
  escudo_url TEXT,
  cancha VARCHAR(100) DEFAULT 'Cancha Principal',
  es_local BOOLEAN DEFAULT TRUE,
  competencia VARCHAR(100) DEFAULT 'Liga Local',
  jornada VARCHAR(50),
  estado ENUM('programado','en_juego','finalizado','suspendido','cancelado') DEFAULT 'programado',
  goles_nuestros INT,
  goles_rival INT,
  resultado ENUM('ganado','empatado','perdido'),
  notas TEXT,
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_partidos_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS comunicados (
  id CHAR(36) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  resumen TEXT,
  contenido TEXT NOT NULL,
  tipo ENUM('general','deportivo','pago','urgente','evento') DEFAULT 'general',
  estado ENUM('borrador','publicado','archivado') DEFAULT 'publicado',
  imagen_url TEXT,
  autor_id CHAR(36),
  destacado BOOLEAN DEFAULT FALSE,
  fecha_publicacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comunicados_estado (estado),
  INDEX idx_comunicados_fecha (fecha_publicacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS horarios_entrenamiento (
  id CHAR(36) PRIMARY KEY,
  dia VARCHAR(20) NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  descripcion TEXT,
  nivel VARCHAR(30) DEFAULT 'Todos',
  activo BOOLEAN DEFAULT TRUE,
  orden INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_horarios_dia (dia),
  INDEX idx_horarios_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sponsors (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  logo_url TEXT,
  sitio_web TEXT,
  tier ENUM('gold','silver','bronze') DEFAULT 'bronze',
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  orden INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CANCHAS POR DEFECTO
-- ============================================================
INSERT INTO canchas (id, nombre, descripcion, capacidad) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cancha Principal', 'Cancha de hockey sobre hierba', 30),
  ('00000000-0000-0000-0000-000000000002', 'Cancha Auxiliar', 'Cancha de entrenamiento', 20)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);
