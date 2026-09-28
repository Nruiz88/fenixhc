import type { NextRequest } from 'next/server';

// Rate limiter en memoria (por instancia). Suficiente para frenar fuerza bruta;
// si escalamos a varias réplicas habría que moverlo a Redis.
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;

function cleanup(now: number) {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Si sigue lleno, borra los más viejos
  if (buckets.size >= MAX_BUCKETS) {
    const extra = buckets.size - MAX_BUCKETS + 1;
    let i = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++i >= extra) break;
    }
  }
}

/**
 * Devuelve true si la petición está permitida, false si superó el límite.
 * @param key    identificador único (ej: "login:1.2.3.4" o "login:admin@club.com")
 * @param limit  cantidad máxima de intentos en la ventana
 * @param windowMs duración de la ventana en ms
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  cleanup(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

// IP del cliente (Coolify/Traefik pone X-Forwarded-For)
export function clientIp(request: NextRequest): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
