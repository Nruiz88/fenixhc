-- =============================================
-- STORAGE BUCKETS + POLICIES
-- =============================================
-- Ejecutar en Supabase SQL Editor

-- =============================================
-- 1. BUCKET: fotos-perfil
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-perfil',
  'fotos-perfil',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Público puede leer
CREATE POLICY "fotos_perfil_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos-perfil');

-- Usuarios autenticados pueden subir su propia foto
CREATE POLICY "fotos_perfil_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fotos-perfil'
    AND auth.role() = 'authenticated'
  );

-- Usuarios pueden actualizar su propia foto
CREATE POLICY "fotos_perfil_auth_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'fotos-perfil'
    AND auth.role() = 'authenticated'
  );

-- Usuarios pueden borrar su propia foto
CREATE POLICY "fotos_perfil_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos-perfil'
    AND auth.role() = 'authenticated'
  );

-- =============================================
-- 2. BUCKET: fotos-galeria
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-galeria',
  'fotos-galeria',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "fotos_galeria_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos-galeria');

CREATE POLICY "fotos_galeria_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fotos-galeria'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "fotos_galeria_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos-galeria'
    AND auth.role() = 'authenticated'
  );

-- =============================================
-- 3. BUCKET: fotos-dni
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'fotos-dni',
  'fotos-dni',
  false, -- PRIVADO - solo el usuario y admin
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Solo el propietario puede ver sus DNIs
CREATE POLICY "fotos_dni_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'fotos-dni'
    AND (
      auth.uid()::text = (string_to_array(name, '/'))[1]
      OR auth.jwt() ->> 'role' = 'service_role'
    )
  );

CREATE POLICY "fotos_dni_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'fotos-dni'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "fotos_dni_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'fotos-dni'
    AND auth.role() = 'authenticated'
  );

-- =============================================
-- 4. BUCKET: comprobantes
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprobantes',
  'comprobantes',
  false, -- PRIVADO
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "comprobantes_owner_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'comprobantes'
    AND (
      auth.uid()::text = (string_to_array(name, '/'))[1]
      OR auth.jwt() ->> 'role' = 'service_role'
    )
  );

CREATE POLICY "comprobantes_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'comprobantes'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "comprobantes_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'comprobantes'
    AND auth.role() = 'authenticated'
  );

-- =============================================
-- 5. BUCKET: chat-archivos
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-archivos',
  'chat-archivos',
  false, -- PRIVADO
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'application/pdf']
) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_archivos_auth_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-archivos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "chat_archivos_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-archivos'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "chat_archivos_auth_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-archivos'
    AND auth.role() = 'authenticated'
  );
