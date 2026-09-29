-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 05
-- Roles de directiva + renombre de los roles de socio.
--
-- Antes:  ENUM('admin','padre','deportista')
-- Ahora:  ENUM('admin','presidente','secretario','tesorero',
--                'vocal_titular','vocal_suplente',
--                'socio_benefactor','socio_cadete')
--
-- IMPORTANTE: esto cambia los valores del ENUM. Los JWT emitidos antes del
-- cambio llevan 'padre'/'deportista' en el payload, asi que TODOS van a
-- tener que volver a iniciar sesion. Es el costo de renombrar de verdad.
--
-- Es idempotente en cuanto a los UPDATE (solo afectan a los valores viejos).
-- ============================================================

USE club_fenix;

-- 1) PRIMERO se amplian los ENUM conservando los valores viejos.
--    Ojo con el DEFAULT: tiene que seguir siendo un valor que todavia exista
--    en la tabla. Si se pone DEFAULT 'socio_benefactor' antes de migrar los
--    datos, MySQL/MariaDB lo valida contra las filas actuales y falla con
--    "Data truncated for column 'rol'" (ERROR 1265).
ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM(
    'admin','presidente','secretario','tesorero',
    'vocal_titular','vocal_suplente',
    'socio_benefactor','socio_cadete',
    'padre','deportista'          -- viejos: se quitan en el paso 3
  ) NOT NULL DEFAULT 'padre';

-- 2) perfiles.rol (copia el rol para mostrar y consultar).
ALTER TABLE perfiles
  MODIFY COLUMN rol ENUM(
    'admin','presidente','secretario','tesorero',
    'vocal_titular','vocal_suplente',
    'socio_benefactor','socio_cadete',
    'padre','deportista'
  ) NOT NULL;

-- notificaciones.destinatario_rol usa los mismos nombres de rol.
ALTER TABLE notificaciones
  MODIFY COLUMN destinatario_rol ENUM(
    'admin','presidente','secretario','tesorero',
    'vocal_titular','vocal_suplente',
    'socio_benefactor','socio_cadete','todos',
    'padre','deportista'
  ) DEFAULT 'todos';

-- 3) Migrar los datos. Recien ahora que los valores nuevos existen en el ENUM.
UPDATE usuarios SET rol = 'socio_benefactor' WHERE rol = 'padre';
UPDATE usuarios SET rol = 'socio_cadete'     WHERE rol = 'deportista';
UPDATE perfiles SET rol = 'socio_benefactor' WHERE rol = 'padre';
UPDATE perfiles SET rol = 'socio_cadete'     WHERE rol = 'deportista';
UPDATE notificaciones SET destinatario_rol = 'socio_benefactor' WHERE destinatario_rol = 'padre';
UPDATE notificaciones SET destinatario_rol = 'socio_cadete'     WHERE destinatario_rol = 'deportista';

-- 4) Ahora que no queda ninguna fila con el valor viejo, se puede quitar del
--    ENUM y poner el DEFAULT definitivo.
ALTER TABLE usuarios
  MODIFY COLUMN rol ENUM(
    'admin','presidente','secretario','tesorero',
    'vocal_titular','vocal_suplente',
    'socio_benefactor','socio_cadete'
  ) NOT NULL DEFAULT 'socio_benefactor';

ALTER TABLE perfiles
  MODIFY COLUMN rol ENUM(
    'admin','presidente','secretario','tesorero',
    'vocal_titular','vocal_suplente',
    'socio_benefactor','socio_cadete'
  ) NOT NULL;

ALTER TABLE notificaciones
  MODIFY COLUMN destinatario_rol ENUM(
    'admin','presidente','secretario','tesorero',
    'vocal_titular','vocal_suplente',
    'socio_benefactor','socio_cadete','todos'
  ) DEFAULT 'todos';

-- 5) El tipo_vinculo NO se toca: 'padre'|'madre'|'tutor' describe la
--    relacion familiar, no el tipo de usuario. Un socio benefactor puede
--    vincularse como madre o tutor.

-- ---------------------------------------------------------------------------
-- Verificacion
-- ---------------------------------------------------------------------------
SELECT rol, COUNT(*) AS usuarios FROM club_fenix.usuarios GROUP BY rol;
SELECT rol, COUNT(*) AS perfiles FROM club_fenix.perfiles GROUP BY rol;
-- No deberia quedar ninguno con el rol viejo:
SELECT COUNT(*) AS roles_viejos FROM club_fenix.usuarios WHERE rol IN ('padre','deportista');
