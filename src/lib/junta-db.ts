// Acceso a la sección de junta directiva.
//
// Un archivo por sección y no un CRUD genérico. Un endpoint genérico con
// `table` y `fields` es cómodo y es exactamente donde aparecen los agujeros:
// una tabla que se agrega a la lista y de golpe es editable para todos. Acá
// cada función escribe su propio SQL con sus propios campos, y no hay forma de
// escribir en una columna que la función no nombre.
//
// Lo que sí es genérico es la NUMERACIÓN de recibos, que necesita una
// transacción y un lock: ver `emitirRecibo`.

import { query, execute, transaccion, uuid } from './db';

// ---------------------------------------------------------------------------
// Comunicaciones internas
// ---------------------------------------------------------------------------

export interface ComunicacionInterna {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  fijado: number;
  adjunto_nombre: string | null;
  adjunto_url: string | null;
  autor_id: string | null;
  autor_nombre: string | null;
  estado: string;
  fecha_publicacion: string | null;
  created_at: string;
}

/**
 * Lista con el autor JOIN.
 *
 * `estado` filtra acá, no en el cliente: una nota en borrador tiene que ser
 * invisible para quien no la tiene que ver, no estar oculta con un `hidden`.
 */
export async function listarComunicaciones(estados?: string[]): Promise<ComunicacionInterna[]> {
  const filtro = estados?.length
    ? `AND ci.estado IN (${estados.map(() => '?').join(',')})`
    : '';

  return query<ComunicacionInterna>(
    `SELECT ci.id, ci.titulo, ci.contenido, ci.categoria, ci.fijado,
            ci.adjunto_nombre, ci.adjunto_url, ci.autor_id, ci.estado,
            ci.fecha_publicacion, ci.created_at,
            TRIM(CONCAT(p.nombre, ' ', p.apellido)) AS autor_nombre
       FROM comunicaciones_internas ci
       LEFT JOIN perfiles p ON p.id = ci.autor_id
      WHERE 1 = 1 ${filtro}
      ORDER BY ci.fijado DESC, COALESCE(ci.fecha_publicacion, ci.created_at) DESC`,
    estados ?? []
  );
}

export async function crearComunicacion(datos: {
  titulo: string;
  contenido: string;
  categoria: string;
  fijado?: boolean;
  adjunto_nombre?: string | null;
  adjunto_url?: string | null;
  autorId: string;
  estado: string;
}): Promise<string> {
  const id = uuid();
  await execute(
    `INSERT INTO comunicaciones_internas
       (id, titulo, contenido, categoria, fijado, adjunto_nombre, adjunto_url,
        autor_id, estado, fecha_publicacion, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id, datos.titulo, datos.contenido, datos.categoria, datos.fijado ? 1 : 0,
      datos.adjunto_nombre ?? null, datos.adjunto_url ?? null,
      datos.autorId, datos.estado,
      datos.estado === 'publicado' ? new Date() : null,
    ]
  );
  return id;
}

export async function actualizarComunicacion(
  id: string,
  datos: Partial<{
    titulo: string;
    contenido: string;
    categoria: string;
    fijado: boolean;
    estado: string;
  }>
): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];

  for (const [campo, valor] of Object.entries(datos)) {
    if (valor === undefined) continue;
    sets.push(`${campo} = ?`);
    // `fijado` es BOOLEAN y en la base llegó como número.
    params.push(campo === 'fijado' ? (valor ? 1 : 0) : valor);
  }
  if (sets.length === 0) return;

  // Publicar por primera vez le pone fecha. Sin esto, las notas del blog salen
  // ordenadas por la de cuándo se escribieron y no por cuándo seTrials Telling.
  if (datos.estado === 'publicado') {
    sets.push('fecha_publicacion = COALESCE(fecha_publicacion, NOW())');
  }

  params.push(id);
  await execute(`UPDATE comunicaciones_internas SET ${sets.join(', ')} WHERE id = ?`, params);
}

// ---------------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------------

export interface Parte {
  id: string;
  tipo: string;
  titulo: string;
  fecha_reunion: string;
  contenido: string;
  asistentes: string | null;
  decisiones: string | null;
  autor_id: string | null;
  autor_nombre: string | null;
  estado: string;
  created_at: string;
}

export async function listarPartes(tipo: string): Promise<Parte[]> {
  return query<Parte>(
    `SELECT pa.id, pa.tipo, pa.titulo, pa.fecha_reunion, pa.contenido,
            pa.asistentes, pa.decisiones, pa.autor_id, pa.estado, pa.created_at,
            TRIM(CONCAT(p.nombre, ' ', p.apellido)) AS autor_nombre
       FROM partes_administrativos pa
       LEFT JOIN perfiles p ON p.id = pa.autor_id
      WHERE pa.tipo = ?
      ORDER BY pa.fecha_reunion DESC`,
    [tipo]
  );
}

export async function crearParte(datos: {
  tipo: string;
  titulo: string;
  fechaReunion: string;
  contenido: string;
  asistentes?: string | null;
  decisiones?: string | null;
  autorId: string;
}): Promise<string> {
  const id = uuid();
  await execute(
    `INSERT INTO partes_administrativos
       (id, tipo, titulo, fecha_reunion, contenido, asistentes, decisiones, autor_id, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'publicado')`,
    [
      id, datos.tipo, datos.titulo, datos.fechaReunion, datos.contenido,
      datos.asistentes ?? null, datos.decisiones ?? null, datos.autorId,
    ]
  );
  return id;
}

// ---------------------------------------------------------------------------
// Documentos de legajo
// ---------------------------------------------------------------------------

export interface DocumentoLegajo {
  id: string;
  perfil_id: string;
  nombre: string;
  tipo: string;
  url: string;
  visibilidad: string;
  notas: string | null;
  fecha: string;
  subido_por: string | null;
  subido_por_nombre: string | null;
  // Del jugador, para no tener que hacer un segundo request por fila.
  jugador_nombre: string | null;
  jugador_apellido: string | null;
  jugador_dni: string | null;
}

export async function listarDocumentosLegajo(filtros?: {
  perfilId?: string;
  tipo?: string;
}): Promise<DocumentoLegajo[]> {
  const conds: string[] = [];
  const params: any[] = [];

  if (filtros?.perfilId) {
    conds.push('d.perfil_id = ?');
    params.push(filtros.perfilId);
  }
  if (filtros?.tipo) {
    conds.push('d.tipo = ?');
    params.push(filtros.tipo);
  }

  return query<DocumentoLegajo>(
    `SELECT d.id, d.perfil_id, d.nombre, d.tipo, d.url, d.visibilidad, d.notas,
            d.fecha, d.subido_por,
            TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS subido_por_nombre,
            j.nombre AS jugador_nombre, j.apellido AS jugador_apellido, j.dni AS jugador_dni
       FROM documentos_legajo d
       LEFT JOIN perfiles u ON u.id = d.subido_por
       LEFT JOIN perfiles j ON j.id = d.perfil_id
      ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
      ORDER BY d.fecha DESC`,
    params
  );
}

export async function crearDocumentoLegajo(datos: {
  perfilId: string;
  nombre: string;
  tipo: string;
  url: string;
  visibilidad: string;
  notas?: string | null;
  subidoPor: string;
}): Promise<string> {
  const id = uuid();
  await execute(
    `INSERT INTO documentos_legajo
       (id, perfil_id, nombre, tipo, url, visibilidad, notas, subido_por, fecha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())`,
    [
      id, datos.perfilId, datos.nombre, datos.tipo, datos.url,
      datos.visibilidad, datos.notas ?? null, datos.subidoPor,
    ]
  );
  return id;
}

export async function obtenerDocumentoLegajo(id: string): Promise<DocumentoLegajo | null> {
  const filas = await query<DocumentoLegajo>(
    `SELECT d.id, d.perfil_id, d.nombre, d.tipo, d.url, d.visibilidad, d.notas,
            d.fecha, d.subido_por,
            TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS subido_por_nombre,
            j.nombre AS jugador_nombre, j.apellido AS jugador_apellido, j.dni AS jugador_dni
       FROM documentos_legajo d
       LEFT JOIN perfiles u ON u.id = d.subido_por
       LEFT JOIN perfiles j ON j.id = d.perfil_id
      WHERE d.id = ?`,
    [id]
  );
  return filas[0] ?? null;
}

// ---------------------------------------------------------------------------
// Recibos
// ---------------------------------------------------------------------------

export interface Recibo {
  id: string;
  numero: string;
  cuota_id: string | null;
  familia_id: string | null;
  monto: number;
  fecha_emision: string;
  forma_pago: string;
  concepto: string | null;
  emitido_por: string | null;
  estado: string;
  anulado_motivo: string | null;
  descargado_en: string | null;
  // Para pintar la tabla sin tener que cruzar con otras tablas en el cliente.
  socio_nombre: string | null;
  socio_dni: string | null;
  mes: number | null;
  anio: number | null;
}

export async function listarRecibos(filtros?: { estado?: string; limite?: number }): Promise<Recibo[]> {
  const conds: string[] = [];
  const params: any[] = [];

  if (filtros?.estado) {
    conds.push('r.estado = ?');
    params.push(filtros.estado);
  }
  params.push(Math.min(filtros?.limite ?? 100, 500));

  return query<Recibo>(
    `SELECT r.id, r.numero, r.cuota_id, r.familia_id, r.monto, r.fecha_emision,
            r.forma_pago, r.concepto, r.emitido_por, r.estado, r.anulado_motivo,
            r.descargado_en,
            TRIM(CONCAT(p.nombre, ' ', p.apellido)) AS socio_nombre,
            p.dni AS socio_dni, c.mes, c.anio
       FROM recibos r
       LEFT JOIN familias f ON f.id = r.familia_id
       LEFT JOIN perfiles p ON p.id = f.padre_perfil_id
       LEFT JOIN cuotas c ON c.id = r.cuota_id
      ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''}
      ORDER BY r.fecha_emision DESC, r.numero DESC
      LIMIT ?`,
    params
  );
}

export async function obtenerRecibo(id: string): Promise<Recibo | null> {
  const filas = await query<Recibo>(
    `SELECT r.id, r.numero, r.cuota_id, r.familia_id, r.monto, r.fecha_emision,
            r.forma_pago, r.concepto, r.emitido_por, r.estado, r.anulado_motivo,
            r.descargado_en,
            TRIM(CONCAT(p.nombre, ' ', p.apellido)) AS socio_nombre,
            p.dni AS socio_dni, c.mes, c.anio
       FROM recibos r
       LEFT JOIN familias f ON f.id = r.familia_id
       LEFT JOIN perfiles p ON p.id = f.padre_perfil_id
       LEFT JOIN cuotas c ON c.id = r.cuota_id
      WHERE r.id = ?`,
    [id]
  );
  return filas[0] ?? null;
}

/**
 * Emite un recibo con número correlativo.
 *
 * Va en una transacción con `FOR UPDATE` sobre la última fila porque el número
 * es UNIQUE: si el tesorero y el admin emiten en el mismo segundo, sin el lock
 * los dos leen el mismo número y uno revienta con duplicate key. Con el lock, el
 * segundo espera y lee el número ya usado.
 *
 * Y el recibo nunca se borra. Si salió mal, se anula y se emite otro con
 * `reemplaza_id` apuntando a este: el banco necesita ver los dos.
 */
export async function emitirRecibo(datos: {
  cuotaId?: string | null;
  familiaId?: string | null;
  monto: number;
  formaPago: string;
  concepto?: string | null;
  emitidoPor: string;
  reemplazaId?: string | null;
}): Promise<{ id: string; numero: string }> {
  return transaccion(async (conn) => {
    const [ultimos] = await conn.execute<any[]>(
      'SELECT numero FROM recibos ORDER BY created_at DESC, numero DESC LIMIT 1 FOR UPDATE'
    );

    const anio = new Date().getFullYear();
    let correlativo = 1;

    if (ultimos?.[0]?.numero) {
      const partes = String(ultimos[0].numero).split('-');
      const numeroPrevio = parseInt(partes[partes.length - 1], 10);
      if (Number.isFinite(numeroPrevio)) correlativo = numeroPrevio + 1;
    }

    // Con el año en el número, el contador arranca en 1 al cambiar de año. Sin
    // eso, el 2 de enero se seguiría del 999 de diciembre y el banco no
    // entiende nada.
    const numero = `R-${anio}-${String(correlativo).padStart(5, '0')}`;
    const id = uuid();

    await conn.execute(
      `INSERT INTO recibos
         (id, numero, cuota_id, familia_id, monto, forma_pago, concepto,
          emitido_por, estado, reemplaza_id, fecha_emision, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'emitido', ?, CURDATE(), NOW())`,
      [
        id, numero, datos.cuotaId ?? null, datos.familiaId ?? null, datos.monto,
        datos.formaPago, datos.concepto ?? null, datos.emitidoPor,
        datos.reemplazaId ?? null,
      ]
    );

    return { id, numero };
  });
}

export async function anularRecibo(id: string, motivo: string, porId: string): Promise<void> {
  await execute(
    `UPDATE recibos
        SET estado = 'anulado', anulado_motivo = ?, anulado_por = ?, anulado_en = NOW()
      WHERE id = ? AND estado = 'emitido'`,
    [motivo.slice(0, 500), porId, id]
  );
}

export async function marcarReciboDescargado(id: string, porId: string): Promise<void> {
  await execute(
    'UPDATE recibos SET descargado_en = NOW(), descargado_por = ? WHERE id = ?',
    [porId, id]
  );
}

// ---------------------------------------------------------------------------
// Seguros
// ---------------------------------------------------------------------------

export interface Adherente {
  id: string;
  jugador_perfil_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  fecha_nacimiento: string | null;
  estado: string;
  fecha_adhesion: string | null;
  fecha_vencimiento: string | null;
  monto: number | null;
  pagado: number;
  fecha_pago: string | null;
  comprobante_url: string | null;
  notas: string | null;
}

export async function listarSeguros(filtros?: { estado?: string }): Promise<Adherente[]> {
  const conds: string[] = ['p.apellido <> \'DADO DE BAJA\''];
  const params: any[] = [];

  if (filtros?.estado) {
    conds.push('COALESCE(s.estado, \'pendiente\') = ?');
    params.push(filtros.estado);
  }

  // LEFT JOIN y no INNER: el club necesita ver también a los que nunca se
  // tocaron, porque son exactamente los que hay que perseguir antes del
  // corte.
  return query<Adherente>(
    `SELECT s.id, s.jugador_perfil_id, s.estado, s.fecha_adhesion, s.fecha_vencimiento,
            s.monto, s.pagado, s.fecha_pago, s.comprobante_url, s.notas,
            p.nombre, p.apellido, p.dni, d.fecha_nacimiento
       FROM deportistas d
       JOIN perfiles p ON p.id = d.perfil_id
       LEFT JOIN seguros s ON s.jugador_perfil_id = d.perfil_id
      WHERE ${conds.join(' AND ')}
      ORDER BY s.estado IS NULL DESC, p.apellido, p.nombre`,
    params
  );
}

/**
 * Guarda o actualiza la adhered.
 *
 * `INSERT ... ON DUPLICATE KEY` en vez de buscar y después escribir: entre el
 * SELECT y el INSERT hay dos requests de la directiva y otra persona carga en
 * medio.
 */
export async function guardarSeguro(datos: {
  jugadorPerfilId: string;
  estado: string;
  fechaAdhesion?: string | null;
  fechaVencimiento?: string | null;
  monto?: number | null;
  pagado?: boolean;
  fechaPago?: string | null;
  comprobanteUrl?: string | null;
  notas?: string | null;
  registradoPor: string;
}): Promise<void> {
  await transaccion(async (conn) => {
    const [anterior] = await conn.execute<any[]>(
      'SELECT id, estado FROM seguros WHERE jugador_perfil_id = ? FOR UPDATE',
      [datos.jugadorPerfilId]
    );

    const id = anterior?.[0]?.id ?? uuid();

    await conn.execute(
      `INSERT INTO seguros
         (id, jugador_perfil_id, estado, fecha_adhesion, fecha_vencimiento, monto,
          pagado, fecha_pago, comprobante_url, notas, registrado_por)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         estado = VALUES(estado),
         fecha_adhesion = VALUES(fecha_adhesion),
         fecha_vencimiento = VALUES(fecha_vencimiento),
         monto = VALUES(monto),
         pagado = VALUES(pagado),
         fecha_pago = VALUES(fecha_pago),
         comprobante_url = VALUES(comprobante_url),
         notas = VALUES(notas),
         registrado_por = VALUES(registrado_por)`,
      [
        id, datos.jugadorPerfilId, datos.estado, datos.fechaAdhesion ?? null,
        datos.fechaVencimiento ?? null, datos.monto ?? null, datos.pagado ? 1 : 0,
        datos.fechaPago ?? null, datos.comprobanteUrl ?? null,
        datos.notas ?? null, datos.registradoPor,
      ]
    );

    // El historial solo cuando el estado cambia de verdad. Renovar dos veces el
    // mismo estado no es una transición y no ensucia la historia.
    if (anterior && anterior[0].estado !== datos.estado) {
      await conn.execute(
        `INSERT INTO seguros_historial
           (id, seguro_id, estado_anterior, estado_nuevo, nota, registrado_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuid(), id, anterior[0].estado, datos.estado, datos.notas ?? null, datos.registradoPor]
      );
    }
  });
}

export async function configSeguro(): Promise<{
  monto_base: number;
  meses_vigencia: number;
  dias_aviso: number;
  dia_corte: number | null;
}> {
  const filas = await query<any>('SELECT * FROM configuracion_seguro WHERE id = 1');
  return filas[0] ?? { monto_base: 15000, meses_vigencia: 12, dias_aviso: 30, dia_corte: null };
}

export async function guardarConfigSeguro(datos: {
  montoBase: number;
  mesesVigencia: number;
  diasAviso: number;
  diaCorte: number | null;
}): Promise<void> {
  await execute(
    `UPDATE configuracion_seguro
        SET monto_base = ?, meses_vigencia = ?, dias_aviso = ?, dia_corte = ?
      WHERE id = 1`,
    [datos.montoBase, datos.mesesVigencia, datos.diasAviso, datos.diaCorte]
  );
}

// ---------------------------------------------------------------------------
// Inventario y préstamos
// ---------------------------------------------------------------------------

export interface ItemInventario {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  cantidad_total: number;
  cantidad_prestada: number;
  estado: string;
  ubicacion: string | null;
  valor_unitario: number | null;
  notas: string | null;
  /** Lo que hay de verdad. Se calcula acá y no en el cliente. */
  cantidad_disponible: number;
}

export async function listarInventario(): Promise<ItemInventario[]> {
  return query<ItemInventario>(
    `SELECT id, nombre, descripcion, categoria, cantidad_total, cantidad_prestada,
            estado, ubicacion, valor_unitario, notas,
            (cantidad_total - cantidad_prestada) AS cantidad_disponible
       FROM inventario_items
      ORDER BY estado, categoria, nombre`
  );
}

export async function guardarItem(datos: {
  id?: string | null;
  nombre: string;
  descripcion?: string | null;
  categoria: string;
  cantidadTotal: number;
  estado: string;
  ubicacion?: string | null;
  valorUnitario?: number | null;
  notas?: string | null;
  actualizadoPor: string;
}): Promise<string> {
  const id = datos.id ?? uuid();

  if (datos.id) {
    await execute(
      `UPDATE inventario_items
          SET nombre = ?, descripcion = ?, categoria = ?, cantidad_total = ?,
              estado = ?, ubicacion = ?, valor_unitario = ?, notas = ?, actualizado_por = ?
        WHERE id = ?`,
      [
        datos.nombre, datos.descripcion ?? null, datos.categoria, datos.cantidadTotal,
        datos.estado, datos.ubicacion ?? null, datos.valorUnitario ?? null,
        datos.notas ?? null, datos.actualizadoPor, datos.id,
      ]
    );
    return datos.id;
  }

  await execute(
    `INSERT INTO inventario_items
       (id, nombre, descripcion, categoria, cantidad_total, cantidad_prestada,
        estado, ubicacion, valor_unitario, notas, actualizado_por)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
    [
      id, datos.nombre, datos.descripcion ?? null, datos.categoria,
      datos.cantidadTotal, datos.estado, datos.ubicacion ?? null,
      datos.valorUnitario ?? null, datos.notas ?? null, datos.actualizadoPor,
    ]
  );
  return id;
}

export interface Prestamo {
  id: string;
  item_id: string;
  item_nombre: string;
  persona_nombre: string;
  usuario_nombre: string | null;
  cantidad: number;
  fecha_prestamo: string;
  fecha_estimada_devolucion: string | null;
  fecha_devolucion: string | null;
  estado: string;
  notas: string | null;
}

export async function listarPrestamos(soloActivos = false): Promise<Prestamo[]> {
  return query<Prestamo>(
    `SELECT p.id, p.item_id, i.nombre AS item_nombre, p.persona_nombre,
            TRIM(CONCAT(u.nombre, ' ', u.apellido)) AS usuario_nombre,
            p.cantidad, p.fecha_prestamo, p.fecha_estimada_devolucion,
            p.fecha_devolucion, p.estado, p.notas
       FROM prestamos_equipo p
       JOIN inventario_items i ON i.id = p.item_id
       LEFT JOIN perfiles u ON u.id = p.usuario_id
      ${soloActivos ? "WHERE p.estado = 'prestado'" : ''}
      ORDER BY p.estado = 'prestado' DESC, p.fecha_prestamo DESC`
  );
}

/**
 * Prestamo o devolucion.
 *
 * El contador `cantidad_prestada` se ajusta acá y no se calcula con un COUNT
 * sobre los préstamos, porque los perdidos también hay que restarlos y el
 * `COUNT` no distingue un préstamo pendiente de uno que se dio por perdido.
 */
export async function registrarPrestamo(datos: {
  itemId: string;
  personaNombre: string;
  usuarioId?: string | null;
  cantidad: number;
  fechaEstimadaDevolucion?: string | null;
  notas?: string | null;
  registradoPor: string;
}): Promise<void> {
  await transaccion(async (conn) => {
    const [items] = await conn.execute<any[]>(
      'SELECT nombre, cantidad_total, cantidad_prestada FROM inventario_items WHERE id = ? FOR UPDATE',
      [datos.itemId]
    );
    const item = items?.[0];
    if (!item) throw new Error('El equipo no existe');

    const disponible = item.cantidad_total - item.cantidad_prestada;
    if (datos.cantidad > disponible) {
      throw new Error(
        `No hay suficiente: quedan ${disponible} y pidió ${datos.cantidad}.`
      );
    }

    await conn.execute(
      `INSERT INTO prestamos_equipo
         (id, item_id, persona_nombre, usuario_id, cantidad, fecha_prestamo,
          fecha_estimada_devolucion, notas, estado, registrado_por)
       VALUES (?, ?, ?, ?, ?, CURDATE(), ?, ?, 'prestado', ?)`,
      [
        uuid(), datos.itemId, datos.personaNombre, datos.usuarioId ?? null,
        datos.cantidad, datos.fechaEstimadaDevolucion ?? null,
        datos.notas ?? null, datos.registradoPor,
      ]
    );

    await conn.execute(
      'UPDATE inventario_items SET cantidad_prestada = cantidad_prestada + ? WHERE id = ?',
      [datos.cantidad, datos.itemId]
    );
  });
}

export async function cerrarPrestamo(
  prestamoId: string,
  resultado: 'devuelto' | 'perdido'
): Promise<void> {
  await transaccion(async (conn) => {
    const [p] = await conn.execute<any[]>(
      'SELECT item_id, cantidad, estado FROM prestamos_equipo WHERE id = ? FOR UPDATE',
      [prestamoId]
    );
    const prestamo = p?.[0];
    if (!prestamo) throw new Error('El préstamo no existe');
    if (prestamo.estado !== 'prestado') {
      throw new Error('Ese préstamo ya estaba cerrado');
    }

    await conn.execute(
      `UPDATE prestamos_equipo
          SET estado = ?, fecha_devolucion = CURDATE()
        WHERE id = ?`,
      [resultado, prestamoId]
    );

    // Devuelto vuelve al inventario. Perdido NO vuelve: se resta de las
    //.existentes, y la baja del bien la decide la directiva aparte.
    if (resultado === 'devuelto') {
      await conn.execute(
        'UPDATE inventario_items SET cantidad_prestada = GREATEST(0, cantidad_prestada - ?) WHERE id = ?',
        [prestamo.cantidad, prestamo.item_id]
      );
    } else {
      await conn.execute(
        'UPDATE inventario_items SET cantidad_total = GREATEST(0, cantidad_total - ?), cantidad_prestada = GREATEST(0, cantidad_prestada - ?) WHERE id = ?',
        [prestamo.cantidad, prestamo.cantidad, prestamo.item_id]
      );
    }
  });
}
