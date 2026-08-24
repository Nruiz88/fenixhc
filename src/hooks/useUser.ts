'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Perfil } from '@/types';

export function useUser() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      setPerfil(data);
      setLoading(false);
    })();
  }, []);

  return { perfil, loading };
}
