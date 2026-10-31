-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 15
-- Cobros online de cuotas con MercadoPago.
--
-- Qué agrega:
--
-- 1) Las credenciales de MercadoPago se guardan en `configuracion_club`,
--    porque el club las carga desde el panel (no por variables de entorno).
--    El Access Token y el secreto de webhooks se guardan CIFRADOS por la
--    aplicación; acá solo viven los textos cifrados.
--
-- 2) `pagos_mercadopago`: una fila por intento de cobro. Es la auditoría
--    que permite saber qué preferencia se creó, qué pago la terminó
--    pagando, por cuánto y con qué estado. Sin esta tabla, el webhook
--    marcaría cuotas como pagadas sin dejar rastro de la operación.
--
-- 3) `cuotas.pago_mp_id`: enlaza la cuota con el cobro online que la pagó.
--    Es informativo: el estado de la cuota sigue siendo la fuente de verdad.
--
-- 4) El método de pago `mercadopago` en `cuotas.metodo_pago`.
--
-- Decisiones que no conviene revertir:
--
-- - El webhook NO marca una cuota por el solo hecho de recibir un POST.
--   Primero consulta el pago a la API de MercadoPago y comprueba que el
--   importe, la moneda y la referencia externa coincidan con un cobro
--   creado por esta app. El POST es solo una señal.
--
-- - `pagos_mercadopago.cuotas` guarda el detalle de importes calculados al
--   crear la preferencia. Si el recargo cambia mientras la persona está en
--   MercadoPago, se acredita lo que efectivamente se cobró, no lo que diría
--   la regla hoy.
--
-- - No hay FK de `cuotas.pago_mp_id` a `pagos_mercadopago`: las cuotas
--   sobreviven a cualquier limpieza de cobros, y la contabilidad no puede
--   quedar colgada de una tabla auxiliar.
--
-- Es idempotente: se puede correr más de una vez sin duplicar nada.
-- ============================================================

USE club_fenix;

-- ------------------------------------------------------------
-- Cobros online
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos_mercadopago (
  id CHAR(36) PRIMARY KEY,
  -- Nullable a propósito: si se elimina una cuenta o una familia, el cobro
  -- tiene que quedar registrado igual. La contabilidad no se borra.
  usuario_id CHAR(36) NULL,
  familia_id CHAR(36) NULL,
  preferencia_id VARCHAR(100) NULL,
  pago_id VARCHAR(100) NULL,
  external_reference VARCHAR(100) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(8) NOT NULL DEFAULT 'ARS',
  -- pendiente | aprobado | rechazado | cancelado | reembolsado | revision | error
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  estado_detalle VARCHAR(100) NULL,
  metodo_pago VARCHAR(50) NULL,
  -- Detalle de las cuotas incluidas: id, familia, monto base, recargo y total.
  cuotas JSON NOT NULL,
  init_point TEXT NULL,
  -- Respuesta resumida del pago de MercadoPago, para auditoría.
  detalle JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mp_preferencia (preferencia_id),
  UNIQUE KEY uq_mp_pago (pago_id),
  UNIQUE KEY uq_mp_external (external_reference),
  INDEX idx_mp_usuario (usuario_id),
  INDEX idx_mp_estado (estado),
  INDEX idx_mp_creado (created_at),
  CONSTRAINT fk_mp_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_mp_familia FOREIGN KEY (familia_id) REFERENCES familias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Vínculo de la cuota con el cobro online
-- ------------------------------------------------------------
ALTER TABLE cuotas
  ADD COLUMN IF NOT EXISTS pago_mp_id CHAR(36) NULL AFTER comprobante_url;

-- El método de pago nuevo. MODIFY es idempotente: volver a correrlo con la
-- misma lista de valores no cambia nada.
ALTER TABLE cuotas
  MODIFY COLUMN metodo_pago ENUM('efectivo','transferencia','debito','credito','cheque','mercadopago') DEFAULT NULL;

-- ------------------------------------------------------------
-- Configuración de MercadoPago
-- ------------------------------------------------------------
-- Los valores se insertan vacíos. El admin los completa desde
-- /admin/configuracion -> Cobros online. El Access Token y el secreto de
-- webhooks se guardan cifrados por la app.
INSERT INTO configuracion_club (clave, valor, descripcion) VALUES
  ('mp_habilitado', '0', 'Cobros online con MercadoPago habilitados (1) o pausados (0)'),
  ('mp_access_token', '', 'Access Token de MercadoPago (cifrado por la aplicación)'),
  ('mp_public_key', '', 'Public Key de MercadoPago'),
  ('mp_webhook_secret', '', 'Secreto de firma de webhooks de MercadoPago (cifrado por la aplicación)')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- ------------------------------------------------------------
-- Verificación
-- ------------------------------------------------------------
SELECT 'pagos_mercadopago' AS tabla, COUNT(*) AS filas
  FROM information_schema.tables
 WHERE table_schema = 'club_fenix' AND table_name = 'pagos_mercadopago';
SELECT clave, CASE WHEN valor = '' THEN '(vacío)' ELSE '(cargado)' END AS estado
  FROM configuracion_club
 WHERE clave LIKE 'mp\_%';
