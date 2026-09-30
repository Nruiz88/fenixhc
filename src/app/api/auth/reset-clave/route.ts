import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { passwordSchema, firstError } from '@/lib/schemas';
import { z } from 'zod';
import {
  cambiarClaveConToken,
  revisarToken,
  esTokenValido,
} from '@/lib/recuperacion';

// Revisar y aplicar el cambio de clave.
//
// ACA SE PUEDE DECIR QUE EL LINK VENCIÓ, Y ES A PROPÓSITO
//
// El endpoint del pedido recibe un email, que es un dato público. Este recibe
// un secreto de 64 hex que solo tuvo quien pidió el cambio. Ocultarle el motivo
// a esa persona solo la deja probando a ciegas.
//
// LO QUE ESTE ENDPOINT NO PUEDE HACER
//
// Cerrar las sesiones abiertas de esa cuenta. El token de sesión es un JWT sin
// estado: no hay dónde anotar "esta sesión fue revocada". La clave nueva empieza
// a valer para los próximos ingresos, pero un dispositivo que ya estaba
// adentro sigue adentro hasta que su token expira (7 días).
//
// Las dos salidas son malas por razones distintas: rotar el JWT_SECRET cierra las
// sesiones de todo el club —una clave olvidada cerraría el portal del
// tesorero—, y esperar los 7 días deja abierta la sesión de quien robó la
// clave, que es justo el caso que motiva hacer esto.
//
// Queda anotado como limitación conocida. Cuando haga falta, la solución es una
// tabla de sesiones revocadas por usuario con un chequeo en el login, y no en el
// proxy: la verificación del JWT tiene que seguir siendo sin base de datos
// porque corre en cada request.

/**
 * Revisa el token SIN consumirlo.
 *
 * La pantalla lo llama al abrir para poder decir "este link venció" antes de
 * que la persona escriba una clave nueva, en vez de dejarla hacerlo y recién
 * ahí avisarle que no iba a servir.
 *
 * No dice nada del usuario más allá del nombre: sirve para que quien llegó
 * clickeando en el mail sepa a qué cuenta corresponde. No expone ni el email
 * ni el DNI.
 */
export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? '';

  if (!esTokenValido(token)) {
    return NextResponse.json({ ok: false, motivo: 'invalido' }, { status: 404 });
  }

  const r = await revisarToken(token);

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, motivo: r.motivo },
      { status: r.motivo === 'expirado' ? 410 : 404 }
    );
  }

  return NextResponse.json({ ok: true, nombre: r.nombre });
}

export async function POST(request: NextRequest) {
  try {
    // Límite por IP: alguien probando tokens robados no debería poder intentar
    // mil. Ocho por hora y por conexión es de sobra para una persona.
    const ip = clientIp(request);
    if (!rateLimit(`reset-clave:${ip}`, 8, 3_600_000)) {
      return NextResponse.json(
        { error: 'Demasiados intentos desde esta conexión. Probá en un rato.' },
        { status: 429 }
      );
    }

    const leido = await leerJson<{ token?: string; password?: string; confirmar?: string }>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const token = String(leido.data.token ?? '').trim();
    const password = String(leido.data.password ?? '');
    const confirmar = String(leido.data.confirmar ?? '');

    if (!token) {
      return NextResponse.json({ error: 'Falta el link de recuperación' }, { status: 400 });
    }

    const parseado = z.string().min(6, 'La contraseña necesita al menos 6 caracteres').safeParse(password);
    if (!parseado.success) {
      return NextResponse.json({ error: firstError(parseado.error) }, { status: 400 });
    }

    // Confirmar evita el error más caro de todos: cambiar la clave, no
    // acordarse de cuál escribiste y perder el acceso a la cuenta en el mismo
    // paso en que la arreglabas.
    if (password !== confirmar) {
      return NextResponse.json({ error: 'Las dos contraseñas no coinciden' }, { status: 400 });
    }

    // Se valida con el mismo esquema que el registro, para que nadie termine
    // con una clave que después no puede usar en el login.
    const nuevaPassword = passwordSchema.parse(parseado.data);

    const r = await cambiarClaveConToken({ token, nuevaPassword });

    if (r.ok) {
      return NextResponse.json({ success: true, mensaje: r.mensaje });
    }

    const mensajes: Record<string, string> = {
      invalido: 'Ese link no sirve. Puede que ya lo hayas usado.',
      expirado:
        'Ese link venció. Pide uno nuevo: los links duran una hora y se pueden usar una sola vez.',
      error: 'No pudimos cambiar la clave. Probá de nuevo en un rato.',
    };

    const status = r.motivo === 'invalido' ? 404 : r.motivo === 'expirado' ? 410 : 500;
    return NextResponse.json({ error: mensajes[r.motivo ?? 'error'] }, { status });
  } catch (err: any) {
    console.error('Cambio de clave:', err);
    return NextResponse.json(
      { error: 'No pudimos cambiar la clave. Probá de nuevo en un rato.' },
      { status: 500 }
    );
  }
}
