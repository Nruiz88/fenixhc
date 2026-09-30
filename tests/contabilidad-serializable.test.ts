import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Este bug era invisible para `tsc` y para `next build`: la página es
// dinámica, así que el error de serialización solo aparecía en runtime, con
// un 500 en producción y una pantalla en blanco para el tesorero.
//
// Estos tests leen el fuente y fallan si la estructura que cruza al cliente
// vuelve a declarar una función. Es un test de estructura, no de
// comportamiento, y esa es justamente la razón de que exista: la garantía
// que tiene que quedar fijada no es qué hace el código, sino qué forma tiene.

const SRC = resolve(__dirname, '../src/lib/contabilidad.ts');

function interfaceCuerpo(nombre: string): string {
  const fuente = readFileSync(SRC, 'utf8');
  const i = fuente.indexOf(`export interface ${nombre} {`);
  if (i < 0) throw new Error(`No se encontró la interface ${nombre}`);
  const fin = fuente.indexOf('\n}', i);
  return fuente.slice(i, fin);
}

describe('estructura que cruza al cliente', () => {
  it('BloqueAntiguedad no declara funciones', () => {
    // Con `test: (dias, pct) => boolean`, Next lanza "Functions cannot be
    // passed directly to Client Components" y la página devuelve 500.
    const cuerpo = interfaceCuerpo('BloqueAntiguedad');
    expect(cuerpo).not.toMatch(/=>|\(\s*\w+\s*[:,)]/);
  });

  it('FilaCartera no declara funciones', () => {
    expect(interfaceCuerpo('FilaCartera')).not.toMatch(/=>/);
  });

  it('ReporteContable no declara funciones', () => {
    expect(interfaceCuerpo('ReporteContable')).not.toMatch(/=>/);
  });

  it('los bloques devueltos son datos puros', () => {
    // El clasificador queda en una tabla aparte, server-side, y de BloqueAntiguedad
    // sale solo el resultado.
    const fuente = readFileSync(SRC, 'utf8');
    expect(fuente).toMatch(/const TRAMOS/);
    expect(fuente).toMatch(/clave: t\.clave/);
  });
});
