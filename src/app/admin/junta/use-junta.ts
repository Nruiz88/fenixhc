'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

// Cliente mínimo de la sección de junta.
//
// Existe para que los mensajes de error sean uno solo. Con seis pantallas
// copiando el mismo try/catch, cada una termina contando los permisos de forma
// distinta y alguna se olvida de avisar que no tenía permiso y muestra un
// error genérico que no dice nada.

export function useJunta<T>(area: string, params?: Record<string, string>) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState<string | null>(null);

  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => !!v) as [string, string][]).toString()
    : '';

  const recargar = useCallback(async () => {
    setCargando(true);
    setFallo(null);
    try {
      const res = await fetch(`/api/junta/${area}${qs}`);
      const json = await res.json();
      if (!res.ok) {
        setFallo(json.error || 'No se pudo cargar');
        setDatos(null);
        return;
      }
      setDatos(json.data);
    } catch {
      setFallo('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, qs]);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { datos, cargando, fallo, recargar };
}

/** Manda una acción al área y avisa. Devuelve si salió bien. */
export async function accionJunta(
  area: string,
  cuerpo: Record<string, unknown>,
  mensajeOk?: string
): Promise<boolean> {
  try {
    const res = await fetch(`/api/junta/${area}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    const json = await res.json();

    if (!res.ok) {
      toast.error(json.error || 'No se pudo completar la operación', { duration: 8000 });
      return false;
    }

    if (mensajeOk) toast.success(mensajeOk, { description: json.mensaje, duration: 6000 });
    return true;
  } catch {
    toast.error('No se pudo conectar con el servidor');
    return false;
  }
}
