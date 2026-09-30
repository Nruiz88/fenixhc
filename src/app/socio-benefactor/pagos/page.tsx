'use client';

import { useState, useEffect, useMemo } from 'react';
import { udb } from '@/lib/userQuery';
import { uploadComprobante } from '@/lib/upload';
import { money, mesNombre, fecha, periodo as fmtPeriodo } from '@/lib/format';
import { useConfigCuotas } from '@/lib/useConfigCuotas';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Hint } from '@/components/admin/ui';
import { DesgloseCuota, PillRecargo } from '@/components/admin/cuota';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, ExternalLink, CheckCircle2, Clock, DollarSign, CalendarClock } from 'lucide-react';

export default function SocioBenefactorPagos() {
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const { calcular, config } = useConfigCuotas();

  async function cargar() {
    setCargando(true);
    const { data } = await udb.view<any>('padre_cuotas');
    setCuotas(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  async function subir(cuotaId: string, file: File) {
    setSubiendo(cuotaId);
    const url = await uploadComprobante(cuotaId, file);
    if (url) {
      await udb.update('cuotas', { comprobante_url: url, metodo_pago: 'transferencia' }, { id: cuotaId });
      toast.success('Comprobante subido', { description: 'La tesorería lo revisa y te avisa si está todo bien.' });
      await cargar();
    }
    setSubiendo(null);
  }

  const { pagadas, pendientes } = useMemo(() => {
    const ordenadas = [...cuotas].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
    return {
      pagadas: ordenadas.filter((c) => c.estado === 'pagada'),
      pendientes: ordenadas.filter((c) => c.estado === 'pendiente'),
    };
  }, [cuotas]);

  // Lo que hay que pagar hoy, con el recargo de cada cuota. Se recalcula
  // cuando llega la configuración: sin los porcentajes cargados no hay
  // recargo y se muestra el monto base.
  const totalPendiente = pendientes.reduce(
    (s, c) => s + calcular(Number(c.monto), Number(c.mes), Number(c.anio), c.vencimiento_override).total,
    0
  );
  const recargoTotal = pendientes.reduce(
    (s, c) => {
      const r = calcular(Number(c.monto), Number(c.mes), Number(c.anio), c.vencimiento_override);
      return s + (r.total - Number(c.monto));
    },
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis cuotas"
        description="Tu historial de pagos y lo que tenés que pagar este mes."
      />

      {/* Reglas de recargo a la vista, no escondidas. */}
      {config && config.vencimientos.length > 0 && (
        <Panel
          title="Cómo se calcula el recargo"
          description="Si pagás antes de la fecha, no hay recargo."
          className="bg-surface-2"
        >
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2 text-muted">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
              Hasta el día {config.vencimientos[0]?.dia} del mes siguiente: sin recargo.
            </li>
            {config.vencimientos.map((v) => (
              <li key={v.dia} className="flex items-center gap-2 text-muted">
                <Clock className="h-4 w-4 shrink-0 text-warn" />
                Después del día {v.dia}: se suma un{' '}
                <strong className="text-warn">{v.porcentaje}%</strong> sobre el valor de la cuota.
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Cuotas" value={cuotas.length} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard label="Pagadas" value={pagadas.length} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard
          label="Pendiente"
          value={money(totalPendiente)}
          hint={recargoTotal > 0 ? `Incluye ${money(recargoTotal)} de recargo` : 'Sin recargo'}
          tone={recargoTotal > 0 ? 'warn' : 'neutral'}
          icon={<CalendarClock className="h-4 w-4" />}
        />
      </div>

      {pendientes.length > 0 && (
        <Hint>
          Subí el comprobante de cada cuota pendiente. La tesorería lo revisa y
          te avisa si el importe coincide.
        </Hint>
      )}

      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : cuotas.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<DollarSign className="h-6 w-6" />}
            title="Todavía no tenés cuotas cargadas"
            description="Cuando la tesorería emita tu cuota del mes, la vas a ver acá con el importe a pagar."
          />
        </Panel>
      ) : (
        <div className="space-y-3">
          {pendientes.map((c) => {
            const hijo = c.familias?.hijo;
            const r = calcular(Number(c.monto), Number(c.mes), Number(c.anio), c.vencimiento_override);
            return (
              <article key={c.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          c.comprobante_url
                            ? 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info'
                            : 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warn/10 text-warn'
                        }
                      >
                        <Clock className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-main">
                          Cuota de {fmtPeriodo(c.mes, c.anio)}
                        </p>
                        {hijo && (
                          <p className="truncate text-xs text-dim">{hijo.nombre} {hijo.apellido}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PillRecargo porcentaje={r.porcentaje} />
                    {c.comprobante_url ? (
                      <Button variant="ghost" size="sm" render={<a href={c.comprobante_url} target="_blank" rel="noopener noreferrer" />}>
                        <ExternalLink className="h-4 w-4" />Ver mi comprobante
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={subiendo === c.id}
                        onClick={() => document.getElementById(`file-${c.id}`)?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        {subiendo === c.id ? 'Subiendo…' : 'Subir comprobante'}
                      </Button>
                    )}
                    <input
                      id={`file-${c.id}`}
                      type="file"
                      accept="image/*,.pdf"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) subir(c.id, f);
                        // Se limpia para poder volver a elegir el mismo archivo
                        // si el primer intento falló.
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>

                <div className="mt-3 max-w-md">
                  <DesgloseCuota
                    montoBase={r.montoBase}
                    porcentaje={r.porcentaje}
                    recargo={r.recargo}
                    total={r.total}
                    diasVencida={r.diasVencida}
                    fechaHito={r.fechaHito}
                    diasParaProximo={r.diasParaProximo}
                  />
                </div>

                {c.comprobante_url && (
                  <p className="mt-2 text-xs text-dim">
                    Comprobante enviado. Queda pendiente de aprobación de tesorería.
                  </p>
                )}
              </article>
            );
          })}

          {pagadas.length > 0 && (
            <Panel title="Cuotas pagadas" description={`${pagadas.length} períodos`} className="mt-6">
              <ul className="divide-y divide-line">
                {pagadas.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-main">
                        {mesNombre(c.mes)} {c.anio}
                      </p>
                      <p className="text-xs text-dim">
                        Pagada el {fecha(c.fecha_pago)}
                        {c.metodo_pago ? ` · ${c.metodo_pago}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Si pagó con recargo, se muestra lo que entró de verdad
                          y no el monto base: es lo que figura en su recibo. */}
                      <span className="text-sm font-semibold tabular text-main">
                        {money(Number(c.monto_pagado) > 0 ? Number(c.monto_pagado) : Number(c.monto))}
                      </span>
                      <StatusPill tone="ok">Pagada</StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
