-- =============================================
-- HORARIOS DE ENTRENAMIENTO
-- =============================================

CREATE TABLE IF NOT EXISTS horarios_entrenamiento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia TEXT NOT NULL, -- Lunes, Martes, etc.
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  tipo TEXT NOT NULL, -- Técnico, Físico, Táctico, Partido, Libre
  descripcion TEXT,
  nivel TEXT DEFAULT 'Todos', -- Todos, Avanzados, Juveniles
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS público para lectura, admin para todo
ALTER TABLE horarios_entrenamiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "horarios_public_select" ON horarios_entrenamiento
  FOR SELECT USING (activo = true);

CREATE POLICY "horarios_admin_all" ON horarios_entrenamiento
  FOR ALL USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_horarios_dia ON horarios_entrenamiento(orden);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_horarios_entrenamiento_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS horarios_entrenamiento_updated_at ON horarios_entrenamiento;
CREATE TRIGGER horarios_entrenamiento_updated_at
  BEFORE UPDATE ON horarios_entrenamiento
  FOR EACH ROW EXECUTE FUNCTION update_horarios_entrenamiento_updated_at();

-- =============================================
-- DATOS INICIALES
-- =============================================
INSERT INTO horarios_entrenamiento (dia, hora_inicio, hora_fin, tipo, descripcion, nivel, orden) VALUES
  ('Lunes', '16:00', '18:00', 'Técnico', 'Dribling, pases y recepción', 'Todos', 1),
  ('Martes', '16:00', '18:00', 'Físico', 'Resistencia, velocidad y fuerza', 'Todos', 2),
  ('Miércoles', '16:00', '18:00', 'Táctico', 'Estrategia y juego colectivo', 'Todos', 3),
  ('Jueves', '16:00', '18:00', 'Partido', 'Práctica competitiva interna', 'Todos', 4),
  ('Viernes', '15:00', '17:00', 'Técnico', 'Tiros libres y penales', 'Avanzados', 5),
  ('Sábado', '10:00', '12:00', 'Libre', 'Juego libre y diversión', 'Todos', 6);
