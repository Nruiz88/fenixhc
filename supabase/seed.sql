-- ============================================================
-- SEED DATA - Datos de prueba para testing local
-- ============================================================
-- IMPORTANTE: Primero creá los usuarios en Supabase Auth manualmente
-- o usa el script de abajo que los crea directamente.
--
-- Usuarios de prueba (contraseña: 123456):
--   admin@club.com      → rol: admin
--   marcelo@mail.com    → rol: padre (Marcelo Cabrera)
--   juan@mail.com       → rol: padre (Juan Perez)
--   lautaro@mail.com    → rol: deportista (Lautaro Cabrera)
--   tomas@mail.com      → rol: deportista (Tomas Perez)
-- ============================================================

-- USUARIOS AUTH (run this in Supabase SQL Editor or via API)
-- Los UUIDs deben coincidir con los auth.users reales.
-- Primero creá los usuarios desde el registro de la app, luego
-- insertá los perfiles con los IDs reales.

-- ============================================================
-- PERFILES (reemplazá los UUIDs con los reales de auth.users)
-- ============================================================
-- Si ya注册aste los usuarios, los IDs se generan automáticamente.
-- Esta seed usa UUIDs de ejemplo:

-- admin
INSERT INTO perfiles (id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', 'Club', 'Admin', '00000000', NULL, 'admin@club.com', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- padres
INSERT INTO perfiles (id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES
('00000000-0000-0000-0000-000000000002', 'padre', 'Marcelo', 'Cabrera', '25123456', '20-25123456-9', 'marcelo@mail.com', '+5491155551234', 'Av. Libertador 1234, Buenos Aires'),
('00000000-0000-0000-0000-000000000003', 'padre', 'Juan', 'Perez', '28765432', '20-28765432-5', 'juan@mail.com', '+5491155555678', 'Calle Falsa 567, Córdoba')
ON CONFLICT (id) DO NOTHING;

-- deportistas
INSERT INTO perfiles (id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES
('00000000-0000-0000-0000-000000000004', 'deportista', 'Lautaro', 'Cabrera', '44123456', NULL, 'lautaro@mail.com', NULL, 'Av. Libertador 1234, Buenos Aires'),
('00000000-0000-0000-0000-000000000005', 'deportista', 'Tomas', 'Perez', '45678901', NULL, 'tomas@mail.com', NULL, 'Calle Falsa 567, Córdoba')
ON CONFLICT (id) DO NOTHING;

-- DEPORTISTAS (info extra)
INSERT INTO deportistas (perfil_id, club_activo, fecha_inscripcion, observaciones) VALUES
('00000000-0000-0000-0000-000000000004', TRUE, '2024-03-01', 'Jugador destacado - Posición: Mediocampista'),
('00000000-0000-0000-0000-000000000005', TRUE, '2024-03-15', 'Nuevo en el club - Posición: Delantero')
ON CONFLICT (perfil_id) DO NOTHING;

-- FAMILIAS (vinculación padre ↔ hijo)
INSERT INTO familias (padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'padre'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'padre')
ON CONFLICT (padre_perfil_id, deportista_perfil_id) DO NOTHING;

-- CUOTAS (ejemplo)
INSERT INTO cuotas (familia_id, tipo_socio, monto, mes, anio, estado) VALUES
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 1, 2025, 'pagada'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 2, 2025, 'pagada'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 3, 2025, 'pendiente'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 4, 2025, 'pendiente'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000003'), 'benefactor', 75000, 1, 2025, 'pagada'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000003'), 'benefactor', 75000, 2, 2025, 'vencida'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000003'), 'benefactor', 75000, 3, 2025, 'pendiente');

-- FINANZAS extra
INSERT INTO finanzas (tipo, concepto, monto, fecha, categoria) VALUES
('ingreso', 'Donación - Empresa Local', 50000, '2025-01-15', 'donacion'),
('ingreso', 'Alquiler cancha extra', 15000, '2025-02-10', 'alquiler'),
('egreso', 'Compra de palos de hockey', 35000, '2025-01-20', 'equipamiento'),
('egreso', 'Mantenimiento cancha', 20000, '2025-02-05', 'mantenimiento'),
('egreso', 'Transporte a torneo', 45000, '2025-03-01', 'viaje');

-- NOTIFICACIONES
INSERT INTO notificaciones (titulo, mensaje, tipo, destinatario_rol, created_by) VALUES
('Pertura de inscripciones 2025', 'Se abren las inscripciones para la temporada 2025. Consultar en el club.', 'general', 'todos', '00000000-0000-0000-0000-000000000001'),
('Partido amistoso este sábado', 'Este sábado a las 10hs jugamos partido amistoso contra Club Norte. ¡Vamos todos!', 'deportivo', 'deportista', '00000000-0000-0000-0000-000000000001'),
('Recordatorio de cuota marzo', 'Recuerden abonar la cuota del mes de marzo antes del día 15.', 'pago', 'padre', '00000000-0000-0000-0000-000000000001');

-- CANCHAS (ya se crea una en el schema, pero agregamos otra)
INSERT INTO canchas (nombre, descripcion, capacidad) VALUES
('Cancha Auxiliar', 'Cancha de entrenamiento', 20);

-- RESERVAS de ejemplo
INSERT INTO reservas (cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado) VALUES
((SELECT id FROM canchas LIMIT 1), '00000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '2 days', '18:00', '19:30', 'confirmada'),
((SELECT id FROM canchas LIMIT 1), '00000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '3 days', '18:00', '19:30', 'confirmada');
