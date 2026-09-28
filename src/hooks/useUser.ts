'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from '@/lib/auth-client';
import { userDb } from '@/lib/api';
import type { Perfil } from '@/types';

export function useUser() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          setLoading(false);
          return;
        }

        setUserId(user.id);

        const { data } = await userDb.select('perfiles', '*', { id: user.id }, { single: true });
        if (data) {
          setPerfil(data as Perfil);
        } else {
          // Fallback to data from the auth session
          setPerfil({
            id: user.id,
            nombre: user.nombre || user.email?.split('@')[0] || '',
            apellido: user.apellido || '',
            correo: user.email || '',
            rol: user.rol || 'padre',
            dni: '00000000',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as Perfil);
        }
      } catch {}
      setLoading(false);
    })();
  }, []);

  return { perfil, loading, userId };
}
