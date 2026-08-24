-- ============================================
-- TABLA DE PARTIDOS / CALENDARIO DE COMPETENCIA
-- Pegar en SQL Editor y darle Run
-- ============================================

-- Tipos
DO $$ BEGIN CREATE TYPE estado_partido AS ENUM ('programado', 'en_juego', 'finalizado', 'suspendido', 'cancelado'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE resultado_partido AS ENUM ('ganado', 'empatado', 'perdido'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tabla
CREATE TABLE IF NOT EXISTS partidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  hora TIME,
  rival TEXT NOT NULL,
  escudo_url TEXT,
  cancha TEXT DEFAULT 'Cancha Principal',
  es_local BOOLEAN DEFAULT TRUE,
  competencia TEXT DEFAULT 'Liga Local',
  jornada TEXT,
  estado estado_partido DEFAULT 'programado',
  goles_nuestros INTEGER,
  goles_rival INTEGER,
  resultado resultado_partido,
  notas TEXT,
  created_by UUID REFERENCES perfiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_partidos_fecha ON partidos(fecha);
CREATE INDEX IF NOT EXISTS idx_partidos_estado ON partidos(estado);

-- RLS
ALTER TABLE partidos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "public_select_partidos" ON partidos; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_partidos" ON partidos; END $$;

CREATE POLICY "public_select_partidos" ON partidos FOR SELECT USING (true);
CREATE POLICY "admin_all_partidos" ON partidos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Trigger updated_at
DROP TRIGGER IF EXISTS partidos_updated_at ON partidos;
CREATE TRIGGER partidos_updated_at
  BEFORE UPDATE ON partidos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Datos de ejemplo
INSERT INTO partidos (fecha, hora, rival, cancha, es_local, competencia, jornada, estado, goles_nuestros, goles_rival, resultado)
VALUES
  ('2026-08-30', '15:00', 'San Isidro', 'Cancha Principal', true, 'Liga Local', 'Fecha 1', 'programado', NULL, NULL, NULL),
  ('2026-09-06', '14:00', 'Belgrano Athletic', 'Cancha Auxiliar', true, 'Liga Local', 'Fecha 2', 'programado', NULL, NULL, NULL),
  ('2026-09-13', '16:00', 'Old Boys', 'Cancha del rival', false, 'Liga Local', 'Fecha 3', 'programado', NULL, NULL, NULL),
  ('2026-09-20', '15:00', 'San Fernando', 'Cancha Principal', true, 'Liga Local', 'Fecha 4', 'programado', NULL, NULL, NULL),
  ('2026-09-27', '14:00', 'Hurlingham', 'Cancha del rival', false, 'Copa Zonal', 'Octavos', 'programado', NULL, NULL, NULL),
  ('2026-08-23', '15:00', 'CURDA', 'Cancha Principal', true, 'Liga Local', 'Fecha 0', 'finalizado', 3, 1, 'ganado')
ON CONFLICT DO NOTHING;
