import { describe, it, expect } from 'vitest';
import { parsearFecha, parsearMonto, recortar, enteroEnRango } from '@/lib/junta-validacion';

// Lo escribe alguien a las apuradas en una reunión. Un '2026-02-31' que se
// convierte calladamente en marzo desordena el libro de partes sin que nada
// avise, y un monto mal parseado hace que un recibo valga $1 en vez de $15.000.

describe('fechas', () => {
  it('acepta el formato ISO y nada más', () => {
    expect(parsearFecha('2026-03-15')).toBe('2026-03-15');
    expect(parsearFecha('15/03/2026')).toBeNull();
    expect(parsearFecha('2026-3-15')).toBeNull();
    expect(parsearFecha('')).toBeNull();
    expect(parsearFecha(null)).toBeNull();
  });

  it('rechaza fechas que no existen en vez de correrlas al mes siguiente', () => {
    // new Date('2026-02-31') es 3 de marzo y no tira error. Por eso se compara
    // contra el mes que se pidió.
    expect(parsearFecha('2026-02-31')).toBeNull();
    expect(parsearFecha('2026-13-01')).toBeNull();
    expect(parsearFecha('2026-00-10')).toBeNull();
    expect(parsearFecha('2026-04-31')).toBeNull();
  });

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(parsearFecha('2028-02-29')).toBe('2028-02-29');
    expect(parsearFecha('2026-02-29')).toBeNull();
  });
});

describe('montos', () => {
  it('entiende el formato argentino', () => {
    // Si el tesorero carga "15.000,50" y lo rechazamos, carga otra cosa por un
    // tema de formato. Y el comprobante va al banco.
    expect(parsearMonto('15.000,50')).toBe(15000.5);
    expect(parsearMonto('$ 1.234')).toBe(1234);
    expect(parsearMonto('75.000')).toBe(75000);
  });

  it('entiende el formato con punto decimal', () => {
    expect(parsearMonto('15000.50')).toBe(15000.5);
    expect(parsearMonto('1234.56')).toBe(1234.56);
  });

  it('distingue miles de decimales', () => {
    // Sin coma, un punto con tres dígitos es separador de miles. "1.234" es
    // ambiguo en abstracto y se resuelve por lo que se carga en un club: pesos
    // enteros.
    expect(parsearMonto('1.234')).toBe(1234);
    expect(parsearMonto('1.234,56')).toBe(1234.56);
    // Con uno o dos dígitos es decimal.
    expect(parsearMonto('1234.5')).toBe(1234.5);
    expect(parsearMonto('1234.56')).toBe(1234.56);
  });

  it('distingue "no vino" de "viene cero"', () => {
    // Con 0 no se puede distinguir, y para el recibo no es lo mismo.
    expect(parsearMonto('')).toBeNull();
    expect(parsearMonto(null)).toBeNull();
    expect(parsearMonto(undefined)).toBeNull();
    expect(parsearMonto(0)).toBe(0);
    expect(parsearMonto('0')).toBe(0);
  });

  it('devuelve null en vez de NaN cuando no hay numero', () => {
    // Si devolviera NaN, el INSERT guardaría NaN y el recibo valdría NaN pesos:
    // el banco no lo puede conciliar.
    expect(parsearMonto('abc')).toBeNull();
    expect(parsearMonto('12abc')).toBeNull();
    expect(parsearMonto('xyz')).toBeNull();
    expect(Number.isNaN(parsearMonto('xyz') as number)).toBe(false);
  });

  it('acepta negativos, por si hay que corregir un cobro', () => {
    expect(parsearMonto('-1.500')).toBe(-1500);
  });
});

describe('texto y números', () => {
  it('recorta sin partir una palabra al pedo', () => {
    const largo = 'primera parte del acta de la reunión que se';
    const r = recortar(largo, 20);
    expect(r.length).toBeLessThanOrEqual(21);
    expect(r.endsWith('…')).toBe(true);
    // No cortó en medio de una palabra.
    expect(largo.startsWith(r.replace('…', '').trimEnd())).toBe(true);
  });

  it('no toca lo que ya entra', () => {
    expect(recortar('corto', 20)).toBe('corto');
  });

  it('acota los enteros a su rango', () => {
    expect(enteroEnRango(5, 1, 12, 1)).toBe(5);
    expect(enteroEnRango(99, 1, 12, 1)).toBe(12);
    expect(enteroEnRango(-3, 1, 12, 1)).toBe(1);
    expect(enteroEnRango('abc', 1, 12, 7)).toBe(7);
    expect(enteroEnRango(4.7, 1, 12, 1)).toBe(4);
  });
});
