import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// Marca notificaciones como leídas para el usuario autenticado.
//
// Se usa INSERT ... ON DUPLICATE KEY en lugar del insert genérico de
// /api/user/query porque `notificaciones_usuarios` tiene UNIQUE
// (notificacion_id, usuario_id): volver a marcar la misma notificación no
// debe fallar ni duplicar la fila.
//
//   POST { ids: string[] }  -> marca esa lista como leídas
//   POST {}                 -> marca TODAS las visibles como leídas
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids)
      ? body.ids.filter((i: unknown): i is string => typeof i === 'string')
      : [];

    // Solo se pueden marcar notificaciones dirigidas a este rol: sin este
    // filtro un usuario podría "leer" avisos de otro grupo y contabilizarlos.
    const visibles = await query<{ id: string }>(
      `SELECT id FROM notificaciones
       WHERE destinatario_rol = 'todos' OR destinatario_rol = ?`,
      [user.rol]
    );
    const permitidas = new Set(visibles.map((r) => r.id));

    const objetivos = (ids.length > 0 ? ids : [...permitidas]).filter((id) => permitidas.has(id));
    if (objetivos.length === 0) {
      return NextResponse.json({ data: { marked: 0 } });
    }

    // Los placeholders se generan desde ids ya validados contra la lista
    // permitted; los valores se bindean aparte, nunca se interpolan.
    const rows = objetivos.map(() => '(UUID(), ?, ?, 1)').join(', ');
    const params = objetivos.flatMap((id) => [id, user.id]);

    await execute(
      `INSERT INTO notificaciones_usuarios (id, notificacion_id, usuario_id, leida)
       VALUES ${rows}
       ON DUPLICATE KEY UPDATE leida = 1`,
      params
    );

    return NextResponse.json({ data: { marked: objetivos.length } });
  } catch (err: any) {
    console.error('Mark read error:', err);
    return NextResponse.json({ error: err.message || 'Error al marcar como leída' }, { status: 500 });
  }
}
