-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 03
-- El chat interno se retiró del producto: se elimina la tabla.
--
-- Ejecutar SOLO en bases que ya tengan 01_schema.sql aplicado
-- (el 01 nuevo ya no la crea). Es idempotente.
-- ============================================================

USE club_fenix;

-- Por si quedó data huérfena de multipartes de chat en disco:
-- los archivos ya no se sirven (el bucket 'chat-archivos' se quitó
-- de ALLOWED_BUCKETS en /api/upload). Hay que borrarlos a mano
-- del volumen de uploads si existen:
--   rm -rf <UPLOAD_DIR>/chat-archivos

DROP TABLE IF EXISTS mensajes_chat;
