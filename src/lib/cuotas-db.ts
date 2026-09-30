import { query, uuid } from './db';
import type { ConfigCuotas, Vencimiento } from './cuotas';

// Acceso a datos de la configuración de cuotas.
//
// Va separado de `cuotas.ts` a propósito: ese archivo es lógica pura y lo
// importan los componentes de cliente, que se llevarían el driver de MySQL
// entero al navegador si esta parte estuviera ahí adentro.

const META_CONFIG: Record<string, string> = {
  cuota_monto_base: 'Monto mensual de la cuota, antes de recargo',
  cuota_mes_vencimiento_dia: 'Día del mes siguiente en que vence la cuota sin recargo',
};

/** Configuración usada si la migración 06 todavía no se aplicó. */
const POR_DEFECTO: ConfigCuotas = {
  montoBase: 75000,
  vencimientos: [
    { id: 'def-10', dia: 10, porcentaje: 5, etiqueta: 'Vence el día 10: +5%', activo: true, orden: 1 },
    { id: 'def-20', dia: 20, porcentaje: 10, etiqueta: 'Vence el día 20: +10%', activo: true, orden: 2 },
    { id: 'def-30', dia: 30, porcentaje: 20, etiqueta: 'Vence el día 30: +20%', activo: true, orden: 3 },
  ],
};

/** Lee la configuración de cuotas desde la base. */
export async function leerConfigCuotas(): Promise<ConfigCuotas> {
  const [filas, vencs] = await Promise.all([
    query<{ clave: string; valor: string }>('SELECT clave, valor FROM configuracion_club'),
    query<Vencimiento>(
      'SELECT id, dia, porcentaje, etiqueta, activo, orden FROM vencimientos_cuota ORDER BY dia ASC'
    ),
  ]);

  const mapa = new Map(filas.map((f) => [f.clave, f.valor]));

  return {
    montoBase: Number(mapa.get('cuota_monto_base') ?? POR_DEFECTO.montoBase) || 0,
    vencimientos: vencs.length ? vencs : POR_DEFECTO.vencimientos,
  };
}

/**
 * Igual que leerConfigCuotas, pero no falla si las tablas no existen.
 *
 * Se usa en las pantallas. Si la migración 06 todavía no corrió, el panel
 * tiene que seguir funcionando con los valores históricos; reventar acá
 * dejaría sin panel a todo el club hasta que alguien aplique la migración.
 */
export async function leerConfigCuotasSegura(): Promise<ConfigCuotas> {
  try {
    return await leerConfigCuotas();
  } catch (err) {
    console.warn('No se pudo leer la configuración de cuotas, se usan valores por defecto:', err);
    return POR_DEFECTO;
  }
}

/** Guarda solo el monto base. */
export async function guardarMontoBase(montoBase: number) {
  await query(
    `INSERT INTO configuracion_club (clave, valor, descripcion) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), descripcion = VALUES(descripcion)`,
    ['cuota_monto_base', String(montoBase), META_CONFIG.cuota_monto_base]
  );
}

/**
 * Inserta o actualiza cada hito por su id.
 *
 * No borra nada: borrar lo que el usuario sacó de la pantalla es responsabilidad
 * de `borrarVencimientos`, que recibe los ids explícitos. Barajar borrados acá
 * dejaría el paso dependente del orden de las consultas, y un fallo a mitad de
 * camino dejaría hitos duplicados o de menos.
 */
export async function guardarVencimientos(vencimientos: Vencimiento[]) {
  const ordenados = vencimientos.slice().sort((a, b) => a.dia - b.dia);

  for (const v of ordenados) {
    await query(
      `INSERT INTO vencimientos_cuota (id, dia, porcentaje, etiqueta, activo, orden)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         dia = VALUES(dia),
         porcentaje = VALUES(porcentaje),
         etiqueta = VALUES(etiqueta),
         activo = VALUES(activo),
         orden = VALUES(orden)`,
      [v.id || uuid(), v.dia, v.porcentaje, v.etiqueta ?? null, v.activo ? 1 : 0, v.orden]
    );
  }

  return ordenados.map((v) => v.id);
}

/** Elimina los hitos con esos ids. */
export async function borrarVencimientos(ids: string[]) {
  if (!ids.length) return;
  const marcadores = ids.map(() => '?').join(',');
  await query(`DELETE FROM vencimientos_cuota WHERE id IN (${marcadores})`, ids);
}

/** Ids de los hitos que existen ahora, para calcular qué hay que borrar. */
export async function idsVencimientosActuales(): Promise<string[]> {
  const filas = await query<{ id: string }>('SELECT id FROM vencimientos_cuota');
  return filas.map((f) => f.id);
}
