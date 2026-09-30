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
// ESTE ENDPOINT SÍ CIERRA LAS SESIONES ABIERTAS, Y CÓMO
//
// El endpoint no hace nada especial para eso: alcanza con que
// `cambiarClaveConToken` ponga `password_changed_at = NOW()`.
//
// El token de sesión lleva dentro el sello de la clave con la que se emitió, y
// `getCurrentUser` lo compara contra el valor de la base antes de devolver un
// dato. Token con sello viejo, base con sello nuevo: el token nació de una clave
// que ya no existe y se descarta. La sesión cerrada dura un request.
//
// LAS DOS SALIDAS QUE SE DESCARTARON
//
// Rotar el JWT_SECRET cierra las sesiones de todo el club: una clave olvidada
// por una familia cerraría el portal del tesorero. Esperar los 7 días de
// expiración deja abierta la sesión de quien robó la clave, que es justo el
// caso que motiva hacer esto. El sello es per usuario, así que no tiene ninguna
// de las dos consecuencias.
//
// DÓNDE ESTÁ LA COMPARACIÓN Y POR QUÉ NO EN EL PROXY
//
// En `getCurrentUser`, no en `verifyToken`. El proxy corre en cada request y
// `verifyToken` es sincrónica: no puede consultar la base. La comparación va
// entonces en la puerta de los DATOS, que es async. Si el proxy se queda con
// un token viejo, lo único que pasa es que se renderiza el cascarón de la
// página y las llamadas por API devuelven 401.

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
