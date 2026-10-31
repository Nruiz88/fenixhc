import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { rateLimit } from '@/lib/rateLimit';
import { leerConfigMercadoPago } from '@/lib/pagos-config';
import { leerConfigCuotasSegura } from '@/lib/cuotas-db';
import { calcularRecargo } from '@/lib/cuotas';
import {
  crearPagoPendiente,
  guardarPreferencia,
  marcarErrorDeCobro,
  type CuotaEnPago,
} from '@/lib/pagos-db';
import { crearPreferencia, origenPublico, puntoDeInicio } from '@/lib/mercadopago';
import { mesNombre } from '@/lib/format';

// Inicia un cobro online de una o varias cuotas.
//
// El importe SIEMPRE se calcula en el servidor con la configuración vigente.
// El cliente manda qué cuotas quiere pagar, nunca cuánto. Si mandara el
// importe, cualquiera podría pagar $1 y que la cuota quede saldada.

const BodySchema = z.object({
  cuotaIds: z.array(z.string().min(1).max(36)).min(1).max(20),
});

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Error interno';
}

interface FilaCuota {
  id: string;
  familia_id: string;
  monto: number | string;
  mes: number | string;
  anio: number | string;
  estado: string;
  comprobante_url: string | null;
  vencimiento_override: string | null;
  padre_perfil_id: string;
  hijo_nombre: string | null;
  hijo_apellido: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    // Un botón apretado muchas veces no debe crear veinte preferencias.
    if (!rateLimit(`mp-preferencia:${user.id}`, 10, 10 * 60_000)) {
      return NextResponse.json(
        { error: 'Hiciste demasiados intentos de pago. Esperá unos minutos y volvé a probar.' },
        { status: 429 }
      );
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const parsed = BodySchema.safeParse(leido.data);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Elegí al menos una cuota para pagar' }, { status: 400 });
    }

    const ids = [...new Set(parsed.data.cuotaIds)];

    const config = await leerConfigMercadoPago();
    if (!config.habilitado || !config.accessToken) {
      return NextResponse.json(
        {
          error:
            'El pago online no está disponible en este momento. Podés subir el comprobante de una transferencia o coordinar con tesorería.',
          codigo: 'pago_online_no_disponible',
        },
        { status: 409 }
      );
    }

    const origen = origenPublico(request);
    if (!origen) {
      return NextResponse.json(
        { error: 'Falta configurar APP_URL para iniciar el pago online.' },
        { status: 500 }
      );
    }

    // La familia solo puede pagar cuotas de sus propios hijos. La condición
    // va en el SQL: si se filtrara en JS después, una cuota ajena ya habría
    // salido de la base.
    const marcadores = ids.map(() => '?').join(',');
    const filas = await query<FilaCuota>(
      `SELECT c.id, c.familia_id, c.monto, c.mes, c.anio, c.estado,
              c.comprobante_url, c.vencimiento_override,
              f.padre_perfil_id,
              dp.nombre AS hijo_nombre, dp.apellido AS hijo_apellido
         FROM cuotas c
         INNER JOIN familias f ON f.id = c.familia_id
         LEFT JOIN perfiles dp ON dp.id = f.deportista_perfil_id
        WHERE c.id IN (${marcadores}) AND f.padre_perfil_id = ?`,
      [...ids, user.id]
    );

    if (filas.length !== ids.length) {
      return NextResponse.json(
        { error: 'Alguna de las cuotas no existe o no pertenece a tu familia.' },
        { status: 404 }
      );
    }

    const conComprobante = filas.find((f) => f.comprobante_url);
    if (conComprobante) {
      return NextResponse.json(
        {
          error:
            'Una de las cuotas tiene un comprobante de transferencia en revisión. Esperá la aprobación de tesorería antes de pagar online.',
          codigo: 'comprobante_en_revision',
        },
        { status: 409 }
      );
    }

    const noPendiente = filas.find((f) => f.estado !== 'pendiente');
    if (noPendiente) {
      return NextResponse.json(
        { error: 'Una de las cuotas ya está paga o no admite un cobro online.' },
        { status: 409 }
      );
    }

    const configCuotas = await leerConfigCuotasSegura();
    const ordenadas = ids
      .map((id) => filas.find((f) => f.id === id)!)
      .sort((a, b) => Number(a.anio) - Number(b.anio) || Number(a.mes) - Number(b.mes));

    const cuotas: CuotaEnPago[] = ordenadas.map((c) => {
      const r = calcularRecargo(
        Number(c.monto),
        Number(c.mes),
        Number(c.anio),
        configCuotas.vencimientos,
        new Date(),
        c.vencimiento_override
      );
      return {
        id: c.id,
        familia_id: c.familia_id,
        monto_base: r.montoBase,
        recargo: r.recargo,
        total: r.total,
        mes: Number(c.mes),
        anio: Number(c.anio),
      };
    });

    if (cuotas.some((c) => c.total <= 0)) {
      return NextResponse.json(
        { error: 'El importe de la cuota no es válido. Contactá a tesorería.' },
        { status: 409 }
      );
    }

    const pagoId = await crearPagoPendiente({ usuarioId: user.id, cuotas });

    const items = ordenadas.map((c, i) => ({
      id: c.id,
      title: `Cuota ${mesNombre(c.mes)} ${c.anio} - Fenix Roller Hockey`,
      description: c.hijo_nombre
        ? `${c.hijo_nombre} ${c.hijo_apellido ?? ''}`.trim()
        : `Cuota de ${mesNombre(c.mes)} ${c.anio}`,
      quantity: 1,
      unit_price: cuotas[i].total,
      currency_id: 'ARS',
    }));

    const base = origen.replace(/\/+$/, '');
    // Sin query propia: MercadoPago agrega `payment_id`, `status` y
    // `external_reference` al volver. Agregar un `?pago=` nuestro obligaría a
    // que MercadoPago use `&` para el resto; cuanto menos se dependa de eso,
    // mejor.
    const vuelta = `${base}/socio-benefactor/pagos/mercadopago`;

    try {
      const preferencia = await crearPreferencia(config.accessToken, {
        items,
        payer: {
          name: user.nombre || 'Socio',
          surname: user.apellido || 'Fenix',
          email: user.email,
        },
        external_reference: pagoId,
        notification_url: `${base}/api/pagos/mercadopago/webhook`,
        back_urls: {
          success: vuelta,
          failure: `${vuelta}?resultado=fallo`,
          pending: `${vuelta}?resultado=pendiente`,
        },
        // `auto_return` exige back_urls.success en https. En desarrollo con
        // APP_URL http, MercadoPago rechaza la preferencia entera si se manda.
        auto_return: base.startsWith('https://') ? 'approved' : undefined,
        statement_descriptor: 'FENIX HOCKEY',
        metadata: {
          pago_id: pagoId,
          usuario_id: user.id,
        },
      });

      const initPoint = puntoDeInicio(preferencia, config.accessToken);
      await guardarPreferencia(pagoId, String(preferencia.id), initPoint);

      return NextResponse.json({
        data: {
          pagoId,
          initPoint,
          total: cuotas.reduce((s, c) => s + c.total, 0),
        },
      });
    } catch (err) {
      console.error('No se pudo crear la preferencia de MercadoPago:', err);
      await marcarErrorDeCobro(pagoId, mensajeError(err));
      return NextResponse.json(
        {
          error:
            'No pudimos iniciar el pago online. Revisá la configuración de MercadoPago o intentá más tarde.',
        },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error('MercadoPago preferencia:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}
