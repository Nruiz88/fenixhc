import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executeQuery } from '@/lib/queryBuilder';
import { TABLES_BY_ROLE } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { table, operation = 'select', filters = {}, data, columns, limit, order, single } = body;

    if (!table) {
      return NextResponse.json({ error: 'Tabla requerida' }, { status: 400 });
    }

    // Get user role
    const admin = createAdminClient();
    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', user.id).single();
    const rol = perfil?.rol;

    // Check table access
    const allowedTables = TABLES_BY_ROLE[rol as keyof typeof TABLES_BY_ROLE] || [];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ error: 'Sin acceso a esta tabla' }, { status: 403 });
    }

    // Inject role-based filters (RLS equivalent)
    if (rol === 'padre') {
      if (table === 'familias') filters.padre_perfil_id = user.id;
      if (table === 'cuotas') {
        const { data: fams } = await admin.from('familias').select('id').eq('padre_perfil_id', user.id);
        const famIds = (fams || []).map((f: any) => f.id);
        if (famIds.length > 0) {
          filters.familia_id = { op: 'in', val: famIds };
        } else {
          return NextResponse.json({ data: [] });
        }
      }
      if (table === 'reservas') filters.usuario_id = user.id;
      if (table === 'perfiles') filters.id = user.id;
    } else if (rol === 'deportista') {
      if (table === 'reservas') filters.usuario_id = user.id;
      if (table === 'perfiles') filters.id = user.id;
      if (table === 'notificaciones_usuarios') filters.usuario_id = user.id;
    }

    const result = await executeQuery(admin, operation, {
      table, columns, filters, data, limit, order, single,
    });

    return NextResponse.json(operation === 'delete' ? { ok: true } : { data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
