import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { leerConfigMercadoPago } from '@/lib/pagos-config';
import {
  buscarPagoPorExternalReference,
  procesarPagoMercadoPago,
} from '@/lib/pagos-db';
import { obtenerPago } from '@/lib/mercadopago';

// Confirmación al volver del checkout.
//
// No se confía en el `status` que MercadoPago agrega a la URL de vuelta:
// cualquiera puede escribir `status=approved` a mano. Se consulta el pago
// real a la API con nuestro Access Token. Es la misma operación que hace el
// webhook, así que funciona aunque la notificación tarde o no llegue.

const BodySchema = z.object({
  paymentId: z.string().min(1).max(100),
});

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Error interno';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    if (!rateLimit(`mp-confirmar:${user.id}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Demasiados intentos. Esperá un momento.' }, { status: 429 });
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const parsed = BodySchema.safeParse(leido.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Falta el identificador del pago' }, { status: 400 });
    }

    const config = await leerConfigMercadoPago();
    if (!config.accessToken) {
      return NextResponse.json(
        { error: 'El pago online no está configurado.' },
        { status: 503 }
      );
    }

    let pago;
    try {
      pago = await obtenerPago(config.accessToken, parsed.data.paymentId);
    } catch (err) {
      console.error('No se pudo consultar el pago de MercadoPago:', err);
      const status = (err as { status?: number } | null)?.status;
      if (status === 404) {
        return NextResponse.json(
          { error: 'No encontramos ese pago en MercadoPago.' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'No pudimos consultar el pago. Si el dinero salió de tu cuenta, escribinos y lo revisamos.' },
        { status: 502 }
      );
    }

    const referencia = pago.external_reference;
    if (!referencia) {
      return NextResponse.json({ error: 'El pago no está asociado a una cuota.' }, { status: 404 });
    }

    const local = await buscarPagoPorExternalReference(referencia);
    if (!local || local.usuario_id !== user.id) {
      return NextResponse.json({ error: 'El pago no pertenece a tu cuenta.' }, { status: 403 });
    }

    const resultado = await procesarPagoMercadoPago(pago);

    return NextResponse.json({
      data: {
        pagoId: local.id,
        estado: resultado.estado,
        mensaje: resultado.mensaje,
        cuotas: resultado.cuotas,
        ignorado: resultado.ignorado,
      },
    });
  } catch (err) {
    console.error('MercadoPago confirmar:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}
