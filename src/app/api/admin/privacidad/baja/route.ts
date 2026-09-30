import { NextRequest, NextResponse } from 'next/server';
import { requireModulo } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { ejecutarBaja, ErrorBaja } from '@/lib/baja';

// Baja directa desde el panel, sin que haya una solicitud de por medio.
//
// El caso es: el club se entera por otro medio (un mail, una conversación)
// que alguien quiere sus datos borrados, y la administración lo ejecuta
// directamente.
//
// Si la baja viene de un pedido formal de la persona, se usa el endpoint de
// solicitudes: ahí queda la trazabilidad de que el club recibió un
// reclamo y lo resolvió, que es distinto de una baja administrativa.

// Exige confirmación explícita. Es irreversible y afecta datos de una
// persona, muchas veces menor de edad: a un click de más no puede llegar a
// borrar el DNI de un chico.
const CONFIRMACION =
  'La baja anonimiza a la persona y borra su documentación. Los registros de pago y contabilidad se conservan, sin nombre.';

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

    if (!confirmar) {
      return NextResponse.json(
        { error: 'Falta la confirmación', requiereConfirmacion: true, mensaje: CONFIRMACION },
        { status: 400 }
      );
    }

    const r = await ejecutarBaja({
      perfilId: perfil_id,
      autorizadaPorId: auth.user.id,
      autorizadaPorNombre: `${auth.user.nombre} ${auth.user.apellido}`,
      autorizadaPorEmail: auth.user.email,
      motivo,
      solicitud: null,
    });

    return NextResponse.json({
      success: true,
      codigo: r.codigo,
      mensaje:
        'La persona fue dada de baja. Su documentación se eliminó y sus datos personales quedaron anonimizados. Los registros de pago y la contabilidad se conservaron.',
    });
  } catch (err: any) {
    if (err instanceof ErrorBaja) {
      const status = err.motivo === 'perfil_inexistente' ? 404 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error('Baja de datos personales error:', err);
    // Genérico a propósito: el detalle del SQL (nombres de columnas y tablas)
    // no ayuda a quien pide la baja y sí ayuda a quien quisiera provocarlo.
    return NextResponse.json(
      { error: 'No se pudo completar la baja. No se modificó nada: los cambios quedaron revertidos.' },
      { status: 500 }
    );
  }
}

export { CONFIRMACION };
