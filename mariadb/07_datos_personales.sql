-- ============================================================
-- 07 - DATOS PERSONALES
-- ============================================================
--
-- El club guarda DNI, CUIL, dirección, teléfono, fotos de documento y
-- comprobantes bancarios. Casi todos los jugadores son menores de edad.
-- Eso es dato personal sensible y la Ley 25.326 obliga a tres cosas que el
-- sistema no tenía:
--
--   1. Saber QUIÉN accedió a un documento y por qué. Sin bitácora no se
--      puede responder "¿quién abrió el DNI de mi hijo?", y esa es
--      justamente la pregunta que hace un padre.
--   2. Informar el propósito del tratamiento antes de collectar. Se resuelve
--      con el aviso de privacidad en /privacidad y el checkbox del registro.
--   3. Poder suprimir los datos cuando la persona lo pide. Hoy no había
--      forma: dar de baja una cuenta dejaba el DNI y los comprobantes.
--
-- Idempotente: se puede correr más de una vez.

-- ------------------------------------------------------------
-- Bitácora de accesos a documentos sensibles
-- ------------------------------------------------------------
-- Se escribe en el servidor cuando alguien lee un DNI o un comprobante que
-- no es suyo. Guardar quién, cuándo y sobre qué documento es lo mínimo para
-- que el acceso sea trazable.
--
-- No se guardan los documentos ni sus valores: solo el identificador del
-- perfil y el tipo. La bitácora no puede convertirse en una segunda copia
-- del padrón de datos.
CREATE TABLE IF NOT EXISTS accesos_datos_sensibles (
  id CHAR(36) PRIMARY KEY,
  -- Quién accedió.
  usuario_id CHAR(36) NOT NULL,
  -- A qué ficha se accedió (NO al archivo: el nombre del archivo no aporta
  -- nada y sí es dato personal).
  perfil_destino_id CHAR(36) NOT NULL,
  -- 'dni' o 'comprobante'. Extensible sin cambiar la estructura.
  tipo_documento VARCHAR(30) NOT NULL,
  -- Para qué dijo que era. Es lo que separa "miró un DNI" de "miró un DNI
  -- para resolver un reclamo", que es lo que la ley pide poder justificar.
  proposito VARCHAR(100) DEFAULT NULL,
  ip VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_destino (perfil_destino_id, created_at),
  INDEX idx_usuario (usuario_id, created_at),
  INDEX idx_fecha (created_at),
  CONSTRAINT fk_accesos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_accesos_destino FOREIGN KEY (perfil_destino_id) REFERENCES perfiles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Solicitudes de baja
-- ------------------------------------------------------------
-- Una baja NO se borra en cascada. Si se borrara la cuenta, se irían el
-- historial de pagos y la contabilidad del club, que son datos que el club
-- necesita conservar. Lo que se elimina es la identidad: se anonimiza el
-- perfil y se corta el vínculo con la persona.
--
-- Por eso esto es una SOLICITUD con estado, y no un botón que borra.
CREATE TABLE IF NOT EXISTS solicitudes_baja (
  id CHAR(36) PRIMARY KEY,
  -- A quién se refiere el pedido. No puede ser FK a perfiles con ON DELETE
  -- CASCADE justamente porque la baja no borra la ficha.
  perfil_id CHAR(36) NOT NULL,
  -- Quién lo pidió. Puede no ser la persona del perfil (un padre pide por
  -- su hijo), por eso no es FK: se guarda el nombre y email tal cual.
  solicitante_nombre VARCHAR(150) NOT NULL,
  solicitante_email VARCHAR(255) NOT NULL,
  -- 'dni', 'cuil' o un texto libre.
  documento_verificacion VARCHAR(30) DEFAULT NULL,
  motivo TEXT,
  -- 'pendiente' | 'en_revision' | 'resuelta' | 'rechazada'
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resuelta_at TIMESTAMP NULL,
  resuelta_por CHAR(36) NULL,
  INDEX idx_estado (estado, created_at),
  INDEX idx_perfil (perfil_id),
  CONSTRAINT fk_baja_resuelta_por FOREIGN KEY (resuelta_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Constancia de qué_version del aviso aceptaron
-- ------------------------------------------------------------
-- Para poder probar ante la autoridad que el aviso estaba vigente cuando la
-- persona se registró. Guardar la fecha alcanza; guardar el texto exacto
-- importaría solo si el aviso cambia, y en ese caso se cambia la versión.
INSERT INTO configuracion_club (clave, valor, descripcion) VALUES
  ('privacidad_version', '2026-09-30', 'Fecha de la versión vigente del aviso de privacidad')
ON DUPLICATE KEY UPDATE valor = VALUES(valor);
