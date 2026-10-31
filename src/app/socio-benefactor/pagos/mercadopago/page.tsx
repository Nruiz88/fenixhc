'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Panel, StatusPill, Hint, type StatusTone } from '@/components/admin/ui';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Loader2, ArrowLeft } from 'lucide-react';

// Vuelta del checkout de MercadoPago.
//
// No se confía en el `status` de la URL: se manda el `payment_id` a la API y
// el servidor consulta el pago real. La pantalla solo muestra el resultado.
//
// Se lee `window.location.search` en un efecto y no con useSearchParams para
// no necesitar un Suspense boundary: esta página es 100 % cliente y no
// prerenderiza datos.

type Estado =
  | 'cargando'
  | 'aprobado'
  | 'pendiente'
  | 'revision'
  | 'rechazado'
  | 'error';

const ESTILO: Record<Estado, { tone: StatusTone; titulo: string; icono: typeof CheckCircle2 }> = {
  cargando: { tone: 'info', titulo: 'Confirmando el pago', icono: Loader2 },
  aprobado: { tone: 'ok', titulo: 'Pago acreditado', icono: CheckCircle2 },
  pendiente: { tone: 'warn', titulo: 'Pago pendiente', icono: Clock },
  revision: { tone: 'warn', titulo: 'Pago en revisión', icono: AlertTriangle },
  rechazado: { tone: 'danger', titulo: 'El pago no se completó', icono: XCircle },
  error: { tone: 'danger', titulo: 'No pudimos confirmar el pago', icono: AlertTriangle },
};

export default function ResultadoPagoMercadoPago() {
  const [estado, setEstado] = useState<Estado>('cargando');
  const [mensaje, setMensaje] = useState('Estamos consultando el pago a MercadoPago…');

  useEffect(() => {
    let vigente = true;

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const paymentId = params.get('payment_id') ?? params.get('collection_id');
      const resultado = params.get('resultado') ?? params.get('status') ?? params.get('collection_status');

      if (!paymentId) {
        if (!vigente) return;
        if (resultado === 'fallo' || resultado === 'rejected') {
          setEstado('rechazado');
          setMensaje('MercadoPago rechazó o canceló el pago. Podés intentar de nuevo desde “Mis cuotas”.');
        } else if (resultado === 'pendiente' || resultado === 'pending' || resultado === 'in_process') {
          setEstado('pendiente');
          setMensaje('MercadoPago todavía está procesando el pago. Cuando se acredite, la cuota se va a marcar sola.');
        } else {
          setEstado('error');
          setMensaje('No encontramos el identificador del pago. Revisá “Mis cuotas” para ver si quedó registrado.');
        }
        return;
      }

      try {
        const res = await fetch('/api/user/mercadopago/confirmar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        });
        const json = await res.json();
        if (!vigente) return;

        if (!res.ok) {
          setEstado('error');
          setMensaje(json.error || 'No pudimos consultar el pago.');
          return;
        }

        const data = json.data;
        const estados: Record<string, Estado> = {
          aprobado: 'aprobado',
          pendiente: 'pendiente',
          en_proceso: 'pendiente',
          autorizado: 'pendiente',
          revision: 'revision',
          rechazado: 'rechazado',
          cancelado: 'rechazado',
          reembolsado: 'revision',
          contracargo: 'revision',
          en_mediacion: 'revision',
        };
        setEstado(estados[data.estado] ?? 'revision');
        setMensaje(data.mensaje || 'El pago fue registrado.');
      } catch {
        if (!vigente) return;
        setEstado('error');
        setMensaje('Hubo un problema de conexión al confirmar el pago. Si el dinero salió de tu cuenta, escribinos: el cobro queda registrado igual.');
      }
    })();

    return () => { vigente = false; };
  }, []);

  const estilo = ESTILO[estado];
  const Icono = estilo.icono;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <Panel>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span
            className={
              estado === 'aprobado'
                ? 'grid h-14 w-14 place-items-center rounded-full bg-ok/10 text-ok'
                : estado === 'cargando'
                  ? 'grid h-14 w-14 place-items-center rounded-full bg-info/10 text-info'
                  : estado === 'pendiente' || estado === 'revision'
                    ? 'grid h-14 w-14 place-items-center rounded-full bg-warn/10 text-warn'
                    : 'grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger'
            }
          >
            <Icono className={estado === 'cargando' ? 'h-7 w-7 animate-spin' : 'h-7 w-7'} />
          </span>

          <div>
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-lg font-semibold text-main">{estilo.titulo}</h1>
              {estado !== 'cargando' && <StatusPill tone={estilo.tone}>{estado}</StatusPill>}
            </div>
            <p className="mt-1 max-w-md text-sm text-muted">{mensaje}</p>
          </div>

          {estado === 'cargando' ? (
            <p className="text-xs text-dim">No cierres esta ventana.</p>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button render={<Link href="/socio-benefactor/pagos" />}>
                <ArrowLeft className="h-4 w-4" />Volver a mis cuotas
              </Button>
            </div>
          )}
        </div>
      </Panel>

      {(estado === 'pendiente' || estado === 'revision') && (
        <Hint tone="warn">
          Si el pago se acredita más tarde, la cuota se va a marcar sola. Si
          necesitás resolverlo ahora, escribile a tesorería con el número de
          operación de MercadoPago.
        </Hint>
      )}
    </div>
  );
}
