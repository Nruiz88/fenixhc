-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 14
-- Una persona puede tener varios roles a la vez.
--
-- Caso real: un socio benefactor que además es secretario, o un tesorero
-- que también juega. El ENUM `rol` no puede guardar más de un valor, así
-- que se agrega `roles` (JSON) y se conserva `rol` como rol PRINCIPAL,
-- que es el que ya usan el login, los índices y las consultas viejas.
--
-- El rol principal se calcula por prioridad (admin > presidente >
-- secretario > tesorero > vocales > socios). La aplicación mantiene las
-- dos columnas sincronizadas: `rol` siempre es uno de los valores de
-- `roles`.
--
-- Las filas existentes arrancan con un solo rol, el que ya tenían.
--
-- Es idempotente: se puede correr dos veces sin perder datos.
-- ============================================================

USE club_fenix;

-- 1) Columnas nuevas. `rol` queda como está (rol principal / compatibilidad).
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS roles JSON NULL AFTER rol;
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS roles JSON NULL AFTER rol;

-- 2) Backfill: cada cuenta arranca con exactamente el rol que ya tenía.
--    Solo se tocan las filas nuevas (roles NULL), para no pisar cambios
--    hechos a mano en la base.
UPDATE usuarios SET roles = JSON_ARRAY(rol) WHERE roles IS NULL;
UPDATE perfiles SET roles = JSON_ARRAY(rol) WHERE roles IS NULL;

-- ---------------------------------------------------------------------------
-- Verificación
-- ---------------------------------------------------------------------------
SELECT id, email, rol, roles FROM club_fenix.usuarios ORDER BY created_at;
SELECT COUNT(*) AS sin_roles FROM club_fenix.usuarios WHERE roles IS NULL;
SELECT COUNT(*) AS admins
  FROM club_fenix.usuarios
 WHERE rol = 'admin' OR JSON_CONTAINS(COALESCE(roles, JSON_ARRAY()), '"admin"');
