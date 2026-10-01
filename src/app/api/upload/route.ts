import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { escribir } from '@/lib/almacen';
import path from 'path';

export const runtime = 'nodejs';

const ALLOWED_BUCKETS = ['fotos-perfil', 'fotos-dni', 'comprobantes', 'fotos-galeria', 'comunicados', 'sponsors', 'partidos'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// Cuántos archivos por hora y por usuario. Sin esto, una cuenta —o la que sea
// que loguee alguien con un rol de gestión— puede llenar el disco del servidor
// subiendo archivos de 10 MB en bucle.
const MAX_SUBIDAS_POR_HORA = 60;

// Whitelist de tipos: nada de .svg/.html/.js que podrían ejecutarse en el mismo origen
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'mp4', 'webm', 'mov', 'pdf']);

// El MIME lo manda el cliente y por lo tanto no significa nada: un `.jpg` con
// `Content-Type: text/html` se sirve igual. Lo que evita que el navegador
// ejecute lo que sube es la extensión de la whitelist, el `X-Content-Type-
// Options: nosniff` y el sandbox de /api/files.

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    if (!rateLimit(`upload:${user.id}`, MAX_SUBIDAS_POR_HORA, 3_600_000)) {
      return NextResponse.json(
        { error: 'Subiste demasiados archivos. Probá de nuevo en un rato.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const bucket = formData.get('bucket') as string;
    const pathField = formData.get('path') as string;

    if (!file || !bucket || !pathField) {
      return NextResponse.json({ error: 'Faltan archivo, bucket o path' }, { status: 400 });
    }

    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: 'Bucket no permitido' }, { status: 400 });
    }

    // Normalizar path. El `includes('/../')` de la versión anterior nunca podía
    // dar true: el replace de arriba ya se había llevado todos los "..". La
    // comprobación real es la de contención, más abajo.
    const cleanPath = pathField.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
    }

    // Tipo de archivo permitido (extensión + MIME)
    const ext = (cleanPath.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 415 });
    }
    const mime = file.type || '';
    if (!(mime.startsWith('image/') || mime.startsWith('video/') || mime === 'application/pdf')) {
      return NextResponse.json({ error: 'MIME no permitido' }, { status: 415 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 413 });
    }

    // La primera carpeta es el id del dueño: solo ahí se puede escribir
    const ownerFolder = cleanPath.split('/')[0];
    if (user.rol !== 'admin' && ownerFolder !== user.id) {
      return NextResponse.json({ error: 'Solo podés subir archivos en tu carpeta' }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // El destino —disco o S3— lo decide lib/almacen, no esta ruta. Acá solo se
    // le pasa la clave. La contención del path se hace adentro, junto con la
    // escritura, para que no puedan quedar separadas: si el chequeo viviera acá
    // y la escritura en el otro lado, un bucket nuevo podría saltárselo.
    try {
      await escribir(bucket, cleanPath, buffer);
    } catch (err: any) {
      if (err?.code === 'EPATH') {
        return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
      }
      throw err;
    }

    // La URL no depende del backend. Con S3 o con disco se devuelve la misma, y
    // `/api/files` la resuelve contra el que esté activo. Por eso migrar el
    // almacenamiento no obliga a tocar ninguna fila de la base.
    return NextResponse.json({ url: `/api/files/${bucket}/${cleanPath}` });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Error al subir archivo' }, { status: 500 });
  }
}
