-- =============================================
-- SPONSORS
-- =============================================

DO $$ BEGIN
  CREATE TYPE sponsor_tier AS ENUM ('gold', 'silver', 'bronze');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  logo_url TEXT,
  sitio_web TEXT,
  tier sponsor_tier DEFAULT 'bronze',
  descripcion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS público para lectura
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sponsors_public_select" ON sponsors
  FOR SELECT USING (activo = true);

CREATE POLICY "sponsors_admin_all" ON sponsors
  FOR ALL USING (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_sponsors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sponsors_updated_at ON sponsors;
CREATE TRIGGER sponsors_updated_at
  BEFORE UPDATE ON sponsors
  FOR EACH ROW EXECUTE FUNCTION update_sponsors_updated_at();

-- Sponsors iniciales
INSERT INTO sponsors (nombre, tier, activo, orden) VALUES
  ('Deportes AR', 'gold', true, 1),
  ('Hockey Pro', 'gold', true, 2),
  ('Sports Tech', 'silver', true, 3),
  ('Fitness Plus', 'silver', true, 4),
  ('Arena Store', 'bronze', true, 5),
  ('Coach Lab', 'bronze', true, 6);
