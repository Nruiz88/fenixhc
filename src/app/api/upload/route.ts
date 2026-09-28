import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const ALLOWED_BUCKETS = ['fotos-perfil', 'fotos-dni', 'comprobantes', 'fotos-galeria', 'chat-archivos', 'comunicados', 'sponsors', 'partidos'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

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

    // Normalize path: no traversal, no leading slashes
    const cleanPath = pathField.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\./g, '');
    if (!cleanPath) {
      return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 10MB)' }, { status: 413 });
    }

    const root = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    const buffer = Buffer.from(await file.arrayBuffer());
    const targetDir = path.join(root, bucket, path.dirname(cleanPath));
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(root, bucket, cleanPath), buffer);

    return NextResponse.json({ url: `/api/files/${bucket}/${cleanPath}` });
  } catch (err: any) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: err.message || 'Error al subir archivo' }, { status: 500 });
  }
}
