import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { readFile } from 'fs/promises';
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
// El resto (DNI, comprobantes) solo lo ve el dueño de la carpeta o un admin.
const PUBLIC_READ = new Set(['fotos-galeria', 'fotos-perfil', 'comunicados', 'sponsors', 'partidos']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: parts } = await params;
    const clean = parts.map((p) => p.replace(/\.\./g, '')).filter(Boolean);
    if (clean.length < 2) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
    }

    const bucket = clean[0];
    const user = await getCurrentUser(request);

    if (!PUBLIC_READ.has(bucket)) {
      if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
      // La carpeta es el id del dueño del archivo
      if (user.rol !== 'admin' && clean[1] !== user.id) {
        return NextResponse.json({ error: 'Sin permiso sobre este archivo' }, { status: 403 });
      }
    }

    const root = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const filePath = path.join(root, ...clean);

    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    const isInline = ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp' || ext === '.gif' || ext === '.heic' || ext === '.mp4' || ext === '.webm';

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${isInline ? 'inline' : 'attachment'}; filename="${path.basename(filePath)}"`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Error al leer archivo' }, { status: 500 });
  }
}
