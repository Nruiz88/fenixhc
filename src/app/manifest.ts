import type { MetadataRoute } from 'next';

// Manifiesto de la PWA.
//
// Next lo publica en /manifest.webmanifest. Con el manifiesto, los iconos y un
// service worker, el navegador ofrece "Instalar app" o "Agregar a pantalla de
// inicio". En iPhone se hace desde Safari → Compartir → Agregar a pantalla de
// inicio; iOS no usa el prompt automático de Chrome.

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Fenix Roller Hockey',
    short_name: 'Fenix Hockey',
    description:
      'Club de hockey sobre patines en línea en Neuquén: cuotas, jugadores, reservas y comunicación con las familias.',
    lang: 'es-AR',
    dir: 'ltr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    categories: ['sports', 'education'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Mis cuotas',
        short_name: 'Cuotas',
        description: 'Ver y pagar las cuotas pendientes',
        url: '/socio-benefactor/pagos',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Contacto',
        short_name: 'Contacto',
        description: 'Escribirle al club',
        url: '/contacto',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
      },
    ],
  };
}
