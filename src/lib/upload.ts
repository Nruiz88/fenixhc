// File upload helpers - uploads through our own API (local disk storage)
// Todos los archivos quedan en /api/files/<bucket>/<uid-del-duenio>/<archivo>:
// el server valida que la primera carpeta sea el usuario autenticado.

import { getCurrentUser } from '@/lib/auth-client';

async function uploadFile(
  bucket: string,
  subPath: string,
  file: File
): Promise<string | null> {
  try {
    const me = await getCurrentUser();
    if (!me) {
      console.error('Upload error: no autenticado');
      return null;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', `${me.id}/${subPath}`);

    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('Upload error:', json.error);
      return null;
    }
    return json.url;
  } catch (err) {
    console.error('Upload error:', err);
    return null;
  }
}

export async function uploadAvatar(_userId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  return uploadFile('fotos-perfil', `avatar.${ext}`, file);
}

export async function uploadDni(_userId: string, file: File, side: 'frente' | 'fondo'): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  return uploadFile('fotos-dni', `dni-${side}.${ext}`, file);
}

export async function uploadComprobante(cuotaId: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  return uploadFile('comprobantes', `${cuotaId}/comprobante.${ext}`, file);
}

export async function uploadGaleria(_origen: string, file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const ts = Date.now();
  return uploadFile('fotos-galeria', `${ts}.${ext}`, file);
}
