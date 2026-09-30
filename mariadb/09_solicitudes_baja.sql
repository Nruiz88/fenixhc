-- ============================================================
-- 09 - SOLICITUDES DE BAJA (derecho de supresión, art. 8 inc. d)
-- ============================================================
--
-- La migración 07 creó la tabla para dejar CONSTANCIA de las bajas que
-- ejecuta la administración. Pero eso solo cubre un lado: la ley dice que
-- el derecho de supresión se EJERCE por la persona, y hasta ahora la única
-- forma de dar de baja era que un administrador lo hiciera por iniciativa
-- propia. Un ex-socio que quiere sus datos borrados no tenía a quién pedírselo.
--
-- Con esta migración la tabla pasa a ser la bandeja de entrada:
--
--   - Una solicitud llega con 'pendiente' y SIN perfil_id asociado. Puede
--     venir de alguien que ya no tiene cuenta, que nunca la tuvo, o que
--     está pidiendo por otra persona. En los tres casos el club no sabe
--     todavía a qué ficha corresponde, y adivinarlo sería peor que no
--     vincularla de entrada.
--
--   - El administrador verifica la identidad con el DNI que trae la
--     solicitud, asocia el perfil_id y resuelve.
--
-- `perfil_id` pasa a NULLABLE por ese motivo. Antes era NOT NULL, lo que
-- obligaba a resolver la identidad en el momento de recibir el pedido, que
-- es exactamente lo que no se puede hacer con un formulario anónimo.
--
-- Idempotente: se puede correr más de una vez sin duplicar nada.

SET NAMES utf8mb4;

-- El DNI de quien pide la baja. Llega en texto porque a veces se escribe con
-- puntos o guiones, y el objetivo es que el admin lo use para encontrar la
-- ficha, no para validarlo automáticamente.
ALTER TABLE solicitudes_baja
  ADD COLUMN IF NOT EXISTS documento_verificacion VARCHAR(30) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS resultado VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS canal VARCHAR(20) DEFAULT 'panel';

-- perfil_id nullable: una solicitud sin resolver no sabe todavía de qué
-- ficha se trata.
ALTER TABLE solicitudes_baja
  MODIFY perfil_id CHAR(36) NULL;

-- Índice para la bandeja del panel: lo pendiente, lo más viejo primero.
--
-- No hace falta crearlo: la migración 07 ya dejó `idx_estado` sobre
-- (estado, created_at), que es exactamente el acceso que hace la bandeja.
-- Agregar un segundo índice igual sería gastar escritura en cada INSERT de
-- solicitud y upkeep en cada UPDATE de estado para no ganar nada.
--
-- Si en algún momento `idx_estado` no estuviera (base creada antes de la 07),
-- el CREATE de la 07 lo deja; esta migración no lo repite a propósito para no
-- duplicarlo.

-- Verificación: se espera perfil_id nullable, y `resultado` y `canal` nuevas.
SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'solicitudes_baja'
ORDER BY ORDINAL_POSITION;
