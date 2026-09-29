import type { NextRequest } from 'next/server';

/**
 * Origen público de la app, para armar links de email (verificación).
 *
 * Prioridad:
 *  1. NEXT_PUBLIC_APP_URL (explícito, recomendado para producción detrás de proxy)
 *  2. el origin de la request que llega
 *
 * En Coolify/Traefik el origin de la request puede ser el interno, por eso
 * conviene setear NEXT_PUBLIC_APP_URL en producción.
 */
export function getBaseUrl(request?: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
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
