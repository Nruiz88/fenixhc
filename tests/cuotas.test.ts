import { describe, it, expect } from 'vitest';
import { calcularRecargo, type Vencimiento } from '@/lib/cuotas';

// El recargo se calcula con aritmética de fechas, que es justo el tipo de
// código que parece correcto y devuelve un número plausible pero equivocado.
// Estos tests fijan los casos que importan.

const VENCIMIENTOS: Vencimiento[] = [
  { id: '1', dia: 10, porcentaje: 5, etiqueta: 'día 10', activo: true, orden: 1 },
  { id: '2', dia: 20, porcentaje: 10, etiqueta: 'día 20', activo: true, orden: 2 },
  { id: '3', dia: 30, porcentaje: 20, etiqueta: 'día 30', activo: true, orden: 3 },
];

const BASE = 75000;

/** Fecha local a las 12:00, para que los tests no dependan de la hora del día. */
const dia = (d: number, m: number, a: number) => new Date(a, m - 1, d, 12);

describe('calcularRecargo', () => {
  it('no aplica recargo antes del primer hito', () => {
    // Cuota de marzo: el primer hito es el 10 de abril.
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(1, 4, 2026));
    expect(r.porcentaje).toBe(0);
    expect(r.recargo).toBe(0);
    expect(r.total).toBe(BASE);
  });

  it('no aplica recargo el mismo día del hito, porque vence ese día', () => {
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(10, 4, 2026));
    expect(r.porcentaje).toBe(0);
  });

  it('aplica el primer tramo un día después del hito', () => {
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(11, 4, 2026));
    expect(r.porcentaje).toBe(5);
    expect(r.recargo).toBe(3750);
    expect(r.total).toBe(78750);
  });

  it('sube al segundo tramo al pasar el segundo hito', () => {
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(21, 4, 2026));
    expect(r.porcentaje).toBe(10);
    expect(r.total).toBe(82500);
  });

  it('sube al tercer tramo al pasar el último hito', () => {
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(2, 5, 2026));
    expect(r.porcentaje).toBe(20);
    expect(r.total).toBe(90000);
  });

  it('el hito es del mes siguiente, no del mismo mes de la cuota', () => {
    // El 15 de marzo la cuota de marzo todavía no venció: su vencimiento es
    // el 10 de abril. Acá está el error clásico de tomar el mes equivocado.
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(15, 3, 2026));
    expect(r.porcentaje).toBe(0);
  });

  it('cruza el cambio de año bien', () => {
    // Cuota de diciembre: vence el 10 de enero del año siguiente.
    const antes = calcularRecargo(BASE, 12, 2026, VENCIMIENTOS, dia(5, 1, 2027));
    expect(antes.porcentaje).toBe(0);

    const despues = calcularRecargo(BASE, 12, 2026, VENCIMIENTOS, dia(11, 1, 2027));
    expect(despues.porcentaje).toBe(5);
  });

  it('un hito que no existe en un mes corto cae en el último día real', () => {
    // 30 de febrero no existe. Con 2026 (no bisiesto), el hito del día 30
    // cae el 28 de febrero, no el 2 de marzo: `new Date(2026, 2, 30)`
    // desborda al mes siguiente y correría el vencimiento dos días tarde.
    //
    // Se usa un solo tramo para aislar el comportamiento: con la escala
    // completa los tres hitos de una cuota de enero caen en febrero y para
    // el 28 los tres vencieron.
    const soloDia30: Vencimiento[] = [
      { id: '1', dia: 30, porcentaje: 5, etiqueta: 'día 30', activo: true, orden: 1 },
    ];

    const elDia28 = calcularRecargo(BASE, 1, 2026, soloDia30, dia(28, 2, 2026));
    expect(elDia28.porcentaje).toBe(0);

    const alDiaSiguiente = calcularRecargo(BASE, 1, 2026, soloDia30, dia(1, 3, 2026));
    expect(alDiaSiguiente.porcentaje).toBe(5);
  });

  it('avisa cuántos días faltan para el próximo hito', () => {
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(1, 4, 2026));
    expect(r.diasParaProximo).toBe(9);
  });

  it('ignora los tramos desactivados', () => {
    const sinPrimero = VENCIMIENTOS.map((v) =>
      v.dia === 10 ? { ...v, activo: false } : v
    );
    // El 11 de abril el primer tramo está desactivado, así que el club sigue
    // sin recargo hasta el día 20.
    const r = calcularRecargo(BASE, 3, 2026, sinPrimero, dia(11, 4, 2026));
    expect(r.porcentaje).toBe(0);
  });

  it('sin vencimientos no cobra recargo', () => {
    // Una instalación que todavía no cargó los porcentajes no debe inventar
    // un recargo: es peor cobrar de más que no cobrar.
    const r = calcularRecargo(BASE, 3, 2026, [], dia(30, 6, 2026));
    expect(r.porcentaje).toBe(0);
    expect(r.total).toBe(BASE);
  });

  it('usa el vencimiento pactado en lugar de la regla general', () => {
    // Acuerdo puntual: esta familia vence el 15 de mayo en vez del día 10.
    const r = calcularRecargo(BASE, 3, 2026, VENCIMIENTOS, dia(16, 5, 2026), '2026-05-15');
    expect(r.porcentaje).toBe(5);
    expect(r.diasVencida).toBe(1);
  });

  it('redondea a dos decimales', () => {
    // 5% de 33.333 = 1666,65. Sin redondear, el total no cierra con lo que
    // efectivamente entró en caja.
    const r = calcularRecargo(33333, 3, 2026, VENCIMIENTOS, dia(11, 4, 2026));
    expect(r.recargo).toBe(1666.65);
    expect(r.total).toBe(34999.65);
  });

  it('no rompe con montos a cero', () => {
    const r = calcularRecargo(0, 3, 2026, VENCIMIENTOS, dia(30, 6, 2026));
    expect(r.total).toBe(0);
    expect(r.porcentaje).toBe(20);
  });
});
