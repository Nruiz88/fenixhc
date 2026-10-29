import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { queryOne, transaccion } from '@/lib/db';
import { emailSchema, firstError } from '@/lib/schemas';
import { rateLimit } from '@/lib/rateLimit';
import { reenviarVerificacion } from '@/lib/verification';
import { getBaseUrl } from '@/lib/url';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';

interface HijoVinculado {
  usuario_id: string;
  email: string;
  email_verificado: number;
  nombre: string;
}

/**
 * El padre reenvía (y si hace falta corrige) la verificación de su hijo.
 *
 * POR QUÉ EXISTE
 *
 * El alta crea la cuenta del jugador y le manda el enlace a la casilla que
 * cargó el padre. Si esa casilla estaba mal escrita, o el correo se perdió, o
 * el chico abrió el enlace días después, el jugador quedaba bloqueado y nadie
 * podía destrabarlo desde la familia. El padre ya es el responsable legal de
 * esos datos: es quien puede corregir el email mientras la cuenta siga sin
 * verificar y pedir un enlace nuevo.
 *
 * La cuenta verificada no se toca desde acá. Cambiar el email de una cuenta ya
 * verificada es una operación del panel, no del portal.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['socio_benefactor']);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (!rateLimit(`verif-hijo:${auth.user.id}`, 5, 10 * 60_000)) {
      return NextResponse.json(
        { error: 'Demasiados reenvíos. Esperá unos minutos.' },
        { status: 429 }
      );
    }

    const leido = await leerJson<{ perfilId?: string; email?: string }>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const perfilId = String(leido.data.perfilId ?? '').trim();
    if (!perfilId) {
      return NextResponse.json({ error: 'Falta el jugador' }, { status: 400 });
    }

    // `familias.padre_perfil_id` guarda el id del PERFIL, que en las cuentas
    // creadas por registro coincide con el del usuario pero no está garantizado
    // en cuentas viejas. Se resuelve siempre desde la tabla.
    const padre = await queryOne<{ perfil_id: string }>(
      'SELECT id AS perfil_id FROM perfiles WHERE usuario_id = ? LIMIT 1',
      [auth.user.id]
    );
    const padrePerfilId = padre?.perfil_id ?? auth.user.id;

    const hijo = await queryOne<HijoVinculado>(
      `SELECT u.id AS usuario_id, u.email, u.email_verificado, p.nombre
         FROM familias f
         JOIN perfiles p ON p.id = f.deportista_perfil_id
         JOIN usuarios u ON u.id = p.usuario_id
        WHERE f.padre_perfil_id = ? AND f.deportista_perfil_id = ?
        LIMIT 1`,
      [padrePerfilId, perfilId]
    );

    if (!hijo) {
      return NextResponse.json(
        { error: 'Ese jugador no está vinculado a tu cuenta.' },
        { status: 404 }
      );
    }

    if (hijo.email_verificado) {
      return NextResponse.json({
        ok: true,
        email: hijo.email,
        enviado: false,
        message: 'La cuenta de tu hijo ya está verificada.',
      });
    }

    let email = hijo.email;
    const emailRaw = typeof leido.data.email === 'string' ? leido.data.email.trim() : '';

    if (emailRaw && emailRaw.toLowerCase() !== email.toLowerCase()) {
      const parsed = emailSchema.safeParse(emailRaw);
      if (!parsed.success) {
        return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
      }
      email = parsed.data;

      // Misma regla que en el alta: la casilla del jugador no puede ser la del
      // adulto. Si no, el padre terminaría verificando la cuenta del hijo desde
      // su propio correo y la verificación dejaría de probar nada.
      if (email.toLowerCase() === auth.user.email.toLowerCase()) {
        return NextResponse.json(
          { error: 'El email del jugador tiene que ser distinto al tuyo.' },
          { status: 400 }
        );
      }

      const enUso = await queryOne<{ id: string }>(
        'SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1',
        [email, hijo.usuario_id]
      );
      if (enUso) {
        return NextResponse.json(
          { error: 'Ese email ya está en uso por otra cuenta.' },
          { status: 409 }
        );
      }

      // Usuario y ficha tienen que quedar con la misma dirección: el login lee
      // `usuarios.email` y el portal muestra `perfiles.correo`.
      await transaccion(async (conn) => {
        await conn.execute(
          `UPDATE usuarios
              SET email = ?, email_verificado = 0,
                  verification_token = NULL, verification_expires_at = NULL
            WHERE id = ?`,
          [email, hijo.usuario_id]
        );
        await conn.execute(
          'UPDATE perfiles SET correo = ? WHERE usuario_id = ?',
          [email, hijo.usuario_id]
        );
      });
    }

    const envio = await reenviarVerificacion(
      hijo.usuario_id,
      email,
      hijo.nombre || 'jugador',
      getBaseUrl(request)
    );

    if (!envio.ok && envio.motivo === 'error') {
      console.error(
        `No se pudo reenviar la verificación del hijo ${email} (usuario ${hijo.usuario_id})`
      );
    }

    return NextResponse.json({
      ok: true,
      email,
      enviado: envio.ok,
      ...(envio.devToken
        ? { devVerificationUrl: `${getBaseUrl(request)}/verificar?token=${envio.devToken}` }
        : {}),
      message: envio.ok
        ? `Le enviamos un enlace nuevo a ${email}.`
        : 'Guardamos el email, pero el correo no salió. Probá de nuevo en unos minutos.',
    });
  } catch (err) {
    console.error('Verificación de hijo error:', err);
    return NextResponse.json(
      { error: 'No se pudo reenviar la verificación' },
      { status: 500 }
    );
  }
}
