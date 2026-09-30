import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { moduloDeRutaCompleto, tieneModulo, type Rol } from '@/lib/roles';

// Una pantalla del panel que no está en la matriz de rutas NO está protegida
// por el proxy: el chequeo devuelve null y la única defensa que queda es el
// requireModulo de la página, que se puede olvidar. Con los roles puestos por
// el proxy se traba con redirects; sin él, con un 500.
//
// El caso real que motivó esto: /admin/privacidad, que muestra quién abrió
// los DNI de cada socio. Nadie la asoció a ningún módulo y quedaba abierta a
// cualquier cargo de directiva, incluidos los vocales que solo deberían
// consultar socios.

const PANEL = join(__dirname, '../src/app/admin');

/** Recorre los directorios con page.tsx y devuelve la ruta del panel. */
function rutasDelPanel(dir: string = PANEL, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) {
      rutasDelPanel(p, acc);
    } else if (entrada === 'page.tsx') {
      // `relative` devuelve rutas con separador de la plataforma: en Windows
      // "usuarios\page.tsx". Hay que normalizar a "/" ANTES de armar la URL,
      // porque concatenar sin convertir daba "/adminusuarios" y ninguna ruta
      // del panel habría coincidido con ningún módulo: el test daba verde
      // sobre un panel entero sin proteger.
      const rel = relative(PANEL, p).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
      acc.push('/admin' + (rel ? '/' + rel : ''));
    }
  }
  return acc;
}

describe('protección de las pantallas del panel', () => {
  const rutas = rutasDelPanel();

  it('el panel tiene pantallas que verificar', () => {
    // Guarda contra un glob que no matchea nada y da verde en falso.
    expect(rutas.length).toBeGreaterThan(10);
  });

  it('toda pantalla del panel cae bajo algún módulo', () => {
    const huerfanas = rutas.filter((r) => moduloDeRutaCompleto(r) === null);
    expect(
      huerfanas,
      `Estas pantallas no están protegidas por el proxy:\n  ${huerfanas.join('\n  ')}`
    ).toEqual([]);
  });

  it('la pantalla de datos personales exige el módulo de configuración', () => {
    const modulo = moduloDeRutaCompleto('/admin/privacidad');
    expect(modulo).toBe('configuracion');

    // Admin y presidente entran; el resto de la directiva no.
    expect(tieneModulo('admin', 'configuracion')).toBe(true);
    expect(tieneModulo('presidente', 'configuracion')).toBe(true);
    for (const rol of ['secretario', 'tesorero', 'vocal_titular', 'vocal_suplente'] as Rol[]) {
      expect(
        tieneModulo(rol, 'configuracion'),
        `${rol} no debería entrar a datos personales`
      ).toBe(false);
    }
  });

  it('ningún socio llega a una pantalla del panel', () => {
    for (const ruta of rutas) {
      const modulo = moduloDeRutaCompleto(ruta);
      if (!modulo) continue;
      expect(tieneModulo('socio_benefactor', modulo), `${ruta} para socio_benefactor`).toBe(false);
      expect(tieneModulo('socio_cadete', modulo), `${ruta} para socio_cadete`).toBe(false);
    }
  });
});
