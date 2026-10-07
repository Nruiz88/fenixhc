'use client';

import { useEffect, useState } from 'react';
import { calcularRecargo, type Vencimiento, type ResultadoRecargo } from '@/lib/cuotas';

// Configuración de cuotas para el cliente.
//
// Se trae una sola vez por sesión y se reutiliza en todas las pantallas que
// muestran cuotas, en vez de pegarle al endpoint en cada tabla. Un mismo
// monto de cuota puede aparecer a la vez en Contabilidad, en Pagos y en el
// legajo, y si cada uno calculara su propio recargo con datos distintos se
// verían cifras que no cierran entre sí.

export interface ConfigCuotasCliente {
  montoBase: number;
  vencimientos: Vencimiento[];
}

let cache: ConfigCuotasCliente | null = null;
let enVuelo: Promise<ConfigCuotasCliente> | null = null;

/** Trae la configuración una vez y la cachea. */
export async function obtenerConfigCuotas(): Promise<ConfigCuotasCliente> {
  if (cache) return cache;
  if (enVuelo) return enVuelo;

  enVuelo = (async () => {
    const res = await fetch('/api/user/cuota-config');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo cargar la configuración de cuotas');
    cache = json.data;
    return cache as ConfigCuotasCliente;
  })();

  try {
    return await enVuelo;
  } finally {
    enVuelo = null;
  }
}

/**
 * Hook que devuelve la función de cálculo del recargo.
 *
 * Mientras no llega la configuración devuelve `listo: false` para que la
 * pantalla pueda decidir qué mostrar. Mostrar el monto base y un segundo
 * después cambiarlo al total con recargo confunde: mejor un esqueleto de
 * carga, o directamente no renderizar los montos todavía.
 */
export function useConfigCuotas() {
  const [config, setConfig] = useState<ConfigCuotasCliente | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    obtenerConfigCuotas()
      .then((c) => vigente && setConfig(c))
      .catch((e) => vigente && setError(e.message));
    return () => { vigente = false; };
  }, []);

  function calcular(
    montoBase: number,
    mes: number,
    anio: number,
    override?: string | null
  ): ResultadoRecargo {
    if (!config) {
      // Sin configuración, no se inventa recargo: se muestra el monto tal
      // cual. Un club que no cargó los porcentajes no cobra recargo.
      return calcularRecargo(montoBase, mes, anio, [], new Date(), override);
    }
    return calcularRecargo(montoBase, mes, anio, config.vencimientos, new Date(), override);
  }

  return { config, error, calcular, listo: config !== null };
}
