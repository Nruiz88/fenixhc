import { query, queryOne, execute, transaccion, uuid } from './db';
import { calcularRecargo, type Vencimiento } from './cuotas';
import {
  agruparParaAvisar, componerAviso,
  type CuotaParaAvisar, type FamiliarParaAvisar, type Responsable, type SeguroParaAvisar,
} from './avisos';
import { sendEmail, emailAviso, idPlantilla } from './email';

// Lectura de a quién hay que avisarle y escritura del aviso.
//
// POR QUÉ EL RECARGO SE CALCULA AQUÍ Y NO EN SQL
//
// Porque el recargo depende de la fecha de HOY y de los tramos configurados, y
// eso es código que ya existe y ya está probado en `lib/cuotas.ts`. Calcularlo
// otra vez en SQL sería tener la misma regla en dos lugares, y la segunda copia
// se desincroniza sin avisar. Se traen las cuotas crudas y se aplica la función.
//
// El costo es traer las pendientes del período. Son las de unos meses, no la
// tabla entera: un club con 200 socios tiene un par de miles de filas y eso entra
// de sobra por el pool de conexiones.

/** Tramos vigentes. Sin ellos no hay recargo y no se avisa a nadie. */
async function tramosVigentes(): Promise<Vencimiento[]> {
  const filas = await query<{
    id: string; dia: number; porcentaje: number; etiqueta: string | null;
    activo: number; orden: number;
  }>(
    'SELECT id, dia, porcentaje, etiqueta, activo, orden FROM vencimientos_cuota WHERE activo = 1 ORDER BY orden, dia'
  );

  return filas.map((f) => ({
    id: f.id, dia: Number(f.dia), porcentaje: Number(f.porcentaje),
    etiqueta: f.etiqueta, activo: !!f.activo, orden: Number(f.orden),
  }));
}

/**
 * Socios con al menos un jugador vinculado, con sus datos de contacto.
 *
 * Se trae la lista COMPLETA, no solo los que deben, porque una familia puede
 * estar al día con las cuotas y tener el seguro vencido. Si la lista se armara
 * desde las cuotas, esa familia nunca aparecería.
 */
async function responsables(): Promise<Responsable[]> {
  const filas = await query<{
    usuario_id: string; perfil_id: string; nombre: string; apellido: string;
    telefono: string | null; correo: string | null;
    jugador_id: string | null; jugador_nombre: string | null; jugador_apellido: string | null;
  }>(
    `SELECT p.usuario_id, p.id AS perfil_id, p.nombre, p.apellido, p.telefono, p.correo,
            d.id AS jugador_id, d.nombre AS jugador_nombre, d.apellido AS jugador_apellido
       FROM familias f
       JOIN perfiles p ON p.id = f.padre_perfil_id
       LEFT JOIN perfiles d ON d.id = f.deportista_perfil_id
      WHERE p.rol IN ('socio_benefactor', 'admin', 'presidente', 'secretario', 'tesorero')
      ORDER BY p.apellido, p.nombre`
  );

  const porUsuario = new Map<string, Responsable>();
  for (const f of filas) {
    // `usuario_id` es NOT NULL en perfiles, pero el tipo lo deja opcional.
    if (!f.usuario_id) continue;

    let r = porUsuario.get(f.usuario_id);
    if (!r) {
      r = {
        usuarioId: f.usuario_id,
        perfilId: f.perfil_id,
        nombre: f.nombre,
        apellido: f.apellido,
        telefono: f.telefono,
        correo: f.correo,
        jugadores: [],
      };
      porUsuario.set(f.usuario_id, r);
    }

    if (f.jugador_id) {
      r.jugadores.push({
        id: f.jugador_id,
        nombre: f.jugador_nombre ?? '',
        apellido: f.jugador_apellido ?? '',
      });
    }
  }

  return [...porUsuario.values()];
}

/**
 * Cuotas pendientes de los últimos meses.
 *
 * El recorte es generoso a propósito: una cuota que quedó sin pagar hace medio
 * año sigue debiéndose y hay que poder avisar por ella. Lo que evita que la
 * lista crezca sin control es el filtro de estado, no la ventana de meses.
 */
async function cuotasPendientes(tramos: Vencimiento[]): Promise<CuotaParaAvisar[]> {
  const filas = await query<{
    id: string; usuario_id: string; monto: string; mes: number; anio: number;
  }>(
    `SELECT c.id, p.usuario_id, c.monto, c.mes, c.anio
       FROM cuotas c
       JOIN familias f ON f.id = c.familia_id
       JOIN perfiles p ON p.id = f.padre_perfil_id
      WHERE c.estado = 'pendiente'
      ORDER BY c.anio, c.mes`
  );

  const hoy = new Date();
  const salida: CuotaParaAvisar[] = [];

  for (const f of filas) {
    if (!f.usuario_id) continue;
    const monto = Number(f.monto) || 0;
    salida.push({
      id: f.id,
      usuarioId: f.usuario_id,
      mes: Number(f.mes),
      anio: Number(f.anio),
      monto,
      recargo: calcularRecargo(monto, Number(f.mes), Number(f.anio), tramos, hoy),
    });
  }

  return salida;
}

/** Seguros sin adherir, con el socio responsable de cada jugador. */
async function segurosPendientes(): Promise<SeguroParaAvisar[]> {
  const filas = await query<{ usuario_id: string; jugador_id: string; adherido: number }>(
    `SELECT p.usuario_id, s.jugador_perfil_id AS jugador_id,
            (s.estado IN ('adherido', 'renovado')) AS adherido
       FROM seguros s
       LEFT JOIN familias f ON f.deportista_perfil_id = s.jugador_perfil_id
       LEFT JOIN perfiles p ON p.id = f.padre_perfil_id
      WHERE s.estado <> 'baja'`
  );

  return filas
    // Un jugador sin familia no tiene a quién avisarle. Es un dato incompleto
    // que se resuelve en la pantalla de seguros, no acá.
    .filter((f) => Boolean(f.usuario_id))
    .map((f) => ({
      usuarioId: f.usuario_id,
      jugadorId: f.jugador_id,
      adherido: !!f.adherido,
    }));
}

export interface ResumenAvisos {
  familia: FamiliarParaAvisar;
  /** Texto tal como se le va a mandar, listo para revisar. */
  mensaje: string;
  /** Último aviso registrado, para no mandar dos veces lo mismo. */
  ultimo: { enviadoEn: string; motivo: string; detalle: string } | null;
}

/** Qué hay que avisar hoy, y a quién se le avisó la última vez. */
export async function listarAvisosPendientes(): Promise<ResumenAvisos[]> {
  const tramos = await tramosVigentes();

  const [resp, cuotas, seguros] = await Promise.all([
    responsables(),
    cuotasPendientes(tramos),
    segurosPendientes(),
  ]);

  const familias = agruparParaAvisar(resp, cuotas, seguros);

  // Se trae todo el historial y se corta en memoria. Es una tabla que crece con
  // los meses y a esta escala (un club) cabe de sobra; el filtro por usuario se
  // hace acá porque se necesita para las DOS columnas.
  const ultimos = new Map<string, { enviadoEn: string; motivo: string; detalle: string }>();
  const historico = await query<{
    usuario_id: string; motivo: string; detalle: string; enviado_en: string | Date;
  }>(
    'SELECT usuario_id, motivo, detalle, enviado_en FROM avisos_familias ORDER BY enviado_en DESC'
  );

  for (const h of historico) {
    if (ultimos.has(h.usuario_id)) continue;
    ultimos.set(h.usuario_id, {
      enviadoEn: h.enviado_en instanceof Date ? h.enviado_en.toISOString() : String(h.enviado_en),
      motivo: h.motivo,
      detalle: h.detalle,
    });
  }

  return familias.map((familia) => ({
    familia,
    mensaje: componerAviso(familia),
    ultimo: ultimos.get(familia.usuarioId) ?? null,
  }));
}

export interface EnviarAvisoResultado {
  ok: boolean;
  /** Id de la notificación del portal, si se creó. */
  notificacionId: string | null;
  email: 'enviado' | 'omitido' | 'error';
  detalleError: string | null;
}

/**
 * Manda el aviso y deja constancia.
 *
 * TODO EN UNA TRANSACCIÓN, con una excepción: el correo.
 *
 * El correo va después del commit a propósito. Si mandarlo fallara y la
 * transacción quedara esperando, avisar por correo no sería reversible y
 * dependería de una API de terceros. Es preferible que quede registrado que se
 * pidió el aviso y que el correo haya fallado, antes que un aviso registrado
 * que en realidad nunca llegó.
 */
export async function enviarAviso(params: {
  usuarioId: string;
  familia: FamiliarParaAvisar;
  mensaje: string;
  enviadoPor: string;
  porCorreo: boolean;
}): Promise<EnviarAvisoResultado> {
  const { usuarioId, familia, mensaje, enviadoPor, porCorreo } = params;

  const id = uuid();

  const notificacionId = await transaccion(async (conn) => {
    // Una notificación por familia, no una por cuota.
    const notifId = uuid();
    await conn.execute(
      `INSERT INTO notificaciones (id, titulo, mensaje, tipo, destinatario_rol, enviada_email, created_by)
       VALUES (?, ?, ?, 'pago', 'socio_benefactor', ?, ?)`,
      [notifId, `Pendiente: ${familia.nombre} ${familia.apellido}`, mensaje, porCorreo ? 1 : 0, enviadoPor]
    );

    // `notificaciones_usuarios` tiene UNIQUE (notificacion_id, usuario_id): el
    // insert repetido no rompe, y el `leida` en 0 es explícito.
    await conn.execute(
      `INSERT INTO notificaciones_usuarios (id, notificacion_id, usuario_id, leida)
       VALUES (?, ?, ?, 0)
       ON DUPLICATE KEY UPDATE leida = 0`,
      [uuid(), notifId, usuarioId]
    );

    await conn.execute(
      `INSERT INTO avisos_familias
         (id, usuario_id, motivo, detalle, cuotas, seguro_id, monto_total,
          dias_vencida, canal, resultado, enviado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'entregado', ?)`,
      [
        id,
        usuarioId,
        familia.motivo,
        mensaje,
        familia.cuotas.map((c) => c.id).join(',') || null,
        familia.seguroJugador?.id ?? null,
        familia.montoTotal || null,
        familia.diasVencida || null,
        porCorreo ? 'ambos' : 'portal',
        enviadoPor,
      ]
    );

    return notifId;
  });

  let email: EnviarAvisoResultado['email'] = 'omitido';
  let detalleError: string | null = null;

  if (porCorreo) {
    const destino = await queryOne<{ correo: string | null }>(
      'SELECT correo FROM perfiles WHERE usuario_id = ? LIMIT 1',
      [usuarioId]
    );

    if (!destino?.correo) {
      email = 'omitido';
      detalleError = 'El socio no tiene correo cargado';
    } else {
      const correo = emailAviso({ nombre: familia.nombre, mensaje });

      const r = await sendEmail({
        to: destino.correo,
        subject: correo.subject,
        html: correo.html,
        text: correo.text,
        // La plantilla lleva el DISEÑO. El texto sigue viniendo del código:
        // `detalle` guarda exactamente lo que salió, y si el html de la
        // plantilla armanara la frase, el registro y el correo dejarían de
        // decir lo mismo. Para eso está el `white-space: pre-line` en el
        // contenedor de {{mensaje}}.
        plantilla: {
          id: idPlantilla('RESEND_TEMPLATE_AVISO'),
          variables: { nombre: familia.nombre, mensaje },
        },
      });

      if (r.sent) email = 'enviado';
      else {
        email = 'error';
        // `sin-key` no es un fallo del aviso: es que el club no tiene Resend.
        // Se distingue porque una es una cosa que hay que arreglar y la otra es
        // una decisión de configuración.
        detalleError = r.motivo === 'sin-key'
          ? 'El correo no salió: falta configurar RESEND_API_KEY. El aviso igual llegó al portal.'
          : r.error || r.motivo || 'No se pudo enviar el correo';
      }

      await execute('UPDATE avisos_familias SET resultado = ?, detalle_error = ? WHERE id = ?', [
        email === 'enviado' ? 'entregado' : 'parcial',
        detalleError,
        id,
      ]);
    }
  }

  return { ok: true, notificacionId, email, detalleError };
}

/** Historial de avisos, para responder "qué le dijimos y cuándo". */
export async function historialAvisos(limite = 50) {
  return query<{
    id: string; usuario_id: string; motivo: string; detalle: string;
    monto_total: string | null; dias_vencida: number | null; canal: string;
    resultado: string; enviado_en: string | Date;
    nombre: string; apellido: string;
  }>(
    `SELECT a.id, a.usuario_id, a.motivo, a.detalle, a.monto_total, a.dias_vencida,
            a.canal, a.resultado, a.enviado_en, p.nombre, p.apellido
       FROM avisos_familias a
       LEFT JOIN perfiles p ON p.usuario_id = a.usuario_id
      ORDER BY a.enviado_en DESC
      LIMIT ?`,
    [limite]
  );
}