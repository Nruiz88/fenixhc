import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_TABLES = [
  'perfiles', 'deportistas', 'familias', 'cuotas', 'notificaciones',
  'notificaciones_usuarios', 'mensajes_chat', 'fotos_galeria',
  'canchas', 'reservas', 'contacto_publico',
];

export async function POST(request: NextRequest) {
  try {
    // 1. Verify user session
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { table, operation = 'select', filters = {}, data, columns, limit, order, single } = body;

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    // 2. Get user role from profile
    const admin = createAdminClient();
    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single();
    const rol = perfil?.rol;

    // 3. Inject user ID into filters (RLS equivalent)
    if (rol === 'padre') {
      // For padre, inject padre_perfil_id filter for familias/cuotas
      if (table === 'familias') filters.padre_perfil_id = user.id;
      if (table === 'cuotas') {
        // Get family IDs for this padre
        const { data: fams } = await admin.from('familias').select('id').eq('padre_perfil_id', user.id);
        const famIds = (fams || []).map((f: any) => f.id);
        if (famIds.length > 0) {
          filters.familia_id = { op: 'in', val: famIds };
        } else {
          return NextResponse.json({ data: [] });
        }
      }
      if (table === 'reservas') filters.usuario_id = user.id;
      if (table === 'perfiles') {
        filters.id = user.id;
      }
    } else if (rol === 'deportista') {
      if (table === 'reservas') filters.usuario_id = user.id;
      if (table === 'perfiles') filters.id = user.id;
      if (table === 'notificaciones_usuarios') filters.usuario_id = user.id;
    }

    // 4. Build and execute query
    let query: any = admin.from(table).select(columns || '*');
    for (const [key, value] of Object.entries(filters) as [string, any][]) {
      if (value && typeof value === 'object' && 'op' in value) {
        switch (value.op) {
          case 'eq': query = query.eq(key, value.val); break;
          case 'neq': query = query.neq(key, value.val); break;
          case 'gt': query = query.gt(key, value.val); break;
          case 'gte': query = query.gte(key, value.val); break;
          case 'lt': query = query.lt(key, value.val); break;
          case 'lte': query = query.lte(key, value.val); break;
          case 'like': query = query.like(key, value.val); break;
          case 'in': query = query.in(key, value.val); break;
        }
      } else {
        query = query.eq(key, value);
      }
    }
    if (order) query = query.order(order.column, { ascending: order.ascending ?? false });
    if (limit) query = query.limit(limit);
    if (single) query = query.single();

    const { data: result, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // 5. Mutations
    if (operation === 'insert') {
      const { data: r, error: e } = await admin.from(table).insert(data).select();
      if (e) return NextResponse.json({ error: e.message }, { status: 400 });
      return NextResponse.json({ data: r });
    }
    if (operation === 'update') {
      let q: any = admin.from(table).update(data);
      for (const [key, value] of Object.entries(filters) as [string, any][]) {
        if (value && typeof value === 'object' && 'op' in value) {
          if (value.op === 'eq') q = q.eq(key, value.val);
        } else {
          q = q.eq(key, value);
        }
      }
      const { data: r, error: e } = await q.select();
      if (e) return NextResponse.json({ error: e.message }, { status: 400 });
      return NextResponse.json({ data: r });
    }

    return NextResponse.json({ data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
