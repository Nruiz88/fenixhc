// Validación de la sección de junta.
//
// Funciones puras y probadas, como las de `consentimientos`. Lo que entra en
// estos screens lo escribe una persona a las apuradas en una reunión, y un
// `new Date('ayer')` que se cuela en la base rompe el orden de los partes sin
// que nada avise.
//
// La fecha merece atención aparte: se valida en formato, no en la fecha que
// JS decide. Un '2026-02-31' es un 3 de marzo y nadie se entera.

/** `YYYY-MM-DD`. */
export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Devuelve la fecha en ISO, o `null` si no es una fecha real. */
export function parsearFecha(valor: unknown): string | null {
  const s = String(valor ?? '').trim();
  if (!FECHA_RE.test(s)) return null;

  const [a, mes, dia] = s.split('-').map(Number);

  // Fecha que existe de verdad. `new Date('2026-02-31')` no da error: corre a
  // marzo. Por eso se compara contra el mes que pidió.
  const d = new Date(Date.UTC(a, mes - 1, dia));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }

  return s;
}

/**
 * Monto con signo, en pesos.
 *
 * Acepta coma decimal porque en Argentina se escribe así: si el tesorero
 * carga "15.000,50" y lo rechazamos, termina cargando otra cosa por un tema de
 * formato. Devuelve `null` —no 0— cuando no hay número, para distinguir
 * "no vino" de "viene cero".
 */
export function parsearMonto(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null;

  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }

  let s = String(valor).trim();
  if (!s) return null;

  // Quita el signo peso y los espacios de miles.
  s = s.replace(/[$\s]/g, '');

  const ultimaComa = s.lastIndexOf(',');
  const ultimoPunto = s.lastIndexOf('.');

  if (ultimaComa > ultimoPunto) {
    // 1.234,56 → el punto separa miles, la coma es el decimal.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (ultimoPunto > ultimaComa) {
    // Sin coma, un punto con EXACTAMENTE tres dígitos detrás es separador de
    // miles: "15.000" son quince mil. Un punto con uno o dos dígitos es
    // decimal: "15000.50".
    //
    // Es una regla de trabajo, no de gramática: "1.234" es ambiguo y no hay
    // forma de saberlo. Se resuelve por lo que se carga en un club, que son
    // pesos enteros. El costo conocido es "0.500", que entra como 500. Para
    // un recibo no es un caso que aparezca.
    const decimales = s.length - ultimoPunto - 1;
    if (decimales === 3) {
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Trunca el texto a un largo, sin cortar a la mitad de una palabra. */
export function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return (ultimoEspacio > max * 0.6 ? corte.slice(0, ultimoEspacio) : corte) + '…';
}

/** Un entero dentro de un rango, o el default. */
export function enteroEnRango(valor: unknown, min: number, max: number, porDefecto: number): number {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n)) return porDefecto;
  return Math.min(Math.max(n, min), max);
}
