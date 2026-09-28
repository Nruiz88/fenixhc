// File upload helpers - uploads through our own API (local disk storage)

async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('path', path);

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

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  return uploadFile('fotos-perfil', `${userId}/avatar.${ext}`, file);
}

export async function uploadDni(userId: string, file: File, side: 'frente' | 'fondo'): Promise<string | null> {
  const ext = file.name.split('.').pop();
  return uploadFile('fotos-dni', `${userId}/dni-${side}.${ext}`, file);
}

export async function uploadComprobante(cuotaId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  return uploadFile('comprobantes', `${cuotaId}/comprobante.${ext}`, file);
}

export async function uploadGaleria(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const ts = Date.now();
  return uploadFile('fotos-galeria', `${userId}/${ts}.${ext}`, file);
}

export async function uploadChatFile(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const ts = Date.now();
  return uploadFile('chat-archivos', `${userId}/${ts}.${ext}`, file);
}
