import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// `query()` devuelve las filas (T[]). `conn.execute()` devuelve la tupla
// [rows, fields]. Son dos formas distintas de leer el mismo resultado de MySQL
// y confundirlas no rompe la compilación: TypeScript acepta ambas y el bug
// aparece en producción.
//
// Lo que pasó: en la bandeja de solicitudes de baja,
// `const [solicitudes] = await query(...)` TOMABA LA PRIMERA FILA del
// resultado, y después el código hacía `solicitudes?.[0]`. El [0] de un objeto
// de fila es undefined, así que toda solicitud daba "no existe" y la pantalla
// de aprobar quedaba verde contra una base vacía. Lo mismo, peor, en el
// portal del socio: `vinculados?.find(...)` sobre una fila suelta es un
// TypeError.
//
// Este test no prueba el comportamiento — eso lo cubre la prueba end-to-end —
// prohíbe la forma. Es barato y corta el error en la primera línea.
//
// No se intenta adivinar, con heurísticas, todos los usos `[0]` sobre un
// resultado de consulta: `nombre?.[0]` para sacar la inicial de un nombre
// aparecería como sospechoso y el test daría falso positivo. Mejor una regla
// precisa que alguien pueda saltarse a propósito que cinco ambiguas que
// nadie va a mirar.

const SRC = join(__dirname, '../src');

function archivos(dir: string = SRC, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) {
      archivos(p, acc);
    } else if (/\.(ts|tsx)$/.test(entrada) && !entrada.endsWith('.d.ts')) {
      acc.push(p);
    }
  }
  return acc;
}

const fuentes = archivos().map((p) => ({
  ruta: relative(SRC, p).replace(/\\/g, '/'),
  texto: readFileSync(p, 'utf8'),
}));

describe('uso de la capa de base de datos', () => {
  it('hay archivos que revisar', () => {
    // Guarda contra un glob que no matchea nada y da verde en falso.
    expect(fuentes.length).toBeGreaterThan(50);
  });

  it('nadie desestructura el resultado de query() como si fuera una tupla', () => {
    // `const [filas] = await query(...)` siempre es un error de lectura:
    // query ya devuelve el array, o el código quería conn.execute.
    const culpables = fuentes
      .filter((f) => /const\s*\[[^\]]*\]\s*=\s*await\s+query\s*[<(]/.test(f.texto))
      .map((f) => f.ruta);

    expect(
      culpables,
      `query() devuelve las filas, no [rows, fields]. Para una sola fila usá queryOne():\n  ${culpables.join('\n  ')}`
    ).toEqual([]);
  });
});
