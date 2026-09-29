// Formateo para mostrar datos a personas no técnicas.
// Todo importe va con separador de miles es-AR ($ 75.000), nunca $75000.00.

/** Importe en pesos: 75000 -> "$ 75.000" */
export function money(n: number | string | null | undefined, opts: { decimales?: boolean } = {}): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$ 0';
  return `$${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: opts.decimales ? 2 : 0,
    maximumFractionDigits: opts.decimales ? 2 : 0,
  }).format(v)}`;
}

/** Importe con signo explícito, para movimientos de caja. */
export function moneySigned(n: number): string {
  const v = Number(n ?? 0);
  return `${v < 0 ? '-' : '+'}${money(Math.abs(v))}`;
}

/** Porcentaje: 0.153 -> "15,3%" */
export function percent(n: number | string | null | undefined, decimales = 1): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '0%';
  return `${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(v * 100)}%`;
}

/** Fecha corta: "12/03/2026" */
export function fecha(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR');
}

/** Fecha con hora: "12/03/2026 18:30" */
export function fechaHora(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Antigüedad de una cuota pendiente, en palabras.
 * El contador no piensa en días: necesita "hace 3 meses".
 */
export function antiguedad(fechaVenc: string | Date | null | undefined): string {
  if (!fechaVenc) return 'sin fecha';
  const d = new Date(fechaVenc);
  if (Number.isNaN(d.getTime())) return 'sin fecha';

  const dias = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (dias < 0) return 'a vencer';
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'venció ayer';
  if (dias < 31) return `hace ${dias} días`;

  const meses = Math.floor(dias / 30);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;

  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto === 0
    ? `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
    : `hace ${anios} ${anios === 1 ? 'año' : 'años'} y ${resto} ${resto === 1 ? 'mes' : 'meses'}`;
}

/** Etiqueta legible de un rol de socio/directiva. */
export function mesNombre(n: number | string | null | undefined): string {
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const i = Number(n) - 1;
  return MESES[i] ?? '—';
}

/** Iniciales para avatares: "Marcelo Cabrera" -> "MC" */
export function iniciales(nombre?: string | null, apellido?: string | null): string {
  return `${nombre?.[0] ?? ''}${apellido?.[0] ?? ''}`.toUpperCase() || '?';
}

/** Nombre de mes corto para etiquetas de cuota: "Mar 2026" */
export function periodo(mes: number | string | null | undefined, anio: number | string | null | undefined): string {
  const m = mesNombre(mes);
  return `${m.slice(0, 3)} ${anio ?? ''}`.trim();
}
