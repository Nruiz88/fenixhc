import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

// Dónde viven los archivos subidos.
//
// POR QUÉ ESTE MÓDULO EXISTE
//
// La aplicación nunca habla con el disco ni con S3 directamente: habla con acá.
// Hay dos motivos.
//
// El primero es que la lectura y la escritura están en un solo lugar cada una:
// `/api/upload` escribe y `/api/files/[...path]` lee. Antes de este módulo cada
// uno hacía su propio I/O, y el chequeo de contención —que es lo que impide que
// un path del cliente escriba fuera de la carpeta— estaba en el de escritura
// pero no en el de lectura. Dos caminos, dos reglas, una forgotten.
//
// El segundo es que el destino tiene que poder cambiar. Con S3 configurado, los
// archivos van a S3; sin configurar, van a disco. Lo que NO cambia es cómo se
// autorizan: eso vive en la ruta, antes de llamar a este módulo, y se aplica
// igual en los dos casos. Ver el comentario sobre URLs firmadas acá abajo.
//
// EL CAMBIO DE ORIGEN NO ES UN CAMBIO DE URLs
//
// `/api/upload` sigue devolviendo `/api/files/<bucket>/<path>` y `/api/files`
// sigue sirviendo esa URL. Mover los archivos a S3 no obliga a tocar ni una
// fila de la base ni una referencia en el código. Esa es toda la gracia de
// tener el cuello de botella en un solo par de funciones.
//
// POR QUÉ NO URLS FIRMADAS
//
// Se podría, y sería más rápido: el navegador pediría el archivo
// directamente a S3 y Node no participaría. No se hace a propósito.
//
// Una URL firmada ES un token. Termina en el `src` de un `<img>`, en el
// historial del navegador, en la caché del proxy, y en el header `Referer` de
// cualquier salida. Para una foto de galería es un detalle. Para la copia del
// DNI de un menor es cambiar la postura de seguridad de lo más sensible que
// maneja el club, a cambio de RAM.
//
// Y rompe la bitácora: `lib/bitacora.ts` registra el acceso de un tercero a un
// documento ajeno, y lo hace ANTES de leer el archivo. Si el navegador pide
// directo a S3, no hay ningún lugar donde registrarlo.
//
// Que Node haga de proxy cuesta memoria. Que el DNI de un menor quede en un
// historial de navegador cuesta más.
//
// QUÉ ES UN "BUCKET" AQUÍ
//
// La app llama bucket a los prefijos de la línea 9 de `api/upload/route.ts`:
// `fotos-dni`, `fotos-galeria`, y así. Son directorios. El control de acceso de
// cada uno está en el código, en `api/files/[...path]/route.ts`, y es lo que
// decide quién puede leer qué. El bucket de S3 es un detalle de acá para abajo:
// en disco es una carpeta, en S3 es un prefijo de clave, o un bucket propio si
// algún día hace falta aislarlo a nivel físico.

export interface OpcionesAlmacen {
  /** Escribe un archivo dentro de un bucket. */
  escribir(bucket: string, clave: string, buffer: Buffer): Promise<void>;
  /** Lee un archivo de un bucket. Lanza `ENOENT` si no existe, igual que `fs`. */
  leer(bucket: string, clave: string): Promise<Buffer>;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Si hay un backend S3 configurado.
 *
 * Se decide por variables de entorno y no por un flag propio: si el proyecto
 * tiene credenciales, las usa. No hay forma de tener S3 configurado y caer
 * inadvertidamente en disco, que es como se sube el DNI de un menor a un
 * directorio que se pierde en el próximo deploy.
 */
function s3Configurado(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

// El cliente se construye una vez y se reutiliza. Crearlo por request abre una
// conexión TLS nueva cada vez, que es exactamente lo que se paga por usar S3.
let clienteS3: unknown = null;

async function obtenerClienteS3(): Promise<{
  send: (comando: unknown) => Promise<{ Body?: unknown }>;
}> {
  if (clienteS3) return clienteS3 as { send: (c: unknown) => Promise<{ Body?: unknown }> };

  // Import dinámico: `@aws-sdk/client-s3` pesa bastante y solo hace falta si
  // hay S3 configurado. Con el almacenamiento en disco —el caso por defecto—
  // nunca se carga.
  const { S3Client } = await import('@aws-sdk/client-s3');

  clienteS3 = new S3Client({
    region: process.env.S3_REGION || 'auto',
    // R2 y otros compatibles con S3 necesitan el endpoint propio y path style.
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  return clienteS3 as { send: (c: unknown) => Promise<{ Body?: unknown }> };
}

/**
 * Convierte el error "no existe" de S3 al mismo que lanza `fs`.
 *
 * Las rutas de lectura chequean `err.code === 'ENOENT'` para devolver 404 en
 * vez de 500. Si S3 tirara su propio código, un archivo faltante se vería como
 * una caída del servidor: el más común de los errores sería el más difícil de
 * leer.
 */
function comoFsError(err: unknown): never {
  const nombre = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;

  if (nombre === 'NoSuchKey' || nombre === 'NotFound' || nombre === 'ENOENT') {
    const e = new Error('Archivo no encontrado') as NodeJS.ErrnoException;
    e.code = 'ENOENT';
    throw e;
  }

  throw err;
}

async function leerS3(bucket: string, clave: string): Promise<Buffer> {
  const { GetObjectCommand } = await import('@aws-sdk/client-s3');
  const cliente = await obtenerClienteS3();

  let cuerpo: unknown;
  try {
    const r = await cliente.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: `${bucket}/${clave}` })
    );
    cuerpo = r.Body;
  } catch (err) {
    return comoFsError(err);
  }

  if (!cuerpo) return comoFsError({ name: 'NoSuchKey' });

  // El Body es un Readable en Node. Recolectarlo entero es el precio de que
  // Node sea el proxy; está anotado arriba por qué se paga.
  const chunks: Buffer[] = [];
  for await (const chunk of cuerpo as AsyncIterable<Buffer | string>) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

async function escribirS3(bucket: string, clave: string, buffer: Buffer): Promise<void> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const cliente = await obtenerClienteS3();

  await cliente.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: `${bucket}/${clave}`,
      Body: buffer,
      ContentType: mimeDe(clave),
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contención
// ─────────────────────────────────────────────────────────────────────────────

const E_PATH = (): NodeJS.ErrnoException =>
  Object.assign(new Error('Path inválido'), { code: 'EPATH' });

/**
 * El destino en disco, o `null` si se sale del bucket.
 *
 * LA CONTIENCIÓN ES POR BUCKET, NO POR RAÍZ, Y NO ES UN DETALLE
 *
 * `fotos-dni/u1/../../secreto.jpg` resuelve a `<raiz>/secreto.jpg`: dentro de
 * la raíz, pero fuera de `fotos-dni`. Con una comprobación contra la raíz sola,
 * un usuario puede escribir en un bucket y el archivo aterriza en otro, que es
 * justo lo que hace inservible la separación entre `fotos-dni` y el resto.
 *
 * Por eso el bucket va como argumento aparte y se resuelve la base contra
 * `raiz/bucket`, como hacía la versión anterior a este módulo.
 */
function rutaContenida(raiz: string, bucket: string, clave: string): string | null {
  const baseBucket = path.resolve(raiz, bucket);
  const destino = path.resolve(baseBucket, clave);
  return destino.startsWith(baseBucket + path.sep) ? destino : null;
}

/**
 * S3 no normaliza las claves: `a/../b` es literalmente una clave con esos
 * caracteres, no un `b`. Eso no es un agujero —nadie puede escapar del bucket
 * que se le dio— pero sí deja basura con nombres raros.
 *
 * Se rechazan los segmentos de navegación en vez de dejarlos pasar. Es más
 * estricto que el disco y coincide con lo que el route ya acepta: la URL que
 * devuelve `/api/upload` nunca los genera.
 */
function claveValida(bucket: string, clave: string): boolean {
  if (!bucket || bucket.includes('..') || bucket.includes('/')) return false;
  if (!clave) return false;

  return clave.split('/').every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export function raizPorDefecto(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
}

/** Qué backend está activo. Para mostrarlo en un diagnóstico, no para decidir. */
export function backendActivo(): 's3' | 'disco' {
  return s3Configurado() ? 's3' : 'disco';
}

export async function escribir(bucket: string, clave: string, buffer: Buffer): Promise<void> {
  if (s3Configurado()) {
    if (!claveValida(bucket, clave)) throw E_PATH();
    await escribirS3(bucket, clave, buffer);
    return;
  }

  const destino = rutaContenida(raizPorDefecto(), bucket, clave);
  if (!destino) throw E_PATH();

  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, buffer);
}

export async function leer(bucket: string, clave: string): Promise<Buffer> {
  if (s3Configurado()) {
    if (!claveValida(bucket, clave)) throw E_PATH();
    return leerS3(bucket, clave);
  }

  const destino = rutaContenida(raizPorDefecto(), bucket, clave);
  if (!destino) throw E_PATH();

  return readFile(destino);
}

function mimeDe(clave: string): string {
  const ext = path.extname(clave).toLowerCase();
  const tabla: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
  };
  return tabla[ext] || 'application/octet-stream';
}
