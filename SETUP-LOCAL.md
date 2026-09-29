# 🏑 Setup Local - Club Deportivo Hockey (MariaDB)

## 1. Base de datos (MariaDB)
El proyecto usa **MariaDB** (vía `mysql2`) en lugar de Supabase.

### Opción A - Docker (recomendado)
```bash
docker run -d --name fenix-mariadb \
  -e MARIADB_ROOT_PASSWORD=root123 \
  -e MARIADB_DATABASE=club_fenix \
  -e MARIADB_USER=fenix \
  -e MARIADB_PASSWORD=TU_CLAVE_LOCAL \
  -p 3306:3306 \
  mariadb:11
```

### Opción B - MariaDB instalado
Creá la base y el usuario a mano con los comandos de `mariadb/` (ver paso 3).

## 2. Variables de entorno
Copiá `.env.example` a `.env.local` y completá:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=fenix
DB_PASSWORD=TU_CLAVE_LOCAL
DB_NAME=club_fenix
JWT_SECRET=un-secreto-largo-para-produccion
# UPLOAD_DIR=/var/fenix-uploads   (opcional)
```

## 3. Crear las tablas y datos de prueba
Ejecutá en orden (con `mariadb` o `mysql` client):

```bash
mariadb -h localhost -u fenix -p'TU_CLAVE_LOCAL' < mariadb/01_schema.sql
mariadb -h localhost -u fenix -p'TU_CLAVE_LOCAL' < mariadb/02_seed.sql
```

- `mariadb/01_schema.sql` → crea la base `club_fenix` y las tablas.
- `mariadb/02_seed.sql` → usuarios de prueba (usuarios + perfiles + deportistas + familias).
- `mariadb/03_drop_chat.sql` → solo si venís de una versión con el chat: elimina `mensajes_chat`.
- `mariadb/04_email_verificacion.sql` → solo si la base ya existía: agrega las columnas de
  verificación y **marca verificadas las cuentas anteriores** (si no, nadie podría entrar).

> En Coolify el mismo proceso se hace con un solo comando SSH/consola (ver README).

## 4. Archivos subidos
No hay buckets externos: `/api/upload` guarda en disco (`.env.local` → `UPLOAD_DIR`,
por defecto `./uploads`) y los sirve `/api/files/...` (requiere sesión).

En producción, montá un **volume** en esa carpeta para que las fotos no se pierdan.

## 5. Ejecutar la app
```bash
npm install
npm run dev
```

## 6. Probar las interfaces
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
| admin@club.com | admin123 | admin | Club Admin |
| marcelo@mail.com | marcelo123 | padre | Marcelo Cabrera |
| juan@mail.com | juan123 | padre | Juan Perez |
| lautaro@mail.com | lautaro123 | deportista | Lautaro Cabrera |
| tomas@mail.com | tomas123 | deportista | Tomas Perez |

## Autenticación
- Sesión propia: JWT en cookie `httpOnly` (`fenix_token`), 7 días.
- Endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`,
  `/api/auth/me`, `/api/auth/password`.
- Queries: `/api/admin/query` (admin), `/api/user/query` (sesión),
  `/api/public/query` (público: comunicados, galería, sponsors, horarios y contacto).

## Verificación de email
El registro **no abre sesión**: manda un email con un enlace y el usuario tiene que
confirmarlo antes de poder hacer login (si no, `/api/auth/login` devuelve 403
`EMAIL_NO_VERIFICADO`).

- El token es aleatorio, expira a las **24h** y es de un solo uso.
- En la base solo se guarda el **SHA-256** del token, nunca el token en claro.
- Endpoints: `GET /api/auth/verify?token=...` y `POST /api/auth/resend-verification`
  (pide email + contraseña, y responde igual exista o no la cuenta para no
  enumerar qué emails están registrados).
- Si el usuario no puede entrar: en el login hay un botón "Reenviar email de
  verificación". El admin también puede crear cuentas ya verificadas desde
  `/admin/usuarios` (el club entrega las credenciales en persona).
- En producción: `RESEND_API_KEY`, `EMAIL_FROM` y **`APP_URL`**. Esta última es
  obligatoria (detrás de Traefik el link puede armarse con el host interno y no
  abrir). Se llama `APP_URL` y no `NEXT_PUBLIC_APP_URL` a propósito: el prefijo
  `NEXT_PUBLIC_` se inlinea en el bundle al buildear, así que si se agrega la
  variable después del deploy no llega al código ya compilado.
- Sin `RESEND_API_KEY` configurado **no sale ningún email**: la app muestra el
  enlace de verificación en pantalla (modo dev). Para producción hace falta la key.

## Estructura de cuota unificada
```
Marcelo Cabrera (padre/benefactor) → Lautaro Cabrera (cadete)
  → Cuota unificada: $75.000/mes
  → Marcelo sube comprobante de transferencia
  → Admin aprueba el pago
```
