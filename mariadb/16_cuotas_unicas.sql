-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 16
-- Una sola cuota por familia y período.
--
-- El panel ya validaba duplicados en el navegador, pero la base no tenía la
-- restricción. Con dos personas emitiendo cuotas al mismo tiempo, o con una
-- llamada directa a la API, se podían crear dos filas para la misma familia,
-- mes y año: dos cuotas para pagar lo mismo.
--
-- Este índice lo resuelve en el único lugar donde la restricción es real.
-- Si en una base vieja ya hubiera duplicados, la creación del índice falla a
-- propósito: primero hay que revisarlos y decidir cuál conservar. No se borra
-- nada automáticamente.
--
-- Es idempotente: CREATE INDEX IF NOT EXISTS no hace nada si ya existe.
-- ============================================================

USE club_fenix;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cuota_familia_periodo
  ON cuotas (familia_id, mes, anio);

SELECT 'indice' AS objeto, COUNT(*) AS existe
  FROM information_schema.statistics
 WHERE table_schema = 'club_fenix'
   AND table_name = 'cuotas'
   AND index_name = 'uq_cuota_familia_periodo';
