-- ============================================================
-- 08 - PERFILES SIN CUENTA (para bajas anonimizadas)
-- ============================================================
--
-- Al dar de baja a una persona, sus cuotas y sus vínculos familiares se
-- conservan para que el club no pierda la contabilidad. Eso exige que la
-- familia siga apuntando a alguien, y ese alguien no puede ser la persona
-- dada de baja: quedaría identificable.
--
-- La solución es un perfil "sustituto", ya anonimizado, que ocupa el lugar
-- en el vínculo. Y un perfil sin cuenta no tiene usuario_id.
--
-- Por eso se afloja la columna en vez de inventar una cuenta falsa: una
-- cuenta con password_hash inventado es una credencial que existe, y
-- "usuario dado de baja" no es una cuenta.
--
-- ORDEN: el índice UNIQUE de usuario_id lo soporta la FK, así que no se
-- puede tocar uno sin el otro. Primero la FK, después el índice, después
-- la columna, y de vuelta índice y FK.
--
-- El UNIQUE vuelve a estar porque sigue haciendo falta: sin él, dos
-- perfiles podrían apuntar al mismo usuario. Varios NULL no colisionan
-- entre sí, así que los perfiles dados de baja no se estorban.
--
-- Idempotente: se puede correr más de una vez.

SET NAMES utf8mb4;

USE club_fenix;

-- Las FK y los índices tienen nombres que cambian entre instalaciones, así
-- que en vez de asumirlos sesucelen primero.
SELECT CONSTRAINT_NAME AS fk_de_usuario
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'club_fenix' AND TABLE_NAME = 'perfiles'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

-- Aplicar sobre la base ya migrada con nombres conocidos:
--   1) DROP FOREIGN KEY   <el nombre que salga arriba>
--   2) DROP INDEX          usuario_id
--   3) MODIFY usuario_id   CHAR(36) NULL
--   4) ADD UNIQUE          usuario_id
--   5) ADD FOREIGN KEY     REFERENCES usuarios(id) ON DELETE CASCADE
--
-- Y el resultado esperado:
--   usuario_id | YES | char(36)
