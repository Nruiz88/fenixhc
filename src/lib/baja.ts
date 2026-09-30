// Baja de datos personales: el procedimiento, suelto del endpoint.
//
// Vive acá porque lo invocan dos caminos distintos y tiene que ser el MISMO
// procedimiento: la baja directa desde el panel y la resolución de una
// solicitud del titular. Si fueran dos implementaciones, la que se usara
// desde el portal podría quedar sin una de las garantías —y la diferencia
// entre las dos es justamente lo que importa.
//
// Qué hace y qué NO hace:
//
//   Anonimiza la identidad: nombre, DNI, CUIL, teléfono, dirección,
//   documentación y acceso a la cuenta.
//
//   Conserva el historial de pagos y la contabilidad. Borrarlos sería
//   destruir la contabilidad del club, que tiene obligación legal de
//   llevarla. Las cuotas quedan colgadas de un perfil sustituto, sin
//   persona identificable detrás.
//
// Todo va en una transacción. La baja toca siete tablas en un orden que
// importa, y sin atomicidad un fallo a la mitad dejaba a la persona sin
// documentación pero todavía identificable, sin registro de nada.

import { transaccion, uuid } from './db';

export interface ResultadoBaja {
  codigo: string;
  /** Cuántas familias quedaron apuntando a un perfil sustituto. */
  familiasDesvinculadas: number;
}

export class ErrorBaja extends Error {
  constructor(
    message: string,
    readonly motivo:
      | 'perfil_inexistente'
      | 'ultimo_admin'
      | 'error_interno'
  ) {
    super(message);
  }
}

export async function ejecutarBaja(params: {
  perfilId: string;
  /** Quién la ordena: un admin directo, o el admin que resuelve un pedido. */
  autorizadaPorId: string;
  autorizadaPorNombre: string;
  autorizadaPorEmail: string;
  motivo?: string | null;
  /** Datos de la solicitud original, si la baja viene de resolver un pedido. */
  solicitud?: {
    id: string;
    solicitanteNombre: string;
    solicitanteEmail: string;
  } | null;
}): Promise<ResultadoBaja> {
  const { perfilId, autorizadaPorId, autorizadaPorNombre, autorizadaPorEmail, motivo, solicitud } = params;

  return transaccion(async (conn) => {
    // --- Verificaciones dentro de la transacción ------------------------
    const [personas] = await conn.execute<any[]>(
      'SELECT id, nombre, apellido, dni, cuil, correo, rol, usuario_id FROM perfiles WHERE id = ?',
      [perfilId]
    );
    const persona = personas[0];

    if (!persona) {
      throw new ErrorBaja('La persona no existe o ya fue dada de baja', 'perfil_inexistente');
    }

    // El club no puede quedar sin nadie que lo administre.
    if (persona.rol === 'admin') {
      const [otros] = await conn.execute<any[]>(
        "SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'admin' AND id != ? AND email_verificado = 1",
        [persona.usuario_id]
      );
      if (Number(otros?.[0]?.c ?? 0) === 0) {
        throw new ErrorBaja(
          'No se puede dar de baja al único administrador. Creá otro primero.',
          'ultimo_admin'
        );
      }
    }

    const codigo = `BAJA-${uuid().replace(/-/g, '').slice(0, 8).toUpperCase()}`;

    // --- 1. Documentación ----------------------------------------------
    await conn.execute(
      'UPDATE deportistas SET dni_frente_url = NULL, dni_fondo_url = NULL WHERE perfil_id = ?',
      [persona.id]
    );

    // --- 2. Comprobantes ------------------------------------------------
    // No se borran: son el respaldo de un cobro. Se desenlazan para que no
    // queden asociados a una identidad.
    await conn.execute(
      `UPDATE cuotas SET comprobante_url = NULL
        WHERE familia_id IN (SELECT id FROM familias WHERE padre_perfil_id = ?)`,
      [persona.id]
    );

    // --- 3. Vínculos familiares, con perfil sustituto -------------------
    // No se pueden "desvincular" poniendo un id nuevo: familias tiene FK
    // contra perfiles. Y borrar la fila tampoco sirve, porque las cuotas
    // cuelgan de la familia con ON DELETE CASCADE.
    //
    // La solución es un perfil sustituto ya anonimizado, uno por familia: el
    // UNIQUE de (padre, deportista) haría colisionar dos socios dados de
    // baja con el mismo jugador.
    const [familias] = await conn.execute<any[]>(
      'SELECT id, padre_perfil_id, deportista_perfil_id FROM familias WHERE padre_perfil_id = ? OR deportista_perfil_id = ?',
      [persona.id, persona.id]
    );

    const sustituto = async (rol: string) => {
      const nuevoId = uuid();
      await conn.execute(
        `INSERT INTO perfiles
           (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion)
         VALUES (?, NULL, ?, ?, 'DADO DE BAJA', ?, NULL, ?, NULL, NULL)`,
        [
          nuevoId,
          rol,
          `BAJA-${uuid().replace(/-/g, '').slice(0, 8).toUpperCase()}`,
          // dni es NOT NULL UNIQUE: un valor distinto por fila.
          `B${uuid().replace(/-/g, '').slice(0, 17).toUpperCase()}`,
          `baja+${nuevoId.slice(0, 8)}@club.local`,
        ]
      );
      return nuevoId;
    };

    for (const f of familias) {
      const padreNuevo =
        f.padre_perfil_id === persona.id ? await sustituto('socio_benefactor') : f.padre_perfil_id;
      const deportistaNuevo =
        f.deportista_perfil_id === persona.id
          ? await sustituto('socio_cadete')
          : f.deportista_perfil_id;
      await conn.execute(
        'UPDATE familias SET padre_perfil_id = ?, deportista_perfil_id = ? WHERE id = ?',
        [padreNuevo, deportistaNuevo, f.id]
      );
    }

    // --- 4. Perfil anonimizado -----------------------------------------
    await conn.execute(
      `UPDATE perfiles
          SET nombre = ?, apellido = 'DADO DE BAJA', dni = ?, cuil = NULL,
              correo = ?, telefono = NULL, direccion = NULL, foto_url = NULL
        WHERE id = ?`,
      [
        codigo,
        uuid().replace(/-/g, '').slice(0, 18).toUpperCase(),
        `baja+${codigo.toLowerCase()}@club.local`,
        persona.id,
      ]
    );

    // --- 5. Cuenta desactivada -----------------------------------------
    if (persona.usuario_id) {
      await conn.execute(
        `UPDATE usuarios
            SET email = ?, email_verificado = 0,
                verification_token = NULL, verification_expires_at = NULL
          WHERE id = ?`,
        [`baja+${codigo.toLowerCase()}@club.local`, persona.usuario_id]
      );
    }

    // --- 6. Constancia --------------------------------------------------
    // Va en la misma transacción: si el resto se revierte, este registro
    // tampoco puede quedar.
    const nota = [
      `Baja ejecutada por ${autorizadaPorNombre} (${autorizadaPorEmail}).`,
      `Datos anonimizados bajo el código ${codigo}.`,
      'Documentación eliminada. Registros de pago y contabilidad conservados.',
      solicitud
        ? `Origen: solicitud ${solicitud.id} de ${solicitud.solicitanteNombre} (${solicitud.solicitanteEmail}).`
        : 'Origen: alta directa desde el panel.',
    ].join(' ');

    const resultado =
      'Datos personales anonimizados. La documentación fue eliminada. Los registros de pago y la contabilidad se conservan.';

    // Si la baja viene de un pedido, el registro YA EXISTE: hay que cerrarlo,
    // no crear otro. Insertar con el id del pedido choca contra la clave
    // primaria y —peor— si algún día esa restricción se relajara, quedaría
    // duplicada la constancia de un mismo reclamo.
    //
    // Y no es solo una cuestión de clave: actualizar la fila original deja
    // intactos `created_at` y los datos del solicitante, que son la prueba de
    // cuándo llegó el pedido y quién lo hizo. Una fila nueva pierde eso.
    if (solicitud) {
      await conn.execute(
        `UPDATE solicitudes_baja
            SET perfil_id = ?, estado = 'resuelta',
                notas = CONCAT(COALESCE(notas, ''), '\\n', ?),
                resultado = ?, resuelta_at = NOW(), resuelta_por = ?
          WHERE id = ?`,
        [persona.id, nota, resultado, autorizadaPorId, solicitud.id]
      );
    } else {
      await conn.execute(
        `INSERT INTO solicitudes_baja
           (id, perfil_id, solicitante_nombre, solicitante_email, motivo, estado,
            notas, resultado, canal, created_at, resuelta_at, resuelta_por)
         VALUES (?, ?, ?, ?, ?, 'resuelta', ?, ?, 'panel', NOW(), NOW(), ?)`,
        [
          uuid(),
          persona.id,
          `${autorizadaPorNombre} (administración)`,
          autorizadaPorEmail,
          motivo ?? null,
          nota,
          resultado,
          autorizadaPorId,
        ]
      );
    }

    return { codigo, familiasDesvinculadas: familias.length };
  });
}
