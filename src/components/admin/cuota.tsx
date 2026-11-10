'use client';

import { money, fecha, percent } from '@/lib/format';
import { StatusPill } from './ui';
import { AlertTriangle } from 'lucide-react';

// Cómo se lee una cuota con recargo.
//
// Se muestra el desglose (base + recargo = total) y no solo el total. Si
// aparece un número que el socio nunca vio pactar, la primera reacción es
// "esto está mal"; con el desglose a la vista se entiende de dónde sale,
// y el recargo deja de ser una sorpresa para ser una regla conocida.

export function DesgloseCuota({
  montoBase,
  montoLista,
  becaPorcentaje = 0,
  porcentaje,
  recargo,
  total,
  diasVencida,
  fechaHito,
  diasParaProximo,
  compacto = false,
}: {
  montoBase: number;
  /** Precio antes de la beca. Si falta, se usa `montoBase`. */
  montoLista?: number;
  /** Porcentaje de beca aplicado. Con beca no hay recargo. */
  becaPorcentaje?: number;
  porcentaje: number;
  recargo: number;
  total: number;
  diasVencida?: number;
  fechaHito?: Date | null;
  diasParaProximo?: number | null;
  compacto?: boolean;
}) {
  const conRecargo = porcentaje > 0;
  const beca = Number(becaPorcentaje) || 0;
  const lista = beca > 0 && Number(montoLista) > montoBase ? Number(montoLista) : null;
  const descuento = lista !== null ? lista - montoBase : 0;

  if (compacto) {
    return (
      <div className="text-right">
        <p className="text-sm font-semibold tabular text-main">{money(total)}</p>
        {conRecargo && (
          <p className="text-[11px] tabular text-warn">
            {money(montoBase)} + {percent(porcentaje / 100, 0)} recargo
          </p>
        )}
        {!conRecargo && beca > 0 && (
          <p className="text-[11px] tabular text-info">
            Beca {percent(beca / 100, 0)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface-2 p-3">
      <dl className="space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted">{lista !== null ? 'Cuota' : 'Cuota base'}</dt>
          <dd className="tabular text-main">{money(lista ?? montoBase)}</dd>
        </div>

        {lista !== null && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-info">Beca {percent(beca / 100, 0)}</dt>
            <dd className="tabular text-info">- {money(descuento)}</dd>
          </div>
        )}

        {conRecargo && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-warn">
              Recargo {percent(porcentaje / 100, 0)}
            </dt>
            <dd className="tabular text-warn">+ {money(recargo)}</dd>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line pt-1.5">
          <dt className="font-medium text-main">Total a pagar</dt>
          <dd className="text-base font-bold tabular text-main">{money(total)}</dd>
        </div>
      </dl>

      {conRecargo ? (
        <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-dim">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
          <span>
            Venció el {fecha(fechaHito)}
            {diasVencida ? `, hace ${diasVencida} ${diasVencida === 1 ? 'día' : 'días'}` : ''}.
            Pagando antes se evita el recargo.
          </span>
        </p>
      ) : beca > 0 ? (
        <p className="mt-2.5 text-[11px] text-info">
          Beca del {percent(beca / 100, 0)}: esta cuota no lleva recargo.
        </p>
      ) : diasParaProximo !== null && diasParaProximo !== undefined ? (
        <p className="mt-2.5 text-[11px] text-dim">
          Sin recargo. Vence en {diasParaProximo}{' '}
          {diasParaProximo === 1 ? 'día' : 'días'}.
        </p>
      ) : null}
    </div>
  );
}

/** Etiqueta compacta para una fila de tabla. */
export function PillRecargo({ porcentaje }: { porcentaje: number }) {
  if (porcentaje <= 0) return <StatusPill tone="ok">Sin recargo</StatusPill>;
  return <StatusPill tone="warn">+{percent(porcentaje / 100, 0)} recargo</StatusPill>;
}
