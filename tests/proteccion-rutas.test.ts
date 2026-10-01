import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { moduloDeRutaCompleto, tieneModulo, RUTAS_SIN_MODULO, esDirectiva, type Rol } from '@/lib/roles';

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

  it('toda pantalla del panel cae bajo algún módulo, salvo las declaradas', () => {
    // Hay una lista de excepciones en roles.ts: pantallas que dependen solo de
    // `esDirectiva` y no de un módulo. No están desprotegidas —el proxy las
    // corta igual por ser `/admin/*`— pero es una excepción deliberada y tiene
    // que estar escrita en el código, no implícita.
    const huerfanas = rutas.filter(
      (r) => moduloDeRutaCompleto(r) === null && !RUTAS_SIN_MODULO.includes(r)
    );
    expect(
      huerfanas,
      `Estas pantallas no están protegidas por el proxy:\n  ${huerfanas.join('\n  ')}`
    ).toEqual([]);
  });

  it('las excepciones son pocas y las que existen son reales', () => {
    // La lista no debe crecer a medida que se abren pantallas: es la clase de
    // excepción que se acumula "solo por esta vez" hasta que la matriz de
    // permisos deja de proteger nada.
    expect(RUTAS_SIN_MODULO.length).toBeLessThanOrEqual(3);

    // Y cada ruta de la lista tiene que existir de verdad, o queda protegiendo
    // algo que ya no está.
    for (const r of RUTAS_SIN_MODULO) {
      expect(rutas, `${r} está en RUTAS_SIN_MODULO pero no existe`).toContain(r);
    }
  });

  it('el manual entra a cualquier cargo de directiva y a ningún socio', () => {
    // Es el caso que justifica la excepción: el manual le sirve a quien todavía
    // no conoce el sistema, así que no puede depender de `configuracion`, que
    // solo tienen admin y presidente.
    expect(moduloDeRutaCompleto('/admin/ayuda')).toBeNull();

    for (const rol of [
      'presidente', 'secretario', 'tesorero', 'vocal_titular', 'vocal_suplente',
    ] as Rol[]) {
      expect(esDirectiva(rol), `${rol} debería poder leer el manual`).toBe(true);
    }
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
