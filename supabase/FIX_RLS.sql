-- ============================================
-- FIX: Agregar políticas RLS faltantes
-- Pegar en SQL Editor y darle Run
-- ============================================

-- PERFILES: falta INSERT y SELECT para todos los authenticated
DO $$ BEGIN DROP POLICY IF EXISTS "auth_insert_own_perfil" ON perfiles; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_all_perfiles" ON perfiles; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_perfiles" ON perfiles; END $$;

CREATE POLICY "auth_insert_own_perfil" ON perfiles FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "auth_select_all_perfiles" ON perfiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_perfiles" ON perfiles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- DEPORTISTAS: falta SELECT
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_deportistas" ON deportistas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "admin_all_deportistas" ON deportistas; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "padre_select_deportistas" ON deportistas; END $$;

CREATE POLICY "auth_select_deportistas" ON deportistas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "admin_all_deportistas" ON deportistas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- NOTIFICACIONES_USUARIOS: falta INSERT/SELECT/UPDATE
DO $$ BEGIN DROP POLICY IF EXISTS "auth_manage_notif_usuarios" ON notificaciones_usuarios; END $$;

CREATE POLICY "auth_manage_notif_usuarios" ON notificaciones_usuarios FOR ALL TO authenticated
  USING (usuario_id = auth.uid());

-- CUOTAS: falta SELECT para admin (ya lo tiene)
-- RESERVAS: falta SELECT para todos
DO $$ BEGIN DROP POLICY IF EXISTS "auth_select_all_reservas" ON reservas; END $$;

CREATE POLICY "auth_select_all_reservas" ON reservas FOR SELECT TO authenticated
  USING (true);

-- FINANZAS: falta SELECT para admin
DO $$ BEGIN DROP POLICY IF EXISTS "admin_select_finanzas" ON finanzas; END $$;

CREATE POLICY "admin_select_finanzas" ON finanzas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
