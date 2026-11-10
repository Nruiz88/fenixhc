import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { requireModulo } from '@/lib/auth';
import { query, transaccion, uuid } from '@/lib/db';
import { aplicarBeca } from '@/lib/cuotas';
import { mesNombre } from '@/lib/format';

// Emisión de cuotas pendientes.
//
// Va por un endpoint propio y no por /api/admin/query por dos razones:
//  1. El genérico no distingue el módulo `pagos`; este sí.
//  2. Acá se controla el duplicado familia + mes + año y se puede emitir en
//     lote sin que una familia quede con dos cuotas del mismo período.

const BodySchema = z.object({
  modo: z.enum(['una', 'todas']),
  familiaId: z.string().min(1).max(36).optional(),
  mes: z.number().int().min(1).max(12),
  anio: z.number().int().min(2020).max(2100),
  monto: z.number().positive().max(99_999_999),
});

function mensajeError(err: unknown): string {
  return err instanceof Error ? err.message : 'Error interno';
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModulo('pagos');
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

    const { modo, familiaId, mes, anio } = parsed.data;
    const monto = Math.round(parsed.data.monto * 100) / 100;

    if (modo === 'una' && !familiaId) {
      return NextResponse.json({ error: 'Elegí una familia' }, { status: 400 });
    }

    const familias =
      modo === 'todas'
        ? await query<{ id: string; beca_porcentaje: number }>(
            `SELECT f.id, COALESCE(d.beca_porcentaje, 0) AS beca_porcentaje
               FROM familias f
               LEFT JOIN deportistas d ON d.perfil_id = f.deportista_perfil_id
              ORDER BY f.id`
          )
        : await query<{ id: string; beca_porcentaje: number }>(
            `SELECT f.id, COALESCE(d.beca_porcentaje, 0) AS beca_porcentaje
               FROM familias f
               LEFT JOIN deportistas d ON d.perfil_id = f.deportista_perfil_id
              WHERE f.id = ? LIMIT 1`,
            [familiaId!]
          );

    if (familias.length === 0) {
      return NextResponse.json(
        { error: 'No hay familias vinculadas para emitir cuotas.' },
        { status: 404 }
      );
    }

    // La beca se congela en la cuota. Si mañana cambia, las cuotas ya emitidas
    // conservan el importe con el que nacieron y el recálculo de pendientes es
    // una acción explícita, no un efecto de abrir la pantalla.
    const becaPorFamilia = new Map(
      familias.map((f) => [f.id, Math.min(Math.max(Number(f.beca_porcentaje) || 0, 0), 100)])
    );

    const ids = familias.map((f) => f.id);
    const marcadores = ids.map(() => '?').join(',');
    const existentes = await query<{ familia_id: string }>(
      `SELECT familia_id FROM cuotas
        WHERE mes = ? AND anio = ? AND familia_id IN (${marcadores})`,
      [mes, anio, ...ids]
    );
    const yaEmitidas = new Set(existentes.map((e) => e.familia_id));
    const nuevas = ids.filter((id) => !yaEmitidas.has(id));

    let creadas = 0;
    let becadas = 0;
    if (nuevas.length > 0) {
      const resultado = await transaccion(async (conn) => {
        let cantidad = 0;
        let dadasPorPagadas = 0;

        for (const id of nuevas) {
          const beca = becaPorFamilia.get(id) ?? 0;
          const { monto: montoCuota } = aplicarBeca(monto, beca);
          const sinCargo = montoCuota <= 0;

          const [r] = (await conn.execute(
            `INSERT IGNORE INTO cuotas
               (id, familia_id, tipo_socio, monto, monto_lista, beca_porcentaje,
                mes, anio, estado, monto_pagado, fecha_pago)
             VALUES (?, ?, 'benefactor', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuid(), id, montoCuota, monto, beca, mes, anio,
              sinCargo ? 'pagada' : 'pendiente',
              sinCargo ? 0 : null,
              sinCargo ? new Date() : null,
            ]
          )) as [{ affectedRows: number }, unknown];

          cantidad += r.affectedRows;
          if (r.affectedRows && sinCargo) dadasPorPagadas++;
        }

        return { cantidad, dadasPorPagadas };
      });

      creadas = resultado.cantidad;
      becadas = resultado.dadasPorPagadas;
    }

    return NextResponse.json({
      data: {
        creadas,
        becadas,
        omitidas: ids.length - creadas,
        total: ids.length,
        periodo: `${mesNombre(mes)} ${anio}`,
        monto,
      },
    });
  } catch (err) {
    console.error('Emitir cuota:', err);
    return NextResponse.json({ error: mensajeError(err) }, { status: 500 });
  }
}
