import { calcularRecargo, type ResultadoRecargo } from './cuotas';

// Quién le toca pagar y a quién hay que avisarle.
//
// POR QUÉ ESTO ESTÁ SEPARADO DE LA BASE
//
// La decisión de "esta cuota está vencida" es una regla del club —depende de los
// tramos configurados y de la fecha— y la regla se puede probar sin base. Traer
// los datos es una cosa; decidir qué hacer con ellos es otra. Mezclarlas
// obligaría a levantar MariaDB para comprobar que el día 10 ya tiene recargo.
//
// LA REGLA DE "VENCIDA"
//
// Una cuota cuenta como vencida cuando tiene recargo aplicado, o sea cuando ya
// pasó el primer hito. Con los tramos de hoy —día 10, 20 y 30— eso es desde el
// día 10 del mes siguiente.
//
// Podría marcarse desde el día 1. No se hace a propósito: avisar el día 2
// molesta a una familia que tiene la plata y va a pagar el 8, y si el club avisa
// de más la gente deja de leer. El club dijo que vence el 10; antes de eso no
// hay nada que reclamar.

export interface CuotaParaAvisar {
  id: string;
  /** Usuario del socio responsable. A él se le avisa. */
  usuarioId: string;
  mes: number;
  anio: number;
  monto: number;
  recargo: ResultadoRecargo;
}

export interface Responsable {
  usuarioId: string;
  perfilId: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  correo: string | null;
  /** Jugadores a nombre de este socio. Para poder decir "el seguro de Lucía". */
  jugadores: { id: string; nombre: string; apellido: string }[];
}

export interface SeguroParaAvisar {
  /** Usuario del socio responsable de este jugador. */
  usuarioId: string;
  jugadorId: string;
  adherido: boolean;
}

export interface FamiliarParaAvisar extends Responsable {
  cuotas: CuotaParaAvisar[];
  /** Total adeudado ya con recargo. */
  montoTotal: number;
  /** Días que lleva vencida la más antigua. */
  diasVencida: number;
  motivo: 'cuota' | 'seguro' | 'mixto';
  seguroPendiente: boolean;
  seguroJugador: { id: string; nombre: string; apellido: string } | null;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function nombreMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

/** Cuántos días lleva vencida una cuota, contados desde el hito vigente. */
export function diasDeAtraso(c: CuotaParaAvisar): number {
  if (c.recargo.diasVencida > 0) return c.recargo.diasVencida;
  // Sin hito vigente no hay atraso. La función se llama sobre cuotas que ya
  // pasaron el primer hito, pero `fechaHito` puede venir null si alguien cambió
  // los tramos a mitad de cálculo.
  if (!c.recargo.fechaHito) return 0;

  const diaLocal = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  return Math.max(0, Math.round((diaLocal(new Date()) - diaLocal(c.recargo.fechaHito)) / 86_400_000));
}

const pesos = (n: number) => n.toLocaleString('es-AR');

/** Arma el texto del aviso, con los montos ya resueltos. */
export function componerAviso(f: FamiliarParaAvisar): string {
  const lineas: string[] = [];

  lineas.push(`Hola ${f.nombre} ${f.apellido}, te escribimos desde el Club Fénix.`);

  if (f.cuotas.length === 0 && f.seguroJugador) {
    lineas.push('');
    lineas.push('Tenemos pendiente la renovación del seguro de tu hijo:');
    lineas.push(`· ${f.seguroJugador.nombre} ${f.seguroJugador.apellido}`);
  } else {
    if (f.cuotas.length === 1) {
      const c = f.cuotas[0];
      lineas.push('');
      lineas.push(
        `La cuota de ${nombreMes(c.mes)} de ${c.anio} está pendiente. Con el recargo por atraso vigente, el total es $${pesos(c.recargo.total)}.`
      );
    } else if (f.cuotas.length > 1) {
      lineas.push('');
      lineas.push('Tenemos pendientes estas cuotas:');
      for (const c of f.cuotas) {
        lineas.push(`· ${nombreMes(c.mes)} de ${c.anio}: $${pesos(c.recargo.total)}`);
      }
      lineas.push(
        `Total a pagar: $${pesos(f.montoTotal)}, con los recargos que corresponden a la fecha de hoy.`
      );
    }

    if (f.seguroJugador) {
      lineas.push('');
      lineas.push(
        `Además está pendiente la renovación del seguro de ${f.seguroJugador.nombre} ${f.seguroJugador.apellido}.`
      );
    }
  }

  lineas.push('');
  lineas.push(
    'Podés pagar con transferencia o efectivo en secretaría. Si ya pagaste, avisanos y lo registramos.'
  );

  return lineas.join('\n');
}

/**
 * Arma la lista de a quién hay que avisarle, y por qué.
 *
 * `responsables` es la lista completa de socios con jugadores. Se necesita
 * entera, y no solo los que deben cuotas, porque una familia puede estar al día
 * con las cuotas y tener el seguro vencido: si se armara la lista a partir de
 * las cuotas, esa familia nunca aparecería.
 *
 * Se agrupa por socio y no por cuota a propósito: uno con dos hijos y dos
 * cuotas vencidas recibe UN aviso. Dos mensajes por lo mismo es la forma más
 * rápida de que alguien deje de leer.
 */
export function agruparParaAvisar(
  responsables: Responsable[],
  cuotas: CuotaParaAvisar[],
  seguros: SeguroParaAvisar[]
): FamiliarParaAvisar[] {
  const porUsuario = new Map<string, FamiliarParaAvisar>();

  // Se parte de TODOS los responsables, no solo de los que deben. Si se
  // arrancara por las cuotas, quien solo debe el seguro se quedaría fuera.
  for (const r of responsables) {
    porUsuario.set(r.usuarioId, {
      ...r,
      jugadores: [...r.jugadores],
      cuotas: [],
      montoTotal: 0,
      diasVencida: 0,
      motivo: 'cuota',
      seguroPendiente: false,
      seguroJugador: null,
    });
  }

  for (const c of cuotas) {
    const f = porUsuario.get(c.usuarioId);
    if (!f) continue;
    // Solo entra lo que tiene recargo. Lo demás todavía no venció y no es
    // motivo para escribirle a nadie.
    if (c.recargo.porcentaje <= 0) continue;
    f.cuotas.push(c);
  }

  for (const s of seguros) {
    if (s.adherido) continue;
    const f = porUsuario.get(s.usuarioId);
    if (!f) continue;

    const jugador = f.jugadores.find((j) => j.id === s.jugadorId);
    f.seguroPendiente = true;
    f.seguroJugador = jugador
      ? { id: jugador.id, nombre: jugador.nombre, apellido: jugador.apellido }
      : null;
  }

  const lista: FamiliarParaAvisar[] = [];

  for (const f of porUsuario.values()) {
    if (f.cuotas.length === 0 && !f.seguroPendiente) continue;

    f.montoTotal = f.cuotas.reduce((s, c) => s + c.recargo.total, 0);
    f.diasVencida = f.cuotas.reduce((max, c) => Math.max(max, diasDeAtraso(c)), 0);
    f.motivo =
      f.cuotas.length > 0 && f.seguroPendiente
        ? 'mixto'
        : f.cuotas.length > 0
          ? 'cuota'
          : 'seguro';

    lista.push(f);
  }

  // Primero lo que más días lleva vencido: es por donde tiene que empezar la
  // tesorería.
  return lista.sort((a, b) => b.diasVencida - a.diasVencida || b.montoTotal - a.montoTotal);
}