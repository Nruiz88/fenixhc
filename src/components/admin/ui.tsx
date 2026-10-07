'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ============================================================
   Piezas compartidas del panel de administración.

   El objetivo es que las páginas no repitan markup ni clases, y que
   un usuario nuevo entienda de entrada qué hace cada pantalla.
   ============================================================ */

const SURFACE = 'bg-surface border-line';

// ------------------------------------------------------------------
// Cabecera de página: título + qué hace esta pantalla + acciones
// ------------------------------------------------------------------
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-main tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ------------------------------------------------------------------
// Tarjeta de indicador
// ------------------------------------------------------------------
export type StatTone = 'neutral' | 'brand' | 'ok' | 'warn' | 'danger' | 'info';

const TONE: Record<StatTone, { chip: string; value: string }> = {
  neutral: { chip: 'bg-surface-3 text-muted', value: 'text-main' },
  brand:   { chip: 'bg-brand/10 text-brand',       value: 'text-main' },
  ok:      { chip: 'bg-ok/10 text-ok',           value: 'text-ok' },
  warn:    { chip: 'bg-warn/10 text-warn',       value: 'text-warn' },
  danger:  { chip: 'bg-danger/10 text-danger',   value: 'text-danger' },
  info:    { chip: 'bg-info/10 text-info',       value: 'text-info' },
};

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  icon?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <div className={cn('rounded-xl border p-4', SURFACE)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-dim">{label}</p>
        {icon && <span className={cn('grid h-7 w-7 place-items-center rounded-lg', t.chip)}>{icon}</span>}
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular truncate', t.value)}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-dim truncate">{hint}</p>}
    </div>
  );
}

// ------------------------------------------------------------------
// Panel: la "caja" con título que se usa en casi todas las pantallas
// ------------------------------------------------------------------
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('rounded-xl border overflow-hidden', SURFACE, className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-main">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-dim">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(bodyClassName ?? 'p-4')}>{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------
// Estado vacío: la parte que más ayuda a un usuario nuevo.
// Antes las pantallas vacías decían "No hay datos", sin decir qué hacer.
// ------------------------------------------------------------------
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-3 text-dim">{icon}</div>}
      <div>
        <p className="font-medium text-main">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------
// Estado de carga: placeholder con la forma aproximada del contenido
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// Etiqueta de estado con color semántico
// ------------------------------------------------------------------
export type StatusTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral' | 'brand';

const STATUS: Record<StatusTone, string> = {
  ok: 'bg-ok/10 text-ok ring-ok/20',
  warn: 'bg-warn/10 text-warn ring-warn/20',
  danger: 'bg-danger/10 text-danger ring-danger/20',
  info: 'bg-info/10 text-info ring-info/20',
  brand: 'bg-brand/10 text-brand ring-brand/20',
  neutral: 'bg-surface-3 text-muted ring-line-strong',
};

export function StatusPill({
  children,
  tone = 'neutral',
  title,
}: {
  children: ReactNode;
  tone?: StatusTone;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        STATUS[tone]
      )}
    >
      {children}
    </span>
  );
}

/** Convierte el estado de una cuota a color, para no repetir el if en cada vista. */
export function tonoEstadoCuota(estado: string): { tone: StatusTone; label: string } {
  switch (estado) {
    case 'pagada':    return { tone: 'ok',     label: 'Pagada' };
    case 'pendiente': return { tone: 'warn',   label: 'Pendiente' };
    case 'rechazada': return { tone: 'danger', label: 'Rechazada' };
    case 'vencida':   return { tone: 'danger', label: 'Vencida' };
    default:          return { tone: 'neutral', label: estado || '—' };
  }
}

export function tonoReserva(estado: string): { tone: StatusTone; label: string } {
  switch (estado) {
    case 'confirmada':  return { tone: 'ok',     label: 'Confirmada' };
    case 'cancelada':   return { tone: 'danger', label: 'Cancelada' };
    case 'completada':  return { tone: 'info',   label: 'Completada' };
    default:            return { tone: 'neutral', label: estado || '—' };
  }
}

// ------------------------------------------------------------------
// Barra de herramientas: búsqueda + filtros + acciones, en un solo lado
// ------------------------------------------------------------------
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      {children}
    </div>
  );
}

// ------------------------------------------------------------------
// Aviso en línea: para explicar un dato o un cálculo en la pantalla
// ------------------------------------------------------------------
export function Hint({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <p className={cn(
      'rounded-lg border px-3 py-2 text-xs',
      tone === 'warn'
        ? 'border-warn/25 bg-warn/10 text-warn'
        : 'border-info/25 bg-info/10 text-info'
    )}>
      {children}
    </p>
  );
}

// ------------------------------------------------------------------
// Etiqueta + valor: par de datos en el detalle (legajo, usuario)
// ------------------------------------------------------------------
export function DataPoint({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-dim">{label}</dt>
      <dd className="mt-0.5 truncate text-sm text-main" title={typeof value === 'string' ? value : undefined}>
        {value ?? '—'}
      </dd>
    </div>
  );
}
