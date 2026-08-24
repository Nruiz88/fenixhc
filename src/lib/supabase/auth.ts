import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getAuthenticatedUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) return null;

  return {
    id: user.id,
    email: user.email,
    role: user.user_metadata?.rol,
    metadata: user.user_metadata,
  };
}

export async function requireAuth(allowedRoles?: string[]) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { error: 'No autenticado', status: 401 as const };
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return { error: 'Sin permisos', status: 403 as const };
  }

  return { user };
}
