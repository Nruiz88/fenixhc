import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { esDirectiva as esDirectivaRol } from '@/lib/roles';
import { registrarAcceso, tipoDeBucket } from '@/lib/bitacora';
import { leer } from '@/lib/almacen';
import path from 'path';

export const runtime = 'nodejs';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

// Buckets visibles sin sesión (imágenes de las páginas públicas).
const PUBLIC_READ = new Set(['fotos-galeria', 'fotos-perfil', 'comunicados', 'sponsors', 'partidos']);

// Buckets que también puede leer la directiva, no solo el dueño de la carpeta.
//
// Sin esto, `/admin/pagos` le mostraba el botón "Ver comprobante" al tesorero y
// al-click le daba 403: el chequeo era `user.rol !== 'admin'`, así que un
// tesorero solo podía ver los comprobantes de su propia carpeta. El flujo
// principal del club —aprobar un pago con comprobante— quedaba roto para
// todos los cargos menos admin.
//
// Los DNI no están acá a propósito: verlos es tarea de la directiva, y el
// bucket se llama 'fotos-dni'. Si alguna vez hace falta limitarlos por rol,
// el chequeo va por módulo, no con una lista de cargos sueltos.
const DIRECTIVA_READ = new Set(['fotos-dni', 'comprobantes']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: parts } = await params;

    // Path traversal: la clave se arma con los segmentos de la URL y se valida
    // adentro de lib/almacen. La versión anterior quitaba la cadena ".." con un
    // replace, que es frágil: "...." se convierte en ".." y vuelve a escapar.
    // Resolver y comparar no depende de qué haya escrito en el path.
    const relativo = parts.filter(Boolean).join('/');

    // El bucket es el primer segmento y tiene que haber un segundo: sin dueño
    // no hay a quién preguntarle si puede verlo.
    const segmentos = relativo.split('/').filter(Boolean);
    if (segmentos.length < 2) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
    }

    const bucket = segmentos[0];
    const user = await getCurrentUser(request);

    if (!PUBLIC_READ.has(bucket)) {
      if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
      // La segunda carpeta es el id del dueño del archivo.
      const esDueño = segmentos[1] === user.id;
      const esDirectiva = DIRECTIVA_READ.has(bucket) && esDirectivaRol(user.rol);
      if (!esDueño && !esDirectiva) {
        return NextResponse.json({ error: 'Sin permiso sobre este archivo' }, { status: 403 });
      }

      // Bitácora: el acceso de un tercero a un documento ajeno queda
      // registrado. Ver lib/bitacora.ts. Se hace ANTES de leer el archivo,
      // porque si alguien abre un documento y el log falla, igual tiene que
      // haber constancia de que se abrió.
      const tipo = tipoDeBucket(bucket);
      if (tipo && !esDueño) {
        await registrarAcceso(request, {
          usuarioId: user.id,
          perfilDestinoId: segmentos[1],
          tipo,
          proposito: request.nextUrl.searchParams.get('motivo') ?? undefined,
        });
      }
    }

    // Todo lo de arriba —permisos y bitácora— va antes de leer, y es igual
    // con disco que con S3. Que Node sea el que lee, y no el navegador con una
    // URL firmada, es lo que permite que el chequeo siga siendo el mismo.
    let data: Buffer;
    try {
      data = await leer(bucket, segmentos.slice(1).join('/'));
    } catch (err: any) {
      if (err?.code === 'ENOENT' || err?.code === 'EISDIR') {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
      }
      if (err?.code === 'EPATH') {
        return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
      }
      throw err;
    }

    const ext = path.extname(relativo).toLowerCase();

    const isInline = ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp' || ext === '.gif' || ext === '.heic' || ext === '.mp4' || ext === '.webm';

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${path.basename(relativo)}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT' || err?.code === 'EISDIR') {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Error al leer archivo' }, { status: 500 });
  }
}
