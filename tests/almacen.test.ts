import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { escribir, leer, backendActivo, raizPorDefecto } from '@/lib/almacen';

// El almacenamiento se puede cambiar de sitio sin cambiar cómo se autorizan los
// archivos. Eso es lo que hacen estos tests.
//
// POR QUÉ IMPORTA
//
// `/api/files/[...path]` decide quién puede ver un DNI y después lee. Si el
// chequeo de permisos y la lectura se mezclan, o si el archivo pasa a servirse
// por una URL firmada, el DNI de un menor queda accesible para cualquiera que
// tenga el enlace —y los enlaces se copian, se cachean y se quedan en el
// historial del navegador.
//
// La contención del path también: con S3 no hay `path.resolve` que compare
// prefijos, así que un `../` tiene que quedar detenido en otro lado, no por
// suerte.

const RUTA = readFileSync(join(__dirname, '../src/app/api/files/[...path]/route.ts'), 'utf8');
const UPLOAD = readFileSync(join(__dirname, '../src/app/api/upload/route.ts'), 'utf8');
const ALMACEN = readFileSync(join(__dirname, '../src/lib/almacen.ts'), 'utf8');
const BITACORA = readFileSync(join(__dirname, '../src/lib/bitacora.ts'), 'utf8');

/** El código sin comentarios, para no encontrar lo buscado en la explicación. */
const codigo = (t: string) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

let raiz: string;

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'fenix-almacen-'));
  delete process.env.S3_BUCKET;
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  process.env.UPLOAD_DIR = raiz;
});

afterEach(() => {
  rmSync(raiz, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
});

describe('el backend por defecto', () => {
  it('sin credenciales escribe y lee de disco', async () => {
    expect(backendActivo()).toBe('disco');
    expect(raizPorDefecto()).toBe(raiz);

    await escribir('fotos-dni', 'u1/dni-frente.jpg', Buffer.from('contenido'));

    expect((await leer('fotos-dni', 'u1/dni-frente.jpg')).toString()).toBe('contenido');
  });

  it('crea las carpetas que le faltan', async () => {
    // El path lo arma el cliente. Si `mkdir` faltara, la primera subida de un
    // socio nuevo fallaría con ENOENT y el usuario vería "Error al subir".
    await escribir('fotos-galeria', '2026/foto.jpg', Buffer.from('x'));
    expect(existsSync(join(raiz, 'fotos-galeria', '2026', 'foto.jpg'))).toBe(true);
  });

  it('un archivo que no existe tira ENOENT, no otra cosa', async () => {
    // El route devuelve 404 con ENOENT y 500 con cualquier otro error. Que
    // "no está" se confunda con "se cayó el servidor" convierte el error más
    // común en el más difícil de leer.
    await expect(leer('fotos-dni', 'u1/no-existe.jpg')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('con credenciales configuradas elige S3', () => {
    process.env.S3_BUCKET = 'fenix';
    process.env.S3_ACCESS_KEY_ID = 'a';
    process.env.S3_SECRET_ACCESS_KEY = 'b';
    expect(backendActivo()).toBe('s3');
  });

  it('S3 a medias no alcanza: o están las tres o va a disco', () => {
    // Con un bucket pero sin clave, el archivo se iría a un sitio que se
    // pierde en el deploy sin decir nada. Es el modo de falla peor.
    process.env.S3_BUCKET = 'fenix';
    expect(backendActivo()).toBe('disco');
  });
});

describe('la contención no depende del backend', () => {
  // Estos escapan de verdad: `path.resolve` los normaliza fuera de la carpeta.
  const escapes = [
    '../../etc/passwd',
    'fotos-dni/../../../etc/passwd',
    'fotos-dni/u1/../../../../root/.ssh/id_rsa',
  ];

  for (const intento of escapes) {
    it(`no puede escribir en "${intento}"`, async () => {
      await expect(escribir('fotos-dni', intento, Buffer.from('x'))).rejects.toMatchObject({
        code: 'EPATH',
      });
    });

    it(`no puede leer "${intento}"`, async () => {
      // Que la lectura esté contenida importa tanto como la escritura: un
      // `readFile` sin control de raíz sirve cualquier archivo del contenedor.
      await expect(leer('fotos-dni', intento)).rejects.toMatchObject({ code: 'EPATH' });
    });
  }

  it('no puede salir del bucket aunque siga dentro de la raíz', () => {
    // Este es el caso que faltaba. `u1/../../secreto.jpg` resuelve a
    // `<raiz>/secreto.jpg`: dentro de la raíz, pero fuera de `fotos-dni`. Con
    // una comprobación contra la raíz sola, un usuario declara un bucket y el
    // archivo aterriza en otro, y la separación entre `fotos-dni` y el resto
    // deja de existir.
    return expect(
      escribir('fotos-dni', 'u1/../../secreto.jpg', Buffer.from('x'))
    ).rejects.toMatchObject({ code: 'EPATH' });
  });

  it('`....` no escapa: es un nombre de carpeta literal, no `..`', async () => {
    // La versión anterior de este chequeo quitaba `..` con un replace de
    // texto, y `"...."` se convertía en `".."` y escapaba. `path.resolve` no
    // tiene ese problema: `....` es un directorio que se llama así, y queda
    // adentro. Por eso se usa resolve-y-comparar y no manipulate-de-strings.
    await escribir('fotos-dni', '....//dentro.jpg', Buffer.from('x'));
    expect(existsSync(join(raiz, 'fotos-dni', '....', 'dentro.jpg'))).toBe(true);
  });
});

describe('los permisos se siguen aplicando igual', () => {
  it('el chequeo de permisos va antes de leer el archivo', () => {
    // Este es EL test. Si alguien "optimiza" la ruta y lee primero para
    // después decidir, el chequeo llega tarde y la bitácora también.
    const cuerpo = codigo(RUTA);
    const chequeo = cuerpo.indexOf('PUBLIC_READ.has(bucket)');
    const lectura = cuerpo.indexOf('await leer(bucket,');

    expect(chequeo).toBeGreaterThan(-1);
    expect(lectura).toBeGreaterThan(-1);
    expect(chequeo).toBeLessThan(lectura);
  });

  it('la bitácora se escribe antes de leer, no después', () => {
    const cuerpo = codigo(RUTA);
    expect(cuerpo.indexOf('registrarAcceso')).toBeLessThan(cuerpo.indexOf('await leer(bucket,'));

    // Y está anotado por qué: si el log falla igual tiene que haber constancia
    // de que el documento se abrió.
    expect(RUTA).toMatch(/ANTES de leer el archivo/);
  });

  it('la bitácora no se saltó al cambiar de backend', () => {
    // La bitácora es la que responde "quién abrió el DNI de este chico". Si
    // queda atada al backend, el día que se migra a S3 se deja de registrar.
    expect(RUTA).toMatch(/registrarAcceso/);
    expect(BITACORA).toMatch(/export/);
  });

  it('los buckets públicos siguen siendo públicos y los demás no', () => {
    expect(RUTA).toMatch(/fotos-galeria/);
    expect(RUTA).toMatch(/No autenticado/);
    expect(RUTA).toMatch(/Sin permiso sobre este archivo/);
  });
});

describe('no hay atajos por la puerta de atrás', () => {
  it('nada de URLs firmadas', () => {
    // Una URL firmada es un token: va en el `src` del img, en el historial del
    // navegador, en la caché del proxy y en el Referer. Para una foto de
    // galería es un detalle; para el DNI de un menor no.
    const todo = ALMACEN + RUTA + UPLOAD;
    expect(todo).not.toMatch(/getSignedUrl|presign|PresignedUrl/i);
  });

  it('nada de bucket público', () => {
    // Un bucket público en S3 haría accesibles los DNI por URL, sin pasar por
    // el chequeo de rol. Se deja explícito para que nadie lo suba por error.
    expect(ALMACEN).toMatch(/R2_URL|endpoint/i);
    expect(codigo(ALMACEN)).not.toMatch(/ACL\s*:\s*['"]public-read/i);
  });

  it('la URL que devuelve la subida no depende del backend', () => {
    // Por eso migrar no obliga a tocar ninguna fila de la base: la referencia
    // que se guarda es a `/api/files/...`, y esa ruta resuelve contra el
    // backend que esté activo.
    expect(UPLOAD).toMatch(/url: `\/api\/files\//);
    expect(UPLOAD).toMatch(/await escribir\(bucket, cleanPath, buffer\)/);
  });

  it('el S3 se importa solo si está configurado', () => {
    // El paquete pesa y sin credenciales no sirve para nada. Importarlo siempre
    // suma arranque y memoria a cada request que sube una foto.
    expect(ALMACEN).toMatch(/await import\('@aws-sdk\/client-s3'\)/);
  });
});
