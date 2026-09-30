-- ============================================================
-- 06 - CONFIGURACION DE CUOTAS Y VENCIMIENTOS
-- ============================================================
--
-- Que resuelve esto:
--
-- 1) El monto de la cuota estaba fijo en $75.000, hardcodeado en el codigo.
--    No habia forma de cambiarlo sin tocar el codigo y redesplegar.
--    Ahora hay un valor por defecto global, editable desde Configuración.
--
-- 2) No habia forma de aplicar recargo por atraso. Peor: la tabla `cuotas`
--    no tenia columna de vencimiento, así que la antigüedad que mostraba la
--    pantalla de contabilidad era una aproximación calculada a partir del
--    mes de la cuota.
--
-- 3) Cuando un socio pagaba con recargo, ese dinero extra no se registraba
--    en ningún lado y la contabilidad mostraba menos ingreso del que entró.
--
-- Decisiones de diseño (confirmadas con el club):
--
-- - El recargo se CALCULA AL VUELO, no se guarda. Cambiar los porcentajes
--   mañana recalcula las cuotas pendientes de hoy, sin tocar la base.
--   Por eso los vencimientos son una tabla aparte y no columnas en `cuotas`.
--
-- - El día del hito se toma del mes SIGUIENTE al de la cuota. La cuota de
--   marzo vence el 10 de abril. Así una cuota del mes en curso nunca tiene
--   recargo, que es lo que espera la gente.
--
-- - `monto_pagado` guarda lo que efectivamente entró. Es NULL mientras la
--   cuota está pendiente. Al aprobar se llena con el total con recargo. Si el
--   socio pagó otra cosa, se corrige a mano: manda lo que entró en caja, no
--   lo que dice el catálogo.
--
-- Idempotente: se puede correr más de una vez sin romper nada.

-- ------------------------------------------------------------
-- Configuración general del club (clave/valor)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion_club (
  clave VARCHAR(64) PRIMARY KEY,
  valor TEXT NOT NULL,
  descripcion VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Hitos de vencimiento y su recargo
-- ------------------------------------------------------------
-- `dia` es el día del mes (1-31) en que el hito se cumple, tomando el mes
-- siguiente al de la cuota. Ej: dia=10 y porcentaje=5 significa "desde el
-- día 10 del mes siguiente, la cuota adeuda un 5% extra".
CREATE TABLE IF NOT EXISTS vencimientos_cuota (
  id CHAR(36) PRIMARY KEY,
  dia INT NOT NULL,
  porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
  etiqueta VARCHAR(100) DEFAULT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_dia CHECK (dia >= 1 AND dia <= 31),
  CONSTRAINT chk_pct CHECK (porcentaje >= 0 AND porcentaje <= 100),
  INDEX idx_orden (orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Columnas nuevas en `cuotas`
-- ------------------------------------------------------------

-- Lo que efectivamente entró en caja. NULL mientras está pendiente.
ALTER TABLE cuotas
  ADD COLUMN IF NOT EXISTS monto_pagado DECIMAL(10,2) NULL AFTER monto;

-- Permite que una cuota puntual se venza en otra fecha a la general.
-- Útil cuando se pactó un acuerdo puntual con una familia. NULL = usar la
-- regla general de `vencimientos_cuota`.
ALTER TABLE cuotas
  ADD COLUMN IF NOT EXISTS vencimiento_override DATE NULL AFTER fecha_pago;

-- ------------------------------------------------------------
-- Datos iniciales
-- ------------------------------------------------------------
INSERT INTO configuracion_club (clave, valor, descripcion) VALUES
  ('cuota_monto_base', '75000', 'Monto mensual de la cuota, antes de recargo'),
  ('cuota_mes_vencimiento_dia', '10', 'Día del mes siguiente en que vence la cuota sin recargo')
ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion);

-- Los tres tramos de recargo. Editables desde /admin/configuracion.
--
-- Los id son FIJOS a propósito: con UUID() cada corrida inserta tres filas
-- nuevas y el script deja de ser idempotente. Con id fijo, el ON DUPLICATE
-- actualiza los tramos existentes en vez de duplicarlos.
INSERT INTO vencimientos_cuota (id, dia, porcentaje, etiqueta, orden) VALUES
  ('00000000-0000-0000-0000-000000000010', 10,  5.00, 'Vence el día 10: +5%',  1),
  ('00000000-0000-0000-0000-000000000020', 20, 10.00, 'Vence el día 20: +10%', 2),
  ('00000000-0000-0000-0000-000000000030', 30, 20.00, 'Vence el día 30: +20%', 3)
ON DUPLICATE KEY UPDATE
  dia = VALUES(dia),
  porcentaje = VALUES(porcentaje),
  etiqueta = VALUES(etiqueta),
  orden = VALUES(orden),
  activo = TRUE;
