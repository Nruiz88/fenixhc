-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 04
-- Verificación obligatoria de email para el login.
--
-- IMPORTANTE: las cuentas que ya existían se marcan como verificadas.
-- Si no se hiciera, todos los usuarios previos (incluido el admin)
-- quedarían afuera del sistema al activar el bloqueo por verificación.
--
-- Es idempotente: se puede correr más de una vez.
-- ============================================================

USE club_fenix;

-- 1) Agregar las columnas (si no existen).
-- MariaDB no tiene "ADD COLUMN IF NOT EXISTS", así que se usa el
-- trick de information_schema + PREPARE para que sea re-seguro.
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'email_verificado') > 0,
  'SELECT 1',
  'ALTER TABLE usuarios ADD COLUMN email_verificado BOOLEAN NOT NULL DEFAULT FALSE AFTER rol'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'verification_token') > 0,
  'SELECT 1',
  'ALTER TABLE usuarios ADD COLUMN verification_token CHAR(64) NULL AFTER email_verificado'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'verification_expires_at') > 0,
  'SELECT 1',
  'ALTER TABLE usuarios ADD COLUMN verification_expires_at TIMESTAMP NULL AFTER verification_token'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
      AND COLUMN_NAME = 'verification_sent_at') > 0,
  'SELECT 1',
  'ALTER TABLE usuarios ADD COLUMN verification_sent_at TIMESTAMP NULL AFTER verification_expires_at'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Índice para buscar por token.
SET @sql = (SELECT IF(
  (SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'usuarios'
      AND INDEX_NAME = 'idx_usuarios_verif') > 0,
  'SELECT 1',
  'ALTER TABLE usuarios ADD INDEX idx_usuarios_verif (verification_token)'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Las cuentas preexistentes quedan verificadas: son las que el club
--    ya/usaba, no cuentas_created_ por spam. Los registros nuevos se crean
--    con email_verificado = FALSE y deben verificar para entrar.
UPDATE usuarios SET email_verificado = 1 WHERE email_verificado = 0;
