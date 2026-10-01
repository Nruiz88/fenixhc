-- ============================================================
-- 13 - AVISOS A FAMILIAS
-- ============================================================
--
-- El club cobraba cuotas y llevaba el seguro, pero no tenía forma de avisarle a
-- una familia que le toca pagar. La capacidad `comunicar_padres` existía en el
-- código desde la sección de junta directiva y nadie la implementaba: era un
-- permiso sin botón detrás.
--
-- Lo que hace esta tabla es dejar constancia de a QUIÉN se le pidió qué y con
-- qué palabras.
--
-- ------------------------------------------------------------
-- Por qué un registro y no nada
-- ------------------------------------------------------------
--
-- Porque el riesgo de esta pantalla es el correo repetido. La tesorería va a
-- volver a pasar por acá todos los meses, y si no queda registrado qué se mandó
-- y a quién, la segunda pasada manda lo mismo otra vez. Un club que manda tres
-- avisos por la misma cuota pierde más credibilidad que el que no manda ninguno.
--
-- Por eso la fila guarda el TEXTO que salió, no solo los ids. Si mañana se
-- cambia la plantilla del aviso, el registro de lo que se dijo en marzo tiene
-- que seguir diciendo lo que se dijo en marzo. Guardar solo "mandaste un aviso
-- de cuota 5" no alcanza para contestar una familia que diga "nunca nos
-- avisaste".
--
-- `canal` queda separado de `resultado` a propósito: que se haya pedido el envío
-- por correo y que el correo haya salido son dos hechos distintos. Sin Resend
-- configurado el correo NO sale, y el registro tiene que poder decir eso sin
-- mentir.
--
-- No hay borrado de avisos. Una baja anonimiza la cuenta del socio, pero no
-- reescribe la historia de lo que el club le pidió.
--
-- Idempotente.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS avisos_familias (
  id CHAR(36) PRIMARY KEY,

  -- A quién se le mandó. Es el usuario del socio responsable, no el del jugador:
  -- a un padre de 14 años no se le manda nada.
  usuario_id CHAR(36) NOT NULL,

  -- Qué motivo tenía el aviso.
  motivo ENUM('cuota', 'seguro', 'mixto') NOT NULL DEFAULT 'cuota',

  -- Cuotas y seguro concretos, congelados como texto.
  --
  -- Se guardan los ids separados por coma y no como relación aparte porque no
  -- se consultan: nadie va a listar "todos los avisos de esta cuota". Se leen
  -- juntos con el texto, para poder responder "esto es lo que se le pidió".
  --
  -- `detalle` es el texto que se mandó, con los montos ya resueltos. Es lo que
  -- se muestra si la familia pregunta.
  detalle TEXT NOT NULL,
  cuotas TEXT DEFAULT NULL,
  seguro_id CHAR(36) DEFAULT NULL,

  -- A cuánto ascendía lo adeudado al momento del aviso. Se congela porque el
  -- recargo sigue subiendo: el aviso de hoy y el de la semana que viene no
  -- pueden decir el mismo número.
  monto_total DECIMAL(10,2) DEFAULT NULL,
  dias_vencida INT DEFAULT NULL,

  -- Por dónde se intentó avisar, y qué pasó.
  canal ENUM('portal', 'email', 'ambos') NOT NULL DEFAULT 'portal',
  resultado ENUM('entregado', 'parcial', 'error') NOT NULL DEFAULT 'entregado',
  detalle_error VARCHAR(500) DEFAULT NULL,

  -- Quién lo mandó, para el club y para la auditoría.
  enviado_por CHAR(36) NOT NULL,
  enviado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_aviso_usuario (usuario_id),
  INDEX idx_aviso_fecha (enviado_en),
  INDEX idx_aviso_motivo (motivo, enviado_en),

  CONSTRAINT fk_aviso_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_aviso_autor FOREIGN KEY (enviado_por) REFERENCES usuarios(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- La pantalla de avisos pregunta "¿a quién ya le avisamos esto?" y esa pregunta
-- siempre es "de este usuario, de este motivo, desde esta fecha".
CREATE INDEX IF NOT EXISTS idx_aviso_usuario_motivo ON avisos_familias (usuario_id, motivo, enviado_en);