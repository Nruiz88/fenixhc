-- ============================================================
-- FENIX ROLLER HOCKEY - Migración 17
-- Becas sobre la cuota del jugador.
--
-- La beca es del JUGADOR, no del socio: un padre puede tener dos hijos y solo
-- uno estar becado. El descuento se guarda también en la cuota al emitirla
-- (`beca_porcentaje`) para que el importe histórico no cambie si después se
-- modifica la beca.
--
-- `monto_lista` guarda el valor de la cuota antes de la beca. `monto` sigue
-- siendo lo que efectivamente se cobra, así todo el sistema (caja,
-- contabilidad, MercadoPago y recibos) sigue leyendo el importe correcto sin
-- cambios.
--
-- No se aplica CHECK: la validación de 0/25/50/100 vive en la app y en la
-- API. MariaDB no soporta `ADD CONSTRAINT IF NOT EXISTS`, y esta migración
-- tiene que poder correrse dos veces sin romper.
-- ============================================================

USE club_fenix;

ALTER TABLE deportistas
  ADD COLUMN IF NOT EXISTS beca_porcentaje TINYINT UNSIGNED NOT NULL DEFAULT 0;

ALTER TABLE cuotas
  ADD COLUMN IF NOT EXISTS monto_lista DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS beca_porcentaje TINYINT UNSIGNED NOT NULL DEFAULT 0;

-- Las cuotas viejas no tenían precio de lista. Para ellas el monto guardado
-- era el valor completo, así que se copia tal cual. Sin este backfill, al
-- asignar una beca se tomaría como lista un importe ya descontado.
UPDATE cuotas SET monto_lista = monto WHERE monto_lista IS NULL;

SELECT 'deportistas.beca_porcentaje' AS columna,
       COUNT(*) AS existe
  FROM information_schema.columns
 WHERE table_schema = 'club_fenix'
   AND table_name = 'deportistas'
   AND column_name = 'beca_porcentaje'

UNION ALL

SELECT 'cuotas.monto_lista', COUNT(*)
  FROM information_schema.columns
 WHERE table_schema = 'club_fenix'
   AND table_name = 'cuotas'
   AND column_name = 'monto_lista'

UNION ALL

SELECT 'cuotas.beca_porcentaje', COUNT(*)
  FROM information_schema.columns
 WHERE table_schema = 'club_fenix'
   AND table_name = 'cuotas'
   AND column_name = 'beca_porcentaje';
