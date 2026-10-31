import { NextRequest, NextResponse } from 'next/server';
import { leerConfigMercadoPago } from '@/lib/pagos-config';
import { procesarPagoMercadoPago } from '@/lib/pagos-db';
import { firmaWebhookValida, obtenerPago } from '@/lib/mercadopago';
import { clientIp, rateLimit } from '@/lib/rateLimit';

// Webhook de MercadoPago.
//
// Reglas de la casa:
//
// 1. El POST es SOLO una señal. La verdad se consulta a la API de MercadoPago
//    con nuestro Access Token. Un atacante puede mandar un POST diciendo que
//    el pago 123 se aprobó; no puede hacer que la API de MercadoPago lo diga.
//
// 2. Si hay secreto configurado, se valida la firma HMAC ANTES de consultar
//    nada. Sin secreto, la consulta del pago sigue siendo la que autentica.
//
// 3. Se responde 200 cuando la notificación ya no necesita reintentos (aunque
//    no haya nada que hacer). Se responde 5xx solo ante una falla transitoria
//    nuestra o de MercadoPago, para que la notificación se reintente.
//
// 4. El procesamiento es idempotente. MercadoPago puede reenviar el mismo
//    webhook varias veces y las cuotas no se pagan dos veces.

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Error interno';
}

export async function POST(request: NextRequest) {
  try {
    // Un webhook público que consulta la API de MercadoPago es una puerta
    // para hacer que el servidor gaste consultas con ids inventados. El
    // límite es alto a propósito: MercadoPago puede reintentar en ráfaga y
    // un club mueve pocos pagos por minuto.
    if (!rateLimit(`mp-webhook:${clientIp(request)}`, 240, 60_000)) {
      return NextResponse.json({ error: 'Demasiadas notificaciones' }, { status: 429 });
    }

    const url = request.nextUrl;
    const search = url.searchParams;

    let body: Record<string, unknown> = {};
    try {
      const leido = await request.json();
      if (leido && typeof leido === 'object') body = leido as Record<string, unknown>;
    } catch {
      // Las notificaciones viejas (IPN) pueden venir sin body JSON.
      body = {};
    }

    const dataBody =
      body.data && typeof body.data === 'object'
        ? (body.data as Record<string, unknown>)
        : undefined;

    const tipoCrudo = search.get('type') ?? search.get('topic') ?? body.type ?? body.topic ?? '';
    const tipo = typeof tipoCrudo === 'string' ? tipoCrudo : '';
    const dataIdQuery = search.get('data.id') ?? search.get('id');
    const dataIdCrudo = dataIdQuery ?? dataBody?.id ?? body.id;
    const dataId = dataIdCrudo == null ? '' : String(dataIdCrudo);

    // `merchant_order` no paga cuotas: el pago llega por su propio topic. Se
    // confirma la recepción para que MercadoPago no lo reintente.
    if (tipo && tipo !== 'payment') {
      return NextResponse.json({ ok: true, ignorado: tipo });
    }

    if (!dataId) {
      return NextResponse.json({ error: 'Notificación sin pago' }, { status: 400 });
    }

    const config = await leerConfigMercadoPago();
    if (!config.accessToken) {
      // No es un error del que MercadoPago se pueda recuperar cambiando algo;
      // cuando el admin cargue las credenciales, los reintentos van a andar.
      return NextResponse.json(
        { error: 'MercadoPago no está configurado' },
        { status: 503 }
      );
    }

    if (
      config.webhookSecret &&
      !firmaWebhookValida({
        xSignature: request.headers.get('x-signature'),
        xRequestId: request.headers.get('x-request-id'),
        // Para la firma se usa el `data.id` del query, que es el que firma
        // MercadoPago. El body queda solo como fallback de compatibilidad.
        dataId: dataIdQuery ?? String(dataId),
        secret: config.webhookSecret,
      })
    ) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }

    let pago;
    try {
      pago = await obtenerPago(config.accessToken, String(dataId));
    } catch (err) {
      const status = (err as { status?: number } | null)?.status;
      if (status === 404) {
        // Pago de otra aplicación de la misma cuenta o id inexistente.
        return NextResponse.json({ ok: true, ignorado: 'pago_no_encontrado' });
      }
      console.error('Webhook MercadoPago: no se pudo consultar el pago', err);
      return NextResponse.json({ error: 'No se pudo consultar el pago' }, { status: 502 });
    }

    const resultado = await procesarPagoMercadoPago(pago);

    return NextResponse.json({
      ok: true,
      ignorado: resultado.ignorado,
      estado: resultado.estado,
    });
  } catch (err) {
    console.error('Webhook MercadoPago:', err, mensajeError(err));
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
