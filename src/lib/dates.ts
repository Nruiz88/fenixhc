// Fechas en formato ISO local (YYYY-MM-DD), sin líos de zona horaria.
//
// Por qué no `new Date().toISOString().slice(0,10)` para "hoy": eso devuelve
// la fecha en UTC. Cerca de medianoche en Argentina da el día anterior, y un
// reporte que muestra "ayer" un día a la noche hace perder la confianza en
// todas las cifras.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function aISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return aISO(new Date());
}

/** Primer día del mes actual, o del mes desplazado `offset` meses. */
export function monthStartISO(offset = 0): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return aISO(d);
}

/** Último día del mes actual, o del mes desplazado `offset` meses. */
export function monthEndISO(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset + 1, 0); // día 0 del mes siguiente = último del actual
  return aISO(d);
}
