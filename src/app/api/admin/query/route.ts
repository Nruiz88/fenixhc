import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/supabase/auth';
import { executeQuery } from '@/lib/queryBuilder';
import { TABLES_BY_ROLE, ALLOWED_OPERATIONS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['admin']);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { table, operation = 'select', filters, data, columns, limit, order, single } = body;

    if (!table || !TABLES_BY_ROLE.admin.includes(table)) {
      return NextResponse.json({ error: 'Tabla no válida' }, { status: 400 });
    }

    if (!ALLOWED_OPERATIONS.includes(operation)) {
      return NextResponse.json({ error: 'Operación no válida' }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key no configurada' }, { status: 500 });
    }

    const supabase = createAdminClient();
    const result = await executeQuery(supabase, operation, {
      table, columns, filters, data, limit, order, single,
    });

    return NextResponse.json(operation === 'delete' ? { ok: true } : { data: result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
