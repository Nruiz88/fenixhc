-- ============================================
-- SEED DATA - Usando IDs reales de auth.users
-- Pegar en SQL Editor y darle Run
-- ============================================

DO $$
DECLARE
  v_admin UUID;
  v_marcelo UUID;
  v_juan UUID;
  v_lautaro UUID;
  v_tomas UUID;
BEGIN
  SELECT id INTO v_admin FROM auth.users WHERE email = 'admin@club.com';
  SELECT id INTO v_marcelo FROM auth.users WHERE email = 'marcelo@mail.com';
  SELECT id INTO v_juan FROM auth.users WHERE email = 'juan@mail.com';
  SELECT id INTO v_lautaro FROM auth.users WHERE email = 'lautaro@mail.com';
  SELECT id INTO v_tomas FROM auth.users WHERE email = 'tomas@mail.com';

  -- ============================================
  -- PERFILES (columna: correo, no email)
  -- ============================================
  INSERT INTO perfiles (id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion)
  VALUES
    (v_admin, 'admin', 'Club', 'Admin', '00000000', '00-00000000-0', 'admin@club.com', '', ''),
    (v_marcelo, 'padre', 'Marcelo', 'Cabrera', '25123456', '20-25123456-3', 'marcelo@mail.com', '+541155512345', 'Av. Libertador 1234, CABA'),
    (v_juan, 'padre', 'Juan', 'Perez', '28765432', '20-28765432-5', 'juan@mail.com', '+541155598765', 'Calle Falsa 567, CABA'),
    (v_lautaro, 'deportista', 'Lautaro', 'Cabrera', '44123456', '20-44123456-7', 'lautaro@mail.com', '+541155534567', 'Av. Libertador 1234, CABA'),
    (v_tomas, 'deportista', 'Tomas', 'Perez', '45678901', '20-45678901-9', 'tomas@mail.com', '+541155523456', 'Calle Falsa 567, CABA')
  ON CONFLICT (id) DO NOTHING;

  -- ============================================
  -- DEPORTISTAS (columnas: dni_frente_url, dni_fondo_url, observaciones)
  -- ============================================
  INSERT INTO deportistas (perfil_id, dni_frente_url, dni_fondo_url, observaciones)
  VALUES
    (v_lautaro, NULL, NULL, 'Jugador hockey - categoría Cadete'),
    (v_tomas, NULL, NULL, 'Jugador hockey - categoría Cadete')
  ON CONFLICT (perfil_id) DO NOTHING;

  -- ============================================
  -- FAMILIAS (columnas: padre_perfil_id, deportista_perfil_id)
  -- ============================================
  INSERT INTO familias (padre_perfil_id, deportista_perfil_id, tipo_vinculo)
  VALUES
    (v_marcelo, v_lautaro, 'padre'),
    (v_juan, v_tomas, 'padre')
  ON CONFLICT (padre_perfil_id, deportista_perfil_id) DO NOTHING;

  -- ============================================
  -- CUOTAS (mes es INTEGER, tipo_socio en vez de tipo)
  -- ============================================
  -- Cuotas de Marcelo (todas pagadas)
  INSERT INTO cuotas (familia_id, tipo_socio, monto, mes, anio, estado, fecha_pago)
  SELECT f.id, 'benefactor'::tipo_socio, 75000, m.mes_num, 2026, 'pagada'::estado_cuota, NOW()
  FROM familias f, (VALUES (1,'Enero'),(2,'Febrero'),(3,'Marzo'),(4,'Abril'),(5,'Mayo'),(6,'Junio'),(7,'Julio')) AS m(mes_num, mes_nombre)
  WHERE f.padre_perfil_id = v_marcelo;

  -- Cuotas de Juan (3 pagadas, 4 pendientes)
  INSERT INTO cuotas (familia_id, tipo_socio, monto, mes, anio, estado, comprobante_url, fecha_pago)
  SELECT f.id, 'benefactor'::tipo_socio, 75000, m.mes_num, 2026,
    CASE WHEN m.mes_num <= 3 THEN 'pagada'::estado_cuota ELSE 'pendiente'::estado_cuota END,
    CASE WHEN m.mes_num <= 3 THEN 'comprobante_ejemplo.pdf' ELSE NULL END,
    CASE WHEN m.mes_num <= 3 THEN NOW() ELSE NULL END
  FROM familias f, (VALUES (1,'Enero'),(2,'Febrero'),(3,'Marzo'),(4,'Abril'),(5,'Mayo'),(6,'Junio'),(7,'Julio')) AS m(mes_num, mes_nombre)
  WHERE f.padre_perfil_id = v_juan;

  -- ============================================
  -- FINANZAS (columna: tipo primero, no notas)
  -- ============================================
  INSERT INTO finanzas (tipo, concepto, monto, fecha, created_by)
  VALUES
    ('ingreso', 'Donación Sr. Rodriguez', 50000, '2026-01-15', v_admin),
    ('ingreso', 'Venta de remeras', 12000, '2026-02-20', v_admin),
    ('egreso', 'Compra de palos', 85000, '2026-01-10', v_admin),
    ('egreso', 'Mantenimiento cancha', 35000, '2026-03-01', v_admin),
    ('ingreso', 'Donación Peña del Club', 100000, '2026-03-15', v_admin);

  -- ============================================
  -- NOTIFICACIONES (columna: destinatario_rol, no para_rol)
  -- ============================================
  INSERT INTO notificaciones (titulo, mensaje, tipo, destinatario_rol, created_by)
  VALUES
    ('Próximo partido', 'El sábado 30 de agosto jugamos contra San Isidro a las 15hs en la cancha principal', 'deportivo'::tipo_notificacion, 'deportista'::destinatario_notificacion, v_admin),
    ('Vencimiento cuota julio', 'La cuota del mes de julio vence el 10 de agosto. Recordá subir el comprobante de pago.', 'general'::tipo_notificacion, 'padre'::destinatario_notificacion, v_admin),
    ('Asamblea general', 'El 15 de septiembre a las 19hs se realiza la asamblea anual del club', 'general'::tipo_notificacion, 'todos'::destinatario_notificacion, v_admin);

  -- ============================================
  -- CANCHAS
  -- ============================================
  INSERT INTO canchas (nombre, capacidad, descripcion)
  VALUES
    ('Cancha Principal', 22, 'Cancha de hockey sobre césped sintético - 91x55m'),
    ('Cancha Auxiliar', 22, 'Cancha de entrenamiento - 60x40m');

  -- ============================================
  -- RESERVAS (necesita usuario_id)
  -- ============================================
  INSERT INTO reservas (cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, notas)
  SELECT c.id, v_admin, '2026-08-30', '14:00', '16:00', 'confirmada'::estado_reserva, 'Partido vs San Isidro'
  FROM canchas c WHERE c.nombre = 'Cancha Principal';

  INSERT INTO reservas (cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado, notas)
  SELECT c.id, v_marcelo, '2026-09-02', '10:00', '12:00', 'confirmada'::estado_reserva, 'Entrenamiento habitual'
  FROM canchas c WHERE c.nombre = 'Cancha Auxiliar';

END $$;
