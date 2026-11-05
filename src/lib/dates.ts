// Fechas en formato ISO local (YYYY-MM-DD), sin líos de zona horaria.
//
// Por qué no `new Date().toISOString().slice(0,10)` para "hoy": eso devuelve
// la fecha en UTC. Cerca de medianoche en Argentina da el día anterior, y un
// reporte que muestra "ayer" un día a la noche hace perder la confianza en
// todas las cifras.

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Fecha y hora para columnas TIMESTAMP/DATETIME de MySQL.
 *
 * MariaDB rechaza el ISO de JavaScript (`2026-11-05T19:04:58.442Z`) en modo
 * estricto: espera `YYYY-MM-DD HH:mm:ss`. El pool usa `timezone: '+00:00'`,
 * así que se manda en UTC y la lectura vuelve como Date.
 */
export function mysqlDateTime(date: Date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
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
