# 🏑 Setup Local - Club Deportivo Hockey

## 1. Crear proyecto en Supabase
1. Andá a [supabase.com](https://supabase.com) y creá un proyecto nuevo
2. Andá a **Settings → API** y copiá:
   - `Project URL`
   - `anon/public key`
   - `service_role key` (Secrets)

## 2. Configurar variables de entorno
Editá `.env.local` con tus datos reales:
```
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## 3. Crear las tablas en Supabase
Andá al **SQL Editor** de Supabase y ejecutá en orden:
1. `supabase/migrations/001_initial_schema.sql` (schema de tablas + RLS)
2. `supabase/migrations/001_initial_schema_rls.sql` (políticas RLS + triggers)
3. `supabase/seed.sql` (datos de prueba)

## 4. Crear Storage Buckets
En **Storage** del dashboard de Supabase, creá estos buckets:
- `fotos-perfil` (público para lectura)
- `fotos-galeria` (público para lectura)
- `fotos-dni` (privado)
- `comprobantes` (privado)
- `chat-archivos` (autenticado)

Para cada bucket, creá una policy:
```sql
-- Para buckets públicos (lectura):
CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id = 'fotos-perfil');

-- Para escritura autenticada:
CREATE POLICY "Auth upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fotos-perfil' AND auth.role() = 'authenticated');

-- Para chat-archivos:
CREATE POLICY "Auth read" ON storage.objects FOR SELECT USING (bucket_id = 'chat-archivos' AND auth.role() = 'authenticated');
CREATE POLICY "Auth upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-archivos' AND auth.role() = 'authenticated');
```

## 5. Registrar usuarios de prueba
Los UUIDs en `seed.sql` son de ejemplo. Para que funcione:

**Opción A (recomendada):** Registrá los usuarios desde la app:
- Andá a `http://localhost:3001/registro`
- Creá una cuenta para cada rol
- Después editá el `seed.sql` con los UUIDs reales

**Opción B:** Creá usuarios directamente en Supabase Auth:
1. Andá a **Authentication → Users**
2. Creá usuarios manualmente con estos emails:
   - `admin@club.com` (password: 123456)
   - `marcelo@mail.com` (password: 123456)
   - `juan@mail.com` (password: 123456)
   - `lautaro@mail.com` (password: 123456)
   - `tomas@mail.com` (password: 123456)
3. En **Auth → Users**, editá cada usuario y agregá en **User Metadata**:
   ```json
   {"rol": "admin"}  // para admin@club.com
   {"rol": "padre"}  // para marcelo y juan
   {"rol": "deportista"}  // para lautaro y tomas
   ```

## 6. Ejecutar la app
```bash
npm run dev
```

## 7. Probar las interfaces
| URL | Qué se ve |
|-----|-----------|
| `/` | Landing page pública |
| `/club` | Info del club |
| `/entrenamientos` | Horarios |
| `/contacto` | Formulario de contacto |
| `/login` | Login |
| `/registro` | Registro |
| `/padre/dashboard` | Portal del padre |
| `/deportista/dashboard` | Portal del deportista |
| `/admin/dashboard` | Panel del club |

## Usuarios de prueba

| Email | Password | Rol | Nombre |
|-------|----------|-----|--------|
| admin@club.com | 123456 | admin | Club Admin |
| marcelo@mail.com | 123456 | padre | Marcelo Cabrera |
| juan@mail.com | 123456 | padre | Juan Perez |
| lautaro@mail.com | 123456 | deportista | Lautaro Cabrera |
| tomas@mail.com | 123456 | deportista | Tomas Perez |

## Estructura de cuota unificada
```
Marcelo Cabrera (padre/benefactor) → Lautaro Cabrera (cadete)
  → Cuota unificada: $75.000/mes
  → Marcelo sube comprobante de transferencia
  → Admin aprueba el pago
```
