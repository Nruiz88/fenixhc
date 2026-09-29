// Exportación a CSV y descarga de archivos.
//
// Los reportes se leen en Excel, así que el CSV tiene que abrir bien con acentos.
// Por eso el BOM UTF-8 al principio: sin él, Excel muestra "Alquiler" como
// "Alquiler" con caracteres rotos y el tesorero no puede cruzar los datos.

/**
 * Serializa filas a CSV con BOM y dispara la descarga.
 * Acepta una lista de columnas explícita para que el orden y el nombre en
 * el archivo no dependan de cómo vinieron los datos de la base.
 */
export function descargarCSV(
  filas: Record<string, unknown>[],
  nombreArchivo: string,
  columnas?: { clave: string; titulo: string }[]
) {
  if (!filas.length) {
    throw new Error('No hay datos para exportar');
  }

  const cols =
    columnas ?? Object.keys(filas[0]).map((k) => ({ clave: k, titulo: k }));

  // El separador `;` en vez de `,` porque en es-AR la coma es separador
  // decimal: con `,` Excel abre la columna "$ 1.250,50" partida en dos.
  const escapar = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lineas = [
    cols.map((c) => escapar(c.titulo)).join(';'),
    ...filas.map((f) => cols.map((c) => escapar(f[c.clave])).join(';')),
  ];

  const csv = '﻿' + lineas.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, `${nombreArchivo}_${fechaArchivo()}.csv`);
}

export function descargarJSON(
  datos: unknown,
  nombreArchivo: string,
) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], {
    type: 'application/json;charset=utf-8;',
  });
  descargarBlob(blob, `${nombreArchivo}_${fechaArchivo()}.json`);
}

function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera el object URL. Sin esto, cada export accumulates un blob en
  // memoria hasta que se recarga la página.
  URL.revokeObjectURL(url);
}

/** Fecha local en YYYY-MM-DD (no UTC: ver lib/dates.ts). */
function fechaArchivo(): string {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
