import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { requireAuth } from '@/lib/auth';
import {
  guardarConfigMercadoPago,
  leerConfigMercadoPago,
  type ConfigMercadoPago,
} from '@/lib/pagos-config';
import { listarPagosMercadoPago } from '@/lib/pagos-db';
import { consultarCuenta, urlWebhook } from '@/lib/mercadopago';

// Credenciales de MercadoPago.
//
// SOLO EL ROL `admin` puede leerlas o cambiarlas. No alcanza con el módulo
// `configuracion` (que también tiene el presidente): estas credenciales
// permiten cobrar en nombre del club y ver todos sus movimientos en la
// cuenta de MercadoPago. Es una capacidad más sensible que editar el precio
// de la cuota.

const BodySchema = z.object({
  habilitado: z.boolean().optional(),
  accessToken: z.string().max(500).nullable().optional(),
  publicKey: z.string().max(500).nullable().optional(),
  webhookSecret: z.string().max(500).nullable().optional(),
});

async function soloAdmin() {
  return requireAuth(['admin']);
}

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Error interno';
}

/**
 * Entorno real de la credencial.
 *
 * No se usa el prefijo: MercadoPago entrega `APP_USR-` tanto a cuentas reales
 * como a cuentas de prueba de Checkout Pro. Se consulta `/users/me` y se mira
 * el tag `test_user`. Si la consulta falla, cae al prefijo como aproximación
 * para no romper la pantalla de configuración.
 */
async function entornoDe(config: ConfigMercadoPago): Promise<'test' | 'produccion' | null> {
  if (!config.accessToken) return null;
  try {
    const cuenta = await consultarCuenta(config.accessToken);
    return cuenta.esPrueba ? 'test' : 'produccion';
  } catch (err) {
    console.warn('No se pudo consultar la cuenta de MercadoPago:', err);
    return config.accessToken.toUpperCase().startsWith('TEST-') ? 'test' : 'produccion';
  }
}

function versionPublica(
  config: ConfigMercadoPago,
  request: NextRequest,
  entorno: 'test' | 'produccion' | null
) {
  return {
    habilitado: config.habilitado,
    accessTokenCargado: config.accessToken.length > 0,
    // El token completo nunca vuelve al navegador. Los últimos cuatro
    // caracteres alcanzan para distinguir una credencial de otra.
    accessTokenFinal: config.accessToken ? config.accessToken.slice(-4) : null,
    publicKey: config.publicKey,
    webhookSecretCargado: config.webhookSecret.length > 0,
    webhookUrl: urlWebhook(request),
    entorno,
    errorCredenciales: config.errorCredenciales,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await soloAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = await leerConfigMercadoPago();
    const [entorno, pagos] = await Promise.all([
      entornoDe(config),
      listarPagosMercadoPago(20),
    ]);

    return NextResponse.json({
      data: { ...versionPublica(config, request, entorno), pagos },
    });
  } catch (err) {
    console.error('MercadoPago config GET:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await soloAdmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const parsed = BodySchema.safeParse(leido.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' },
        { status: 400 }
      );
    }

    const datos = parsed.data;
    if (Object.values(datos).every((v) => v === undefined)) {
      return NextResponse.json({ error: 'No enviaste ningún valor para cambiar' }, { status: 400 });
    }

    // Se valida sobre el estado PROYECTADO antes de escribir. Si se guardara
    // primero y se rechazara después, la base quedaría con el cobro
    // "habilitado" sin token y el panel mostraría un estado que no es el que
    // la persona creyó guardar.
    const actual = await leerConfigMercadoPago();
    const habilitadoProyectado = datos.habilitado ?? actual.habilitado;
    const tokenProyectado =
      datos.accessToken !== undefined
        ? (datos.accessToken ?? '').trim()
        : actual.accessToken;

    if (habilitadoProyectado && !tokenProyectado) {
      return NextResponse.json(
        {
          error:
            'Para habilitar los cobros online primero cargá el Access Token de MercadoPago.',
        },
        { status: 400 }
      );
    }

    await guardarConfigMercadoPago(datos);
    const config = await leerConfigMercadoPago();
    const [entorno, pagos] = await Promise.all([
      entornoDe(config),
      listarPagosMercadoPago(20),
    ]);

    return NextResponse.json({
      data: { ...versionPublica(config, request, entorno), pagos },
    });
  } catch (err) {
    console.error('MercadoPago config PUT:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}
