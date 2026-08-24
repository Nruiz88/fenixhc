
-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
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

-- Políticas RLS: perfiles
CREATE POLICY "admin_select_perfiles" ON perfiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "user_select_own_perfil" ON perfiles FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "user_update_own_perfil" ON perfiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Políticas RLS: familias
CREATE POLICY "admin_all_familias" ON familias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "padre_select_familias" ON familias FOR SELECT TO authenticated
  USING (padre_perfil_id = auth.uid());

-- Políticas RLS: cuotas
CREATE POLICY "admin_all_cuotas" ON cuotas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "padre_select_cuotas" ON cuotas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM familias f WHERE f.id = cuotas.familia_id AND f.padre_perfil_id = auth.uid()));

-- Políticas RLS: finanzas (solo admin)
CREATE POLICY "admin_all_finanzas" ON finanzas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas RLS: notificaciones
CREATE POLICY "admin_insert_notif" ON notificaciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "auth_select_notif" ON notificaciones FOR SELECT TO authenticated USING (true);

-- Políticas RLS: mensajes_chat
CREATE POLICY "auth_insert_chat" ON mensajes_chat FOR INSERT TO authenticated
  WITH CHECK (emisor_id = auth.uid());
CREATE POLICY "auth_select_chat" ON mensajes_chat FOR SELECT TO authenticated USING (true);

-- Políticas RLS: fotos_galeria
CREATE POLICY "auth_insert_fotos" ON fotos_galeria FOR INSERT TO authenticated
  WITH CHECK (subido_por = auth.uid());
CREATE POLICY "auth_select_fotos" ON fotos_galeria FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_delete_fotos" ON fotos_galeria FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas RLS: reservas
CREATE POLICY "admin_all_reservas" ON reservas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));
CREATE POLICY "user_select_reservas" ON reservas FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());
CREATE POLICY "user_insert_reservas" ON reservas FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "user_update_reservas" ON reservas FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid());

-- Políticas RLS: canchas
CREATE POLICY "auth_select_canchas" ON canchas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_canchas" ON canchas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas RLS: contacto_publico
CREATE POLICY "anon_insert_contacto" ON contacto_publico FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "admin_select_contacto" ON contacto_publico FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin'));

-- Políticas RLS: push_subscriptions
CREATE POLICY "user_manage_push" ON push_subscriptions FOR ALL TO authenticated
  USING (usuario_id = auth.uid());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER perfiles_updated_at
  BEFORE UPDATE ON perfiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Datos iniciales
INSERT INTO canchas (nombre, descripcion, capacidad)
VALUES ('Cancha Principal', 'Cancha de hockey sobre hierba', 30);
