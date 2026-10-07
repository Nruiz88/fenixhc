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
 * @param key    identificador único (ej: "login:1.2.3.4" o "login:socio@ejemplo.com")
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

/**
 * IP real del cliente.
 *
 * LA CADENA DE PROXIES
 *
 * En producción la petición llega así:
 *
 *   Persona → Cloudflare → Traefik (Coolify) → Next
 *
 * Cada proxy AGREGA su cadena en `X-Forwarded-For` y, al hacerlo, lo hace al
 * FINAL. Entonces la ÚLTIMA posición es la de la persona; la primera es la del
 * proxy más externo, o sea Cloudflare.
 *
 * La versión anterior tomaba `fwd.split(',')[0]`, o sea la primera. Con el
 * sitio detrás de Cloudflare eso devolvía `172.70.215.49` — una IP de
 * Cloudflare — para absolutamente todas las peticiones.
 *
 * POR QUÉ ESO NO ERA COSMÉTICO
 *
 * Dos cosas dependían de esta dirección y quedaban anuladas:
 *
 *  - `usuarios.reset_solicitado_ip`: con siempre la misma IP, la señal de "el
 *    token salió de otro lado" nunca se disparaba.
 *  - Los rate limits por IP del registro y del login: agrupaban a todo el
 *    mundo en un mismo cubo, así que cinco pedidos de toda la ciudad cuentan
 *    como uno.
 *
 * `CF-Connecting-IP` va primero porque es el header que Cloudflare pone con la
 * IP original del cliente y no lo reescribe nadie en la cadena. Es válido
 * mientras Cloudflare esté adelante; si algún día se saca del medio, ese header
 * deja de llegar y el código sigue funcionando por la rama siguiente.
 */
export function clientIp(request: NextRequest): string {
  // Cloudflare: la IP original, tal como la vio en el borde.
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) {
    const ip = normalizarIp(cf);
    if (ip) return ip;
  }

  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) {
    // LA ÚLTIMA, no la primera. Ver arriba.
    const partes = fwd.split(',').map((p) => p.trim()).filter(Boolean);
    for (let i = partes.length - 1; i >= 0; i--) {
      const ip = normalizarIp(partes[i]);
      if (ip) return ip;
    }
  }

  const real = request.headers.get('x-real-ip');
  if (real) {
    const ip = normalizarIp(real);
    if (ip) return ip;
  }

  // Sin headers de proxy (dev local, tests): NO usar una constante compartida,
  // porque agruparía a todos los clientes en un mismo bucket de rate-limit.
  // Se usa un identificador por sesión/usuario como aproximación.
  return `local:${request.cookies.get('fenix_token')?.value?.slice(-16) ?? 'anon'}`;
}

/**
 * Normaliza una IP y descarta las que no lo son.
 *
 * Sin esto, un `X-Forwarded-For: desconocido` se guardaba tal cual en
 * `reset_solicitado_ip`, y un header manipulable servía para escribir basura en
 * una columna que sirve para detectarognition de abuso.
 *
 * Acepta IPv4 e IPv6 sin hacer la comprobación profunda de IPv6: se busca que
 * tenga forma de dirección y no que sea una dirección válida al 100%. Una IPv6
 * comprimida trae `%`, `_` y zona, y `:` de sobra; exigir más rechazaría IPs
 * legítimas.
 */
function normalizarIp(valor: string): string | null {
  const ip = valor.trim();
  if (!ip || ip.length > 45) return null; // 45 = largo de una IPv6 con zona

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const octetos = ip.split('.').map(Number);
    return octetos.every((o) => o >= 0 && o <= 255) ? ip : null;
  }

  // IPv6: tiene que traer al menos dos grupos y nada fuera de lo hexaédrico.
  if (ip.includes(':') && /^[0-9a-fA-F:.%_]+$/.test(ip) && (ip.match(/:/g) ?? []).length >= 2) {
    return ip;
  }

  return null;
}
