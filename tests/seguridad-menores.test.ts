import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Los dos agujeros que aparecieron probando contra producción.
//
// No se prueban por comportamiento —eso lo cubre la prueba end-to-end— sino
// por la FORMA del código, porque las dos maneras de abrirlos son silenciosas:
// compilan, devuelven 200 y el sistema responde que todo está bien.

const REG = readFileSync(join(__dirname, '../src/app/api/auth/register/route.ts'), 'utf8');
const CONS_DB = readFileSync(join(__dirname, '../src/lib/consentimientos-db.ts'), 'utf8');
const CONS_API = readFileSync(join(__dirname, '../src/app/api/admin/consentimientos/route.ts'), 'utf8');

describe('un menor no puede abrirse su propia cuenta', () => {
  it('la ruta de jugador exige fecha de nacimiento', () => {
    // El agujero: `socio_cadete` se podía registrar sin fecha ni vínculo, con
    // lo que un menor creaba su propia cuenta y su consentimiento quedaba
    // asentado como si fuera de un adulto.
    expect(REG).toMatch(/fechaNacimientoValida\(fechaNacimientoPropia\)/);
  });

  it('rechaza el alta si al declararla edad resulta menor', () => {
    expect(REG).toMatch(/edadPropio\s*<\s*18/);
    expect(REG).toMatch(/necesitaTutor:\s*true/);
  });

  it('el jugador que se registra solo recibe ficha de deportista', () => {
    // Antes quedaba un perfil con rol de cadete y nada más: invisible para
    // el panel de jugadores y sin dónde guardar nada.
    expect(REG).toMatch(/INSERT INTO deportistas[\s\S]{0,200}perfil_id[\s\S]{0,120}fecha_nacimiento/);
  });
});

describe('la oposición del menor no se puede desactivar', () => {
  it('la opinión propia se consulta antes que la del representante', () => {
    // El agujero: se tomaba la última fila sin mirar quién la escribió, así
    // que un admin anotaba "no preguntado" encima del "no" de un pibe.
    const iPropia = CONS_DB.indexOf("origen = 'propia'");
    expect(iPropia).toBeGreaterThan(-1);

    // Y tiene que devolver apenas la encuentra: no seguir leyendo para que
    // algo posterior la pise.
    const bloque = CONS_DB.slice(iPropia - 900, iPropia + 400);
    expect(bloque).toMatch(/if \(propias\[0\]\)\s*return/);
  });

  it('el endpoint del panel rechaza pisar una opinión ya emitida por el menor', () => {
    expect(CONS_API).toMatch(/origen = 'propia'/);
    expect(CONS_API).toMatch(/Solo él puede cambiarla/);
  });
});
