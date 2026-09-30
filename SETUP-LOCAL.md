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

### Opción B - MariaDB instalada

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
- `mariadb/05_roles_directiva.sql` → migra los roles de directiva y renombra los socios.
- `mariadb/06_configuracion_cuota.sql` → monto base de la cuota y tramos de recargo.
  **Necesaria para que los recargos funcionen**; sin ella el panel sigue andando con los
  valores por defecto, pero no se pueden editar.
- `mariadb/07_datos_personales.sql` → bitácora de accesos a documentación y tabla de
  solicitudes de baja.
- `mariadb/08_perfil_sin_cuenta.sql` → permite `perfiles.usuario_id = NULL`, necesario para
  los perfiles anonimizados que deja una baja.
- `mariadb/09_solicitudes_baja.sql` → convierte la tabla de bajas en bandeja de entrada:
  agrega `resultado` y `canal`, y vuelve `perfil_id` nullable para los pedidos que llegan
  sin ficha asociada. **Sin ella el formulario `/solicitar-baja` y el panel de solicitudes
  devuelven error.**
- `mariadb/10_menores_consentimientos.sql` → `deportistas.fecha_nacimiento`, la tabla
  `consentimientos` (solo de alta), `revocaciones_consentimiento` y `opiciones_menor`.
  **Sin ella el registro con consentimiento da error y no se puede subir el DNI.**

Todas son idempotentes: se pueden volver a correr sin duplicar nada.

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
| `/socio-benefactor/dashboard` | Portal del socio benefactor |
| `/socio-cadete/dashboard` | Portal del socio cadete |
| `/admin/dashboard` | Panel de la directiva |

## Usuarios de prueba

| Email | Password | Rol | Nombre |
|-------|----------|-----|--------|
| admin@club.com | admin123 | admin | Club Admin |
| marcelo@mail.com | marcelo123 | padre | Marcelo Cabrera |
| juan@mail.com | juan123 | padre | Juan Perez |
| lautaro@mail.com | lautaro123 | deportista | Lautaro Cabrera |
| tomas@mail.com | tomas123 | deportista | Tomas Perez |

> Las cuentas de directiva que no están en el seed (`admin2@`, `presidente@`,
> `secretario@`, `tesorero@`, `vocal@` con `club.com`) se crearon a mano y
> **no tienen clave conocida en este archivo**. `vocal@club.com` quedó en
> `vocal123` después de una prueba de recuperación de clave; las otras cuatro
> solo se usan con un token de sesión. Si se pierden, se cambian desde
> `/admin/usuarios`.

## Autenticación
- Sesión propia: JWT en cookie `httpOnly` (`fenix_token`), 7 días.
- Endpoints: `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`,
  `/api/auth/me`, `/api/auth/password`.

### Recuperación de clave
- `/recuperar` pide el email; `/recuperar/[token]` escribe la clave nueva.
- **La respuesta es siempre la misma**, exista o no la cuenta. Si dijera "no
  encontramos esa cuenta", la pantalla serviría para averiguar qué familias
  están inscriptas y para mandar correo a direcciones ajenas con el remitente
  del club.
- **Solo recupera con email verificado.** Sin eso, cualquiera puede registrarse
  con el correo de otra persona y quedarse con la cuenta.
- El link dura **una hora** (la verificación dura 24 h), es de **un solo uso**, y
  pedir uno nuevo invalida el anterior. El token se guarda hasheado (SHA-256).
- Rate limit: 5/hora por IP y 3/hora por email.
- El correo **nunca pide la clave**: el link abre una pantalla para escribir la
  nueva. Así el ataque de suplantación no tiene qué robar.

- **Cambiar la clave cierra las sesiones abiertas de esa cuenta**, y solo de esa
  cuenta. El JWT lleva dentro el sello de la clave con que se emitió (`pc`) y
  `getCurrentUser` lo compara contra `usuarios.password_changed_at` antes de
  devolver un dato. Token con sello viejo, base con sello nuevo: se descarta.
  La sesión cerrada dura **un request**.
- La comparación vive en `getCurrentUser`, no en el proxy, porque `verifyToken`
  es sincrónica y corre en cada request: no puede consultar la base. Si el proxy
  se queda con un token viejo, se renderiza el cascarón de la página y las
  llamadas por API devuelven 401, que el cliente traduce a un reenvío al login.
- **Un token sin sello se rechaza.** Los JWT emitidos antes de esto no lo
  tienen, así que el primer despliegue cierra todas las sesiones abiertas y
  hay que entrar de nuevo. Es el canje correcto: aceptar un token sin sello
  dejaría abierta la puerta justo de los tokens más viejos.
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
Marcelo Cabrera (socio benefactor) → Lautaro Cabrera (socio cadete)
  → Cuota unificada: $75.000/mes
  → Marcelo sube comprobante de transferencia
  → Admin aprueba el pago
```

## Roles y permisos
El enum `usuarios.rol` tiene 8 valores. La fuente única de los roles y de la
matriz de permisos es `src/lib/roles.ts` (si se agrega un rol, se edita ese
archivo **y** el ENUM con una migración).

| Rol | Portal | Alcance |
|-----|--------|---------|
| `admin` | `/admin` | Todos los módulos |
| `presidente` | `/admin` | Todos los módulos |
| `secretario` | `/admin` | Socios, jugadores, agenda, comunicados, notificaciones, horarios, reservas |
| `tesorero` | `/admin` | Socios, jugadores, pagos, finanzas, reportes, contabilidad |
| `vocal_titular` | `/admin` | Consulta de socios, jugadores, legajos y partidos |
| `vocal_suplente` | `/admin` | Igual que Vocal Titular |
| `socio_benefactor` | `/socio-benefactor` | Sus cuotas, sus hijos, reservas, galería |
| `socio_cadete` | `/socio-cadete` | Su ficha, su DNI, reservas, galería |

Las URLs viejas `/padre/*` y `/deportista/*` redirigen con 308 a las nuevas.

- El registro público (`/registro`) solo admite `socio_benefactor` y
  `socio_cadete`. Los cargos se dan de alta desde `/admin/usuarios`.
- **Editar usuarios y cambiar roles** se hace desde la misma pantalla, con el
  lápiz en cada fila. Endpoint `PATCH /api/admin/update-user`.
- El menú lateral se filtra según el cargo, y el proxy bloquea por URL
  las páginas sin permiso (no es solo cosmético).
- Los socios no tienen ningún módulo del panel, ni siquiera el dashboard: el
  suyo está en su portal.

### Reglas del cambio de rol

En `PATCH /api/admin/update-user`, que aplica sobre las **dos** columnas de rol
(`usuarios.rol` y `perfiles.rol`; si se actualiza una sola, el login y el panel
muestran roles distintos):

- Nadie puede cambiar su propio rol. Un admin que se degrada a vocal por
  error puede dejar el club sin nadie que administre los usuarios.
- No se puede dejar el club sin administradores: hay que crear otro admin
  antes de bajar el del último.
- Al pasar a `socio_cadete` se crea la fila en `deportistas` si no existe
  (el portal y las cuotas la necesitan). Al salir de ese rol la fila se
  conserva: borrarla tiraría abajo el historial del jugador.
- **Cambiar el email deja la cuenta sin verificar** y manda un token a la
  dirección nueva. Sin esto, cualquiera podría poner el email de un tercero y
  quedarse con la cuenta ya validada.
- La contraseña se hashea en el endpoint; el genérico de queries nunca la
  toca. `usuarios` está en su whitelist de columnas solo con `id`, `email`,
  `rol`, `email_verificado` y fechas: `password_hash` y `verification_token`
  están fuera a propósito.
- Un JWT emitido antes de la migración 05 lleva el rol viejo y se rechaza:
  hay que volver a iniciar sesión.

Migración necesaria: `mariadb/05_roles_directiva.sql`.

## Contabilidad
`/admin/contabilidad` (módulo `contabilidad`, permiso de admin, presidente y
tesorero). Todos los cálculos viven en `src/lib/contabilidad.ts`; la pantalla es
solo presentación. Si hay que cambiar una fórmula se edita ese archivo, no el
JSX, para que el gráfico y los totales no se desincronicen.

Tres cosas que conviene no revertir sin pensarlo:

1. **Las cuotas no se suman a la caja.** `finanzas` es la fuente del estado de
   resultados; `cuotas` aparece aparte como cobranza del mes y cuentas por
   cobrar. Una cuota pagada suele estar registrada en las dos tablas, y sumar
   ambas duplica los ingresos del club.
2. **La antigüedad de una cuota sale de su período** (mes/año), no de una
   columna de vencimiento: `cuotas` no la tiene. Es una limitación del modelo,
   no un atajo.
3. **La categoría de un movimiento se normaliza al cargar.** `finanzas.categoria`
   es texto libre; sin normalizar, "alquiler", "Alquiler" y "alquiler cancha"
   serían tres filas que no suman al total. Lo que no se reconoce queda en
   "Sin clasificar" y se muestra en pantalla para que se corrija la carga.

Gráficos: son SVG propio en `src/components/admin/charts.tsx`, sin librería de
charts. Pesan menos que el bundle de una dependencia y se ven nítidos en
cualquier densidad de pantalla.

## Sistema de diseño del panel
`src/app/globals.css` define tokens **semánticos** (`surface`, `line`, `muted`,
`ok`, `warn`, `danger`, `brand`). Las páginas eligen color por significado, no
por tono: no hay `bg-gray-900` ni `text-gray-400` en `/admin`. Si hace falta un
color nuevo se agrega un token, no un gris hardcodeado.

Piezas compartidas en `src/components/admin/ui.tsx`: `PageHeader`, `StatCard`,
`Panel`, `EmptyState`, `StatusPill`, `Toolbar`, `Hint`, `DataPoint`. Formato de
importes, fechas y antigüedad en `src/lib/format.ts` (importes en es-AR con
separador de miles: `$ 75.000`, nunca `$75000`).

Regla para pantallas nuevas: todo importe con `money()`, toda fecha con
`fecha()`, y confirmación con `Confirmar` antes de cualquier borrado. Nunca
`window.confirm`: el texto del navegador está en inglés y no dice qué se está
borrando.

## Cuotas y recargos
Migración `mariadb/06_configuracion_cuota.sql`. Se edita en
`/admin/configuracion` → pestaña "Cuotas y vencimientos" (admin y presidente).

Antes el monto estaba fijo en $75.000, hardcodeado en `admin/pagos/page.tsx`.
Ahora:

- `configuracion_club` guarda el monto base (`cuota_monto_base`).
- `vencimientos_cuota` guarda los tramos: día del mes y porcentaje.
  Vienen tres por defecto: día 10 → +5%, día 20 → +10%, día 30 → +20%.
- `cuotas.monto_pagado` guarda lo que efectivamente entró en caja. Es NULL
  mientras la cuota está pendiente.

Cuatro decisiones que no conviene revertir:

1. **El recargo se calcula al vuelo, no se guarda.** `cuotas.monto` es siempre
   el monto base. Cambiar un porcentaje recalcula las cuotas pendientes al
   instante y las ya cobradas no se tocan. Por eso los vencimientos son una
   tabla y no columnas en `cuotas`.
2. **El hito se toma del mes siguiente al de la cuota.** La cuota de marzo
   vence el 10 de abril. Así una cuota del mes en curso nunca tiene recargo.
3. **El recargo arranca al día siguiente del hito.** El día del hito todavía
   se puede pagar sin recargo, que es lo que entiende alguien que lee
   "vence el día 10".
4. **Un día inexistente se clampea al último del mes.** El hito del día 30 de
   la cuota de enero cae el 28 de febrero, no el 2 de marzo. `new Date(anio,
   mes, 30)` desborda al mes siguiente y corría el vencimiento dos días tarde.

`cuotas.vencimiento_override` permite pactar una fecha puntual con una familia:
mueve toda la escala de hitos, no deja los otros dos clavados.

Cálculo en `src/lib/cuotas.ts` (lógica pura, la importan el servidor y el
cliente); lectura y escritura de la configuración en `src/lib/cuotas-db.ts`.
La separación importa: si el acceso a la base estuviera en el archivo puro, el
driver de MySQL se iría al bundle del navegador.

Tests: `npm test` (vitest). Cubren los casos de fecha que fallan en silencio:
cambio de año, meses cortos, límite del día del hito y redondeo. También
fijan la matriz de roles y permisos (`tests/roles.test.ts`), que todas las
pantallas del panel caigan bajo un módulo (`tests/proteccion-rutas.test.ts`) y
el mínimo de datos que tiene que traer un pedido de baja
(`tests/baja-solicitud.test.ts`).

## Solicitudes de baja de datos
El derecho de supresión lo tiene la persona, no el club, así que hay tres
piezas y ninguna borra nada por sí sola:

| Pieza | Ruta | Qué hace |
| --- | --- | --- |
| Formulario público | `/solicitar-baja` | Para quien no tiene cuenta. Exige DNI. |
| Portal del socio | `/socio-{cadete,benefactor}/configuracion` | Pide la baja propia o de un jugador a su cargo. |
| Bandeja del panel | `/admin/configuracion` → "Solicitudes de baja" | Aprueba (ejecuta la baja) o rechaza con motivo. |

- El pedido **nunca** anonimiza a nadie por sí solo. Al aprobar, el admin elige
  a qué ficha corresponde y recién ahí corre `src/lib/baja.ts`, el mismo
  procedimiento que usa la baja directa del panel.
- La identidad se verifica por DNI contra `perfiles`. Por eso `perfil_id` es
  nullable en la tabla: un formulario anónimo no sabe todavía a qué ficha
  corresponde, y adivinarlo sería peor que no vincularlo.
- Aprobar conserva pagos y contabilidad; solo anonimiza la identidad.
- Rechazar exige motivo: se le comunica a quien pidió.
- Módulo requerido: `configuracion` (admin y presidente).

## Menores de edad y consentimientos
El club no sabe si un jugador es menor si no tiene la fecha de nacimiento.
Y no puede probar que alguien consentió si no guarda el consentimiento. Las
dos cosas vivían solo en el papel antes de esto.

**Estructura:**

| Tabla | Qué guarda |
| --- | --- |
| `deportistas.fecha_nacimiento` | Lo que define si es menor, y cuándo cumple 18 |
| `consentimientos` | Actos de consentimiento. **Solo altas: no se editan ni se borran** |
| `revocaciones_consentimiento` | La oposición. Revocar no borra, agrega |
| `opiones_menor` | Qué se le preguntó al menor y qué dijo |

**Por qué el consentimiento es solo de alta.** Si el club puede modificarlo,
deja de ser prueba. Con dos tablas se demuestra la secuencia completa —"el 3
de marzo lo consintió, el 20 de agosto lo revocó"—; con una sola que se
actualiza queda solo el último estado.

**Catálogo de finalidades** (`src/lib/consentimientos.ts`), cada una con su
base legal:

- `inscripcion`, `contacto`, `comunicaciones` → ejecución del contrato
- `documentacion_dni`, `datos_deportivos`, `imagenes` → **consentimiento
  expreso**, casilla propia sin marcar, y opinión del menor
- `cuotas_contabilidad` → **obligación legal**. No se puede revocar: si se
  pudiera, el club quedaría sin contabilidad.

**Reglas que no se negocian:**

- El **"no" del menor veda la finalidad**, aunque el representante firme
  (art. 124 inc. b del Código Civil). El registro lo rechaza y la pantalla de
  autorización también.
- **Decir que no NO bloquea el alta.** La puerta está en la operación: subir
  la foto del DNI exige consentimiento vigente (`/api/user/query`, no la
  pantalla, porque la pantalla se puede saltar).
- La fecha de nacimiento es obligatoria en el alta de un jugador y el vínculo
  se declara (antes el backend ponía `padre` fijo: una madre quedaba
  asentada como padre).

**La alerta que aparece sola:** `cumplo 18`. Cuando un jugador cumple 18, el
consentimiento que firmó su representante deja de ser la base legal: a partir
de ahí tiene que firmarlo el jugador. Es lo único que se dispara con el correr
del tiempo sin que nadie haga nada.

**Pendiente operativo:** los jugadores que ya estaban cargados **no tienen
fecha de nacimiento ni consentimiento registrado**. Hay que recabar ambos
(`/admin/configuracion` → "Consentimientos y menores"). Hasta entonces, el
club no puede responder quién autorizó nada.

> **Lo que esto NO es:** un criterio legal. Las referencias a la Ley 25.326 y
> al Código Civil están para que un abogado rastree el fundamento. El texto
> del aviso, el catálogo de finalidades y los plazos necesitan firma profesional
> antes de operar con menores.

## Proxy (antes middleware)
El archivo se llama `src/proxy.ts` y exporta `proxy()`. En Next 16 la
convención `middleware` está deprecada. Corre en Node.js por diseño (jsonwebtoken
necesita crypto de Node), así que ya no hace falta declarar runtime.

