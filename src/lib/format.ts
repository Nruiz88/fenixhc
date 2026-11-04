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
/** Porcentaje: 0.153 -> "15,3%" */
export function percent(n: number | string | null | undefined, decimales = 1): string {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '0%';
  return `${new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(v * 100)}%`;
}

// Las columnas DATE de MySQL llegan al navegador como ISO a medianoche UTC:
// "2026-12-05T00:00:00.000Z". Si se hace `new Date(...)` y se muestra en
// Argentina, el resultado cae el día anterior. Para un campo que es solo un
// día (partido, vencimiento, fecha de pago) hay que tomar los componentes de
// la fecha tal como vienen, sin convertir de zona horaria.
const FECHA_DIA = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.\d{1,3})?Z)?$/;

/** Convierte un campo DATE de MySQL a un Date local al mediodía. */
export function parseFechaDia(v: string | Date | null | undefined): Date | null {
  if (!v) return null;

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    // mysql2 devuelve DATE como Date a medianoche UTC.
    return new Date(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate(), 12);
  }

  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Fecha de un campo DATE: "05/12/2026", sin corrimiento por zona horaria. */
export function fechaDia(v: string | Date | null | undefined): string {
  const d = parseFechaDia(v);
  return d ? d.toLocaleDateString('es-AR') : '—';
}

/** Formato YYYY-MM-DD para `<input type="date">`, sin corrimiento. */
export function isoDia(v: string | Date | null | undefined): string {
  const d = parseFechaDia(v);
  if (!d) return '';
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Fecha corta: "12/03/2026" */
export function fecha(v: string | Date | null | undefined): string {
  if (!v) return '—';

  // Fecha sin hora (o serializada a medianoche UTC): se formatea por partes.
  if (typeof v === 'string') {
    const m = v.match(FECHA_DIA);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }

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
