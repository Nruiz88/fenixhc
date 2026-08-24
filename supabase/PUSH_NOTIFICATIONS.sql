-- =============================================
-- NOTIFICACIONES PUSH
-- =============================================

-- Tabla de suscripciones push (ya existe push_subscriptions en el schema)
-- Verificamos que tenga las columnas necesarias
DO $$ BEGIN
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES perfiles(id) ON DELETE CASCADE;
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT NOT NULL;
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS p256dh TEXT NOT NULL;
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS auth TEXT NOT NULL;
  ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT TRUE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_auth_all" ON push_subscriptions
  FOR ALL USING (auth.role() = 'authenticated');

-- =============================================
-- FUNCIÓN PARA ENVIAR PUSH (llamada desde la API)
-- =============================================
CREATE OR REPLACE FUNCTION notify_push(
  p_titulo TEXT,
  p_mensaje TEXT,
  p_url TEXT DEFAULT '/',
  p_para_rol TEXT DEFAULT 'todos'
)
RETURNS JSON AS $$
DECLARE
  v_subs RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Buscar suscripciones activas según el rol
  FOR v_subs IN
    SELECT ps.endpoint, ps.p256dh, ps.auth
    FROM push_subscriptions ps
    JOIN perfiles p ON p.id = ps.user_id
    WHERE ps.activa = true
      AND (p_para_rol = 'todos' OR p.rol = p_para_rol)
  LOOP
    -- Aquí se enviaría el push real via Web Push
    -- Por ahora solo contamos las suscripciones
    v_count := v_count + 1;
  END LOOP;

  RETURN json_build_object(
    'ok', true,
    'suscripciones_afectadas', v_count,
    'titulo', p_titulo,
    'mensaje', p_mensaje
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
