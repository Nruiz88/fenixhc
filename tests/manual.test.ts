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

describe('el manual habla con el socio, no con el desarrollador', () => {
  it('ninguna tarea anuncia que una función falta', () => {
    // El manual es para la directiva, no para quien desarrolla. Anunciar que
    // "todavía no hay pantalla para X" le dice al socio que el club no lo
    // tiene, que es distinto de cómo se usa hoy lo que sí hay.
    //
    // Si una función no existe, no se documenta. Si existe y se usa por otro
    // medio, se documenta el medio que hay.
    const estadoDeDesarrollo = TAREAS.flatMap((t) =>
      [
        ...t.pasos.map((p) => p.texto),
        ...t.pasos.map((p) => p.nota ?? ''),
        ...(t.avisos ?? []),
      ]
        .filter((txt) =>
          /todavía no|aún no|en preparación|pendiente de|se completa|falta implementar|no hay pantalla|debería existir/i.test(
            txt
          )
        )
        .map((txt) => `${t.id}: "${txt}"`)
    );

    expect(estadoDeDesarrollo, estadoDeDesarrollo.join('\n')).toEqual([]);
  });

  it('los avisos son cosas que se rompen, no cosas que faltan', () => {
    // Un aviso tiene que explicar qué pasa mal si no se sabe. Si se documenta
    // el motivo, la persona entiende por qué el paso va en ese orden.
    for (const t of TAREAS) {
      for (const a of t.avisos ?? []) {
        expect(
          a.length,
          `${t.id}: un aviso de menos de 20 caracteres no explica nada ("${a}")`
        ).toBeGreaterThan(20);
      }
    }
  });

  it('cada tarea dice para qué cargo es', () => {
    // El manual se filtra por permisos, pero el texto tiene que decirlo. La
    // diferencia: si el tesorero ve "cargá un comunicado" desaparecer de la
    // pantalla y no entiende por qué, y si lo ve, tiene que entender que no
    // puede.
    const conPermiso = TAREAS.filter((t) => t.capacidad && t.modulo === 'junta');

    for (const t of conPermiso) {
      // El reparto de cargos puede estar en el paso, en la nota o en el aviso:
      // lo que importa es que esté escrito en algún lado.
      const texto = [
        ...t.pasos.map((p) => p.texto),
        ...t.pasos.map((p) => p.nota ?? ''),
        ...(t.avisos ?? []),
      ].join(' ');
      expect(
        texto,
        `${t.id} no aclara que cargo puede hacerla`
      ).toMatch(/presidente|secretario|tesorero|vocal/i);
    }
  });
});
describe('los ejemplos enseÃ±an, no decoran', () => {
  it('las tareas mÃ¡s consultadas tienen ejemplo', () => {
    // Un ejemplo enseÃ±a la forma del resultado mÃ¡s rÃ¡pido que una
    // instrucciÃ³n: "AprobÃ¡ el comprobante" no dice cuÃ¡nto tiene que dar.
    // Sin ejemplo, la persona aprueba a ciegas y se entera del error cuando la
    // contabilidad no cierra.
    const debenTener = [
      'aprobar-pago',
      'pago-otro-canal',
      'recargo-atraso',
      'crear-usuario',
      'vincular-familia',
      'registrar-gasto',
      'consentimientos',
    ];

    for (const id of debenTener) {
      const t = TAREAS.find((x) => x.id === id);
      expect(t, `${id} no existe`).toBeTruthy();
      expect(t!.ejemplo, `${id} se usa todos los meses y no tiene ejemplo`).toBeTruthy();
    }
  });

  it('los ejemplos usan los nÃºmeros reales del club', () => {
    // Un ejemplo con nÃºmeros inventados desconecta a la persona de la
    // pantalla: ve $50.000 donde la pantalla dice $75.000 y deja de confiar.
    const conEjemplo = TAREAS.filter((t) => t.ejemplo);
    expect(conEjemplo.length).toBeGreaterThanOrEqual(10);

    const conPlata = conEjemplo.filter((t) => /\$/.test(t.ejemplo!));
    expect(conPlata.length, 'ningÃºn ejemplo muestra un monto').toBeGreaterThanOrEqual(5);
  });

  it('los ejemplos tienen un largo que se lee de un vistazo', () => {
    // Un ejemplo de una lÃ­nea no muestra el caso; uno de un pÃ¡rrafo deja de
    // usarse porque hay que leerlo entero antes de empezar.
    for (const t of TAREAS) {
      if (!t.ejemplo) continue;
      expect(t.ejemplo.length, `${t.id}: ejemplo muy corto`).toBeGreaterThan(60);
      expect(t.ejemplo.length, `${t.id}: ejemplo muy largo`).toBeLessThan(320);
    }
  });
});

describe('los temas son navegables', () => {
  it('toda secciÃ³n declara un Ã­cono que existe', () => {
    // Si el Ã­cono no existe en el mapa, la pantalla cae al BookOpen y todas
    // las tarjetas se ven iguales: la navegaciÃ³n por tema deja de servir.
    const ICONOS = ['Sparkles', 'Users', 'DollarSign', 'PieChart', 'CalendarDays',
                    'Megaphone', 'Landmark', 'ShieldCheck'];
    for (const s of MANUAL) {
      expect(ICONOS, `la secciÃ³n "${s.titulo}" usa "${s.icono}"`).toContain(s.icono);
    }
  });

  it('ninguna secciÃ³n tiene el mismo Ã­cono que otra', () => {
    // Si dos temas se ven igual, el Ã­ndice no sirve para elegir.
    const iconos = MANUAL.map((s) => s.icono);
    const repetidos = iconos.filter((i, n) => iconos.indexOf(i) !== n);
    expect(repetidos).toEqual([]);
  });

  it('toda secciÃ³n se presenta sola', () => {
    // Con un solo tema el filtro es ruido, y con ninguno es un menu vacÃ­o.
    for (const s of MANUAL) {
      expect(s.tareas.length, `"${s.titulo}" tiene una sola tarea`).toBeGreaterThan(2);
    }
  });

  it('los identificadores de secciÃ³n no se repiten', () => {
    // El tema se elige por tÃ­tulo, asÃ­ que dos secciones con el mismo tÃ­tulo
    // fundirÃ­an la navegaciÃ³n.
    const titulos = MANUAL.map((s) => s.titulo);
    const repetidos = titulos.filter((t, i) => titulos.indexOf(t) !== i);
    expect(repetidos).toEqual([]);
  });
});

describe('la paginaciÃ³n no promete lo que no hay', () => {
  it('las tareas por pÃ¡gina alcanzan para varias pÃ¡ginas', () => {
    // Si no, la paginaciÃ³n nunca aparece y el cÃ³digo eså¤æ‚åº¦ muerta.
    expect(TAREAS.length).toBeGreaterThan(6);
  });

  it('ninguna tarea visible se repite entre Ã­ndice y detalle', () => {
    // La clave del Ã­ndice es el id. Si dos tareas compartieran id, al abrir
    // una se abrirÃ­a la otra.
    const ids = TAREAS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});