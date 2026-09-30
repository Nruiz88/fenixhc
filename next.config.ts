import type { NextConfig } from "next";

// Cabeceras de seguridad.
//
// La que de verdad importa acá es `frame-ancestors 'none'`: sin ella, un
// sitio externo puede embeber el panel en un iframe y dibujar encima un
// panel falso. El admin hace clic creyendo que está en la pantalla de
// confirmación de un pago y en realidad está confirmando otra cosa. Con un
// panel donde se mueven plata, eso no es teórico.
//
// La CSP lleva 'unsafe-inline' porque Next hidrata con scripts en línea y no
// usa nonces: pasarla a strict sin nonces rompe la app. Igual se saca
// 'unsafe-eval', que no hace falta en producción y solo sirve para que un XSS
// ejecute código arbitrario.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Next carga estilos en línea por el CSS-in-JS y las variables de tema.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Anti-clickjacking y anti-exfiltración de URLs con parámetros.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Solo en producción: en local el server es http y el navegador rechazaría.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  // El límite de cuerpo lo maneja /api/upload, que acepta hasta 10 MB.
  serverExternalPackages: ['bcryptjs'],
};

export default nextConfig;
