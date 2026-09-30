import { NextRequest, NextResponse } from 'next/server';
import { requireModulo } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { z } from 'zod';
import {
  leerConfigCuotasSegura, guardarMontoBase, guardarVencimientos,
  borrarVencimientos, idsVencimientosActuales,
} from '@/lib/cuotas-db';
import { calcularRecargo, type Vencimiento } from '@/lib/cuotas';

// Configuración de cuotas: monto base y tramos de recargo.
//
// Requiere el módulo `configuracion` (admin y presidente). No es un dato de
// sólo lectura que pueda ver la directiva en general: el precio y los
// porcentajes con los que se cobra son de la administración del club, y un
// tesorero que puede moverlos no podría justificarse por qué cobró lo que
// cobró.

const VencimientoSchema = z.object({
  id: z.string().max(36).optional(),
  dia: z.number().int().min(1).max(31),
  porcentaje: z.number().min(0).max(100),
  etiqueta: z.string().max(100).nullish(),
  activo: z.boolean(),
  orden: z.number().int().optional(),
});

const BodySchema = z.object({
  montoBase: z.number().min(0).max(99_999_999).optional(),
  vencimientos: z.array(VencimientoSchema).max(10).optional(),
});

/**
 * El permiso sale del módulo `configuracion`, que por ahora tienen `admin` y
 * `presidente`. No se agrega un chequeo de rol aparte: duplicaría la lista de
 * permitidos en un segundo lugar, y es exactamente la forma de que ambos se
 * desincronicen sin que nada avise.
 */
async function autorizado() {
  return requireModulo('configuracion');
}

export async function GET() {
  try {
    const auth = await autorizado();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = await leerConfigCuotasSegura();

    // Ejemplo de simulación: qué pasaría con una cuota emitida hoy. Permite
    // ver el efecto de los porcentajes sin tener que emitir una cuota real.
    const hoy = new Date();
    const ejemplo = calcularRecargo(
      config.montoBase,
      hoy.getMonth() + 1,
      hoy.getFullYear(),
      config.vencimientos,
      hoy
    );

    return NextResponse.json({ data: { ...config, ejemplo } });
  } catch (err: any) {
    console.error('Config cuotas GET:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await autorizado();
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

    const { montoBase, vencimientos } = parsed.data;
    if (montoBase === undefined && vencimientos === undefined) {
      return NextResponse.json({ error: 'No enviaste ningún valor para cambiar' }, { status: 400 });
    }

    if (montoBase !== undefined) {
      await guardarMontoBase(montoBase);
    }

    if (vencimientos !== undefined) {
      // Los días tienen que ser distintos: con dos hitos el mismo día el
      // cálculo toma el último y el otro queda muerto, pero el usuario ve
      // dos filas y cree que los dos aplican.
      const dias = vencimientos.map((v) => v.dia);
      if (new Set(dias).size !== dias.length) {
        return NextResponse.json(
          { error: 'No puede haber dos vencimientos el mismo día' },
          { status: 400 }
        );
      }

      const ordenados = vencimientos
        .map((v, i) => ({ ...v, orden: i + 1 }) as Vencimiento)
        .sort((a, b) => a.dia - b.dia);

      // Primero se guarda lo que viene, después se borra lo que quedó fuera.
      // Al revés, un fallo al borrar dejaría hitos duplicados.
      const idsGuardados = await guardarVencimientos(ordenados);
      await borrarVencimientos((await idsVencimientosActuales()).filter((id) => !idsGuardados.includes(id)));
    }

    return NextResponse.json({ data: await leerConfigCuotasSegura() });
  } catch (err: any) {
    console.error('Config cuotas PUT:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
