# 🗄️ Crear la base de datos en Coolify (MariaDB)

Todo el SQL del proyecto está en `mariadb/`:

| Archivo | Qué hace |
|---------|----------|
| `00_create_db.sql` | Crea la base `club_fenix`, el usuario `fenix` y los permisos |
| `01_schema.sql` | Las 18 tablas + índices + FK + canchas por defecto |
| `02_seed.sql` | Usuarios de prueba (usuarios, perfiles, deportistas, familias) |
| **`COOLIFY-PEGAR.sh`** | **Bloque único listo para pegar en la terminal de Coolify** (SQL embebido, no necesita archivos en el servidor) |

## ⭐ Opción rápida: pegar en la terminal de Coolify

1. Abrí `mariadb/COOLIFY-PEGAR.sh`, cambia `ROOT_PASS="AQUI_ROOT_PASSWORD"` por el root password de MariaDB.
2. Copialo entero:
   - Mac: `cat mariadb/COOLIFY-PEGAR.sh | pbcopy`
   - Windows: `cat club-deportivo/mariadb/COOLIFY-PEGAR.sh | clip`
3. Pegalo en la terminal de Coolify (Consola → Terminal del servidor, o del contenedor MariaDB) y Enter.
4. Crea base + usuario + 18 tablas + seed en una sola sesión y al final imprime la cantidad de tablas.

> Si la terminal ya está en un prompt `mariadb>` (no bash), pegá directamente el SQL de
> `00_create_db.sql`, después `01_schema.sql` y después `02_seed.sql`.

## 1. Levantar MariaDB en Coolify

1. Coolify → **+ New** → **Databases** → **MariaDB**
2. Nombre sugerido: `mariadb-fenix`
3. Guardá el **root password** que genera Coolify
4. No crees la base a mano: lo hace el comando del paso 2.

## 2. Comando SSH con key (desde tu PC)

En la raíz del repo:

```bash
export ROOT_PASS="PEGAR_AQUI_EL_ROOT_PASSWORD"
export DB_PASS="CLAVE_FUERTE_PARA_EL_USUARIO_FENIX"

cat mariadb/00_create_db.sql mariadb/01_schema.sql mariadb/02_seed.sql | \
  ssh -i ~/.ssh/TU_KEY root@TU_IP \
  "docker exec -i \$(docker ps --format '{{.Names}}' | grep -iE 'maria|mysql' | head -1) mariadb -uroot -p'$ROOT_PASS'"
```

Reemplazá:
- `~/.ssh/TU_KEY` → la ruta de tu key (`-i /ruta/key.pem`)
- `TU_IP` → IP del servidor con Coolify
- `root` → usuario SSH si es otro (`ubuntu`, `debian`…)
- `ROOT_PASS` → root password de MariaDB

Todo corre en **una sola sesión** de MariaDB: crea la base, el usuario,
las 18 tablas y el seed, en ese orden.

Si el contenedor no se detecta solo, decile cuál es:

```bash
cat mariadb/00_create_db.sql mariadb/01_schema.sql mariadb/02_seed.sql | \
  ssh -i ~/.ssh/TU_KEY root@TU_IP \
  "docker exec -i mariadb-fenix mariadb -uroot -p'$ROOT_PASS'"
```

### Alternativa: ya estás en la terminal del servidor / consola de Coolify

```bash
cat mariadb/00_create_db.sql mariadb/01_schema.sql mariadb/02_seed.sql | \
  docker exec -i "$(docker ps --format '{{.Names}}' | grep -iE 'maria|mysql' | head -1)" \
  mariadb -uroot -p"$ROOT_PASS"
```

## 3. Verificar

```bash
ssh -i ~/.ssh/TU_KEY root@TU_IP \
  "docker exec \$(docker ps --format '{{.Names}}' | grep -iE 'maria|mysql' | head -1) \
   mariadb -ufenix -p"$DB_PASS" -e 'USE club_fenix; SHOW TABLES;'"
```

Debería listar las 18 tablas.

## 4. Variables de entorno de la app en Coolify

| Variable | Valor |
|----------|-------|
| `DB_HOST` | nombre del servicio MariaDB (ej. `mariadb-fenix`); si la DB está en otra máquina, su IP |
| `DB_PORT` | `3306` |
| `DB_USER` | `fenix` |
| `DB_PASSWORD` | la clave que definiste en `DB_PASS` (no la subas al repo) |
| `DB_NAME` | `club_fenix` |
| `JWT_SECRET` | generá uno largo y distinto |
| `UPLOAD_DIR` | `/var/fenix-uploads` (montar un volume ahí para no perder fotos) |

## 5. Usuarios de prueba

| Email | Password | Rol |
|-------|----------|-----|
| admin@club.com | admin123 | admin |
| marcelo@mail.com | marcelo123 | padre |
| juan@mail.com | juan123 | padre |
| lautaro@mail.com | lautaro123 | deportista |
| tomas@mail.com | tomas123 | deportista |
