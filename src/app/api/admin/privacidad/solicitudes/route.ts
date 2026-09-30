import { NextRequest, NextResponse } from 'next/server';
import { query, execute, uuid } from '@/lib/db';
import { requireModulo } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { ejecutarBaja, ErrorBaja } from '@/lib/baja';

// Bandeja de solicitudes de baja: las que llegaron por el formulario
// público y las que mandaron los socios desde su portal.
//
// Resolver una solicitud con 'aprobar' EJECUTA la baja. No es un cambio de
// estado: el mismo procedimiento de lib/baja.ts, con la diferencia de que
// la constancia queda atada a la solicitud original, para que se pueda
// probar que el club recibió un reclamo y lo atendió.

export async function GET() {
  try {
    const auth = await requireModulo('configuracion');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [pendientes, resueltas] = await Promise.all([
      query<any>(
        `SELECT id, solicitante_nombre, solicitante_email, documento_verificacion,
                motivo, notas, estado, canal, created_at
         FROM solicitudes_baja
         WHERE estado IN ('pendiente', 'en_revision')
         ORDER BY created_at ASC`
      ),
      query<any>(
        `SELECT id, solicitante_nombre, solicitante_email, documento_verificacion,
                motivo, estado, resultado, canal, created_at, resuelta_at
         FROM solicitudes_baja
         WHERE estado IN ('resuelta', 'rechazada')
         ORDER BY resuelta_at DESC
         LIMIT 100`
      ),
    ]);

    // Para resolver, el admin necesita encontrar la ficha. Se devuelven los
    // candidatos que coinciden con el documento informado, para no obligar
    // a escribir el nombre a mano y arriesgar elegir a la persona
    // equivocada.
    const candidatos: Record<string, any[]> = {};
    for (const s of pendientes) {
      if (!s.documento_verificacion) continue;
      const filas = await query<any>(
        `SELECT p.id, p.nombre, p.apellido, p.dni, p.rol, p.correo
         FROM perfiles p
         WHERE p.dni = ? AND p.apellido <> 'DADO DE BAJA'
         LIMIT 5`,
        [s.documento_verificacion]
      );
      candidatos[s.id] = filas;
    }

    return NextResponse.json({ data: { pendientes, resueltas, candidatos } });
  } catch (err: any) {
    console.error('Solicitudes de baja GET:', err);
    return NextResponse.json({ error: 'No se pudieron cargar las solicitudes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModulo('configuracion');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson<{
      solicitud_id?: string;
      accion?: 'aprobar' | 'rechazar';
      perfil_id?: string;
      motivo?: string;
    }>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const { solicitud_id, accion, perfil_id, motivo } = leido.data;

    if (!solicitud_id || !accion) {
      return NextResponse.json({ error: 'Falta la solicitud o la acción' }, { status: 400 });
    }

    const [solicitudes] = await query<any>(
      'SELECT id, solicitante_nombre, solicitante_email, motivo, estado FROM solicitudes_baja WHERE id = ?',
      [solicitud_id]
    );
    const solicitud = solicitudes?.[0];

    if (!solicitud) {
      return NextResponse.json({ error: 'La solicitud no existe' }, { status: 404 });
    }
    if (solicitud.estado !== 'pendiente' && solicitud.estado !== 'en_revision') {
      return NextResponse.json(
        { error: `Esta solicitud ya está ${solicitud.estado}` },
        { status: 400 }
      );
    }

    // --- Rechazar -------------------------------------------------------
    if (accion === 'rechazar') {
      if (!motivo?.trim()) {
        return NextResponse.json(
          { error: 'Para rechazar hay que explicar por qué: se lo va a comunicar a quien pidió.' },
          { status: 400 }
        );
      }
      await execute(
        `UPDATE solicitudes_baja
            SET estado = 'rechazada', resultado = ?, notas = CONCAT(COALESCE(notas,''), '\nRechazada: ', ?),
                resuelta_at = NOW(), resuelta_por = ?
          WHERE id = ?`,
        [motivo.trim().slice(0, 255), motivo.trim().slice(0, 2000), auth.user.id, solicitud_id]
      );
      return NextResponse.json({
        success: true,
        mensaje: 'Solicitud rechazada. Se le informa el motivo a quien la hizo.',
      });
    }

    // --- Aprobar = ejecutar la baja --------------------------------------
    if (!perfil_id) {
      return NextResponse.json(
        { error: 'Elegí a qué persona corresponde la solicitud antes de aprobarla' },
        { status: 400 }
      );
    }

    const r = await ejecutarBaja({
      perfilId: perfil_id,
      autorizadaPorId: auth.user.id,
      autorizadaPorNombre: `${auth.user.nombre} ${auth.user.apellido}`,
      autorizadaPorEmail: auth.user.email,
      motivo: solicitud.motivo,
      solicitud: {
        id: solicitud.id,
        solicitanteNombre: solicitud.solicitante_nombre,
        solicitanteEmail: solicitud.solicitante_email,
      },
    });

    return NextResponse.json({
      success: true,
      codigo: r.codigo,
      mensaje:
        'Baja ejecutada y solicitud resuelta. Los datos quedaron anonimizados y el historial de pagos se conservó.',
    });
  } catch (err: any) {
    if (err instanceof ErrorBaja) {
      const status = err.motivo === 'perfil_inexistente' ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('Resolver solicitud de baja:', err);
    return NextResponse.json(
      { error: 'No se pudo resolver. No se modificó nada: los cambios quedaron revertidos.' },
      { status: 500 }
    );
  }
}
