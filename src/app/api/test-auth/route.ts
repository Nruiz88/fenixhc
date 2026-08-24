import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    // Test 1: env vars
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key || !serviceKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Missing env vars',
        hasUrl: !!url,
        hasKey: !!key,
        hasServiceKey: !!serviceKey,
      });
    }

    // Test 2: admin client
    const admin = createAdminClient();
    const { data, error } = await admin.from('perfiles').select('id, correo, rol').limit(3);

    if (error) {
      return NextResponse.json({ status: 'error', message: error.message });
    }

    // Test 3: auth
    const { data: authData, error: authError } = await admin.auth.signInWithPassword({
      email: 'admin@club.com',
      password: 'admin123',
    });

    return NextResponse.json({
      status: 'ok',
      envVars: { hasUrl: true, hasKey: true, hasServiceKey: true },
      profiles: data?.length || 0,
      authWorks: !authError,
      authError: authError?.message || null,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', message: err.message });
  }
}
