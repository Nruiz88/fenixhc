import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  let perfil = null;
  let perfilError = null;
  let count = null;
  
  if (user) {
    const result = await supabase
      .from('perfiles')
      .select('nombre, apellido, rol')
      .eq('id', user.id)
      .single();
    perfil = result.data;
    perfilError = result.error;

    const countResult = await supabase
      .from('perfiles')
      .select('id', { count: 'exact', head: true });
    count = countResult.count;
  }

  return NextResponse.json({
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
    userMetadata: user?.user_metadata,
    perfil,
    perfilError: perfilError ? { message: perfilError.message, code: perfilError.code } : null,
    count,
  });
}
