-- ============================================================
-- CLUB DEPORTIVO HOCKEY - Setup Completo para Supabase
-- Pegar todo en SQL Editor y dar Run
-- ============================================================

-- Tipos personalizados (safe create)
DO $$ BEGIN CREATE TYPE rol_usuario AS ENUM ('admin', 'padre', 'deportista'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE tipo_vinculo AS ENUM ('padre', 'madre', 'tutor'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE tipo_socio AS ENUM ('cadete', 'activo', 'benefactor'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE estado_cuota AS ENUM ('pendiente', 'pagada', 'vencida'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE metodo_pago AS ENUM ('transferencia'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE tipo_finanza AS ENUM ('ingreso', 'egreso'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE tipo_notificacion AS ENUM ('pago', 'deportivo', 'general', 'urgente'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE destinatario_notificacion AS ENUM ('padre', 'deportista', 'todos'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE tipo_contenido_chat AS ENUM ('texto', 'imagen', 'video'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE estado_reserva AS ENUM ('confirmada', 'cancelada', 'completada'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tablas
CREATE TABLE IF NOT EXISTS perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rol rol_usuario NOT NULL,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  dni TEXT NOT NULL UNIQUE,
  cuil TEXT,
  correo TEXT NOT NULL,
  telefono TEXT,
  direccion TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deportistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE UNIQUE,
  dni_frente_url TEXT,
  dni_fondo_url TEXT,
  club_activo BOOLEAN DEFAULT TRUE,
  fecha_inscripcion DATE DEFAULT CURRENT_DATE,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS familias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  padre_perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  deportista_perfil_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  tipo_vinculo tipo_vinculo NOT NULL DEFAULT 'padre',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(padre_perfil_id, deportista_perfil_id)
);

CREATE TABLE IF NOT EXISTS cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  familia_id UUID REFERENCES familias(id) ON DELETE CASCADE,
  tipo_socio tipo_socio NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio INTEGER NOT NULL,
  estado estado_cuota DEFAULT 'pendiente',
  metodo_pago metodo_pago,
  comprobante_url TEXT,
  fecha_pago TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finanzas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_finanza NOT NULL,
  concepto TEXT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  categoria TEXT,
  comprobante_url TEXT,
  created_by UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo tipo_notificacion DEFAULT 'general',
  destinatario_rol destinatario_notificacion DEFAULT 'todos',
  enviada_email BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notificaciones_usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notificacion_id UUID REFERENCES notificaciones(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  leida BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(notificacion_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS mensajes_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emisor_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  tipo_contenido tipo_contenido_chat DEFAULT 'texto',
  archivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fotos_galeria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subido_por UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  descripcion TEXT,
  es_video BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canchas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  capacidad INTEGER DEFAULT 1,
  activa BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancha_id UUID REFERENCES canchas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  estado estado_reserva DEFAULT 'confirmada',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cancha_id, fecha, hora_inicio)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacto_publico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  correo TEXT NOT NULL,
  telefono TEXT,
  mensaje TEXT NOT NULL,
  leido BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_perfiles_rol ON perfiles(rol);
CREATE INDEX IF NOT EXISTS idx_perfiles_dni ON perfiles(dni);
CREATE INDEX IF NOT EXISTS idx_familias_padre ON familias(padre_perfil_id);
CREATE INDEX IF NOT EXISTS idx_familias_deportista ON familias(deportista_perfil_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_familia ON cuotas(familia_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_estado ON cuotas(estado);
CREATE INDEX IF NOT EXISTS idx_cuotas_mes_anio ON cuotas(mes, anio);
CREATE INDEX IF NOT EXISTS idx_finanzas_tipo ON finanzas(tipo);
CREATE INDEX IF NOT EXISTS idx_finanzas_fecha ON finanzas(fecha);
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_created ON mensajes_chat(created_at);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha ON reservas(fecha);
CREATE INDEX IF NOT EXISTS idx_reservas_cancha ON reservas(cancha_id);

-- RLS
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE deportistas ENABLE ROW LEVEL SECURITY;
ALTER TABLE familias ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_galeria ENABLE ROW LEVEL SECURITY;
ALTER TABLE canchas ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacto_publico ENABLE ROW LEVEL SECURITY;

-- Policies (drop if exist then create)
DO $$ BEGIN DROP POLICY IF EXISTS "admin_select_perfiles" ON perfiles; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "user_select_own_perfil" ON perfiles; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "user_update_own_perfil" ON perfiles; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_familias" ON familias; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "padre_select_familias" ON familias; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_cuotas" ON cuotas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "padre_select_cuotas" ON cuotas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_finanzas" ON finanzas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_insert_notif" ON notificaciones; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_notif" ON notificaciones; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_insert_chat" ON mensajes_chat; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_chat" ON mensajes_chat; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_insert_fotos" ON fotos_galeria; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_fotos" ON fotos_galeria; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_delete_fotos" ON fotos_galeria; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_reservas" ON reservas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "user_select_reservas" ON reservas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "user_insert_reservas" ON reservas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "user_update_reservas" ON reservas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_canchas" ON canchas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_canchas" ON canchas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "anon_insert_contacto" ON contacto_publico; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_select_contacto" ON contacto_publico; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "user_manage_push" ON push_subscriptions; END $$;

-- Policies create
CREATE POLICY "admin_select_perfiles" ON perfiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "user_select_own_perfil" ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "user_update_own_perfil" ON perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "admin_all_familias" ON familias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "padre_select_familias" ON familias FOR SELECT TO authenticated
  USING (padre_perfil_id = auth.uid());

CREATE POLICY "admin_all_cuotas" ON cuotas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "padre_select_cuotas" ON cuotas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM familias f WHERE f.id = cuotas.familia_id AND f.padre_perfil_id = auth.uid()));

CREATE POLICY "admin_all_finanzas" ON finanzas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_insert_notif" ON notificaciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "auth_select_notif" ON notificaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_chat" ON mensajes_chat FOR INSERT TO authenticated
  WITH CHECK (emisor_id = auth.uid());
CREATE POLICY "auth_select_chat" ON mensajes_chat FOR SELECT TO authenticated USING (true);

CREATE POLICY "auth_insert_fotos" ON fotos_galeria FOR INSERT TO authenticated
  WITH CHECK (subido_por = auth.uid());
CREATE POLICY "auth_select_fotos" ON fotos_galeria FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_delete_fotos" ON fotos_galeria FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "admin_all_reservas" ON reservas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "user_select_reservas" ON reservas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());
CREATE POLICY "user_insert_reservas" ON reservas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "user_update_reservas" ON reservas FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid());

CREATE POLICY "auth_select_canchas" ON canchas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_canchas" ON canchas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "anon_insert_contacto" ON contacto_publico FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_select_contacto" ON contacto_publico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

CREATE POLICY "user_manage_push" ON push_subscriptions FOR ALL TO authenticated
  USING (usuario_id = auth.uid());

-- Trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS perfiles_updated_at ON perfiles;
CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Canchas iniciales
INSERT INTO canchas (nombre, descripcion, capacidad) VALUES
  ('Cancha Principal', 'Cancha de hockey sobre hierba', 30),
  ('Cancha Auxiliar', 'Cancha de entrenamiento', 20)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED DATA
-- Nota: Los UUIDs de ejemplo solo funcionan si creaste los
-- usuarios en Auth con esos mismos IDs. Si registrás desde
-- la app, los IDs serán distintos.
-- ============================================================

-- PERFILES
INSERT INTO perfiles (id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES
('00000000-0000-0000-0000-000000000001', 'admin', 'Club', 'Admin', '00000000', NULL, 'admin@club.com', NULL, NULL),
('00000000-0000-0000-0000-000000000002', 'padre', 'Marcelo', 'Cabrera', '25123456', '20-25123456-9', 'marcelo@mail.com', '+5491155551234', 'Av. Libertador 1234, Buenos Aires'),
('00000000-0000-0000-0000-000000000003', 'padre', 'Juan', 'Perez', '28765432', '20-28765432-5', 'juan@mail.com', '+5491155555678', 'Calle Falsa 567, Cordoba'),
('00000000-0000-0000-0000-000000000004', 'deportista', 'Lautaro', 'Cabrera', '44123456', NULL, 'lautaro@mail.com', NULL, 'Av. Libertador 1234, Buenos Aires'),
('00000000-0000-0000-0000-000000000005', 'deportista', 'Tomas', 'Perez', '45678901', NULL, 'tomas@mail.com', NULL, 'Calle Falsa 567, Cordoba')
ON CONFLICT (id) DO NOTHING;

-- DEPORTISTAS
INSERT INTO deportistas (perfil_id, club_activo, fecha_inscripcion, observaciones) VALUES
('00000000-0000-0000-0000-000000000004', TRUE, '2024-03-01', 'Jugador destacado - Posicion: Mediocampista'),
('00000000-0000-0000-0000-000000000005', TRUE, '2024-03-15', 'Nuevo en el club - Posicion: Delantero')
ON CONFLICT (perfil_id) DO NOTHING;

-- FAMILIAS
INSERT INTO familias (padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES
('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004', 'padre'),
('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'padre')
ON CONFLICT (padre_perfil_id, deportista_perfil_id) DO NOTHING;

-- CUOTAS
INSERT INTO cuotas (familia_id, tipo_socio, monto, mes, anio, estado) VALUES
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 1, 2025, 'pagada'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 2, 2025, 'pagada'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 3, 2025, 'pendiente'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000002'), 'benefactor', 75000, 4, 2025, 'pendiente'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000003'), 'benefactor', 75000, 1, 2025, 'pagada'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000003'), 'benefactor', 75000, 2, 2025, 'vencida'),
((SELECT id FROM familias WHERE padre_perfil_id = '00000000-0000-0000-0000-000000000003'), 'benefactor', 75000, 3, 2025, 'pendiente');

-- FINANZAS
INSERT INTO finanzas (tipo, concepto, monto, fecha, categoria) VALUES
('ingreso', 'Donacion - Empresa Local', 50000, '2025-01-15', 'donacion'),
('ingreso', 'Alquiler cancha extra', 15000, '2025-02-10', 'alquiler'),
('egreso', 'Compra de palos de hockey', 35000, '2025-01-20', 'equipamiento'),
('egreso', 'Mantenimiento cancha', 20000, '2025-02-05', 'mantenimiento'),
('egreso', 'Transporte a torneo', 45000, '2025-03-01', 'viaje');

-- NOTIFICACIONES
INSERT INTO notificaciones (titulo, mensaje, tipo, destinatario_rol, created_by) VALUES
('Apertura de inscripciones 2025', 'Se abren las inscripciones para la temporada 2025. Consultar en el club.', 'general', 'todos', '00000000-0000-0000-0000-000000000001'),
('Partido amistoso este sabado', 'Este sabado a las 10hs jugamos partido amistoso contra Club Norte.', 'deportivo', 'deportista', '00000000-0000-0000-0000-000000000001'),
('Recordatorio de cuota marzo', 'Recuerden abonar la cuota del mes de marzo antes del dia 15.', 'pago', 'padre', '00000000-0000-0000-0000-000000000001');

-- RESERVAS
INSERT INTO reservas (cancha_id, usuario_id, fecha, hora_inicio, hora_fin, estado) VALUES
((SELECT id FROM canchas LIMIT 1), '00000000-0000-0000-0000-000000000004', CURRENT_DATE + INTERVAL '2 days', '18:00', '19:30', 'confirmada'),
((SELECT id FROM canchas LIMIT 1), '00000000-0000-0000-0000-000000000005', CURRENT_DATE + INTERVAL '3 days', '18:00', '19:30', 'confirmada');

-- ============================================================
-- LISTO! Ahora creá los usuarios en Auth con los mismos emails
-- y metadatos de rol para que todo funcione.
-- ============================================================
