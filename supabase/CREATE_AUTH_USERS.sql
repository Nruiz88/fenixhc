-- ============================================
-- PASO 1: Crear usuarios en auth.users
-- Pegar esto en SQL Editor y darle Run
-- Usa service_role (no anon)
-- ============================================

-- Función helper para crear usuarios
CREATE OR REPLACE FUNCTION create_auth_user(
  p_email TEXT,
  p_password TEXT,
  p_rol TEXT,
  p_nombre TEXT,
  p_apellido TEXT
)
RETURNS UUID AS $$
DECLARE
  new_user_id UUID;
BEGIN
  -- Generar UUID determinístico basado en email
  new_user_id := gen_random_uuid();
  
  -- Insertar en auth.users (solo service role puede hacer esto)
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    new_user_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    NOW(),
    jsonb_build_object('rol', p_rol, 'nombre', p_nombre, 'apellido', p_apellido),
    jsonb_build_object('provider', 'email', 'providers', ARRAY['email']),
    NOW(),
    NOW(),
    encode(gen_random_bytes(32), 'hex'),
    encode(gen_random_bytes(32), 'hex')
  );
  
  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- USUARIOS A CREAR
-- ============================================

-- Admin
SELECT create_auth_user('admin@club.com', '123456', 'admin', 'Club', 'Admin');

-- Padres
SELECT create_auth_user('marcelo@mail.com', '123456', 'padre', 'Marcelo', 'Cabrera');
SELECT create_auth_user('juan@mail.com', '123456', 'padre', 'Juan', 'Perez');

-- Deportistas
SELECT create_auth_user('lautaro@mail.com', '123456', 'deportista', 'Lautaro', 'Cabrera');
SELECT create_auth_user('tomas@mail.com', '123456', 'deportista', 'Tomas', 'Perez');

-- Verificar que se crearon
SELECT id, email, raw_user_meta_data->>'rol' as rol, raw_user_meta_data->>'nombre' as nombre
FROM auth.users
WHERE email IN ('admin@club.com', 'marcelo@mail.com', 'juan@mail.com', 'lautaro@mail.com', 'tomas@mail.com');
