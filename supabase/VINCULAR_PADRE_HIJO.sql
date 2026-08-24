-- =============================================
-- VINCULAR PADRE ↔ DEPORTISTA + CUOTA UNIFICADA
-- =============================================

-- Función para vincular un padre con un deportista y generar la cuota unificada
CREATE OR REPLACE FUNCTION vincular_padre_deportista(
  p_padre_perfil_id UUID,
  p_deportista_perfil_id UUID,
  p_tipo_vinculo TEXT DEFAULT 'padre'
)
RETURNS JSON AS $$
DECLARE
  v_familia_id UUID;
  v_deportista RECORD;
  v_padre RECORD;
  v_existe BOOLEAN;
  v_resultado JSON;
BEGIN
  -- Verificar que el padre existe y es rol padre
  SELECT * INTO v_padre FROM perfiles WHERE id = p_padre_perfil_id AND rol = 'padre';
  IF v_padre IS NULL THEN
    RETURN json_build_object('error', 'No se encontró un perfil de padre con ese ID');
  END IF;

  -- Verificar que el deportista existe y es rol deportista
  SELECT * INTO v_deportista FROM perfiles WHERE id = p_deportista_perfil_id AND rol = 'deportista';
  IF v_deportista IS NULL THEN
    RETURN json_build_object('error', 'No se encontró un perfil de deportista con ese ID');
  END IF;

  -- Verificar que no exista ya el vínculo
  SELECT EXISTS(
    SELECT 1 FROM familias
    WHERE padre_perfil_id = p_padre_perfil_id
    AND deportista_perfil_id = p_deportista_perfil_id
  ) INTO v_existe;

  IF v_existe THEN
    RETURN json_build_object('error', 'Ya existe un vínculo entre este padre y este deportista');
  END IF;

  -- Crear el vínculo familiar
  INSERT INTO familias (padre_perfil_id, deportista_perfil_id, tipo_vinculo)
  VALUES (p_padre_perfil_id, p_deportista_perfil_id, p_tipo_vinculo)
  RETURNING id INTO v_familia_id;

  -- Verificar si ya existen cuotas para esta familia
  IF NOT EXISTS(SELECT 1 FROM cuotas WHERE familia_id = v_familia_id) THEN
    -- Generar cuota unificada del año actual (75.000 por defecto)
    -- Se generan cuotas para los meses restantes del año
    INSERT INTO cuotas (familia_id, tipo_socio, monto, mes, anio, estado)
    SELECT
      v_familia_id,
      'benefactor'::tipo_socio,
      75000,
      m.mes_num,
      EXTRACT(YEAR FROM NOW())::INTEGER,
      CASE
        WHEN m.mes_num < EXTRACT(MONTH FROM NOW()) THEN 'pagada'::estado_cuota
        WHEN m.mes_num = EXTRACT(MONTH FROM NOW()) THEN 'pendiente'::estado_cuota
        ELSE 'pendiente'::estado_cuota
      END
    FROM (VALUES
      (1,'Enero'),(2,'Febrero'),(3,'Marzo'),(4,'Abril'),
      (5,'Mayo'),(6,'Junio'),(7,'Julio'),(8,'Agosto'),
      (9,'Septiembre'),(10,'Octubre'),(11,'Noviembre'),(12,'Diciembre')
    ) AS m(mes_num, mes_nombre)
    WHERE m.mes_num <= 12;
  END IF;

  -- Preparar resultado
  v_resultado := json_build_object(
    'ok', true,
    'familia_id', v_familia_id,
    'padre', v_padre.nombre || ' ' || v_padre.apellido,
    'deportista', v_deportista.nombre || ' ' || v_deportista.apellido,
    'tipo_vinculo', p_tipo_vinculo,
    'cuota_mensual', 75000,
    'mensaje', 'Vínculo creado y cuota unificada generada exitosamente'
  );

  RETURN v_resultado;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para desvincular padre ↔ deportista
CREATE OR REPLACE FUNCTION desvincular_padre_deportista(
  p_familia_id UUID
)
RETURNS JSON AS $$
BEGIN
  -- Eliminar cuotas pendientes de esta familia
  DELETE FROM cuotas WHERE familia_id = p_familia_id AND estado = 'pendiente'::estado_cuota;

  -- Eliminar el vínculo
  DELETE FROM familias WHERE id = p_familia_id;

  RETURN json_build_object('ok', true, 'mensaje', 'Vínculo eliminado y cuotas pendientes canceladas');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
