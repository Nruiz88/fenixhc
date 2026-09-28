-- ============================================================
-- FENIX ROLLER HOCKEY - Creación de base, usuario y privilegios
-- Se ejecuta como root (consola de Coolify / SSH)
-- ============================================================

CREATE DATABASE IF NOT EXISTS club_fenix
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fenix'@'%' IDENTIFIED BY 'Fenix2026!DB';
CREATE USER IF NOT EXISTS 'fenix'@'localhost' IDENTIFIED BY 'Fenix2026!DB';

GRANT ALL PRIVILEGES ON club_fenix.* TO 'fenix'@'%';
GRANT ALL PRIVILEGES ON club_fenix.* TO 'fenix'@'localhost';

FLUSH PRIVILEGES;
