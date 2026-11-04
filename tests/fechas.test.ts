import { describe, it, expect } from 'vitest';
import { fecha, fechaDia, isoDia, parseFechaDia } from '@/lib/format';

// Las columnas DATE de MySQL llegan al navegador como ISO a medianoche UTC.
// Si se hace new Date(...) en Argentina, el día se corre al anterior. Estos
// tests fijan el comportamiento de los campos que son solo un día.

describe('fechas de MySQL DATE', () => {
  it('muestra el mismo día que vino de la base', () => {
    expect(fecha('2026-12-05')).toBe('05/12/2026');
    expect(fecha('2026-12-05T00:00:00.000Z')).toBe('05/12/2026');
    expect(fechaDia('2026-12-05T00:00:00.000Z')).toBe('5/12/2026');
  });

  it('prepara el valor de un input type=date sin corrimiento', () => {
    expect(isoDia('2026-12-05T00:00:00.000Z')).toBe('2026-12-05');
    expect(isoDia(new Date(Date.UTC(2026, 11, 5)))).toBe('2026-12-05');
    expect(isoDia('')).toBe('');
  });

  it('parsea una fecha DATE al mediodía local', () => {
    const d = parseFechaDia('2026-12-05T00:00:00.000Z');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(11);
    expect(d?.getDate()).toBe(5);
    expect(d?.getHours()).toBe(12);
  });

  it('no rompe con valores vacíos o inválidos', () => {
    expect(fecha(null)).toBe('—');
    expect(fecha('')).toBe('—');
    expect(fecha('no-es-fecha')).toBe('—');
    expect(parseFechaDia('no-es-fecha')).toBeNull();
  });
});
