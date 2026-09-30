import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Un crash de render deja la pantalla en blanco.
//
// Eso no es un detalle de apariencia: la persona que hace clic piensa que la
// página no funciona, cuando en realidad la aplicación se rompió. Y como la
// excepción se come el render, no hay mensaje, no hay log del cliente, y no
// queda rastro de qué pasó.
//
// Acá se fija una clase de error que se repite en este panel: poner en
// pantalla un objeto a medio camino de traerle sus datos.
//
// El caso que motivó esto: /admin/legajos. `abrir()` hace dos renders —primero
// la fila cruda de la lista, después la fila con `familias` y `cuotas`— y el
// primer render leía `seleccionado.familias.length`. Sobre `undefined`, eso
// tira. La pantalla quedaba en blanco siempre, al primer clic, sin importar
// los datos.

const APP = join(__dirname, '../src/app');

const LEER = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8');

/**
 * El código sin comentarios.
 *
 * Un comentario que menciona `seleccionado.familias.length` —justo lo que
 * explica el bug— haría que el test pasara sin que el código lo arregle.
 */
const codigo = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

/** Todos los page.tsx de la app. */
function pantallas(dir: string = APP, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) {
      if (['node_modules', '.next'].includes(entrada)) continue;
      pantallas(p, acc);
    } else if (entrada === 'page.tsx') {
      acc.push(p);
    }
  }
  return acc;
}

describe('el legajo no se rompe al abrirlo', () => {
  const PAGINA = LEER('/src/app/admin/legajos/page.tsx');
  const LIMPIO = codigo(PAGINA);

  it('la vista de detalle protege las dos listas', () => {
    // `abrir` pone la fila cruda antes de traer los datos. El detalle tiene
    // que poder renderizarse con lo que todavía no llegó. Por eso `?? []` en
    // las dos, y no solo en las cuotas.
    expect(LIMPIO).toMatch(/const\s+cuotas\s*=\s*seleccionado\.cuotas\s*\?\?\s*\[\]/);
    expect(LIMPIO).toMatch(/const\s+familias\s*=\s*seleccionado\.familias\s*\?\?\s*\[\]/);
  });

  it('nunca desarma un campo del legajo sin proteger', () => {
    // Cualquier `seleccionado.algo.` que no sea `?? []` ni `?.` vuelve a
    // Romper en el primer render.
    const peligrosa = [...LIMPIO.matchAll(/seleccionado\.(\w+)\.(?!\?)/g)].map(
      (m) => m[0]!
    );

    // Lo único admisible es el campo `error`, que es un string.
    const reprobadas = peligrosa.filter((p) => !p.startsWith('seleccionado.error.'));

    expect(reprobadas).toEqual([]);
  });

  it('la carga de familias y cuotas no puede quedar girando para siempre', () => {
    // Sin `finally`, un corte de conexión dejaba el esqueleto loader para
    // siempre: `cargandoDetalle` solo se apagaba si las consultas terminaban.
    expect(LIMPIO).toMatch(/finally\s*\{\s*setCargandoDetalle\(false\)/);
  });

  it('si la carga falla, lo dice en pantalla', () => {
    // El `catch` no puede ser silencioso: si no, el mismo corte de conexión
    // que antes colgaba la pantalla ahora muestra un legajo vacío, que es peor
    // que no mostrar nada porque parece que el jugador no tiene familia.
    expect(LIMPIO).toMatch(/catch/);
    expect(PAGINA).toMatch(/seleccionado\.error/);
  });
});

describe('el mismo error no está en otra pantalla', () => {
  it('ningún panel desarma un estado puesto a medio cargar', () => {
    const hallazgos: string[] = [];

    for (const ruta of pantallas()) {
      const texto = readFileSync(ruta, 'utf8');
      if (!texto.includes("'use client'")) continue;

      const limpio = codigo(texto);

      // El patrón que rompe: dentro de una función async, un `setX(v)` con el
      // parámetro crudo y después un `setX({ ...v, algo })`. El primer render
      // tiene el objeto sin esos campos.
      const patron = /async function \w+\([^)]*\)\s*\{([\s\S]*?)\n  \}/g;
      for (const cuerpo of limpio.matchAll(patron)) {
        const [, bloque] = cuerpo;
        const crudo = bloque!.match(/set(\w+)\(\s*(\w+)\s*\)/);
        const armado = bloque!.match(/set(\w+)\(\{\s*\.\.\./);
        if (!crudo || !armado || crudo[1] !== armado[1]) continue;

        const estado = crudo[1]!;
        // Toda lectura `estado.algo.prop` sin `?.` es un crash esperando.
        const peligrosa = [...limpio.matchAll(new RegExp(`\\b${estado}\\.\\w+\\.`, 'g'))]
          .map((m) => m[0]!);

        hallazgos.push(
          ...peligrosa.map((p) => `${ruta.replace(APP, '')}: ${estado} se arma en dos pasos y lee ${p} sin proteger`)
        );
      }
    }

    expect(hallazgos, hallazgos.join('\n')).toEqual([]);
  });
});
