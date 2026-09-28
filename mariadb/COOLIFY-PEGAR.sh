#!/usr/bin/env bash
# ============================================================
# FENIX ROLLER HOCKEY - Setup completo de MariaDB para Coolify
# PEGA ESTE BLOQUE COMPLETO EN LA TERMINAL DE COOLIFY
# (crea base + usuario + 18 tablas + seed en una sola sesión)
# ============================================================
set -euo pipefail

# --- CONFIGURACIÓN: cambiá esto ---
ROOT_PASS="${ROOT_PASS:-AQUI_ROOT_PASSWORD}"   # root password (o exportar ROOT_PASS)
# MARIADB_CONTAINER="mariadb-fenix"  # descomentá si no detecta el contenedor
# ----------------------------------

DB_NAME="club_fenix"
DB_USER="fenix"
DB_PASS="Fenix2026!DB"

if command -v docker >/dev/null 2>&1; then
  C="${MARIADB_CONTAINER:-$(docker ps --format '{{.Names}}' | grep -iE 'maria|mysql' | head -1 || true)}"
  if [ -z "$C" ]; then
    echo "✖ No encontré el contenedor MariaDB. Contenedores activos:"
    docker ps
    echo "Definí MARIADB_CONTAINER y volvé a pegar."
    exit 1
  fi
  echo "→ Contenedor: $C"
  RUN_SQL() { docker exec -i "$C" mariadb -uroot -p"$ROOT_PASS"; }
else
  echo "→ docker no disponible, usando el cliente mariadb de esta terminal"
  RUN_SQL() { mariadb -uroot -p"$ROOT_PASS"; }
fi

RUN_SQL <<'SQL'
-- ============================================================
-- 00: BASE + USUARIO
-- ============================================================
CREATE DATABASE IF NOT EXISTS club_fenix
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fenix'@'%' IDENTIFIED BY 'Fenix2026!DB';
CREATE USER IF NOT EXISTS 'fenix'@'localhost' IDENTIFIED BY 'Fenix2026!DB';
GRANT ALL PRIVILEGES ON club_fenix.* TO 'fenix'@'%';
GRANT ALL PRIVILEGES ON club_fenix.* TO 'fenix'@'localhost';
FLUSH PRIVILEGES;

-- ============================================================
-- 01: SCHEMA (18 tablas)
-- ============================================================
CREATE DATABASE IF NOT EXISTS club_fenix
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE club_fenix;

CREATE TABLE IF NOT EXISTS usuarios (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('admin','padre','deportista') NOT NULL DEFAULT 'padre',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_usuarios_rol (rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS perfiles (
  id CHAR(36) PRIMARY KEY,
  usuario_id CHAR(36) NOT NULL UNIQUE,
  rol ENUM('admin','padre','deportista') NOT NULL,
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
  destinatario_rol ENUM('padre','deportista','todos') DEFAULT 'todos',
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

CREATE TABLE IF NOT EXISTS mensajes_chat (
  id CHAR(36) PRIMARY KEY,
  emisor_id CHAR(36) NOT NULL,
  contenido TEXT NOT NULL,
  tipo_contenido ENUM('texto','imagen','video') DEFAULT 'texto',
  archivo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chat_emisor (emisor_id),
  INDEX idx_chat_fecha (created_at)
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

INSERT INTO canchas (id, nombre, descripcion, capacidad) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Cancha Principal', 'Cancha de hockey sobre hierba', 30),
  ('00000000-0000-0000-0000-000000000002', 'Cancha Auxiliar', 'Cancha de entrenamiento', 20)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- ============================================================
-- 02: SEED (usuarios de prueba)
-- ============================================================
USE club_fenix;

INSERT IGNORE INTO usuarios (id, email, password_hash, rol) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@club.com', '$2b$10$a8KRvV9AfBrALkt8Bdhki.8CjUG2fXHH.uWEcpWLUvlxSxDwQWXRu', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'marcelo@mail.com', '$2b$10$O.L2GpVEa9HTyVZ6jNlfQORvgsPLCGBuFvrJx7vrrwie7Y1OAt.HG', 'padre'),
  ('00000000-0000-0000-0000-000000000003', 'juan@mail.com', '$2b$10$Lof6XuNCqaYxjAz1xSx14uPeVKgIWeSHuOyPKugshL/JoJZs4cr6K', 'padre'),
  ('00000000-0000-0000-0000-000000000004', 'lautaro@mail.com', '$2b$10$sAsOuwLq3z7Xf8uMSRPDwuAhFuBfSkEcaaNlolg.vEXk3AxEjYOqS', 'deportista'),
  ('00000000-0000-0000-0000-000000000005', 'tomas@mail.com', '$2b$10$bDQXArSmMfUmvGd2g5sOeupBaYTTCExZyzWJMm1W/YDQ/XHrkG7E6', 'deportista');

INSERT IGNORE INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin', 'Club', 'Admin', '00000000', '00-00000000-0', 'admin@club.com', '', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'padre', 'Marcelo', 'Cabrera', '25123456', '20-25123456-3', 'marcelo@mail.com', '+541155512345', 'Av. Libertador 1234, CABA'),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'padre', 'Juan', 'Perez', '28765432', '20-28765432-5', 'juan@mail.com', '+541155598765', 'Calle Falsa 567, CABA'),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'deportista', 'Lautaro', 'Cabrera', '44123456', '20-44123456-7', 'lautaro@mail.com', '+541155534567', 'Av. Libertador 1234, CABA'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005', 'deportista', 'Tomas', 'Perez', '45678901', '20-45678901-9', 'tomas@mail.com', '+541155523456', 'Calle Falsa 567, CABA');

INSERT IGNORE INTO deportistas (id, perfil_id) VALUES
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004'),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000005');

INSERT IGNORE INTO familias (id, padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'padre'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'padre');

SELECT 'OK: club_fenix creada' AS resultado, COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = 'club_fenix';
SQL

echo "✔ Base club_fenix creada con las 18 tablas y el seed."
echo "  Usuario app: $DB_USER / $DB_PASS  (DB: $DB_NAME)"
