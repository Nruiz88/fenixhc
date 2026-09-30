import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { getBaseUrl } from '@/lib/url';
import { emailSchema, firstError } from '@/lib/schemas';
import { z } from 'zod';
import { solicitarRecuperacion } from '@/lib/recuperacion';

// Pedir el cambio de clave.
//
// LA REGLA DE ESTE ENDPOINT: no dice nunca si el email existe.
//
// La respuesta es SIEMPRE la misma. Si acá se contestara "no encontramos esa
// cuenta", la pantalla se convierte en un formulario para averiguar quién tiene
// cuenta en el club, y eso sirve para:
//
//   - saber si una familia concreta está inscripta,
//   - confirmar un dato personal de alguien,
//   - generar un envío de correo a una dirección ajena usando al club de
//     remitente.
//
// Con una respuesta fija no hay nada que averiguar: siempre dice lo mismo,
// tarde lo que tarde.
//
// NO se exporta ninguna función para consultar si un email existe. Hizo falta
// para diagnosticar y terminó acá, que es el peor lugar: un route file es un
// archivo público y convertirlo en un forms para averiguar cuentas del club es
// exactamente el agujero que este endpoint evita.

const MENSAJE =
  'Si ese email tiene una cuenta en el club, te mandamos un link para cambiar la clave. Revisá la carpeta de correo no deseado.';

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    const base = getBaseUrl(request);

    // Dos límites y para dos cosas distintas.
    //
    // Por IP: evita que alguien pruebe cien direcciones desde una conexión.
    // Por email: evita que, desde cien conexiones, le hagan pedidos a una
    // dirección sola y le llenen la bandeja.
    if (!rateLimit(`recuperar-ip:${ip}`, 5, 3_600_000)) {
      return NextResponse.json(
        { error: 'Pediste demasiadas recuperaciones desde esta conexión. Probá en un rato.' },
        { status: 429 }
      );
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data as any;

    const emailParseado = z
      .string()
      .trim()
      .email('Ese email no parece válido')
      .safeParse(body?.email);

    if (!emailParseado.success) {
      // El error de formato SÍ se devuelve. No revela nada: nadie usa un email
      // mal escrito para averiguar si esa cuenta existe.
      return NextResponse.json({ error: firstError(emailParseado.error) }, { status: 400 });
    }

    const email = emailSchema.parse(emailParseado.data).toLowerCase();

    if (!rateLimit(`recuperar-email:${email}`, 3, 3_600_000)) {
      // Misma respuesta que el éxito. Si acá se dijera "demasiados intentos
      // para ese correo", se confirmaría que la cuenta existe.
      return NextResponse.json({ ok: true, mensaje: MENSAJE });
    }

    const r = await solicitarRecuperacion({ email, baseUrl: base, ip });

    // El motivo real va al log del servidor, nunca a la respuesta.
    if (r.motivoEnvio) {
      console.log(`[recuperacion] ${email} -> ${r.motivoEnvio}`);
    }

    return NextResponse.json({
      ok: true,
      mensaje: MENSAJE,
      // Solo cuando el envío no pudo salir, para que en desarrollo no quede
      // nadie trabado sin salida. Con Resend configurado no aparece nunca.
      devLink: r.devToken ? `${base}/recuperar/${r.devToken}` : undefined,
    });
  } catch (err: any) {
    console.error('Pedido de recuperación:', err);
    // Tampoco acá se distingue: un error de servidor no tiene por qué
    // confirmar que la casilla existe.
    return NextResponse.json({ ok: true, mensaje: MENSAJE });
  }
}