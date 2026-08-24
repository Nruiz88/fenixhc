import { createClient } from '@/lib/supabase/client';

export async function uploadFile(
  bucket: string,
  path: string,
  file: File
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
  });
  if (error) {
    console.error('Upload error:', error);
    return null;
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
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
