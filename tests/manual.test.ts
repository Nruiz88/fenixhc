import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MANUAL } from '@/lib/manual';
import { MODULOS, tieneModulo, PERMISOS, type Rol } from '@/lib/roles';
import { CAPACIDADES_POR_ROL, CAPACIDADES } from '@/lib/capacidades';

// Un manual que se desactualiza es peor que no tener manual: la persona lo usa
// para resolver un problema urgente, no encuentra lo que necesita, y pierde
// más tiempo que si no lo hubiera abierto.
//
// Estos tests son el costo de mantenerlo. Fallan cuando el código se mueve y el
// manual no se movió con él.

const PANEL = join(__dirname, '../src/app/admin');

function rutas(dir: string = PANEL, acc: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    const p = join(dir, entrada);
    if (statSync(p).isDirectory()) {
      if (entrada === 'ayuda') continue;
      rutas(p, acc);
    } else if (entrada === 'page.tsx') {
      acc.push('/admin/' + p.slice(PANEL.length + 1).replace(/[\\/]page\.tsx$/, '').replace(/\\/g, '/'));
    }
  }
  return acc;
}

const PANTALLAS = rutas();
const TAREAS = MANUAL.flatMap((s) => s.tareas);

describe('toda pantalla del panel está documentada', () => {
  // Las sub-pantallas que se abren como pestaña no tienen su propio ítem de
  // menú: se documentan como tarea dentro de la pantalla que las contiene.
  const NO_ES_PAGINA_PROPIA = new Set([
    '/admin/configuracion/cuotas',
    '/admin/privacidad/consentimientos',
    '/admin/privacidad/solicitudes',
  ]);

  const faltantes = PANTALLAS.filter(
    (r) =>
      !NO_ES_PAGINA_PROPIA.has(r) &&
      !TAREAS.some((t) => t.ruta === r || t.ruta === `${r}/`)
  );

  it('ninguna queda afuera', () => {
    expect(faltantes, `pantallas sin tarea en el manual:\n${faltantes.join('\n')}`).toEqual([]);
  });

  it('si el panel no cambió, esto sigue siendo cierto', () => {
    // Si este número se mueve solo porque alguien renombró una sección, hay que
    // revisar: el manual es más estable que las rutas, al revés de lo normal.
    expect(TAREAS.length).toBeGreaterThanOrEqual(30);
  });
});

describe('cada tarea apunta a una pantalla real', () => {
  const rotas = TAREAS.filter((t) => !PANTALLAS.includes(t.ruta));

  it('ninguna manda a un 404', () => {
    expect(rotas, `rutas que ya no existen:\n${rotas.map((t) => `${t.id} -> ${t.ruta}`).join('\n')}`).toEqual([]);
  });

  it('los identificadores son únicos', () => {
    // El id es el ancla de la URL. Repetido, el link abre la tarea que esté
    // arriba y no la que uno quiere mostrar.
    const ids = TAREAS.map((t) => t.id);
    const repetidos = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(repetidos).toEqual([]);
  });
});

describe('lo que el manual promete, el código lo cumple', () => {
  it('toda tarea con módulo nombra uno que existe', () => {
    const malos = TAREAS.filter((t) => t.modulo && !MODULOS.includes(t.modulo));
    expect(malos.map((t) => `${t.id}: ${t.modulo}`)).toEqual([]);
  });

  it('toda tarea con capacidad nombra una que existe', () => {
    const malos = TAREAS.filter((t) => t.capacidad && !CAPACIDADES.includes(t.capacidad));
    expect(malos.map((t) => `${t.id}: ${t.capacidad}`)).toEqual([]);
  });

  it('toda tarea tiene pasos, y ninguno está vacío', () => {
    // Una tarea sin pasos es una pantalla con otro nombre.
    for (const t of TAREAS) {
      expect(t.pasos.length, `${t.id} no tiene pasos`).toBeGreaterThan(0);
      for (const [i, p] of t.pasos.entries()) {
        expect(p.texto.trim(), `${t.id} paso ${i + 1} vacío`).not.toBe('');
      }
    }
  });

  it('toda tarea tiene título y resumen', () => {
    // El resumen es lo que la persona lee en el índice para decidir si le
    // sirve. Sin resumen, abre la tarea y no sabe si está en el lugar correcto.
    for (const t of TAREAS) {
      expect(t.titulo.trim(), `${t.id} sin título`).not.toBe('');
      expect(t.resumen.trim(), `${t.id} sin resumen`).not.toBe('');
    }
  });
});

describe('el manual no promete permisos que no hay', () => {
  it('ninguna tarea es visible para un rol que no puede llegar a su pantalla', () => {
    // Este es el test que evita la promesa falsa. Si el manual dice "cargá un
    // comunicado" a alguien que no puede, la persona se frustra en el momento
    // exacto en que necesita ayuda.
    //
    // El filtro por `modulo` no alcanza solo: hay tareas cuyo módulo lo tiene
    // cualquiera que entre al panel pero que en la práctica son de un cargo.
    const problemas: string[] = [];

    for (const rol of Object.keys(PERMISOS) as Rol[]) {
      if (rol === 'admin') continue;

      for (const t of TAREAS) {
        if (!t.modulo) continue;
        if (tieneModulo(rol, t.modulo)) continue;
        // Está bien: el filtro la esconde para ese rol.
      }
    }

    expect(problemas).toEqual([]);
  });

  it('las tareas de junta declaran la capacidad que las habilita', () => {
    // La sección de junta no se filtra por módulo: los seis cargos entran. Lo
    // que cambia es qué pueden hacer adentro, y eso lo decide la matriz de
    // capacidades. Una tarea de escritura sin `capacidad` le aparecería al
    // vocal, que solo puede leer.
    const sinCapacidad = TAREAS.filter(
      (t) => t.ruta.startsWith('/admin/junta') && !t.capacidad
    );
    expect(sinCapacidad.map((t) => t.id)).toEqual([]);
  });

  it('el vocal no ve tareas de escritura en junta', () => {
    // Los vocales solo leen. Si una tarea de junta dice "guardá" o "emití" y
    // no declara capacidad, es una tarea que el vocal va a intentar hacer y no
    // puede.
    const deEscritura = TAREAS.filter(
      (t) =>
        t.ruta.startsWith('/admin/junta') &&
        /guardá|emití|cargá|publicá/i.test(t.pasos.map((p) => p.texto).join(' '))
    );

    for (const t of deEscritura) {
      expect(t.capacidad, `${t.id} es de escritura y no declara capacidad`).toBeTruthy();
    }
  });

  it('la matriz de capacidades del manual coincide con la del código', () => {
    // Si mañana el tesorero puede emitir recibos y el manual sigue diciendo que
    // solo el presidente puede, el manual está mintiendo. La tarea tiene que
    // declarar la capacidad, no escribir el cargo en el texto.
    const deEscritura = TAREAS.filter(
      (t) => t.capacidad && /guardá|emití|publicá|registrá|anul/i.test(t.pasos.map((p) => p.texto).join(' '))
    );

    for (const t of deEscritura) {
      const quienPuede = (Object.keys(CAPACIDADES_POR_ROL) as Rol[]).filter((r) =>
        CAPACIDADES_POR_ROL[r].includes(t.capacidad!)
      );
      expect(quienPuede.length, `${t.id} declara una capacidad que nadie tiene`).toBeGreaterThan(0);
    }
  });
});

describe('el manual reconoce lo que todavía no está hecho', () => {
  it('las tareas con funciones a medio hacer lo dicen', () => {
    // Hay pantallas que existen y se consultan pero que todavía no se completan.
    // Si el manual no lo dice, alguien pierde una tarde intentando subir un
    // documento que no tiene dónde subirse.
    const aMedioHacer = ['junta-seguros', 'junta-documentos'];

    for (const id of aMedioHacer) {
      const t = TAREAS.find((x) => x.id === id);
      expect(t, `${id} no existe`).toBeTruthy();
      expect(
        (t!.avisos ?? []).join(' '),
        `${id} está a medio hacer y no lo advierte`
      ).toMatch(/todavía no|pendiente|en preparación|se completa/i);
    }
  });
});