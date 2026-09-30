// Qué se puede ver públicamente, y qué no.
//
// Estas reglas viven acá y no dentro de cada endpoint por dos razones:
//
//  1) Las necesitan DOS endpoints: el público (sin sesión) y el de socios.
//     Duplicadas en cada uno, divergen en la primera corrección.
//
//  2) Al estar en un módulo se pueden testear. Un filtro de publicación mal
//     hecho es de los que no se rompen visiblemente: la pantalla sigue
//     funcionando y lo que falla es que un borrador se publica solo.
// El problema que previene: `comunicados` es de lectura compartida, así que el
// filtro de propiedad no la cubría, y las páginas mandaban
// `estado: 'publicado'` como filtro del cliente. Eso no protege nada: un POST
// a mano con `{"table":"comunicados","columns":"*"}` se llevaba también los
// borradores y los comunicados archivados.

/** Filtro SQL forzado por tabla, sin parámetros. */
export type FiltrosPublicos = Record<string, string>;

export const FILTROS_PUBLICOS: FiltrosPublicos = {
  comunicados: "estado = 'publicado'",
  sponsors: 'activo = TRUE',
  horarios_entrenamiento: 'activo = TRUE',
};

/**
 * Agrega los filtros forcidos a los que venga del cliente.
 *
 * Siempre con AND. Si el cliente pidió `estado: 'borrador'`, la consulta
 * queda `estado = 'borrador' AND estado = 'publicado'`, que no devuelve nada
 * — que es justo lo que tiene que pasar.
 */
export function aplicarFiltrosPublicos(
  tabla: string,
  condiciones: string[],
  params: unknown[]
): void {
  const filtro = FILTROS_PUBLICOS[tabla];
  if (!filtro) return;

  condiciones.push(filtro);

  // Los filtros de acá son constantes sin `?`, así que no agregan params.
  // Se deja el assert por si alguien agrega uno con placeholder después y
  // no actualiza la cuenta: es mejor romper en los tests que en producción
  // con los parámetros desalineados.
  if (filtro.includes('?')) {
    throw new Error(`El filtro público de "${tabla}" tiene placeholders: agregalos como params`);
  }
  void params;
}

/** Tablas que el endpoint público puede leer. El estado lo pone FILTROS_PUBLICOS. */
export const PUBLIC_SELECT_TABLES = [
  'comunicados',
  'fotos_galeria',
  'sponsors',
  'horarios_entrenamiento',
  'partidos',
  'canchas',
];
