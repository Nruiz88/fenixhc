import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { requireModulo } from '@/lib/auth';
import { transaccion } from '@/lib/db';
import { rolesDeUsuario } from '@/lib/roles';
import { aplicarBeca } from '@/lib/cuotas';

// Asignación de becas a jugadores.
//
// La beca es del jugador y no del socio: un padre puede tener dos hijos y solo
// uno estar becado. El descuento se aplica sobre el precio de lista de la cuota
// y, además, apaga el recargo.
//
// Al cambiarla se recalculan SOLO las cuotas pendientes. Las pagadas son
// historia: si la beca cambió después, el recibo y la caja ya reflejan lo que
// realmente entró. Una cuota que queda en $0 por una beca del 100% se marca
// pagada, para que no quede como deuda eterna.

const BodySchema = z.object({
  perfil_id: z.string().min(1).max(36),
  porcentaje: z.union([
    z.literal(0),
    z.literal(25),
    z.literal(50),
    z.literal(100),
  ]),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModulo('socios');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Los vocales pueden ver la sección, pero no mover dinero. La beca cambia
    // el importe de las cuotas, así que la escriben los cargos que manejan
    // socios y tesorería.
    const roles = rolesDeUsuario(auth.user);
    const puedeEditar = roles.some((r) =>
      ['admin', 'presidente', 'secretario', 'tesorero'].includes(r)
    );
    if (!puedeEditar) {
      return NextResponse.json(
        { error: 'Tu cargo no puede asignar becas.' },
        { status: 403 }
      );
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const parsed = BodySchema.safeParse(leido.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'El porcentaje tiene que ser 0, 25, 50 o 100.' },
        { status: 400 }
      );
    }

    const { perfil_id: perfilId, porcentaje } = parsed.data;

    const resultado = await transaccion(async (conn) => {
      const [jugador] = (await conn.execute(
        'SELECT perfil_id FROM deportistas WHERE perfil_id = ? LIMIT 1',
        [perfilId]
      )) as [Array<{ perfil_id: string }>, unknown];

      if (jugador.length === 0) {
        throw new Error('No encontramos ese jugador');
      }

      await conn.execute(
        'UPDATE deportistas SET beca_porcentaje = ? WHERE perfil_id = ?',
        [porcentaje, perfilId]
      );

      const [familias] = (await conn.execute(
        'SELECT id FROM familias WHERE deportista_perfil_id = ?',
        [perfilId]
      )) as [Array<{ id: string }>, unknown];

      if (familias.length === 0) {
        return { cuotasActualizadas: 0, cuotasPagadas: 0 };
      }

      const ids = familias.map((f) => f.id);
      const marcadores = ids.map(() => '?').join(',');

      // FOR UPDATE: si la tesorería está aprobando una cuota en este momento,
      // se espera a que termine. Si no, el recálculo podría pisar un pago que
      // acaba de entrar o cobrar de más una cuota ya saldada.
      const [pendientes] = (await conn.execute(
        `SELECT id, COALESCE(monto_lista, monto) AS monto_lista
           FROM cuotas
          WHERE familia_id IN (${marcadores}) AND estado = 'pendiente'
          FOR UPDATE`,
        ids
      )) as [Array<{ id: string; monto_lista: string | number }>, unknown];

      let cuotasActualizadas = 0;
      let cuotasPagadas = 0;

      for (const cuota of pendientes) {
        const lista = Number(cuota.monto_lista) || 0;
        const { monto } = aplicarBeca(lista, porcentaje);

        if (monto <= 0) {
          // Beca del 100%: la cuota queda saldada, no pendiente en $0.
          await conn.execute(
            `UPDATE cuotas
                SET monto_lista = ?, monto = 0, beca_porcentaje = ?,
                    estado = 'pagada', monto_pagado = 0, fecha_pago = NOW()
              WHERE id = ?`,
            [lista, porcentaje, cuota.id]
          );
          cuotasPagadas++;
          continue;
        }

        await conn.execute(
          `UPDATE cuotas
              SET monto_lista = ?, monto = ?, beca_porcentaje = ?
            WHERE id = ?`,
          [lista, monto, porcentaje, cuota.id]
        );
        cuotasActualizadas++;
      }

      return { cuotasActualizadas, cuotasPagadas };
    });

    return NextResponse.json({
      success: true,
      ...resultado,
      porcentaje,
    });
  } catch (err) {
    console.error('Asignar beca:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'No se pudo asignar la beca' },
      { status: 400 }
    );
  }
}
