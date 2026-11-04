'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker de la PWA.
 *
 * Solo en producción: en desarrollo un service worker cacheando chunks hace
 * que los cambios no se vean hasta cerrar todos los contextos del navegador.
 *
 * No se registra nada si el navegador no lo soporta. El manifest y los iconos
 * alcanzan para que el sitio sea instalable; el service worker agrega el
 * arranque offline con una página pública, sin cachear HTML autenticado.
 */
export function RegistrarPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelado = false;

    const registrar = () => {
      if (cancelado) return;
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch((err) => {
          // No romper la app si el navegador rechaza el registro (por ejemplo,
          // modo privado o una política del dispositivo).
          console.warn('No se pudo registrar el service worker:', err);
        });
    };

    if (document.readyState === 'complete') {
      registrar();
    } else {
      window.addEventListener('load', registrar, { once: true });
    }

    return () => {
      cancelado = true;
      window.removeEventListener('load', registrar);
    };
  }, []);

  return null;
}
