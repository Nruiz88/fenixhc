import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_TABLES = [
  'perfiles', 'deportistas', 'familias', 'cuotas', 'finanzas',
  'notificaciones', 'notificaciones_usuarios', 'mensajes_chat',
  'fotos_galeria', 'canchas', 'reservas', 'push_subscriptions', 'contacto_publico',
  'partidos', 'comunicados', 'horarios_entrenamiento', 'sponsors',
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, operation = 'select', filters, data, columns, limit, order, single } = body;

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return NextResponse.json({ error: 'Invalid table' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
    }

    const supabase = createAdminClient();

    if (operation === 'select') {
      let query: any = supabase.from(table).select(columns || '*');
      if (filters) {
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
      }
      if (order) query = query.order(order.column, { ascending: order.ascending ?? false });
      if (limit) query = query.limit(limit);
      if (single) query = query.single();
      const { data: result, error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data: result });
    }

    if (operation === 'insert') {
      const { data: result, error } = await supabase.from(table).insert(data).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data: result });
    }

    if (operation === 'upsert') {
      const { data: result, error } = await supabase.from(table).upsert(data).select();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data: result });
    }

    if (operation === 'update') {
      let query: any = supabase.from(table).update(data);
      if (filters) {
        for (const [key, value] of Object.entries(filters) as [string, any][]) {
          if (value && typeof value === 'object' && 'op' in value) {
            if (value.op === 'eq') query = query.eq(key, value.val);
          } else {
            query = query.eq(key, value);
          }
        }
      }
      const { data: result, error } = await query.select();
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ data: result });
    }

    if (operation === 'delete') {
      let query: any = supabase.from(table).delete();
      if (filters) {
        for (const [key, value] of Object.entries(filters) as [string, any][]) {
          if (value && typeof value === 'object' && 'op' in value) {
            if (value.op === 'eq') query = query.eq(key, value.val);
          } else {
            query = query.eq(key, value);
          }
        }
      }
      const { error } = await query;
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
