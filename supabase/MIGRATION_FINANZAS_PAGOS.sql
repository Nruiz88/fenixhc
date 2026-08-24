-- Migración: Agregar campos a finanzas y estado rechazada a cuotas
-- Ejecutar en Supabase SQL Editor

-- 1. Agregar metodo_pago y descripcion a la tabla finanzas
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS metodo_pago TEXT DEFAULT 'efectivo';
ALTER TABLE finanzas ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- 2. Verificar que el tipo_finanza y estado_cuota tengan los valores necesarios
-- (Ya deberían existir, pero por si acaso)

-- 3. Agregar política RLS para finanzas (solo admin puede escribir)
-- Primero eliminar políticas existentes si las hay
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'finanzas') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON finanzas';
  END LOOP;
END
$$;

-- Admin puede hacer todo con finanzas
CREATE POLICY "finanzas_admin_all" ON finanzas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
    )
  );

-- Service role puede hacer todo
CREATE POLICY "finanzas_service_all" ON finanzas
  FOR ALL USING (auth.role() = 'service_role');

-- Verificar RLS está habilitado
ALTER TABLE finanzas ENABLE ROW LEVEL SECURITY;

-- 4. Agregar política RLS para cuotas (solo admin puede actualizar)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'cuotas') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON cuotas';
  END LOOP;
END
$$;

-- Admin puede todo con cuotas
CREATE POLICY "cuotas_admin_all" ON cuotas
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM perfiles
      WHERE perfiles.id = auth.uid() AND perfiles.rol = 'admin'
    )
  );

-- Padres pueden ver sus cuotas
CREATE POLICY "cuotas_padre_select" ON cuotas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM familias f
      WHERE f.id = cuotas.familia_id
      AND f.padre_perfil_id = auth.uid()
    )
  );

-- Service role puede todo
CREATE POLICY "cuotas_service_all" ON cuotas
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
