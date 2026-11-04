'use client';

import { useEffect, useState } from 'react';
import { Download, Share, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Botón "Instalar app" de la home.
 *
 * - Android/Chrome/Edge: usa el evento `beforeinstallprompt`. El navegador lo
 *   emite cuando la PWA cumple los requisitos; hasta entonces no se muestra el
 *   botón, para no prometer una instalación que el navegador no ofrece.
 * - iPhone/iPad: Safari no tiene prompt automático, así que el botón abre las
 *   instrucciones de "Compartir → Agregar a pantalla de inicio".
 * - Si ya está instalada (se abre en modo standalone), no se muestra.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS moderno se identifica como Macintosh; se detecta por touch.
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function esAndroid(): boolean {
  return typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
}

function estaInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

export function BotonInstalarPwa() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [android, setAndroid] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [ayuda, setAyuda] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    let vigente = true;

    const alPoderInstalar = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const alInstalar = () => {
      setInstalada(true);
      setPromptEvent(null);
      setAyuda(null);
    };

    window.addEventListener('beforeinstallprompt', alPoderInstalar);
    window.addEventListener('appinstalled', alInstalar);

    // La detección inicial va en un microtask: así el primer render del
    // servidor y el del cliente coinciden y no se setea estado en el cuerpo
    // del efecto (evita un render en cascada).
    Promise.resolve().then(() => {
      if (!vigente) return;
      if (estaInstalada()) {
        setInstalada(true);
        return;
      }
      setIos(esIOS());
      setAndroid(esAndroid());
    });

    return () => {
      vigente = false;
      window.removeEventListener('beforeinstallprompt', alPoderInstalar);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  async function instalar() {
    if (promptEvent) {
      await promptEvent.prompt();
      const eleccion = await promptEvent.userChoice;
      if (eleccion.outcome === 'accepted') setInstalada(true);
      setPromptEvent(null);
      return;
    }

    if (ios) setAyuda('ios');
    else if (android) setAyuda('android');
  }

  const visible = !instalada && (!!promptEvent || ios || android);
  if (!visible) return null;

  const esAyudaIOS = ayuda === 'ios';

  return (
    <>
      <Button
        size="lg"
        variant="outline"
        onClick={instalar}
        className="border-white/20 text-white hover:bg-white/5 font-semibold px-8 h-14 text-base gap-2"
      >
        {ios || android ? <Smartphone className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        Instalar app
      </Button>

      <Dialog open={ayuda !== null} onOpenChange={(abierto) => !abierto && setAyuda(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {esAyudaIOS ? 'Instalar Fenix en tu iPhone' : 'Instalar Fenix en tu Android'}
            </DialogTitle>
            <DialogDescription>
              {esAyudaIOS
                ? 'Safari no muestra el botón automático, pero se agrega en dos pasos:'
                : 'Si el navegador no mostró el cartel automático, se agrega desde el menú:'}
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3 text-sm text-muted">
            {esAyudaIOS ? (
              <>
                <li className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                    <Share className="h-4 w-4" />
                  </span>
                  <span>
                    Tocá el botón <strong className="text-main">Compartir</strong>{' '}
                    (el cuadrado con la flecha) en la barra de Safari.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                    2
                  </span>
                  <span>
                    Elegí <strong className="text-main">Agregar a pantalla de inicio</strong>{' '}
                    y confirmá con <strong className="text-main">Agregar</strong>.
                  </span>
                </li>
              </>
            ) : (
              <>
                <li className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                    1
                  </span>
                  <span>
                    Abrí el menú <strong className="text-main">⋮</strong> del navegador
                    (arriba a la derecha).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                    2
                  </span>
                  <span>
                    Elegí <strong className="text-main">Instalar app</strong> o{' '}
                    <strong className="text-main">Agregar a pantalla principal</strong>.
                  </span>
                </li>
              </>
            )}
          </ol>

          <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
            <Button onClick={() => setAyuda(null)}>Entendido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
