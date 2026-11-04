/* Service worker de la PWA de Fenix.
 *
 * Reglas de seguridad:
 *  - Nunca cachea HTML de páginas. El panel y el portal tienen datos de socios
 *    y menores; una copia en el cache del navegador sobrevive al logout.
 *  - Nunca cachea /api/. Los archivos del club se sirven por /api/files.
 *  - Las navegaciones van siempre a la red. Si no hay conexión, muestra una
 *    página offline pública.
 *  - Solo cachea estáticos públicos: chunks de Next, iconos e imágenes.
 *
 * Si se cambia la lista de precache o la lógica, subir VERSION para que los
 * navegadores descarten el cache viejo.
 */
const VERSION = 'fenix-pwa-v1';
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = '/offline.html';

const PRECACHE = [
  OFFLINE_URL,
  '/logo.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('fenix-pwa-') && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: red primero y sin guardar el HTML. Sin conexión, offline.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const offline = await caches.match(OFFLINE_URL);
        return offline || Response.error();
      })
    );
    return;
  }

  // Datos privados y APIs: siempre red, nunca cache.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/socio-')
  ) {
    return;
  }

  const esEstatico =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|png|jpe?g|webp|avif|svg|ico|woff2?)$/i.test(url.pathname);

  if (!esEstatico) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);

      // Stale-while-revalidate: se responde rápido con lo cacheado y se
      // actualiza atrás. Los chunks de Next llevan hash, así que un archivo
      // viejo nunca pisa a uno nuevo con el mismo nombre.
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) void cache.put(request, res.clone());
          return res;
        })
        .catch(() => null);

      return cached || (await network) || Response.error();
    })()
  );
});
