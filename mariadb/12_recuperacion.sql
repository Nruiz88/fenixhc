-- ============================================================
-- 12 - RECUPERACION DE CONTRASENA
-- ============================================================
--
-- Antes no había forma de recuperar una clave perdida. Quien la olvidaba
-- dependía de que un administrador se la cambiara desde el panel. Para un club
-- con socios que se registran solos, eso no es un trámite: es una cuenta
-- inutilizable.
--
-- ------------------------------------------------------------
-- Por qué columnas y no una tabla de tokens
-- ------------------------------------------------------------
-- Es el mismo criterio que usa la verificación de email: los tokens son de un
-- solo uso, expiran y se borran al consumirse. Con una tabla aparte habría que
-- purgarla, y una tabla que se purga es una tabla de la que alguien se olvida
-- de purgar. En `usuarios` el token desaparece con el UPDATE.
--
-- Los campos van SEPARADOS de los de verificación a propósito. Una cuenta
-- puede estar verificando el email y pidiendo el cambio de clave al mismo
-- tiempo, y con una columna compartida una de las dos acciones pisa a la otra.
--
-- Idempotente.

SET NAMES utf8mb4;

-- SHA-256 del token, nunca el token en claro. Alguien que lea esta tabla no
-- puede abrir la cuenta de nadie.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS reset_token CHAR(64) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS reset_enviado_en TIMESTAMP NULL,
  -- Desde qué IP se pidió. Un token que sale de una IP distinta a la del
  -- último pedido es una señal.
  ADD COLUMN IF NOT EXISTS reset_solicitado_ip VARCHAR(45) DEFAULT NULL;

-- Cuándo se cambió la clave por última vez.
--
-- Sirve para responder "desde cuándo tenés esta clave". Y para que, cuando se
-- implemente la revocación de sesiones por versión, no haya que volver a tocar
-- esta migración: el campo ya queda escrito.
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- El lookup principal es `WHERE reset_token = ?`. Sin índice propio, MySQL
-- recorre la tabla entera en cada intento de recuperación: se vuelven a
-- preguntar todos los que perdieron la clave, juntos.
SET @idx := (
  SELECT IFNULL(
    (SELECT CONCAT('ALTER TABLE usuarios ADD INDEX idx_usuarios_reset (reset_token)')
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'usuarios'
        AND INDEX_NAME = 'idx_usuarios_reset'
      LIMIT 1),
    'SELECT 1'
  )
);
PREPARE stmt FROM @idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'usuarios'
  AND COLUMN_NAME IN (
    'reset_token', 'reset_expires_at', 'reset_enviado_en',
    'reset_solicitado_ip', 'password_changed_at'
  )
ORDER BY ORDINAL_POSITION;