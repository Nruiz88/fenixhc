-- =============================================
-- CUOTA UNIFICADA AUTOMÁTICA
-- =============================================

-- Función que genera cuotas unificadas para un vínculo padre-deportista
-- Se ejecuta cuando se crea un vínculo en familias
CREATE OR REPLACE FUNCTION generar_cuotas_unificadas()
RETURNS TRIGGER AS $$
DECLARE
  v_anio INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_mes_actual INTEGER := EXTRACT(MONTH FROM NOW())::INTEGER;
  v_mes INTEGER;
BEGIN
  -- Generar cuotas para los meses del año actual
  FOR v_mes IN 1..12 LOOP
    INSERT INTO cuotas (
      familia_id,
      tipo_socio,
      monto,
      mes,
      anio,
      estado,
      descripcion
    ) VALUES (
      NEW.id,
      'benefactor'::tipo_socio,
      75000,
      v_mes,
      v_anio,
      CASE
        WHEN v_mes < v_mes_actual THEN 'pagada'::estado_cuota
        WHEN v_mes = v_mes_actual THEN 'pendiente'::estado_cuota
        ELSE 'pendiente'::estado_cuota
      END,
      'Cuota unificada Benefactor + Cadete'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: al crear un vínculo familiar, generar cuotas
DROP TRIGGER IF EXISTS trigger_generar_cuotas ON familias;
CREATE TRIGGER trigger_generar_cuotas
  AFTER INSERT ON familias
  FOR EACH ROW EXECUTE FUNCTION generar_cuotas_unificadas();

-- =============================================
-- FUNCIÓN PARA RECALCULAR CUOTAS
-- (útil cuando el admin cambia el monto)
-- =============================================
CREATE OR REPLACE FUNCTION recalcular_cuota_mensual(
  p_familia_id UUID,
  p_nuevo_monto NUMERIC
)
RETURNS JSON AS $$
BEGIN
  -- Actualizar cuotas pendientes del año actual
  UPDATE cuotas
  SET monto = p_nuevo_monto
  WHERE familia_id = p_familia_id
    AND anio = EXTRACT(YEAR FROM NOW())::INTEGER
    AND estado = 'pendiente'::estado_cuota;

  RETURN json_build_object(
    'ok', true,
    'mensaje', 'Cuotas pendientes actualizadas a $' || p_nuevo_monto,
    'cuotas_afectadas', (SELECT COUNT(*) FROM cuotas WHERE familia_id = p_familia_id AND estado = 'pendiente'::estado_cuota)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
