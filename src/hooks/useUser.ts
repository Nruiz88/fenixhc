'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Perfil } from '@/types';

export function useUser() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) { setLoading(false); return; }

    const supabase = createClient(url, key);

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setLoading(false); return; }

        setUserId(session.user.id);

        // Try to get profile, fallback to auth metadata
        try {
          const { data } = await supabase
            .from('perfiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          if (data) {
            setPerfil(data);
          } else {
            // Fallback to auth metadata
            setPerfil({
              id: session.user.id,
              nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0] || '',
              apellido: session.user.user_metadata?.apellido || '',
              correo: session.user.email || '',
              rol: session.user.user_metadata?.rol || 'padre',
              dni: '00000000',
              created_at: session.user.created_at,
              updated_at: session.user.updated_at || session.user.created_at,
            } as Perfil);
          }
        } catch {
          // RLS might block, use metadata
          setPerfil({
            id: session.user.id,
            nombre: session.user.user_metadata?.nombre || session.user.email?.split('@')[0] || '',
            apellido: session.user.user_metadata?.apellido || '',
            correo: session.user.email || '',
            rol: session.user.user_metadata?.rol || 'padre',
            dni: '00000000',
            created_at: session.user.created_at,
            updated_at: session.user.updated_at || session.user.created_at,
          } as Perfil);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  return { perfil, loading, userId };
}
