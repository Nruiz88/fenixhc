// Consentimientos y menores de edad.
//
// Todo lo que decide SI se puede tratar un dato de un menor vive acá, en
// funciones puras y probadas. No es una formalidad: es lo que separa a un club
// que puede responder "el 3 de marzo su madre autorizó la foto del DNI, y el
// 20 de agosto el chico pidió que se borrara" de uno que no puede responder
// nada.
//
// ADVERTENCIA — LEER ANTES DE TOCAR EL TEXTO
//
// Este módulo implementa un CRITERIO TÉCNICO, no una opinión legal. Las
// referencias a la Ley 25.326 y al Código Civil están para que quien revise
// pueda rastrear el fundamento. El texto que ve el usuario final, el catálogo
// de finalidades y los plazos tienen que ser validados por un abogado antes de
// operar con menores de verdad. Nada de lo que hay acá reemplaza esa revisión.

/** La versión del aviso que se firma. Cambiar el aviso obliga a cambiar esto. */
export const VERSION_AVISO = '2026-09-30';

// ------------------------------------------------------------
// Finalidades
// ------------------------------------------------------------
//
// Catálogo cerrado a propósito. Un propósito escrito a mano ("lo que haga
// falta") no se puede contar, comparar ni auditar: al año nobody sabe qué
// consintieron realmente. Cada finalidad tiene que poder contestarse sola.

export type Finalidad =
  | 'inscripcion'
  | 'contacto'
  | 'documentacion_dni'
  | 'datos_deportivos'
  | 'imagenes'
  | 'comunicaciones'
  | 'cuotas_contabilidad';

export type BaseLegal = 'consentimiento' | 'ejecucion_de_contrato' | 'obligacion_legal';

export interface DefFinalidad {
  id: Finalidad;
  /** Lo que se le muestra a la persona. Sin jerga legal. */
  etiqueta: string;
  /** Qué dato concreto cae acá. Sirve para que la casilla no sea una caja negra. */
  datos: string;
  baseLegal: BaseLegal;
  /**
   * Consentimiento expreso y por separado.
   *
   * En el derecho argentino el consentimiento tiene que ser libre, informado,
   * expreso y claro. Para estas finalidades eso se traduce en algo concreto:
   * la casilla NO viene marcada, NO se agrupa con otras, y el texto explica
   * qué pasa si se dice que no. "Acepto el aviso de privacidad" con todo
   * adentro no alcanza para el DNI de un menor.
   */
  expreso: boolean;
  /**
   * Si es un menor, esta finalidad necesita además el consentimiento del
   * representante Y la opinión del menor.
   *
   * La opinión no es un extra: el Código Civil exige que en los actos que
   * afectan al menor se tenga en cuenta su propia voluntad, y para datos que
   * afectan a su identidad y su cuerpo eso es lo que se está respetando.
   */
  requiereOpinionMenor: boolean;
  /** Cómo se le explica al usuario que puede decir que no. */
  siNo: string;
}

export const FINALIDADES: Record<Finalidad, DefFinalidad> = {
  inscripcion: {
    id: 'inscripcion',
    etiqueta: 'Gestionar la inscripción',
    datos: 'Nombre, apellido, DNI y, si lo carga, CUIL.',
    baseLegal: 'ejecucion_de_contrato',
    expreso: false,
    requiereOpinionMenor: false,
    siNo:
      'Sin esto el club no puede gestionar la inscripción. Es el único dato sin el cual no hay relación posible.',
  },
  contacto: {
    id: 'contacto',
    etiqueta: 'Contactarte',
    datos: 'Correo electrónico, teléfono y domicilio, para avisos de cobranza y actividades.',
    baseLegal: 'ejecucion_de_contrato',
    expreso: false,
    requiereOpinionMenor: false,
    siNo: 'Vas a tener que enterarte de los vencimientos por otros medios.',
  },
  documentacion_dni: {
    id: 'documentacion_dni',
    etiqueta: 'Guardar fotos del documento de identidad',
    datos:
      'Fotos del frente y dorso del DNI. El club las usa solo para verificar la identidad del jugador.',
    baseLegal: 'consentimiento',
    expreso: true,
    requiereOpinionMenor: true,
    siNo:
      'El club no puede guardar la documentación. La inscripción sigue adelante, pero no se puede acreditar la identidad ante una organización sportiva.',
  },
  datos_deportivos: {
    id: 'datos_deportivos',
    etiqueta: 'Datos de la actividad deportiva',
    datos:
      'Categoría, posición, partidos, observaciones de la ficha técnica y, si se carga, lesiones o datos de salud.',
    baseLegal: 'consentimiento',
    expreso: true,
    requiereOpinionMenor: true,
    siNo:
      'El club lleva la inscripción pero no un historial deportivo. Afecta la confía en la organización de las categorías.',
  },
  imagenes: {
    id: 'imagenes',
    etiqueta: 'Fotos y videos en la galería y redes',
    datos: 'Imágenes de partidos, y lo que se publique en la galería del sitio.',
    baseLegal: 'consentimiento',
    expreso: true,
    requiereOpinionMenor: true,
    siNo: 'Nadie va a subir fotos del jugador a la galería ni a las redes del club.',
  },
  comunicaciones: {
    id: 'comunicaciones',
    etiqueta: 'Recibir avisos del club',
    datos: 'Correos y notificaciones sobre cobranza, partidos y suspensiones.',
    baseLegal: 'consentimiento',
    expreso: false,
    requiereOpinionMenor: false,
    siNo: 'Vas a enterarte de las novedades entrando a mirar la web.',
  },
  cuotas_contabilidad: {
    id: 'cuotas_contabilidad',
    etiqueta: 'Cuotas y contabilidad',
    datos:
      'Cuotas emitidas, pagos, comprobantes y movimientos de caja.',
    baseLegal: 'obligacion_legal',
    expreso: false,
    requiereOpinionMenor: false,
    siNo:
      'ESTE DATO NO SE PUEDE RECHAZAR. El club tiene obligación de llevar la contabilidad de sus socios, y por eso se guarda aunque no se acepte nada. No es una casilla: es una obligación legal.',
  },
};

export const TODAS_LAS_FINALIDADES: Finalidad[] = Object.keys(FINALIDADES) as Finalidad[];

/**
 * Finalidades que de verdad dependen de que alguien diga que sí.
 *
 * Se separa del resto porque la consecuencia es distinta: si alguien retira su
 * consentimiento para estas, el club tiene que dejar de tratar esos datos. En
 * las demás no alcanza con retire: hay una obligación detrás.
 */
export const FINALIDADES_REVOCABLES: Finalidad[] = TODAS_LAS_FINALIDADES.filter(
  (f) => FINALIDADES[f].baseLegal === 'consentimiento'
);

/** Finalidades que se conservan pase lo que pase el club. */
export const FINALIDADES_OBLIGATORIAS: Finalidad[] = TODAS_LAS_FINALIDADES.filter(
  (f) => FINALIDADES[f].baseLegal === 'obligacion_legal'
);

// ------------------------------------------------------------
// Edad
// ------------------------------------------------------------

export const EDAD_MAYORIA = 18;

/**
 * Años cumplidos en una fecha dada.
 *
 * Se calcula por mes y día, no dividiendo días: "18 años" en el hockey no es
 * un promedio. Un chico que cumple 18 el 3 de marzo es mayor desde el 3 de
 * marzo, no desde el 3 de marzo menos un día.
 *
 * EL 29 DE FEBRERO
 *
 * El que nació un 29 de febrero no cumple años esa fecha en los años que no
 * son bisiestos. La convención más usada —y la que se aplica acá— es que
 * cumple el 28 de febrero. Es un detalle chico con un solo día de diferencia,
 * pero ese día es la diferencia entre tratar los datos de un menor y los de
 * una persona adulta, así que queda escrito y no depende de qué haga el
 * lenguaje con esa fecha.
 *
 * Si la ley argentina resultara decir otra cosa, el cambio es UNA LÍNEA acá.
 */
export function edadCumplida(nacimiento: string | Date, referencia: Date = new Date()): number | null {
  const n = nacimiento instanceof Date ? nacimiento : parseFecha(nacimiento);
  if (!n) return null;

  let edad = referencia.getFullYear() - n.getFullYear();

  // Cumple años cuando ya pasó su día, o cuando hoy es el 28 y su día era el
  // 29 de un año bisiesto.
  const diaCumple = n.getMonth() === 1 && n.getDate() === 29 ? 28 : n.getDate();
  const cumpleEsteAnio =
    referencia.getMonth() > n.getMonth() ||
    (referencia.getMonth() === n.getMonth() && referencia.getDate() >= diaCumple);

  if (!cumpleEsteAnio) edad -= 1;
  return edad >= 0 ? edad : null;
}

/**
 * Fecha en que la persona alcanza la mayoría de edad.
 *
 * Esto es lo que permite que el club avise. Dentro de tres años, cuando este
 * pibe se haga mayor, el consentimiento que firmó su madre deja de ser la
 * base: pasa a tener que consentir él. Sin guardar esta fecha, nadie se avisa
 * nunca y el club sigue tratando datos de un adulto con el consentimiento de
 * alguien que ya no tiene por qué darlo.
 */
export function fechaMayoria(nacimiento: string | Date): Date | null {
  const n = nacimiento instanceof Date ? nacimiento : parseFecha(nacimiento);
  if (!n) return null;
  return new Date(n.getFullYear() + EDAD_MAYORIA, n.getMonth(), n.getDate());
}

export function esMenor(nacimiento: string | Date | null, referencia: Date = new Date()): boolean | null {
  if (!nacimiento) return null;
  const edad = edadCumplida(nacimiento, referencia);
  if (edad === null) return null;
  return edad < EDAD_MAYORIA;
}

/** `'YYYY-MM-DD'` -> Date local, sin corrimiento por zona horaria. */
function parseFecha(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor.trim());
  if (!m) return null;
  const [, a, mes, dia] = m;
  const d = new Date(Number(a), Number(mes) - 1, Number(dia));
  // Rechaza 31 de febrero y otros: `new Date(2026, 1, 31)` es 3 de marzo.
  if (d.getMonth() !== Number(mes) - 1 || d.getDate() !== Number(dia)) return null;
  return d;
}

/** Valida que la fecha sea una fecha de nacimiento plausible. */
export function fechaNacimientoValida(valor: unknown, referencia: Date = new Date()): boolean {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return false;
  const edad = edadCumplida(valor, referencia);
  // Un jugador del club con más de 100 años o con 3 es un error de carga, no
  // un dato: dejarlo pasar arruinaría los cálculos de edad de todo lo demás.
  return edad !== null && edad <= 100;
}

// ------------------------------------------------------------
// Representación
// ------------------------------------------------------------

export type Vinculo = 'padre' | 'madre' | 'tutor';

export const VINCULOS: Vinculo[] = ['padre', 'madre', 'tutor'];

export const ETIQUETA_VINCULO: Record<Vinculo, string> = {
  padre: 'Padre',
  madre: 'Madre',
  tutor: 'Tutor legal',
};

/**
 * `'otro_representante'` existe para el caso real de la abuela, la tía o el
 *representante legal. No se le da el mismo tratamiento que a un padre: hay que
 * dejarlo asentado, porque es la única señal de que el club tiene que mirar
 * la documentación con más cuidado.
 */
export function esRepresentanteLegitimado(vinculo: string | null | undefined): boolean {
  return vinculo === 'padre' || vinculo === 'madre' || vinculo === 'tutor';
}

// ------------------------------------------------------------
// Opinión del menor
// ------------------------------------------------------------

export type Opinion = 'a_favor' | 'en_contra' | 'no_consultado';

export const ETIQUETA_OPINION: Record<Opinion, string> = {
  a_favor: 'Está de acuerdo',
  en_contra: 'No está de acuerdo',
  no_consultado: 'No se le preguntó',
};

/**
 * La opinión del menor en contra VEDA la finalidad.
 *
 * Es la parte del diseño que más incomoda y la más importante. El padre firmó,
 * pero el chico no está de acuerdo. El club no sube la foto del DNI igual.
 *
 * La alternativa —dejar que la opinion sea un dato más y que el padre pueda
 * igualar— sería guardar la opinión para que exista en el expediente y no
 * para que sirva de algo.
 */
export function opinionVeda(obtiene: Opinion | null | undefined): boolean {
  return obtiene === 'en_contra';
}

// ------------------------------------------------------------
// Reglas de validación del alta
// ------------------------------------------------------------

export interface ConsentimientoRecibido {
  /** Finalidades que el titular marcó. */
  marcadas: string[];
}

export interface DatosMenor {
  nombre: string;
  fechaNacimiento?: string | null;
  /** Opinión que el representante traslada del menor. */
  opinion?: Opinion;
}

export type ResultadoValidacion =
  | { ok: true; finalidades: Finalidad[]; opinion: Opinion }
  | { ok: false; error: string };

/**
 * Valida lo que se envió en el alta de un jugador.
 *
 * Devuelve el primer problema, no una lista. Con un formulario de esta
 * complejidad, mostrar los cinco errores juntos es más difícil de resolver
 * que verlos de a uno: la persona los resuelve en orden.
 */
export function validarConsentimientos(input: {
  consentimiento: ConsentimientoRecibido;
  menor: DatosMenor;
  vinculo?: string | null;
  /**
   * Que el llamador sabe que está.guarda un jugador y no un adulto.
   *
   * Hace falta porque sin fecha de nacimiento no se puede calcular la edad, y
   * entonces la regla "si es menor, pedile la fecha" nunca se dispara: el
   * club se queda sin poder distinguir y el dato no se pide nunca. El que
   * sabe que se está inscribiendo un jugador del club es el formulario de
   * alta, no este cálculo.
   */
  esAltaDeMenor: boolean;
}): ResultadoValidacion {
  const marcadas = new Set(
    (input.consentimiento.marcadas ?? []).filter((f): f is Finalidad =>
      TODAS_LAS_FINALIDADES.includes(f as Finalidad)
    )
  );

  // Las finalidades que el club tiene obligación de guardar se anotan solas,
  // sin casilla. Si vinieran marcadas, se anotan igual: es un hecho, no una
  // elección.
  for (const f of FINALIDADES_OBLIGATORIAS) marcadas.add(f);

  const edad = input.menor.fechaNacimiento
    ? edadCumplida(input.menor.fechaNacimiento)
    : null;
  const esMenorAhora = edad !== null && edad < EDAD_MAYORIA;

  const opinion: Opinion = input.menor.opinion ?? 'no_consultado';

  // --- El jugador necesita representante legítimo -------------------------
  // El vínculo se pide siempre en el alta, se sea menor o no: es lo que
  // autoriza al club a tratar los datos de alguien que en muchos casos no
  // puede autorizarlos por sí mismo.
  if (input.esAltaDeMenor) {
    if (!esRepresentanteLegitimado(input.vinculo)) {
      return {
        ok: false,
        error:
          'Para inscribir a un jugador hay que indicar quién es la madre, el padre o la persona tutora legal.',
      };
    }
    if (!input.menor.fechaNacimiento) {
      return {
        ok: false,
        error:
          'Falta la fecha de nacimiento del jugador. El club la necesita para saber si es menor y, si lo es, con quién tiene que hablar.',
      };
    }
  }

  // Lo que es "expreso" no se concede por omisión: si la casilla no se marcó,
  // esa finalidad simplemente no existe para esta persona.
  //
  // Y acá está el punto que más se confunde: NO se rechaza el alta por no
  // haber marcado esas casillas. Decir que no es un derecho, y un club que
  // obliga a decir que sí no lo cumple: la estaría comprando.
  //
  // La puerta real está donde la operación se va a hacer de verdad: subir la
  // foto del DNI exige el consentimiento vigente, y si no está, no se sube.
  // El alta se hace igual y el jugador queda con la inscripción sin
  // documentación.

  // Para un menor, las finalidades que exigen su opinión no se pueden
  // obtener solo del representante.
  const necesitaOpinion = esMenorAhora
    ? TODAS_LAS_FINALIDADES.filter((f) => FINALIDADES[f].requiereOpinionMenor && marcadas.has(f))
    : [];

  if (opinionVeda(opinion) && necesitaOpinion.length > 0) {
    const nombres = necesitaOpinion.map((f) => FINALIDADES[f].etiqueta).join(', ');
    return {
      ok: false,
      error:
        `El jugador no está de acuerdo con: ${nombres}. ` +
        'Esa opinión prevalece sobre la del representante, aunque firme. ' +
        'Desmarcá esas finalidades para seguir con el alta, o escribile a la secretaría.',
    };
  }

  // La opinión "no consultada" no impide el consentimiento del representante:
  // en muchos casos el chico no tiene edad para entenderlo y consultarle
  // sería una violencia. Lo que no puede es DECIR que no.
  return {
    ok: true,
    finalidades: TODAS_LAS_FINALIDADES.filter((f) => marcadas.has(f)),
    opinion,
  };
}
