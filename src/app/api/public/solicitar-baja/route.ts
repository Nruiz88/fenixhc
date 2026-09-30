import { NextRequest, NextResponse } from 'next/server';
import { execute, uuid } from '@/lib/db';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { validarPedidoPublico, componerNotas } from '@/lib/baja-solicitud';

// Solicitud de baja de datos, por formulario público.
//
// Existe para el caso que la baja desde el panel no cubre: una persona que
// ya no tiene cuenta, que nunca la tuvo, o que está pidiendo por otra.
// La ley reconoce el derecho a pedir la supresión de los datos, y si el único
// canal es "que un administrador se acuerde", ese derecho no existe.
//
// Lo que NO hace este endpoint es dar de baja a nadie. Recibe el pedido y
// lo deja en la bandeja; una persona tiene que verificar la identidad y
// ejecutarla. Anonimizar desde un formulario abierto sería un problema de
// integridad, no una comodidad: cualquiera podría mandar el DNI de otro y
// dejarlo sin sus datos.

export async function POST(request: NextRequest) {
  try {
    // Recurso público sin sesión: se limita por IP porque es anónimo, y es
    // la forma de que alguien llene la bandeja de pedidos falsos.
    if (!rateLimit(`baja-publica:${clientIp(request)}`, 3, 3_600_000)) {
      return NextResponse.json(
        { error: 'Demasiados pedidos desde esta conexión. Probá en un rato.' },
        { status: 429 }
      );
    }

    const leido = await leerJson<Record<string, unknown>>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const validado = validarPedidoPublico(leido.data);
    if (!validado.ok) {
      return NextResponse.json({ error: validado.error }, { status: 400 });
    }

    const p = validado.datos;

    const id = uuid();

    await execute(
      `INSERT INTO solicitudes_baja
         (id, perfil_id, solicitante_nombre, solicitante_email, documento_verificacion,
          motivo, estado, canal, notas, created_at)
       VALUES (?, NULL, ?, ?, ?, ?, 'pendiente', 'formulario', ?, NOW())`,
      [
        id,
        p.nombre,
        p.email,
        p.documento,
        p.motivo,
        componerNotas({ vinculo: p.relacion, comentario: p.comentario }),
      ]
    );

    return NextResponse.json(
      {
        success: true,
        // El código sirve para reclamar. Sin él, quien pide la baja no tiene
        // forma de referirse al pedido y tiene que describirlo de memoria.
        referencia: id.slice(0, 8).toUpperCase(),
        mensaje:
          'Recibimos tu pedido. La administración lo revisa y te responde a este mismo correo.',
        plazo:
          'La Ley 25.326 obliga a responder dentro de los 10 días hábiles. Si pasaron más de ese plazo, escribinos de nuevo.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Solicitud publica de baja:', err);
    return NextResponse.json(
      { error: 'No pudimos registrar el pedido. Probá de nuevo en un rato.' },
      { status: 500 }
    );
  }
}
