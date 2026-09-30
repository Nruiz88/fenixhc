import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, uuid } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { normalizarMotivo, componerNotas } from '@/lib/baja-solicitud';

// Solicitud de baja desde el portal del socio.
//
// Acá el club sabe quién es la persona, así que la solicitud queda atada a
// la ficha desde el primer momento. El admin igual tiene que ejecutarla:
// que el pedido venga de la cuenta no lo hace más automático.
//
// Permite pedir la baja de los hijos: son menores y el ejercicio de su
// derecho lo hace madre, padre o tutor. El vínculo se valida contra la base,
// no contra lo que diga el formulario.

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    if (!rateLimit(`baja-usuario:${user.id}`, 5, 3_600_000)) {
      return NextResponse.json(
        { error: 'Ya enviaste varios pedidos hoy. Si necesitás otra cosa, escribinos.' },
        { status: 429 }
      );
    }

    const leido = await leerJson<{
      perfil_id?: string;
      motivo?: string;
      comentario?: string;
    }>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const { perfil_id } = leido.data;

    if (!perfil_id) {
      return NextResponse.json({ error: 'Elegí a quién es el pedido' }, { status: 400 });
    }

    const esUnoMismo = perfil_id === user.id;
    let nombreParaLaSolicitud: string;
    let documento: string;
    let vinculo: string;

    if (esUnoMismo) {
      const mio = await queryOne<any>(
        "SELECT nombre, apellido, dni FROM perfiles WHERE id = ? AND apellido <> 'DADO DE BAJA'",
        [user.id]
      );
      if (!mio) {
        return NextResponse.json(
          { error: 'Tu ficha ya no está activa. Escribinos a la administración.' },
          { status: 404 }
        );
      }
      nombreParaLaSolicitud = `${mio.nombre} ${mio.apellido}`;
      documento = mio.dni;
      vinculo = 'El propio socio';
    } else {
      // Solo se puede pedir por un jugador realmente vinculado a esta
      // persona. Sin este chequeo, cualquier socio podría pedir la baja de
      // un niño que no es hijo suyo.
      //
      // `query` devuelve las filas directamente: no es la tupla
      // [rows, fields] de `conn.execute`. Ya se confundió una vez con eso y
      // terminó llamándole `.find` a una fila suelta.
      const vinculados = await query<any>(
        `SELECT p.id, p.nombre, p.apellido, p.dni
         FROM familias f
         JOIN perfiles p ON p.id = f.deportista_perfil_id
         WHERE f.padre_perfil_id = ?`,
        [user.id]
      );
      const hijo = vinculados.find((h: any) => h.id === perfil_id);

      if (!hijo) {
        return NextResponse.json(
          { error: 'Ese jugador no está vinculado a tu cuenta' },
          { status: 403 }
        );
      }
      nombreParaLaSolicitud = `${hijo.nombre} ${hijo.apellido}`;
      documento = hijo.dni;
      vinculo = `Tutor de ${hijo.nombre} ${hijo.apellido}`;
    }

    // No se apila un pedido idéntico que ya está pendiente.
    const yaHay = await queryOne<any>(
      `SELECT id FROM solicitudes_baja
        WHERE perfil_id = ? AND estado IN ('pendiente','en_revision')`,
      [perfil_id]
    );
    if (yaHay) {
      return NextResponse.json(
        { error: 'Ya hay un pedido de baja en curso para esta persona' },
        { status: 409 }
      );
    }

    await execute(
      `INSERT INTO solicitudes_baja
         (id, perfil_id, solicitante_nombre, solicitante_email, documento_verificacion,
          motivo, estado, canal, notas, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'portal', ?, NOW())`,
      [
        uuid(),
        perfil_id,
        `${user.nombre} ${user.apellido}`,
        user.email,
        documento,
        normalizarMotivo(leido.data.motivo),
        componerNotas({
          vinculo,
          comentario: leido.data.comentario ? String(leido.data.comentario).trim() : '',
        }),
      ]
    );

    return NextResponse.json(
      {
        success: true,
        mensaje: `Registramos tu pedido de baja para ${nombreParaLaSolicitud}. La administración lo revisa y te responde a este correo.`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Solicitud de baja desde el portal:', err);
    return NextResponse.json({ error: 'No pudimos registrar el pedido' }, { status: 500 });
  }
}

/**
 * A quién puede pedirle baja el socio que está mirando.
 * Lo consume el portal para armar las opciones del selector.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const propio = await queryOne<any>(
      "SELECT id, nombre, apellido, dni, rol FROM perfiles WHERE id = ? AND apellido <> 'DADO DE BAJA'",
      [user.id]
    );

    const hijos = await query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni, p.rol
       FROM familias f
       JOIN perfiles p ON p.id = f.deportista_perfil_id
       WHERE f.padre_perfil_id = ? AND p.apellido <> 'DADO DE BAJA'`,
      [user.id]
    );

    return NextResponse.json({
      data: { propio, hijos },
    });
  } catch (err: any) {
    console.error('Candidatos para baja (portal):', err);
    return NextResponse.json({ error: 'No se pudo cargar la información' }, { status: 500 });
  }
}
