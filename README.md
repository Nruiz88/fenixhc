# Fenix Roller Hockey

Gestión de socios, jugadores, cuotas y consentimientos de un club de roller
hockey. Next.js 16 (App Router) sobre MariaDB, desplegado con Coolify.

## Qué hace

- **Socios**: alta de benefactores y cadetes, portal propio para cada uno.
- **Cuotas**: monto configurable, tramos de recargo por vencimiento, comprobantes
  que sube la familia y aprueba tesorería.
- **Cuota unificada**: el padre paga la de sus hijos; el jugador no tiene que
  tener una cuenta para estar federado.
- **Junta directiva**: partes, inventario, seguros, recibos en PDF, documentos
  del legajo y avisos a las familias.
- **Privacidad**: consentimientos por finalidad, opinión del menor, bitácora de
  accesos a documentación y solicitudes de baja.

## Arranque local

Requiere Node >= 22 y una MariaDB (o Docker).

```bash
docker run -d --name fenix-mariadb \
  -e MARIADB_ROOT_PASSWORD=root123 \
  -e MARIADB_DATABASE=club_fenix \
  -e MARIADB_USER=fenix \
  -e MARIADB_PASSWORD=una-clave-local \
  -p 3306:3306 mariadb:11

cp .env.example .env.local   # y completar
npm install
npm run dev
```

La base se crea con los archivos de `mariadb/`, en orden:

```bash
mariadb -h localhost -u fenix -p'...' < mariadb/01_schema.sql
mariadb -h localhost -u fenix -p'...' < mariadb/02_seed.sql
mariadb -h localhost -u fenix -p'...' < mariadb/03_drop_chat.sql
# ... hasta 13. Cada uno es idempotente: se pueden volver a correr.
```

**El detalle completo de cada migración está en [SETUP-LOCAL.md](SETUP-LOCAL.md)**,
junto con los roles, el diseño del sistema y las decisiones que no conviene
revertir sin pensarlas. Ese archivo es la referencia; este es el índice.

## Scripts

```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm start       # servidor de producción
npm test        # tests (vitest)
npm run lint    # eslint
```

## Dónde está cada cosa

| Ruta | Qué |
|---|---|
| `src/app/api/auth/register` | Alta de socio. El bloque del hijo se valida contra sus propios consentimientos |
| `src/app/api/user/query` | Queries del portal del socio. Autorización por fila (reemplaza la RLS de Supabase) |
| `src/app/api/admin/query` | Queries del panel. Autorización por módulo y rol |
| `src/app/api/files/[...path]` | Sirve los archivos. Chequea permisos y deja bitácora ANTES de leer |
| `src/proxy.ts` | Protección de rutas por sesión y módulo |
| `src/lib/roles.ts` | Los 8 roles y la matriz de módulos |
| `src/lib/capacidades.ts` | Permisos finos de la sección de junta directiva |
| `src/lib/consentimientos.ts` | Reglas de consentimiento de menores. Lógica pura y testeada |
| `src/lib/almacen.ts` | Archivos: disco o S3/R2. La URL no depende del backend |
| `emails/` | HTML de referencia de los correos. La directiva los edita en Resend |
| `mariadb/` | Migraciones, en orden. Todas idempotentes |
| `tests/` | Tests de lógica: fechas, importes, roles, consentimiento, seguridad |

## Lo que no está, y por qué

- **`supabase/`**: se borró. La app pasó de Supabase a MariaDB y quedaron 19
  archivos con el esquema viejo, la RLS y una lista de socios de ejemplo con DNI
  y CUIL. Nada los referenciaba. El esquema real está en `mariadb/`.
- **`generate-all.js`**: se borró. Sobreescribía seis páginas con una versión
  obsoleta del club (roles `padre`/`deportista`, datos de contacto que ya no
  existen) y no estaba en ningún script de `package.json`.
- **Primitivas de UI sin uso** (`tabs`, `table`, `separator`, `dropdown-menu`):
  ~500 líneas de componentes de shadcn que nadie importaba.
- **`src/hooks/useUser.ts` y `src/types/index.ts`**: borrados; lo único que los
  usaba era cada uno del otro.
- **`VALIDATION` en `constants.ts`**: era una trampa. Sus límites viven donde se
  aplican (el mínimo de contraseña en `schemas.ts`, el tope de consulta en la
  whitelist de tablas, el límite de tamaño en la ruta de subida). Tenerlos en un
  objeto que nadie leía daba la falsa impresión de que cambiar ahí alcanzaba.
- **`createClient` y `buildQuery` en `auth-client.ts`**: emulaban la API del
  cliente de Supabase para que el código viejo siguiera andando. Ya no queda
  código viejo.
- **Dependencias sin uso**: `@react-pdf/renderer`, `date-fns`, `tw-animate-css`,
  `web-push`, `xlsx`, `next-themes`.

`tests/sin-codigo-muerto.test.ts` vigila que nada de esto vuelva a aparecer y
que cada import con alias `@/` apunte a un archivo existente.

## Decisiones que conviene conocer antes de tocar algo

- **El consentimiento se presta por persona, no por familia.** El padre firma
  para sus datos y aparte para los de su hijo, y son registros distintos. La
  opinión del menor, cuando él habla, gana sobre la del representante.
- **La puerta del DNI está en la API, no en la pantalla.** Una pantalla se puede
  saltar; `POST /api/user/query` es la única línea por la que pasa el dato.
- **Subir la foto del DNI no se rechaza por falta de consentimiento.** Decir que
  no es un derecho. Lo que se cierra es la operación, no el alta.
- **Los archivos se sirven siempre por proxy**, nunca con una URL directa: así la
  bitácora de accesos puede registrar quién abrió qué.
- **`script-src` lleva `'unsafe-inline'`** porque Next hidrata con scripts en
  línea y no usa nonces. Pasarlo a strict sin nonces rompe la app.

## Advertencia

El módulo de menores y consentimientos implementa un **criterio técnico**, no una
opinión legal. Las referencias a la Ley 25.326 y al Código Civil están para que
quien revise rastree el fundamento. **El texto que ve la familia, el catálogo de
finalidades y los plazos necesitan firma profesional antes de operar con
menores de verdad.** Ver la advertencia en `src/lib/consentimientos.ts`.

## Estado

Ramas: `main` es la que se despliega. Sin CI: el build corre en el deploy de
Coolify.