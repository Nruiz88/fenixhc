import type { NextRequest } from 'next/server';

/**
 * Origen público de la app, para armar links de email (verificación).
 *
 * Prioridad:
 *  1. APP_URL (explícito, recomendado para producción detrás de proxy)
 *  2. el origin de la request que llega
 *
 * OJO: se llama APP_URL y no NEXT_PUBLIC_APP_URL a propósito. El prefijo
 * NEXT_PUBLIC_ hace que Next.js inlinee el valor en el bundle AL BUILEAR, así
 * que si la variable se agrega después no llegaría al código ya compilado.
 * Acá solo la usa el servidor, no tiene por qué exponerse al cliente.
 */
export function getBaseUrl(request?: NextRequest): string {
  const configured = process.env.APP_URL;
  if (configured) return configured.replace(/\/+$/, '');

  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ||
      (host?.startsWith('localhost') || host?.startsWith('127.0.0.1') ? 'http' : 'https');
    if (host) return `${proto}://${host}`;
  }

  return 'http://localhost:3000';
}
