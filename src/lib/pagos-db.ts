import { execute, query, queryOne, transaccion, uuid } from './db';
import { redondearImporte, type PagoMercadoPago } from './mercadopago';

// Persistencia de los cobros online.
//
// La tabla `pagos_mercadopago` es la auditoría del cobro: qué preferencia se
// creó, qué pago la pagó, cuánto entró y qué cuotas se acreditaron. El webhook
// nunca marca una cuota basándose solo en el POST: primero se consulta el pago
// real a la API y después se ejecuta `procesarPagoMercadoPago`, que es
// idempotente y transaccional.

export interface CuotaEnPago {
  id: string;
  familia_id: string;
  monto_base: number;
  recargo: number;
  total: number;
  mes: number;
  anio: number;
}

export interface PagoLocal {
  id: string;
  usuario_id: string | null;
  familia_id: string | null;
  preferencia_id: string | null;
  pago_id: string | null;
  external_reference: string;
  monto: number | string;
  moneda: string;
  estado: string;
  estado_detalle: string | null;
  metodo_pago: string | null;
  cuotas: unknown;
  init_point: string | null;
  detalle: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface ResultadoProcesamiento {
  ignorado: boolean;
  estado: string;
  mensaje: string;
  cuotas: string[];
}

function parseCuotas(valor: unknown): CuotaEnPago[] {
  let crudo: unknown = valor;
  if (typeof crudo === 'string') {
    try { crudo = JSON.parse(crudo); } catch { return []; }
  }
  if (!Array.isArray(crudo)) return [];
  return crudo.filter((c): c is CuotaEnPago => {
    if (!c || typeof c !== 'object') return false;
    const item = c as Partial<CuotaEnPago>;
    return typeof item.id === 'string' && Number.isFinite(Number(item.total));
  });
}

/** Estado local a partir del estado que informa MercadoPago. */
function estadoLocal(status: string): string {
  switch (status) {
    case 'approved': return 'aprobado';
    case 'pending': return 'pendiente';
    case 'in_process': return 'en_proceso';
    case 'authorized': return 'autorizado';
    case 'rejected': return 'rechazado';
    case 'cancelled': return 'cancelado';
    case 'refunded': return 'reembolsado';
    case 'charged_back': return 'contracargo';
    case 'in_mediation': return 'en_mediacion';
    default: return status || 'desconocido';
  }
}

function mensajeDeEstado(estado: string): string {
  switch (estado) {
    case 'aprobado': return 'El pago fue acreditado.';
    case 'pendiente': return 'MercadoPago todavía está procesando el pago.';
    case 'en_proceso': return 'MercadoPago está revisando el pago.';
    case 'autorizado': return 'El pago fue autorizado y está pendiente de captura.';
    case 'rechazado': return 'MercadoPago rechazó el pago. Podés intentar con otro medio.';
    case 'cancelado': return 'El pago fue cancelado.';
    case 'reembolsado': return 'El pago fue reembolsado. La tesorería revisará la cuota.';
    case 'contracargo': return 'Se inició un contracargo. La tesorería revisará la cuota.';
    case 'en_mediacion': return 'El pago está en mediación. La tesorería lo revisará.';
    case 'revision': return 'El pago quedó en revisión para la tesorería.';
    default: return 'El pago no está acreditado todavía.';
  }
}

function detalleResumido(payment: PagoMercadoPago) {
  return {
    id: String(payment.id),
    status: payment.status,
    status_detail: payment.status_detail ?? null,
    transaction_amount: payment.transaction_amount,
    currency_id: payment.currency_id ?? null,
    payment_method_id: payment.payment_method_id ?? null,
    payment_type_id: payment.payment_type_id ?? null,
    date_approved: payment.date_approved ?? null,
    date_created: payment.date_created ?? null,
  };
}

/** Crea la fila local antes de pedirle la preferencia a MercadoPago. */
export async function crearPagoPendiente(datos: {
  usuarioId: string;
  cuotas: CuotaEnPago[];
}): Promise<string> {
  const id = uuid();
  const familias = new Set(datos.cuotas.map((c) => c.familia_id));
  const familiaId = familias.size === 1 ? [...familias][0] : null;
  const monto = redondearImporte(datos.cuotas.reduce((s, c) => s + Number(c.total), 0));

  await execute(
    `INSERT INTO pagos_mercadopago
       (id, usuario_id, familia_id, external_reference, monto, moneda, estado, cuotas)
     VALUES (?, ?, ?, ?, ?, 'ARS', 'pendiente', ?)`,
    [id, datos.usuarioId, familiaId, id, monto, JSON.stringify(datos.cuotas)]
  );

  return id;
}

export async function guardarPreferencia(
  pagoId: string,
  preferenciaId: string,
  initPoint: string
) {
  await execute(
    `UPDATE pagos_mercadopago
        SET preferencia_id = ?, init_point = ?, estado = 'pendiente', estado_detalle = NULL
      WHERE id = ?`,
    [preferenciaId, initPoint, pagoId]
  );
}

export async function marcarErrorDeCobro(pagoId: string, mensaje: string) {
  await execute(
    `UPDATE pagos_mercadopago
        SET estado = 'error', estado_detalle = ?
      WHERE id = ? AND estado <> 'aprobado'`,
    [mensaje.slice(0, 100), pagoId]
  );
}

export async function buscarPagoPorExternalReference(
  externalReference: string
): Promise<PagoLocal | null> {
  return queryOne<PagoLocal>(
    `SELECT * FROM pagos_mercadopago WHERE external_reference = ? LIMIT 1`,
    [externalReference]
  );
}

export async function buscarPagoPorId(id: string): Promise<PagoLocal | null> {
  return queryOne<PagoLocal>(
    `SELECT * FROM pagos_mercadopago WHERE id = ? LIMIT 1`,
    [id]
  );
}

/** Últimos cobros, para la pantalla de administración. */
export async function listarPagosMercadoPago(limite = 20) {
  const n = Math.max(1, Math.min(Number(limite) || 20, 100));
  const filas = await query<PagoLocal>(
    `SELECT id, usuario_id, familia_id, preferencia_id, pago_id, monto, moneda,
            estado, estado_detalle, metodo_pago, cuotas, created_at, updated_at
       FROM pagos_mercadopago
      ORDER BY created_at DESC
      LIMIT ${n}`
  );

  return filas.map((f) => ({
    id: f.id,
    preferencia_id: f.preferencia_id,
    pago_id: f.pago_id,
    monto: Number(f.monto),
    moneda: f.moneda,
    estado: f.estado,
    estado_detalle: f.estado_detalle,
    metodo_pago: f.metodo_pago,
    cuotas: parseCuotas(f.cuotas),
    created_at: f.created_at,
  }));
}

/**
 * Registra un segundo pago aprobado sobre una preferencia que ya estaba paga.
 *
 * No se acredita a la cuota: se guarda para que la tesorería vea el cobro
 * duplicado y decida la devolución. Pisar el pago original o perder el
 * segundo dejaría un cobro sin rastro.
 */
async function registrarPagoDuplicado(
  original: PagoLocal,
  payment: PagoMercadoPago
): Promise<ResultadoProcesamiento> {
  const pagoId = String(payment.id);
  const id = uuid();
  const detalle = {
    ...detalleResumido(payment),
    duplicado_de: original.id,
    motivo: 'La preferencia ya tenía un pago aprobado.',
  };

  try {
    await execute(
      `INSERT INTO pagos_mercadopago
         (id, usuario_id, familia_id, pago_id, external_reference, monto, moneda,
          estado, estado_detalle, metodo_pago, cuotas, detalle)
       VALUES (?, ?, ?, ?, ?, ?, 'ARS', 'revision', 'pago_duplicado', ?, ?, ?)`,
      [
        id,
        original.usuario_id,
        original.familia_id,
        pagoId,
        `dup:${original.id}:${pagoId}`.slice(0, 100),
        redondearImporte(Number(payment.transaction_amount)),
        payment.payment_method_id ?? null,
        typeof original.cuotas === 'string' ? original.cuotas : JSON.stringify(original.cuotas ?? []),
        JSON.stringify(detalle),
      ]
    );
  } catch (err) {
    // Si ya existe la fila del duplicado (webhook repetido), no es un error.
    console.warn('No se pudo registrar el pago duplicado de MercadoPago:', err);
  }

  return {
    ignorado: false,
    estado: 'revision',
    mensaje: 'Se recibió un segundo pago sobre una preferencia ya pagada. Quedó en revisión para la tesorería.',
    cuotas: [],
  };
}

/** Actualiza una fila local que no está aprobada (rechazo, pendiente, etc.). */
async function actualizarPagoNoAprobado(
  local: PagoLocal,
  payment: PagoMercadoPago
): Promise<ResultadoProcesamiento> {
  const estado = estadoLocal(payment.status);

  await execute(
    `UPDATE pagos_mercadopago
        SET pago_id = ?, estado = ?, estado_detalle = ?, metodo_pago = ?, detalle = ?
      WHERE id = ? AND estado <> 'aprobado'`,
    [
      String(payment.id),
      estado,
      payment.status_detail ?? null,
      payment.payment_method_id ?? null,
      JSON.stringify(detalleResumido(payment)),
      local.id,
    ]
  );

  return {
    ignorado: false,
    estado,
    mensaje: mensajeDeEstado(estado),
    cuotas: [],
  };
}

/**
 * Procesa un pago consultado a la API de MercadoPago.
 *
 * Es la única función que acredita cuotas. La llaman el webhook y la vuelta
 * del checkout; las dos vías son idempotentes.
 */
export async function procesarPagoMercadoPago(
  payment: PagoMercadoPago
): Promise<ResultadoProcesamiento> {
  const referencia = payment.external_reference;
  if (!referencia) {
    return { ignorado: true, estado: 'ignorado', mensaje: 'El pago no trae referencia externa.', cuotas: [] };
  }

  const local = await buscarPagoPorExternalReference(referencia);
  if (!local) {
    // Puede ser un pago de otra aplicación de la misma cuenta de MercadoPago.
    return { ignorado: true, estado: 'ignorado', mensaje: 'El pago no pertenece a Fenix.', cuotas: [] };
  }

  const pagoId = String(payment.id);
  const estado = estadoLocal(payment.status);

  // Ya estaba aprobado: puede ser un webhook repetido o un segundo cobro.
  if (local.estado === 'aprobado') {
    if (String(local.pago_id ?? '') === pagoId) {
      if (payment.status === 'approved') {
        return {
          ignorado: false,
          estado: 'aprobado',
          mensaje: 'El pago ya estaba acreditado.',
          cuotas: parseCuotas(local.cuotas).map((c) => c.id),
        };
      }

      // Reembolso o contracargo posterior. No se revierte la cuota sola:
      // devolver la deuda automáticamente por un aviso podría dejar a la
      // familia debiendo una cuota que ya pagó si el reembolso fue parcial.
      // Se marca el cobro para que la tesorería lo resuelva.
      await execute(
        `UPDATE pagos_mercadopago
            SET estado = ?, estado_detalle = ?, detalle = ?
          WHERE id = ?`,
        [estado, payment.status_detail ?? null, JSON.stringify(detalleResumido(payment)), local.id]
      );
      return {
        ignorado: false,
        estado,
        mensaje: mensajeDeEstado(estado),
        cuotas: [],
      };
    }

    if (payment.status === 'approved') {
      return registrarPagoDuplicado(local, payment);
    }

    return {
      ignorado: false,
      estado: local.estado,
      mensaje: 'El pago ya estaba acreditado.',
      cuotas: [],
    };
  }

  if (payment.status !== 'approved') {
    return actualizarPagoNoAprobado(local, payment);
  }

  const cuotas = parseCuotas(local.cuotas);
  if (cuotas.length === 0) {
    await execute(
      `UPDATE pagos_mercadopago
          SET estado = 'revision', estado_detalle = 'sin_cuotas', detalle = ?
        WHERE id = ?`,
      [JSON.stringify(detalleResumido(payment)), local.id]
    );
    return {
      ignorado: false,
      estado: 'revision',
      mensaje: 'El cobro no tiene cuotas asociadas. La tesorería lo revisará.',
      cuotas: [],
    };
  }

  const totalEsperado = redondearImporte(cuotas.reduce((s, c) => s + Number(c.total), 0));
  const cobrado = redondearImporte(Number(payment.transaction_amount));
  const moneda = (payment.currency_id ?? 'ARS').toUpperCase();

  if (moneda !== 'ARS') {
    await execute(
      `UPDATE pagos_mercadopago
          SET estado = 'revision', estado_detalle = 'moneda_distinta', detalle = ?
        WHERE id = ?`,
      [JSON.stringify(detalleResumido(payment)), local.id]
    );
    return {
      ignorado: false,
      estado: 'revision',
      mensaje: 'El pago no está en pesos argentinos. Quedó en revisión.',
      cuotas: [],
    };
  }

  if (cobrado + 0.01 < totalEsperado) {
    await execute(
      `UPDATE pagos_mercadopago
          SET estado = 'revision', estado_detalle = 'monto_insuficiente', detalle = ?
        WHERE id = ?`,
      [JSON.stringify({ ...detalleResumido(payment), total_esperado: totalEsperado }), local.id]
    );
    return {
      ignorado: false,
      estado: 'revision',
      mensaje: 'El importe pagado es menor al total de las cuotas. Quedó en revisión para la tesorería.',
      cuotas: [],
    };
  }

  const detalle = {
    ...detalleResumido(payment),
    total_esperado: totalEsperado,
    sobrante: redondearImporte(Math.max(0, cobrado - totalEsperado)),
  };

  const resultado = await transaccion(async (conn) => {
    const [pagoRows] = (await conn.execute(
      `SELECT * FROM pagos_mercadopago WHERE id = ? FOR UPDATE`,
      [local.id]
    )) as [PagoLocal[], unknown];
    const actual = pagoRows[0];
    if (!actual) throw new Error('El cobro desapareció durante el procesamiento');

    if (actual.estado === 'aprobado') {
      return {
        ignorado: false,
        estado: 'aprobado',
        mensaje: 'El pago ya estaba acreditado.',
        cuotas: parseCuotas(actual.cuotas).map((c) => c.id),
      } satisfies ResultadoProcesamiento;
    }

    const ids = cuotas.map((c) => c.id).sort();
    const marcadores = ids.map(() => '?').join(',');
    const [cuotaRows] = (await conn.execute(
      `SELECT id, estado FROM cuotas WHERE id IN (${marcadores}) ORDER BY id FOR UPDATE`,
      ids
    )) as [{ id: string; estado: string }[], unknown];

    if (cuotaRows.length !== cuotas.length) {
      await conn.execute(
        `UPDATE pagos_mercadopago
            SET estado = 'revision', estado_detalle = 'cuota_inexistente', detalle = ?
          WHERE id = ?`,
        [JSON.stringify(detalle), local.id]
      );
      return {
        ignorado: false,
        estado: 'revision',
        mensaje: 'Alguna de las cuotas del cobro ya no existe. Quedó en revisión.',
        cuotas: [],
      } satisfies ResultadoProcesamiento;
    }

    const noPendientes = cuotaRows.filter((c) => c.estado !== 'pendiente');
    if (noPendientes.length > 0) {
      await conn.execute(
        `UPDATE pagos_mercadopago
            SET estado = 'revision', estado_detalle = 'cuota_ya_pagada', detalle = ?
          WHERE id = ?`,
        [JSON.stringify(detalle), local.id]
      );
      return {
        ignorado: false,
        estado: 'revision',
        mensaje: 'Una de las cuotas ya estaba paga o en revisión. El cobro quedó para revisar.',
        cuotas: [],
      } satisfies ResultadoProcesamiento;
    }

    const fechaPago = payment.date_approved ? new Date(payment.date_approved) : new Date();

    for (const cuota of [...cuotas].sort((a, b) => a.id.localeCompare(b.id))) {
      const [res] = (await conn.execute(
        `UPDATE cuotas
            SET estado = 'pagada',
                monto_pagado = ?,
                fecha_pago = ?,
                metodo_pago = 'mercadopago',
                pago_mp_id = ?
          WHERE id = ? AND estado = 'pendiente'`,
        [redondearImporte(Number(cuota.total)), fechaPago, local.id, cuota.id]
      )) as [{ affectedRows: number }, unknown];
      if (res.affectedRows !== 1) {
        throw new Error(`La cuota ${cuota.id} cambió de estado durante el cobro`);
      }
    }

    await conn.execute(
      `UPDATE pagos_mercadopago
          SET pago_id = ?, monto = ?, estado = 'aprobado', estado_detalle = ?,
              metodo_pago = ?, detalle = ?
        WHERE id = ?`,
      [
        pagoId,
        cobrado,
        payment.status_detail ?? null,
        payment.payment_method_id ?? null,
        JSON.stringify(detalle),
        local.id,
      ]
    );

    return {
      ignorado: false,
      estado: 'aprobado',
      mensaje: 'El pago fue acreditado y las cuotas quedaron pagas.',
      cuotas: cuotas.map((c) => c.id),
    } satisfies ResultadoProcesamiento;
  });

  return resultado;
}
