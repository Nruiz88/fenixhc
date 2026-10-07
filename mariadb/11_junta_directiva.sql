-- ============================================================
-- 11 - SECION DE JUNTA DIRECTIVA
-- ============================================================
--
-- Todo lo que es del club por dentro y no del portal del socio: las
-- comunicaciones internas, los partes, los documentos de los legajos, los
-- recibos, el seguro y el inventario.
--
-- POR QUÉ UNA SOLA MIGRACIÓN Y SIETE TABLAS
--
-- Son siete Matters distintos, pero salen del mismo pedido y los usa la misma
-- gente. Meterlos juntos tiene una ventaja concreta: si algo sale mal, se
-- revierte o se ajusta junto, y no queda la mitad del módulo andando.
--
-- DISEÑO COMÚN
--
-- Almost todas guardan quién y cuándo. En una asociación civil eso no es
-- metadato: es lo que hace válido el registro. Un parte sin autor es un
-- papel; un inventario sin quién lo cargó no sirve para reclamar.
--
-- Idempotente.

SET NAMES utf8mb4;

USE club_fenix;

-- ------------------------------------------------------------
-- 1. Comunicaciones internas (la parte tipo blog)
-- ------------------------------------------------------------
-- Es como los comunicados públicos pero para adentro. La diferencia no es la
-- pantalla: es que lo que se escribe acá no sale del club. UnDirectivection
-- anota una reunión conflictiva o un problema con una familia, y eso no puede
-- terminar en la web.
--
-- `visible_para` existe aunque hoy todos los de directiva pueden verlo. El día
-- que un secretario necesite algo que el tesorero no vea —y en una asociación
-- pasa— la columna ya está.
CREATE TABLE IF NOT EXISTS comunicaciones_internas (
  id CHAR(36) PRIMARY KEY,
  titulo VARCHAR(200) NOT NULL,
  -- El cuerpo va como texto plano y lo formatea quien lo lee. HTML guardado en
  -- la base es la forma más común de guardar un XSS esperando su momento.
  contenido TEXT NOT NULL,
  categoria ENUM('general','reunion','deportivo','administrativo','urgente')
    NOT NULL DEFAULT 'general',
  -- Fijado arriba de todo, como la comunicación del mes.
  fijado BOOLEAN NOT NULL DEFAULT FALSE,
  visible_para ENUM('directiva','solo_directiva') NOT NULL DEFAULT 'directiva',
  adjunto_nombre VARCHAR(200) DEFAULT NULL,
  adjunto_url TEXT DEFAULT NULL,
  autor_id CHAR(36) DEFAULT NULL,
  estado ENUM('borrador','publicado','archivado') NOT NULL DEFAULT 'borrador',
  fecha_publicacion TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_comint_estado (estado),
  INDEX idx_comint_fecha (fecha_publicacion),
  INDEX idx_comint_fijado (fijado),
  FOREIGN KEY (autor_id) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Partes administrativos
-- ------------------------------------------------------------
-- El acta de la reunión. `tipo` separa el parte que le importa a la secretaría
-- del que le importa a tesorería, porque no son el mismo documento: uno trata sobre
-- decisiones institucionales y el otro sobre plata.
--
-- `asistentes` es texto libre a propósito: es una lista de nombres de una
-- reunión, no un catálogo. Meterla en tabla propia sería normalizar algo que
-- se escribe una vez y no se vuelve a consultar.
CREATE TABLE IF NOT EXISTS partes_administrativos (
  id CHAR(36) PRIMARY KEY,
  tipo ENUM('administrativo','financiero') NOT NULL DEFAULT 'administrativo',
  titulo VARCHAR(200) NOT NULL,
  fecha_reunion DATE NOT NULL,
  contenido TEXT NOT NULL,
  asistentes TEXT DEFAULT NULL,
  decisiones TEXT DEFAULT NULL,
  autor_id CHAR(36) DEFAULT NULL,
  estado ENUM('borrador','publicado') NOT NULL DEFAULT 'borrador',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parte_tipo_fecha (tipo, fecha_reunion),
  FOREIGN KEY (autor_id) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 3. Documentos de legajo
-- ------------------------------------------------------------
-- Lo que el club guarda en el legajo de cada jugador y que alguien tiene que
-- poder BAJAR: fichas, certificados de estudios, copia del DNI, evaluaciones.
--
-- `visibilidad` distingue lo que ve la directiva de lo que el club guarda para
-- sus papeles. Una evaluación de un menor no es un documento para que lo vea
-- cualquier voz de la junta.
CREATE TABLE IF NOT EXISTS documentos_legajo (
  id CHAR(36) PRIMARY KEY,
  perfil_id CHAR(36) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  tipo ENUM('ficha','certificado_estudios','copia_dni','evaluacion','planilla','otro')
    NOT NULL DEFAULT 'otro',
  url TEXT NOT NULL,
  -- 'directiva': lo ven todos los cargos. 'privado': solo quien lo subió y el
  -- presidente. Es un escalón, no un sistema de permisos completo.
  visibilidad ENUM('directiva','privado') NOT NULL DEFAULT 'directiva',
  notas TEXT DEFAULT NULL,
  subido_por CHAR(36) DEFAULT NULL,
  fecha DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_doclegajo_perfil (perfil_id),
  INDEX idx_doclegajo_tipo (tipo),
  FOREIGN KEY (perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
  FOREIGN KEY (subido_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Seguro: adherentes y vencimientos
-- ------------------------------------------------------------
-- Va por JUGADOR y no por familia: el seguro cubre a quien juega, y el club
-- tiene que poder responder "¿quién está sin seguro?" antes del corte, no
-- después.
--
-- `estado` no es derivado de `pagado` a propósito. Se paga el seguro y después
-- llega la fecha de baja; se renueva con la documentación al día; o se da de
-- baja. Son tres hechos distintos y se anotan por separado.
CREATE TABLE IF NOT EXISTS seguros (
  id CHAR(36) PRIMARY KEY,
  jugador_perfil_id CHAR(36) NOT NULL,
  estado ENUM('pendiente','adherido','renovado','baja') NOT NULL DEFAULT 'pendiente',
  fecha_adhesion DATE DEFAULT NULL,
  fecha_vencimiento DATE DEFAULT NULL,
  monto DECIMAL(10,2) DEFAULT NULL,
  pagado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_pago DATE DEFAULT NULL,
  comprobante_url TEXT DEFAULT NULL,
  notas TEXT DEFAULT NULL,
  registrado_por CHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- Un seguro por jugador. Si hay que renovarlo, se actualiza la fila: el
  -- historial de renovaciones lo cuenta `seguros_historial`.
  UNIQUE KEY uq_seguro_jugador (jugador_perfil_id),
  INDEX idx_seguro_estado (estado),
  INDEX idx_seguro_vencimiento (fecha_vencimiento),
  FOREIGN KEY (jugador_perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
  FOREIGN KEY (registrado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El historial de cambios, para que "renovado" no borre el por qué.
CREATE TABLE IF NOT EXISTS seguros_historial (
  id CHAR(36) PRIMARY KEY,
  seguro_id CHAR(36) NOT NULL,
  estado_anterior VARCHAR(20) DEFAULT NULL,
  estado_nuevo VARCHAR(20) NOT NULL,
  nota VARCHAR(500) DEFAULT NULL,
  registrado_por CHAR(36) DEFAULT NULL,
  registrado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_seghist_seguro (seguro_id),
  FOREIGN KEY (seguro_id) REFERENCES seguros(id) ON DELETE CASCADE,
  FOREIGN KEY (registrado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configuración del seguro: monto, vigencia y fecha de corte.
-- Una sola fila. Igual que configuracion_cuota, y por el mismo motivo: el
-- corte lo cambia la directiva, no el código.
CREATE TABLE IF NOT EXISTS configuracion_seguro (
  id TINYINT PRIMARY KEY DEFAULT 1,
  monto_base DECIMAL(10,2) NOT NULL DEFAULT 15000.00,
  meses_vigencia INT NOT NULL DEFAULT 12,
  -- Días antes del vencimiento en que el club avisa a las familias.
  dias_aviso INT NOT NULL DEFAULT 30,
  -- Fecha en que cae el corte del período. NULL = usar el día 1.
  dia_corte TINYINT DEFAULT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_seguro_unica_fila CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO configuracion_seguro (id, monto_base, meses_vigencia, dias_aviso, dia_corte)
VALUES (1, 15000.00, 12, 30, NULL)
ON DUPLICATE KEY UPDATE monto_base = VALUES(monto_base);

-- ------------------------------------------------------------
-- 5. Recibos
-- ------------------------------------------------------------
-- El comprobante que EL CLUB emite. No es lo que sube el padre: es el papel que
-- la clubación entrega y que prueba que cobró.
--
-- `numero` es único y correlativo porque el banco y el contador lo usan para
-- conciliar. Va con prefijo de año para que no haya que adivinar a qué período
-- pertenece cada uno.
--
-- UN RECIBO NUNCA SE BORRA. Si se emitió mal, se anula y se emite otro con la
-- corrección apuntando a este.
CREATE TABLE IF NOT EXISTS recibos (
  id CHAR(36) PRIMARY KEY,
  numero VARCHAR(30) NOT NULL,
  cuota_id CHAR(36) DEFAULT NULL,
  familia_id CHAR(36) DEFAULT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha_emision DATE NOT NULL DEFAULT (CURRENT_DATE),
  forma_pago ENUM('efectivo','transferencia','debito','credito','cheque')
    NOT NULL DEFAULT 'efectivo',
  concepto VARCHAR(255) DEFAULT NULL,
  emitido_por CHAR(36) DEFAULT NULL,
  estado ENUM('emitido','anulado') NOT NULL DEFAULT 'emitido',
  anulado_motivo VARCHAR(500) DEFAULT NULL,
  anulado_por CHAR(36) DEFAULT NULL,
  anulado_en TIMESTAMP NULL,
  -- Recibo que corrige a este. Permite trazar la cadena sin perder el original.
  reemplaza_id CHAR(36) DEFAULT NULL,
  descargado_en TIMESTAMP NULL,
  descargado_por CHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_recibo_numero (numero),
  INDEX idx_recibo_fecha (fecha_emision),
  INDEX idx_recibo_familia (familia_id),
  INDEX idx_recibo_cuota (cuota_id),
  FOREIGN KEY (cuota_id) REFERENCES cuotas(id) ON DELETE SET NULL,
  FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE SET NULL,
  FOREIGN KEY (emitido_por) REFERENCES perfiles(id) ON DELETE SET NULL,
  FOREIGN KEY (anulado_por) REFERENCES perfiles(id) ON DELETE SET NULL,
  FOREIGN KEY (reemplaza_id) REFERENCES recibos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 6. Inventario de equipos
-- ------------------------------------------------------------
-- El club tiene kits, tosses y sticks que alguien tiene que encontrar. Sin esto,
-- encontrar. Sin esto, la pregunta "¿cuántos sticks tenemos?" no tiene
-- respuesta.
--
-- `cantidad_total` y `cantidad_prestada` van separadas. Si no, cada préstamo
-- reescribe el total y se pierde el histórico de cuánto había. Lo que hay
-- realmente es la diferencia.
CREATE TABLE IF NOT EXISTS inventario_items (
  id CHAR(36) PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  descripcion TEXT DEFAULT NULL,
  categoria ENUM('sticks','tickets','pads','porterias','balones','indumentaria','otros')
    NOT NULL DEFAULT 'otros',
  cantidad_total INT NOT NULL DEFAULT 0,
  cantidad_prestada INT NOT NULL DEFAULT 0,
  -- Los que se rompen también se restan, pero conviene saberlo: por eso el
  -- estado es propio y no un signo en la cantidad.
  estado ENUM('activo','baja','reparacion') NOT NULL DEFAULT 'activo',
  ubicacion VARCHAR(120) DEFAULT NULL,
  valor_unitario DECIMAL(10,2) DEFAULT NULL,
  notas TEXT DEFAULT NULL,
  actualizado_por CHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inv_categoria (categoria),
  INDEX idx_inv_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 7. Préstamos de equipo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prestamos_equipo (
  id CHAR(36) PRIMARY KEY,
  item_id CHAR(36) NOT NULL,
  -- Quién se lo llevó. Texto libre y no FK a perfiles: el que pide un stick no
  -- es necesariamente un socio, puede ser unLikewise de una escuela que trae
  -- thirty pibes. La FK obligaría a inventar un perfil para eso.
  persona_nombre VARCHAR(150) NOT NULL,
  usuario_id CHAR(36) DEFAULT NULL,
  cantidad INT NOT NULL DEFAULT 1,
  fecha_prestamo DATE NOT NULL DEFAULT (CURRENT_DATE),
  fecha_estimada_devolucion DATE DEFAULT NULL,
  fecha_devolucion DATE DEFAULT NULL,
  estado ENUM('prestado','devuelto','perdido') NOT NULL DEFAULT 'prestado',
  notas TEXT DEFAULT NULL,
  registrado_por CHAR(36) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prestamo_item (item_id),
  INDEX idx_prestamo_estado (estado),
  INDEX idx_prestamo_fecha (fecha_prestamo),
  FOREIGN KEY (item_id) REFERENCES inventario_items(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES perfiles(id) ON DELETE SET NULL,
  FOREIGN KEY (registrado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
    'comunicaciones_internas','partes_administrativos','documentos_legajo',
    'seguros','seguros_historial','configuracion_seguro','recibos',
    'inventario_items','prestamos_equipo'
  )
ORDER BY TABLE_NAME;
