import { createClient } from '@/lib/supabase/server';

export default async function DebugPage() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  let perfil = null;
  let perfilError = null;
  if (user) {
    const result = await supabase
      .from('perfiles')
      .select('nombre, apellido, rol')
      .eq('id', user.id)
      .single();
    perfil = result.data;
    perfilError = result.error;
  }

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Debug Auth</h1>
      <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
        {JSON.stringify({
          hasUser: !!user,
          userId: user?.id,
          userEmail: user?.email,
          userMetadata: user?.user_metadata,
          perfil,
          perfilError: perfilError?.message,
          userError: userError?.message,
        }, null, 2)}
      </pre>
    </div>
  );
}
