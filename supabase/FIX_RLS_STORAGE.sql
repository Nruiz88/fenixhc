-- =============================================
-- FIX: RLS RECURSIVE ON perfiles + Storage Buckets
-- =============================================
-- Ejecutar este SQL en Supabase SQL Editor

-- 1. ARREGLAR RLS RECURSIVO EN perfiles
-- Eliminar todas las políticas existentes en perfiles
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'perfiles') LOOP
    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON perfiles';
  END LOOP;
END
$$;

-- Crear políticas simples sin recursión
CREATE POLICY "perfiles_select_own" ON perfiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "perfiles_auth_read" ON perfiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "perfiles_service_all" ON perfiles
  FOR ALL USING (auth.role() = 'service_role');

-- 2. CREAR STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-perfil', 'fotos-perfil', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-galeria', 'fotos-galeria', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('fotos-dni', 'fotos-dni', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('comprobantes', 'comprobantes', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-archivos', 'chat-archivos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- 3. STORAGE POLICIES
-- fotos-perfil
CREATE POLICY "fotos_perfil_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-perfil');
CREATE POLICY "fotos_perfil_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fotos-perfil' AND auth.role() = 'authenticated');
CREATE POLICY "fotos_perfil_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'fotos-perfil' AND auth.role() = 'authenticated');

-- fotos-galeria
CREATE POLICY "fotos_galeria_public_read" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-galeria');
CREATE POLICY "fotos_galeria_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fotos-galeria' AND auth.role() = 'authenticated');
CREATE POLICY "fotos_galeria_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'fotos-galeria' AND auth.role() = 'authenticated');

-- fotos-dni
CREATE POLICY "fotos_dni_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-dni' AND auth.role() = 'authenticated');
CREATE POLICY "fotos_dni_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fotos-dni' AND auth.role() = 'authenticated');
CREATE POLICY "fotos_dni_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'fotos-dni' AND auth.role() = 'authenticated');

-- comprobantes
CREATE POLICY "comprobantes_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');
CREATE POLICY "comprobantes_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');
CREATE POLICY "comprobantes_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'comprobantes' AND auth.role() = 'authenticated');

-- chat-archivos
CREATE POLICY "chat_archivos_auth_read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-archivos' AND auth.role() = 'authenticated');
CREATE POLICY "chat_archivos_auth_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-archivos' AND auth.role() = 'authenticated');
CREATE POLICY "chat_archivos_auth_delete" ON storage.objects FOR DELETE USING (bucket_id = 'chat-archivos' AND auth.role() = 'authenticated');
