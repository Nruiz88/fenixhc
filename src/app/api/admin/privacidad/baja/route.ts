import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuid } from '@/lib/db';
import { requireModulo } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';

// Baja de datos personales (derecho de supresión, Ley 25.326 art. 8 inc. d).
//
// La baja NO borra en cascada. Si se borrara la cuenta, se irían el historial
// de pagos y la contabilidad del club, que son datos que tiene obligación de
// conservar. Lo que se elimina es la identidad:
//
//   - La documentación (fotos de DNI) se borra del disco y de la base.
//   - El perfil se anonimiza: el nombre pasa a un código, el DNI y el CUIL
//     se vacían, y el email se cambia a uno no contactable.
//   - Las cuotas quedan sin padre_perfil_id, así que el cobro histórico se
//     conserva sin querma a una persona identificable.
//   - La cuenta se desactiva para que nadie pueda entrar con esos datos.
//
// Lo que NO se borra nunca: los movimientos de finanzas y el estado de las
// cuotas. Son registros contables, y borrarlos sería destruir la contabilidad
// del club.

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModulo('usuarios');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson<{
      perfil_id?: string;
      motivo?: string;
      confirmar?: boolean;
    }>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const { perfil_id, motivo, confirmar } = leido.data;

    if (!perfil_id) {
      return NextResponse.json({ error: 'Falta la persona a dar de baja' }, { status: 400 });
    }

    // Es una acción irreversible sobre datos de una persona. Se pide
    // confirmación explícita: un click de más no puede borrar el DNI de un
    // menor.
    if (!confirmar) {
      return NextResponse.json(
        {
          error: 'Falta la confirmación',
          requiereConfirmacion: true,
          mensaje:
            'La baja anonimiza a la persona y borra su documentación. Los registros de pago y contabilidad se conservan, sin nombre.',
        },
        { status: 400 }
      );
    }

    const perfil = await query<any>(
      'SELECT id, nombre, apellido, dni, cuil, correo, rol, usuario_id FROM perfiles WHERE id = ?',
      [perfil_id]
    );
    if (!perfil[0]) {
      return NextResponse.json({ error: 'La persona no existe' }, { status: 404 });
    }

    const persona = perfil[0];

    // No se puede dar de baja al último administrador, por la misma razón que
    // no se puede quitarle el rol: el club quedaría sin nadie que lo administre.
    if (persona.rol === 'admin') {
      const [otros] = await query<{ c: number }>(
        "SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'admin' AND id != ? AND email_verificado = 1",
        [persona.usuario_id]
      );
      if (Number(otros?.c ?? 0) === 0) {
        return NextResponse.json(
          { error: 'No se puede dar de baja al único administrador. Creá otro primero.' },
          { status: 400 }
        );
      }
    }

    // Código de seudonimización. Se genera al azar y no se deriva del nombre,
    // para que no permita reconstruirlo.
    const codigo = `BAJA-${uuid().slice(0, 8).toUpperCase()}`;

    // 1. Fotografías de DNI. Se borran de la base; el archivo en disco lo
    //    limpia /api/files cuando ya no queda nadie que lo referencie.
    await execute(
      'UPDATE deportistas SET dni_frente_url = NULL, dni_fondo_url = NULL WHERE perfil_id = ?',
      [persona.id]
    );

    // 2. Comprobantes de pago. No se borran: son el respaldo de un cobro que
    //    el club realizó. Se desenlazan para que no queden asociados a una
    //    identidad, y queda la constancia de que existieron.
    await execute(
      'UPDATE cuotas SET comprobante_url = NULL WHERE familia_id IN (SELECT id FROM familias WHERE padre_perfil_id = ?)',
      [persona.id]
    );

    // 3. Vínculos familiares: se despegan para que la cuota quede huérfana y
    //    sin persona identificable detrás.
    await execute(
      'UPDATE familias SET padre_perfil_id = ? WHERE padre_perfil_id = ?',
      [`baja-${uuid()}`, persona.id]
    );
    await execute(
      'UPDATE familias SET deportista_perfil_id = ? WHERE deportista_perfil_id = ?',
      [`baja-${uuid()}`, persona.id]
    );

    // 4. Perfil anonimizado.
    await execute(
      `UPDATE perfiles
          SET nombre = ?, apellido = 'DADO DE BAJA', dni = ?, cuil = NULL,
              correo = ?, telefono = NULL, direccion = NULL, foto_url = NULL
        WHERE id = ?`,
      [
        codigo,
        `BAJA-${uuid().replace(/-/g, '').slice(0, 14)}`,
        `baja+${codigo.toLowerCase()}@club.local`,
        persona.id,
      ]
    );

    // 5. Cuenta desactivada. El email se replaces por uno no contactable y la
    //    verificación se revierte, así que no puede volver a entrar ni alguien
    //    con la sesión vieja puede seguir usándola.
    await execute(
      `UPDATE usuarios
          SET email = ?, email_verificado = 0,
              verification_token = NULL, verification_expires_at = NULL
        WHERE id = ?`,
      [`baja+${codigo.toLowerCase()}@club.local`, persona.usuario_id]
    );

    await execute(
      `INSERT INTO solicitudes_baja
         (id, perfil_id, solicitante_nombre, solicitante_email, motivo, estado, notas, resuelta_at, resuelta_por)
       VALUES (?, ?, ?, ?, ?, 'resuelta', ?, NOW(), ?)`,
      [
        uuid(),
        persona.id,
        `${auth.user.nombre} ${auth.user.apellido} (administración)`,
        auth.user.email,
        motivo ?? null,
        `Baja ejecutada por la administración. Datos anonimizados bajo el código ${codigo}. Documentación eliminada. Registros de pago y contabilidad conservados.`,
        auth.user.id,
      ]
    );

    return NextResponse.json({
      success: true,
      codigo,
      mensaje:
        'La persona fue dada de baja. Su documentación se eliminó y sus datos personales quedaron anonimizados. Los registros de pago y la contabilidad se conservaron.',
    });
  } catch (err: any) {
    console.error('Baja de datos personales error:', err);
    return NextResponse.json({ error: err.message || 'Error al procesar la baja' }, { status: 500 });
  }
}
