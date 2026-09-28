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
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.heic': 'image/heic',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { path: parts } = await params;
    const clean = parts.map((p) => p.replace(/\.\./g, '')).filter(Boolean);
    if (clean.length < 2) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
    }

    const root = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const filePath = path.join(root, ...clean);

    const data = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Error al leer archivo' }, { status: 500 });
  }
}
