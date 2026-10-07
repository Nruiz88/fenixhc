-- ============================================================
-- 10 - MENORES DE EDAD: NACIMIENTO Y CONSENTIMIENTOS
-- ============================================================
--
-- Esta migración es la que hace posible, o no, tratar legalmente los datos de
-- los menores. Antes de ella el club tenía dos huecos que no se arreglan con
-- software:
--
--   1. NO SABÍA SI ALGUIEN ERA MENOR. No había fecha de nacimiento en
--      ninguna tabla. El rol 'socio_cadete' dice quién juega, no cuántos años
--      tiene. Sin edad no hay forma de saber a quién se le pide consentimiento
--      y a quién se le exige que sea él mismo quien consienta.
--
--   2. NO GUARDABA EL CONSENTIMIENTO. El registro exigía un checkbox, y el
--      checkbox no dejaba rastro: no se sabía quién consintió, ni en nombre de
--      quién, ni para qué, ni qué versión del aviso leyó. Con un "sí" que no
--      se guarda no hay forma de demostrar nada, que es justo lo que hay que
--      poder demostrar.
--
-- DECISIÓN DE DISEÑO — POR QUÉ HAY UNA TABLA DE REVOCACIONES SEPARADA
--
-- El consentimiento es la prueba. Si el club puede editarlo o borrarlo, deja
-- de ser prueba. Por eso `consentimientos` es SOLO DE ALTA: cada fila es un
-- acto, y no se toca. Revocar no borra la fila del consentimiento: agrega una
-- fila en `revocaciones_consentimiento` que apunta a él.
--
-- Con eso se puede demostrar la secuencia completa —"el 3 de marzo lo
-- consintió, el 20 de agosto lo revocó"— que es lo que se pide ver. Con una
-- tabla única que se actualiza, solo queda el último estado y se pierde el
-- historial.
--
-- BASE LEGAL — LA DISTINCIÓN QUE SOSTIENE TODO
--
-- No todo depende del consentimiento. Las cuotas, los pagos y la contabilidad
-- no se guardan porque alguien aceptó guardarlas: se guardan porque el club
-- tiene OBLIGACIÓN de llevar esa contabilidad. Si esa columna no existiera,
-- revocar el consentimiento de un socio borraría sus pagos del club, y el
-- club quedaría sin contabilidad. Está explícita para que eso no dependa de
-- que alguien se acuerde.
--
-- Idempotente.

SET NAMES utf8mb4;

USE club_fenix;

-- ------------------------------------------------------------
-- 1. Fecha de nacimiento
-- ------------------------------------------------------------
-- Va en `deportistas` y no en `perfiles` a propósito. No todos los perfiles
-- son jugadores, y a un socio benefactor adulto no le hace falta que el club
-- guarde su fecha de nacimiento: nadie necesita saber cuándo nació un padre
-- para cobrarle una cuota. El dato se pide solo donde corresponde.
ALTER TABLE deportistas
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(30) DEFAULT NULL;

-- ------------------------------------------------------------
-- 2. Evidencia del vínculo
-- ------------------------------------------------------------
-- El registro tenía 'padre' fijo en el código: una madre que inscribe a su
-- hija quedaba asentada como "padre" del niño. Eso no es un detalle de forma. El
-- vínculo es la EVIDENCIA de quién representa a quién. Si el acta dice
-- 'padre' y en realidad es la madre, el registro contradice a la realidad
-- justo en el campo que después va a sostener una firma de consentimiento.
ALTER TABLE familias
  ADD COLUMN IF NOT EXISTS documentacion_vinculo VARCHAR(200) DEFAULT NULL;

-- ------------------------------------------------------------
-- 3. Consentimientos (solo altas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consentimientos (
  id CHAR(36) PRIMARY KEY,

  -- Para QUIÉN es el consentimiento. Puede ser el propio titular o un menor.
  titular_perfil_id CHAR(36) NOT NULL,

  -- QUIÉN lo otorgó. NULL significa que lo otorga el propio titular.
  -- Cuando es un menor, es el representante legal: nunca el menor.
  otorgante_perfil_id CHAR(36) DEFAULT NULL,

  -- Cómo se prueba quién representa. Sin esto, el campo anterior es una
  -- declaración sin respaldo.
  otorgante_tipo ENUM('titular','padre','madre','tutor','otro_representante')
    NOT NULL DEFAULT 'titular',

  -- Vínculo declarado con el menor. Es lo que se cruza contra `familias`.
  vinculo_tipo ENUM('padre','madre','tutor') DEFAULT NULL,

  -- Para QUÉ se pidió. Catálogo cerrado, nunca texto libre: un propósito
  -- escrito a mano no se puede contar ni comparar entre consentimientos.
  finalidad VARCHAR(40) NOT NULL,

  -- POR QUÉ se puede tratar. Separa lo que depende de la voluntad de alguien
  -- de lo que el club tiene obligación de guardar pase lo que pase.
  base_legal ENUM('consentimiento','ejecucion_de_contrato','obligacion_legal')
    NOT NULL DEFAULT 'consentimiento',

  -- Si era MENOR al momento de otorgar. Se guarda porque la misma persona a
  -- los 9 y a los 19 no está en la misma situación, y dentro de tres años
  -- esta fila va a ser la prueba de algo distinto.
  menor_al_otorgar BOOLEAN NOT NULL DEFAULT FALSE,
  edad_al_otorgar SMALLINT DEFAULT NULL,

  -- Qué versión del texto se leyó. Sin esto, dentro de un año no se puede
  -- demostrar qué se consintió: el aviso pudo haber cambiado.
  version_aviso VARCHAR(20) NOT NULL,

  -- Contexto del acto. No es para vigilar a nadie: es para probar que el
  -- consentimiento no se obtuvo de otra manera.
  ip VARCHAR(45) DEFAULT NULL,
  user_agent VARCHAR(255) DEFAULT NULL,

  -- Cómo llegó el consentimiento: online en el registro, cargado por la
  -- secretaría, o firmado presencialmente en la sede.
  canal ENUM('registro','panel','presencial') NOT NULL DEFAULT 'registro',
  registrado_por CHAR(36) DEFAULT NULL,

  otorgado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_cons_titular (titular_perfil_id),
  INDEX idx_cons_finalidad (finalidad),
  INDEX idx_cons_otorgante (otorgante_perfil_id),
  INDEX idx_cons_fecha (otorgado_en),
  FOREIGN KEY (titular_perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
  FOREIGN KEY (otorgante_perfil_id) REFERENCES perfiles(id) ON DELETE SET NULL,
  FOREIGN KEY (registrado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 4. Revocaciones (también solo altas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revocaciones_consentimiento (
  id CHAR(36) PRIMARY KEY,
  consentimiento_id CHAR(36) NOT NULL,
  -- Quién revoca. Un menor puede revocar sobre sus propios datos consentidos
  -- por el padre: la oposición del titular menor prevalece sobre el
  -- consentimiento del tutor. Por eso esto NO exige que sea el mismo que
  -- otorgó.
  revocado_por CHAR(36) DEFAULT NULL,
  revocado_por_tipo ENUM('titular','representante') NOT NULL DEFAULT 'titular',
  motivo VARCHAR(500) DEFAULT NULL,
  revocado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rev_cons (consentimiento_id),
  INDEX idx_rev_fecha (revocado_en),
  FOREIGN KEY (consentimiento_id) REFERENCES consentimientos(id) ON DELETE CASCADE,
  FOREIGN KEY (revocado_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 5. Opinion del menor (art. 124 inc. b del Codigo Civil)
-- ------------------------------------------------------------
-- El Código Civil exige que en los actos que afectan al menor se tenga en
-- cuenta SU opinión. No alcanza con que la dé el padre: si el chico dice que
-- no quiere que le saquen la foto del DNI, el club tiene que respetarlo
-- aunque la madre haya firmado.
--
-- Por eso la opinión va en su propia tabla y no como una columna más: es un
-- acto del menor, distinto del acto del representante, y puede contradecirlo.
CREATE TABLE IF NOT EXISTS opiniones_menor (
  id CHAR(36) PRIMARY KEY,
  menor_perfil_id CHAR(36) NOT NULL,
  -- Qué se le preguntó. Sin contexto la opinión no es interpretable:
  -- 'documentacion_dni' = "¿te sacamos la foto del DNI?"
  consulta VARCHAR(60) NOT NULL,
  -- 'a_favor' | 'en_contra' | 'no_consultado'
  opinion ENUM('a_favor','en_contra','no_consultado') NOT NULL,
  -- Quién recogió la opinión: el menor en su portal, o un adulto que la
  -- preguntó y la anotó. La diferencia importa si algún día se discute.
  recogida_por CHAR(36) DEFAULT NULL,
  origen ENUM('propia','transmitida_por_representante')
    NOT NULL DEFAULT 'propia',
  edad_al_consultar SMALLINT DEFAULT NULL,
  registrada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_op_menor (menor_perfil_id),
  INDEX idx_op_consulta (consulta),
  FOREIGN KEY (menor_perfil_id) REFERENCES perfiles(id) ON DELETE CASCADE,
  FOREIGN KEY (recogida_por) REFERENCES perfiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('consentimientos','revocaciones_consentimiento','opiones_menor');

SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'deportistas'
  AND COLUMN_NAME IN ('fecha_nacimiento','categoria');
