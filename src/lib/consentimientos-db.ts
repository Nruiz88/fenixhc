// Acceso a la base de los consentimientos.
//
// Regla que atraviesa todo el archivo: `consentimientos` es SOLO DE ALTA. No
// hay UPDATE ni DELETE en ninguna función. Revocar no borra, agrega una fila
// en `revocaciones_consentimiento`. Si alguna vez se necesita corregir un dato
// mal cargado, se agrega un consentimiento nuevo y se revoca el anterior: el
// historial queda entero.

import { query, execute, transaccion, uuid } from './db';
import {
  VERSION_AVISO,
  FINALIDADES,
  edadCumplida,
  EDAD_MAYORIA,
  type Finalidad,
  type Opinion,
  type Vinculo,
} from './consentimientos';

export interface FilaConsentimiento {
  id: string;
  titular_perfil_id: string;
  otorgante_perfil_id: string | null;
  otorgante_tipo: string;
  vinculo_tipo: Vinculo | null;
  finalidad: Finalidad;
  base_legal: string;
  menor_al_otorgar: number;
  edad_al_otorgar: number | null;
  version_aviso: string;
  canal: string;
  otorgado_en: string;
  revocado_en: string | null;
  revocado_por_tipo: string | null;
}

export interface EstadoFinalidad {
  finalidad: Finalidad;
  otorgada: boolean;
  /** Consentimiento vigente, si lo hay. */
  consentimiento: FilaConsentimiento | null;
  /** Por qué no está, cuando no la está. Se le muestra a la persona. */
  motivo: 'otorgada' | 'nunca_otorgada' | 'revocada' | 'obligacion_legal';
}

/**
 * Estado de TODAS las finalidades de una persona, consentidas o no.
 *
 * Devuelve el catálogo entero, no solo lo firmado. La diferencia importa: la
 * pantalla tiene que poder decir "no autorizaste la documentación", y eso
 * requiere saber que la finalidad existe aunque no tenga fila.
 */
export async function estadoConsentimientos(titularId: string): Promise<EstadoFinalidad[]> {
  const filas = await query<FilaConsentimiento>(
    `SELECT c.id, c.titular_perfil_id, c.otorgante_perfil_id, c.otorgante_tipo,
            c.vinculo_tipo, c.finalidad, c.base_legal, c.menor_al_otorgar,
            c.edad_al_otorgar, c.version_aviso, c.canal, c.otorgado_en,
            r.revocado_en, r.revocado_por_tipo
       FROM consentimientos c
       LEFT JOIN revocaciones_consentimiento r ON r.consentimiento_id = c.id
      WHERE c.titular_perfil_id = ?
      ORDER BY c.otorgado_en DESC`,
    [titularId]
  );

  // La última fila de cada finalidad es la que manda. Se itera de más nueva a
  // más vieja y la primera que aparece gana: si esa está revocada, la
  // finalidad está revocada. Un consentimiento posterior puede reactivarla.
  const vigente = new Map<Finalidad, FilaConsentimiento>();
  const revocada = new Set<Finalidad>();

  for (const f of filas) {
    if (!vigente.has(f.finalidad)) vigente.set(f.finalidad, f);
    if (f.revocado_en && !revocada.has(f.finalidad)) revocada.add(f.finalidad);
  }

  return (Object.keys(FINALIDADES) as Finalidad[]).map((finalidad) => {
    const base = FINALIDADES[finalidad].baseLegal;
    if (base === 'obligacion_legal') {
      return { finalidad, otorgada: true, consentimiento: null, motivo: 'obligacion_legal' as const };
    }

    const c = vigente.get(finalidad);
    if (!c) {
      return { finalidad, otorgada: false, consentimiento: null, motivo: 'nunca_otorgada' as const };
    }
    if (c.revocado_en) {
      return { finalidad, otorgada: false, consentimiento: c, motivo: 'revocada' as const };
    }
    return { finalidad, otorgada: true, consentimiento: c, motivo: 'otorgada' as const };
  });
}

/** ¿Está vigente esta finalidad para esta persona? */
export async function tieneConsentimiento(titularId: string, finalidad: Finalidad): Promise<boolean> {
  const estado = await estadoConsentimientos(titularId);
  return estado.find((e) => e.finalidad === finalidad)?.otorgada ?? false;
}

/**
 * Guarda el conjunto de consentimientos de un alta.
 *
 * Todo en una transacción: o queda constancia de todo lo que firmó la
 * persona, o no queda nada. A medio camino, el club tiene un registro que
 * dice que consentió y otro que dice que no, y no sabe cuál vale.
 */
export async function registrarConsentimientos(params: {
  titularPerfilId: string;
  otorgantePerfilId?: string | null;
  otorganteTipo: 'titular' | 'padre' | 'madre' | 'tutor' | 'otro_representante';
  vinculo?: Vinculo | null;
  finalidades: Finalidad[];
  edadAlOtorgar?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  canal?: 'registro' | 'panel' | 'presencial';
  registradoPor?: string | null;
}): Promise<void> {
  const {
    titularPerfilId, otorgantePerfilId = null, otorganteTipo, vinculo = null,
    finalidades, edadAlOtorgar = null, ip = null, userAgent = null,
    canal = 'registro', registradoPor = null,
  } = params;

  const menorAlOtorgar = edadAlOtorgar !== null && edadAlOtorgar < EDAD_MAYORIA;

  await transaccion(async (conn) => {
    for (const finalidad of finalidades) {
      await conn.execute(
        `INSERT INTO consentimientos
           (id, titular_perfil_id, otorgante_perfil_id, otorgante_tipo, vinculo_tipo,
            finalidad, base_legal, menor_al_otorgar, edad_al_otorgar,
            version_aviso, ip, user_agent, canal, registrado_por, otorgado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuid(), titularPerfilId, otorgantePerfilId, otorganteTipo, vinculo,
          finalidad, FINALIDADES[finalidad].baseLegal, menorAlOtorgar, edadAlOtorgar,
          VERSION_AVISO,
          ip?.slice(0, 45) ?? null,
          userAgent?.slice(0, 255) ?? null,
          canal, registradoPor,
        ]
      );
    }
  });
}

/**
 * Registra la opinión del menor.
 *
 * Si el menor se opone, la fila queda igual: es prueba de que se preguntó y
 * de que dijo que no. Borrarla sería justo lo que hay que evitar.
 */
export async function registrarOpinionMenor(params: {
  menorPerfilId: string;
  consulta: Finalidad;
  opinion: Opinion;
  origen: 'propia' | 'transmitida_por_representante';
  recogidaPor?: string | null;
  edadAlConsultar?: number | null;
}): Promise<void> {
  const { menorPerfilId, consulta, opinion, origen, recogidaPor = null, edadAlConsultar = null } = params;

  await execute(
    `INSERT INTO opiniones_menor
       (id, menor_perfil_id, consulta, opinion, recogida_por, origen, edad_al_consultar, registrada_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
    [uuid(), menorPerfilId, consulta, opinion, recogidaPor, origen, edadAlConsultar]
  );
}

/**
 * La opinión que RIGE para una finalidad.
 *
 * LA REGLA QUE HIZO FALTA, Y CÓMO SE DESCUBRIÓ
 *
 * La primera versión tomaba la última fila, sin mirar QUIÉN la había escrito.
 * Con eso el veto del menor era decorativo: un admin entraba a
 * "Consentimientos y menores", tocaba "No preguntado", y la oposición de un
 * pibe de 12 años desaparecía. Después el padre subía el DNI y el sistema
 * respondía que estaba todo en orden.
 *
 * Se comprobó funcionando contra producción, con el flujo completo. Un control
 * que se puede desactivar desde la misma pantalla que lo muestra no es un
 * control: es un campo.
 *
 * POR QUÉ "LA PROPIA MANDA SIEMPRE"
 *
 *  - `propia` es la voz del menor. Nadie más escribe con ese origen, y solo
 *    él puede cambiarla: entra por su portal.
 *  - `transmitida_por_representante` es lo que dice un adulto. Vale cuando el
 *    menor todavía no habló, que es lo normal en un Chico de 6 años.
 *
 * En cuanto existe una opinión propia, ESA manda para siempre, hasta que el
 * menor registre otra. Un adulto no la puede pisar. Esa es toda la diferencia
 * entre un veto y un campo de texto.
 */
export async function opinionVigente(
  menorPerfilId: string,
  consulta: Finalidad
): Promise<Opinion | null> {
  // Primero, la voz del menor. Si habló, su palabra es la que rige.
  const propias = await query<{ opinion: Opinion }>(
    `SELECT opinion FROM opiniones_menor
      WHERE menor_perfil_id = ? AND consulta = ? AND origen = 'propia'
      ORDER BY registrada_en DESC
      LIMIT 1`,
    [menorPerfilId, consulta]
  );
  if (propias[0]) return propias[0].opinion;

  // No habló nunca: vale lo que transmita el representante.
  const trasmitidas = await query<{ opinion: Opinion }>(
    `SELECT opinion FROM opiniones_menor
      WHERE menor_perfil_id = ? AND consulta = ? AND origen = 'transmitida_por_representante'
      ORDER BY registrada_en DESC
      LIMIT 1`,
    [menorPerfilId, consulta]
  );
  return trasmitidas[0]?.opinion ?? null;
}

/** Revoca. No borra: agrega el registro de la oposición. */
export async function revocarConsentimiento(params: {
  consentimientoId: string;
  revocadoPor?: string | null;
  revocadoPorTipo?: 'titular' | 'representante';
  motivo?: string | null;
}): Promise<void> {
  const {
    consentimientoId, revocadoPor = null, revocadoPorTipo = 'titular', motivo = null,
  } = params;

  await execute(
    `INSERT INTO revocaciones_consentimiento
       (id, consentimiento_id, revocado_por, revocado_por_tipo, motivo, revocado_en)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [uuid(), consentimientoId, revocadoPor, revocadoPorTipo, motivo?.slice(0, 500) ?? null]
  );
}

// ------------------------------------------------------------
// Alertas para el panel
// ------------------------------------------------------------

export interface AlertaConsentimiento {
  tipo:
    | 'mayor_ahora'
    | 'documento_sin_consentimiento'
    | 'opinion_en_contra'
    | 'sin_vinculo_verificado';
  perfil_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  /** Por qué le toca attention al club. */
  detalle: string;
  /** Qué debería hacer la secretaría. */
  accion: string;
  urgente: boolean;
}

/**
 * Lo que hay que mirar antes de que sea un problema.
 *
 * Estas cuatro situaciones son las que el club no puede ignorar:
 *
 *  - MAYOR_AHORA: el pibe cumplió 18. El consentimiento que firmó su madre
 *    dejó de ser la base legal: ahora lo tiene que firmar él. Mientras nadie
 *    se avise, el club sigue tratando datos de adultos con el aval de alguien
 *    que ya no tiene por qué darlo. Es la única alerta de esta lista que
 *    aparece sola con el correr del tiempo, sin que nadie haga nada.
 *
 *  - DOCUMENTO_SIN_CONSENTIMIENTO: hay una foto del DNI guardada sin
 *    consentimiento vigente, o revocado. Es exactamente el reclamo que el
 *    club no podría responder.
 *
 *  - OPINION_EN_CONTRA: el menor dijo que no y la operación se hizo igual.
 *
 *  - SIN_VINCULO_VERIFICADO: datos de un menor cargados por alguien que no
 *    figura como representante.
 */
/**
 * Fecha legible.
 *
 * El driver devuelve las DATE como objetos Date. Interpolados directo salen
 * como "Wed May 20 2026 00:00:00 GMT+0000", que no le sirve de mucho a una
 * secretaria que tiene que llamar a una familia. Además la zona horaria
 * puede correrse un día: 20 de mayo a la noche en Argentina es 21 en UTC.
 */
function formatearFecha(valor: unknown): string {
  if (!valor) return '—';
  if (valor instanceof Date) {
    return valor.toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC',
    });
  }
  return String(valor);
}

export async function alertasConsentimientos(): Promise<AlertaConsentimiento[]> {
  const alertas: AlertaConsentimiento[] = [];

  const [mayores, sinConsentimiento, enContra, sinVinculo] = await Promise.all([
    // Ya cumplió 18: el consentimiento del representante dejó de ser la base.
    query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni,
              DATE_ADD(d.fecha_nacimiento, INTERVAL ${EDAD_MAYORIA} YEAR) AS mayoria_al
         FROM deportistas d
         JOIN perfiles p ON p.id = d.perfil_id
        WHERE d.fecha_nacimiento IS NOT NULL
          AND DATE_ADD(d.fecha_nacimiento, INTERVAL ${EDAD_MAYORIA} YEAR) <= CURDATE()
        ORDER BY mayoria_al DESC`
    ),

    // Documentación guardada sin consentimiento vigente.
    query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni
         FROM deportistas d
         JOIN perfiles p ON p.id = d.perfil_id
        WHERE (d.dni_frente_url IS NOT NULL OR d.dni_fondo_url IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM consentimientos c
             WHERE c.titular_perfil_id = d.perfil_id
               AND c.finalidad = 'documentacion_dni'
               AND NOT EXISTS (SELECT 1 FROM revocaciones_consentimiento r
                                WHERE r.consentimiento_id = c.id)
          )`
    ),

    // El menor dijo que no y la operación se hizo igual.
    query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni, o.consulta
         FROM opiniones_menor o
         JOIN perfiles p ON p.id = o.menor_perfil_id
         JOIN deportistas d ON d.perfil_id = p.id
        WHERE o.opinion = 'en_contra'
          AND o.id = (
            SELECT x.id FROM opiniones_menor x
             WHERE x.menor_perfil_id = o.menor_perfil_id
               AND x.consulta = o.consulta
             ORDER BY x.registrada_en DESC LIMIT 1
          )
          AND (
            (o.consulta = 'documentacion_dni'
             AND (d.dni_frente_url IS NOT NULL OR d.dni_fondo_url IS NOT NULL))
            OR o.consulta = 'imagenes'
          )`
    ),

    // Menor sin vínculo comprobado en la tabla de familias.
    query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni
         FROM deportistas d
         JOIN perfiles p ON p.id = d.perfil_id
        WHERE d.fecha_nacimiento IS NOT NULL
          AND DATE_ADD(d.fecha_nacimiento, INTERVAL ${EDAD_MAYORIA} YEAR) > CURDATE()
          AND NOT EXISTS (
            SELECT 1 FROM familias f
             WHERE f.deportista_perfil_id = d.perfil_id
               AND f.tipo_vinculo IN ('padre','madre','tutor')
          )`
    ),
  ]);

  const m = (filas: any[]) => filas ?? [];

  for (const r of m(mayores)) {
    alertas.push({
      tipo: 'mayor_ahora',
      perfil_id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      dni: r.dni,
      detalle: `Cumplió 18 el ${formatearFecha(r.mayoria_al)}. El consentimiento lo firmó su representante cuando era menor.`,
      accion:
        'Pedirle que confirme y renueve los consentimientos, o dar de baja lo que no renueve.',
      urgente: false,
    });
  }

  for (const r of m(sinConsentimiento)) {
    alertas.push({
      tipo: 'documento_sin_consentimiento',
      perfil_id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      dni: r.dni,
      detalle:
        'Tiene documentación del DNI guardada sin consentimiento vigente, o con el consentimiento revocado.',
      accion: 'Pedir el consentimiento o eliminar la documentación.',
      urgente: true,
    });
  }

  for (const r of m(enContra)) {
    alertas.push({
      tipo: 'opinion_en_contra',
      perfil_id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      dni: r.dni,
      detalle: `El jugador dijo que no está de acuerdo y la operación se hizo igual (${r.consulta}).`,
      accion: 'Eliminar lo que el menor no autorizó. Su opinión prevalece sobre la del representante.',
      urgente: true,
    });
  }

  for (const r of m(sinVinculo)) {
    alertas.push({
      tipo: 'sin_vinculo_verificado',
      perfil_id: r.id,
      nombre: r.nombre,
      apellido: r.apellido,
      dni: r.dni,
      detalle: 'Es menor de edad y no figura ninguna persona a cargo en la ficha familiar.',
      accion: 'Verificar quién es el representante y registrar el consentimiento en nombre de esa persona.',
      urgente: true,
    });
  }

  return alertas;
}

/** Edad actual a partir de la fecha guardada. Reexportado para los endpoints. */
export { edadCumplida };
