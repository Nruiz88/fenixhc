import { describe, it, expect } from 'vitest';
import {
  agruparParaAvisar, componerAviso, diasDeAtraso, nombreMes,
  type CuotaParaAvisar, type FamiliarParaAvisar, type Responsable, type SeguroParaAvisar,
} from '@/lib/avisos';
import { calcularRecargo, type Vencimiento } from '@/lib/cuotas';

// La decisión de a quién se avisa es la parte que importa, y se puede probar sin
// base: los tramos y la fecha son lo único que decide.
//
// LAS FECHAS DE LOS TESTS SON LOCALES A PROPÓSITO
//
// `new Date('2026-04-25')` se parsea como medianoche UTC, que en Argentina es el
// día anterior a las 21. Con eso `calcularRecargo` cuenta un día menos y los
// tests miden el huso horario en vez de la regla del club. Se usa
// `new Date(anio, mes, dia)`, que es local y es como el club piensa las fechas.

const TRAMOS: Vencimiento[] = [
  { id: 'v1', dia: 10, porcentaje: 5, etiqueta: '', activo: true, orden: 1 },
  { id: 'v2', dia: 20, porcentaje: 10, etiqueta: '', activo: true, orden: 2 },
  { id: 'v3', dia: 30, porcentaje: 20, etiqueta: '', activo: true, orden: 3 },
];

const dia = (mes: number, d: number, anio = 2026) => new Date(anio, mes - 1, d);

function cuota(mes: number, hoy: Date, monto = 75_000, usuarioId = 'u1'): CuotaParaAvisar {
  return {
    id: 'c-' + mes,
    usuarioId,
    mes,
    anio: 2026,
    monto,
    recargo: calcularRecargo(monto, mes, 2026, TRAMOS, hoy),
  };
}

const ANA: Responsable = {
  usuarioId: 'u1',
  perfilId: 'p1',
  nombre: 'Ana',
  apellido: 'Ruiz',
  telefono: '11 5555 0000',
  correo: 'ana@club.com',
  jugadores: [{ id: 'j1', nombre: 'Lucia', apellido: 'Ruiz' }],
};

const SEGURO_PENDIENTE: SeguroParaAvisar = {
  usuarioId: 'u1',
  jugadorId: 'j1',
  adherido: false,
};

describe('qué cuenta como vencida', () => {
  it('la cuota de marzo no tiene recargo el 5 de abril', () => {
    // Vence el 10 de abril. El 5 todavía no llegó.
    expect(cuota(3, dia(4, 5)).recargo.porcentaje).toBe(0);
  });

  it('la cuota de marzo ya tiene recargo el 15 de abril', () => {
    expect(cuota(3, dia(4, 15)).recargo.porcentaje).toBe(5);
  });

  it('antes del primer hito no se avisa a nadie', () => {
    expect(agruparParaAvisar([ANA], [cuota(3, dia(4, 5))], [])).toHaveLength(0);
  });

  it('pasado el primer hito sí se avisa', () => {
    expect(agruparParaAvisar([ANA], [cuota(3, dia(4, 15))], [])).toHaveLength(1);
  });

  it('sin tramos cargados no se avisa a nadie', () => {
    // Una instalación nueva no tiene tramos. Reclamar un recargo que el club
    // nunca definió es peor que no avisar.
    const c = cuota(3, dia(9, 1));
    c.recargo = calcularRecargo(75_000, 3, 2026, [], dia(9, 1));

    expect(c.recargo.porcentaje).toBe(0);
    expect(agruparParaAvisar([ANA], [c], [])).toHaveLength(0);
  });

  it('la cuota de febrero ya está en el último tramo el 15 de abril', () => {
    // Vencía en marzo. En abril va por el 20%.
    expect(cuota(2, dia(4, 15)).recargo.porcentaje).toBe(20);
  });
});

describe('una familia al día con las cuotas pero con el seguro vencido', () => {
  // Este caso lo define el diseño: la lista se arma a partir de los
  // responsables, no de las cuotas. Si se armara desde las cuotas, esta familia
  // no aparecería nunca y se quedaría sin seguro indefinidamente.
  it('igual aparece en la lista', () => {
    const lista = agruparParaAvisar([ANA], [], [SEGURO_PENDIENTE]);

    expect(lista).toHaveLength(1);
    expect(lista[0].motivo).toBe('seguro');
    expect(lista[0].montoTotal).toBe(0);
    expect(lista[0].seguroJugador?.nombre).toBe('Lucia');
  });

  it('un seguro ya adherido no genera aviso', () => {
    const lista = agruparParaAvisar([ANA], [], [{ ...SEGURO_PENDIENTE, adherido: true }]);
    expect(lista).toHaveLength(0);
  });

  it('una familia al día en todo no aparece', () => {
    expect(agruparParaAvisar([ANA], [], [])).toHaveLength(0);
  });
});

describe('un aviso por familia, no uno por cuota', () => {
  const hoy = dia(4, 15);

  it('dos cuotas del mismo socio van en un solo aviso', () => {
    // Caso real: una familia con dos pibes y las dos cuotas atrasadas. Mandar
    // dos mensajes por lo mismo es la forma más rápida de que dejen de leer.
    const lista = agruparParaAvisar([ANA], [cuota(3, hoy), cuota(2, hoy, 70_000)], []);

    expect(lista).toHaveLength(1);
    expect(lista[0].cuotas.length).toBe(2);
  });

  it('el motivo distingue cuota, seguro y las dos cosas', () => {
    expect(agruparParaAvisar([ANA], [cuota(3, hoy)], [])[0].motivo).toBe('cuota');
    expect(agruparParaAvisar([ANA], [], [SEGURO_PENDIENTE])[0].motivo).toBe('seguro');
    expect(
      agruparParaAvisar([ANA], [cuota(3, hoy)], [SEGURO_PENDIENTE])[0].motivo
    ).toBe('mixto');
  });

  it('el total suma el recargo de cada cuota', () => {
    const a = cuota(3, hoy);          // 75000 +5%  = 78750
    const b = cuota(2, hoy, 70_000);  // 70000 +20% = 84000
    const [f] = agruparParaAvisar([ANA], [a, b], []);

    expect(f.montoTotal).toBe(78_750 + 84_000);
  });

  it('dos familias se mantienen separadas', () => {
    const juan: Responsable = { ...ANA, usuarioId: 'u2', nombre: 'Juan' };
    const lista = agruparParaAvisar(
      [ANA, juan],
      [cuota(3, hoy), cuota(3, hoy, 60_000, 'u2')],
      []
    );

    expect(lista).toHaveLength(2);
    expect(lista.map((f) => f.nombre).sort()).toEqual(['Ana', 'Juan']);
  });

  it('la más vencida va primero', () => {
    // Por dónde tiene que empezar la tesorería: lo que más días lleva, antes.
    const juan: Responsable = { ...ANA, usuarioId: 'u2', nombre: 'Juan' };
    const lista = agruparParaAvisar(
      [ANA, juan],
      [cuota(3, hoy), cuota(1, hoy, 75_000, 'u2')],   // Ana venció en abril, Juan en febrero
      []
    );

    expect(lista[0].nombre).toBe('Juan');
  });
});

describe('el texto del aviso', () => {
  const base: FamiliarParaAvisar = { ...ANA, cuotas: [], montoTotal: 0, diasVencida: 0,
    motivo: 'cuota', seguroPendiente: false, seguroJugador: null };

  it('una sola cuota se lee en una frase', () => {
    const c = cuota(3, dia(4, 15));
    const texto = componerAviso({ ...base, cuotas: [c], montoTotal: c.recargo.total });

    expect(texto).toContain('Hola Ana Ruiz');
    expect(texto).toContain('marzo de 2026');
    expect(texto).toContain('78.750');
  });

  it('varias cuotas van listadas con su total', () => {
    const a = cuota(3, dia(4, 15));
    const b = cuota(2, dia(4, 15), 70_000);
    const [f] = agruparParaAvisar([ANA], [a, b], []);
    const texto = componerAviso({ ...base, ...f });

    expect(texto).toContain('marzo de 2026');
    expect(texto).toContain('febrero de 2026');
    expect(texto).toContain('Total a pagar');
    expect(texto).toContain('162.750');
  });

  it('menciona al jugador cuando el motivo es el seguro', () => {
    const texto = componerAviso({
      ...base,
      motivo: 'seguro',
      seguroPendiente: true,
      seguroJugador: { id: 'j1', nombre: 'Lucia', apellido: 'Ruiz' },
    });

    expect(texto).toContain('Lucia Ruiz');
    expect(texto).toContain('seguro');
  });

  it('con cuota y seguro juntos, nombra los dos', () => {
    const c = cuota(3, dia(4, 15));
    const texto = componerAviso({
      ...base,
      motivo: 'mixto',
      cuotas: [c],
      montoTotal: c.recargo.total,
      seguroPendiente: true,
      seguroJugador: { id: 'j1', nombre: 'Lucia', apellido: 'Ruiz' },
    });

    expect(texto).toContain('marzo de 2026');
    expect(texto).toContain('Lucia Ruiz');
  });

  it('siempre dice cómo pagar y que avise si ya pagó', () => {
    // Sin esto la familia contesta "no sé a dónde pagar" y hay que responder
    // uno por uno, que es justo lo que el aviso tenía que evitar.
    const texto = componerAviso(base);
    expect(texto.toLowerCase()).toContain('transferencia');
    expect(texto.toLowerCase()).toContain('si ya pagaste');
  });

  it('los meses salen en español', () => {
    expect(nombreMes(3)).toBe('marzo');
    expect(nombreMes(2)).toBe('febrero');
    expect(nombreMes(12)).toBe('diciembre');
  });
});

describe('los días de atraso', () => {
  it('se cuentan desde el hito, no desde el día 1', () => {
    // La de marzo venció el 10 de abril; estamos el 15: 5 días.
    expect(diasDeAtraso(cuota(3, dia(4, 15)))).toBe(5);
  });

  it('al día siguiente del hito es un día', () => {
    expect(diasDeAtraso(cuota(3, dia(4, 11)))).toBe(1);
  });

  it('sin hito no hay atraso, no un número negativo', () => {
    expect(diasDeAtraso(cuota(3, dia(4, 1)))).toBe(0);
  });

  it('deja el máximo cuando hay varias cuotas vencidas', () => {
    // Interesa la más vieja: es la que hay que empujar.
    const antigua = cuota(1, dia(4, 15));  // venció en febrero
    const nueva = cuota(3, dia(4, 15));    // venció el 10 de abril
    const [f] = agruparParaAvisar([ANA], [antigua, nueva], []);

    expect(f.diasVencida).toBe(diasDeAtraso(antigua));
    expect(f.diasVencida).toBeGreaterThan(diasDeAtraso(nueva));
  });
});