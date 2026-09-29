'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { money, percent, fecha, mesNombre, periodo as fmtPeriodo } from '@/lib/format';

// ============================================================
// Gráficos contables.
//
// Van en SVG a mano en vez de sumar una librería de charts por tres
// gráficos. Motivo: estas pantallas se usan en la oficina con conexiones
// lentas y con notebooks viejos; el bundle de una librería de charts
// pesa más que todo lo que dibujan estos tres gráficos juntos, y SVG
// nativo se ve nítido en cualquier densidad de pantalla.
// ============================================================

/** Color estable por categoría, para que un color siempre signifique lo mismo. */
const PALETA = [
  '#dc2626', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#14b8a6', '#ec4899', '#f97316', '#6366f1', '#84cc16',
];

export function colorDe(indice: number): string {
  return PALETA[indice % PALETA.length];
}

/** Barra horizontal: composición de ingresos o egresos por categoría. */
export function BarrasComposicion({
  datos,
  vacio = 'Sin movimientos en el período',
}: {
  datos: { etiqueta: string; valor: number; porcentaje: number }[];
  vacio?: string;
}) {
  if (!datos.length) {
    return <p className="py-8 text-center text-sm text-dim">{vacio}</p>;
  }

  return (
    <div className="space-y-3">
      {datos.map((d, i) => (
        <div key={d.etiqueta}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-sm text-main" title={d.etiqueta}>{d.etiqueta}</span>
            <span className="shrink-0 text-sm tabular text-muted">
              {money(d.valor)}
              <span className="ml-1.5 text-xs text-dim">{percent(d.porcentaje, 0)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(d.porcentaje * 100, 1.5)}%`,
                backgroundColor: colorDe(i),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Gráfico de barras agrupadas: ingresos y egresos mes a mes. */
export function GraficoMensual({
  datos,
  resaltado,
}: {
  datos: { periodo: string; ingresos: number; egresos: number }[];
  resaltado?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const max = useMemo(
    () => Math.max(1, ...datos.flatMap((d) => [d.ingresos, d.egresos])),
    [datos]
  );

  if (!datos.length) {
    return <p className="py-12 text-center text-sm text-dim">Todavía no hay movimientos registrados.</p>;
  }

  const H = 180;

  return (
    <div>
      <div className="flex items-end gap-1 overflow-x-auto pb-1 sm:gap-1.5" style={{ height: H + 8 }}>
        {datos.map((d) => {
          const activo = resaltado === d.periodo;
          const hIng = (d.ingresos / max) * H;
          const hEgr = (d.egresos / max) * H;
          const etiqueta = fmtPeriodo(Number(d.periodo.slice(5, 7)), d.periodo.slice(0, 4));

          return (
            <div
              key={d.periodo}
              className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-0.5"
              onMouseEnter={() => setHover(d.periodo)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex w-full items-end justify-center gap-0.5" style={{ height: H }}>
                <div
                  className="w-1/2 rounded-t bg-ok transition-[height]"
                  style={{ height: Math.max(hIng, d.ingresos > 0 ? 2 : 0) }}
                  title={`${etiqueta} · Ingresos ${money(d.ingresos)}`}
                />
                <div
                  className="w-1/2 rounded-t bg-danger transition-[height]"
                  style={{ height: Math.max(hEgr, d.egresos > 0 ? 2 : 0) }}
                  title={`${etiqueta} · Egresos ${money(d.egresos)}`}
                />
              </div>
              <span
                className={cn(
                  'text-[9px] leading-none tracking-tight',
                  activo ? 'font-bold text-main' : 'text-dim'
                )}
              >
                {etiqueta}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-dim">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ok" /> Ingresos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-danger" /> Egresos
        </span>
        {hover && (
          <span className="ml-auto tabular">
            {fmtPeriodo(Number(hover.slice(5, 7)), hover.slice(0, 4))}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Barras de antigüedad de la cartera.
 * El color va de verde a rojo a medida que la cuota se atrasa: es la lectura
 * que el tesorero necesita de un vistazo, sin leer una tabla.
 */
export function BarrasAntiguedad({
  bloques,
}: {
  bloques: { clave: string; etiqueta: string; cantidad: number; total: number }[];
}) {
  const max = Math.max(1, ...bloques.map((b) => b.total));

  const TONO: Record<string, string> = {
    al_dia: 'bg-ok',
    '1_30': 'bg-warn',
    '31_60': 'bg-orange-500',
    '61_90': 'bg-danger',
    mas_90: 'bg-danger',
  };

  return (
    <div className="space-y-3">
      {bloques.map((b) => (
        <div key={b.clave} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-sm text-main">{b.etiqueta}</span>
          <span className="shrink-0 text-sm tabular text-muted">{money(b.total)}</span>
          <div className="col-span-2 h-2.5 overflow-hidden rounded-full bg-surface-3">
            <div
              className={cn('h-full rounded-full transition-[width] duration-500', TONO[b.clave])}
              style={{ width: `${Math.max((b.total / max) * 100, b.total > 0 ? 2 : 0)}%` }}
            />
          </div>
          <span className="col-span-2 text-[11px] text-dim">
            {b.cantidad} {b.cantidad === 1 ? 'cuota' : 'cuotas'}
          </span>
        </div>
      ))}
    </div>
  );
}

export { fecha, mesNombre };
