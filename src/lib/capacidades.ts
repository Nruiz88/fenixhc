// Capacidades de la sección de junta directiva.
//
// POR QUÉ NO ALCANZA CON MÓDULOS
//
// El panel decide con módulos: un rol tiene o no tiene acceso a una pantalla.
// Para esta sección no alcanza, porque el pedido real mezcla cosas distintas
// dentro del mismo lugar:
//
//   - El tesorero ve la parte de ingresos y egresos, pero NO el resto del
//     parte administrativo.
//   - El vocal ve la comunicación interna, pero no puede escribirla.
//   - El secretario baja documentos del legajo, pero no emite recibos.
//
// Con módulos, o el tesorero no ve el parte financiero —y no puede trabajar— o
// ve el administrativo también, que es información institucional que no le
// corresponde. Con capacidades se puede decir las dos cosas.
//
// OTRAS COSAS QUE ESTE ARCHIVO RESUELVE
//
//  - Los secretos de una junta directiva: el tesorero es la excepción y por
//    eso existe `esTesorero` y no un público.
//  - Un mismo nombre de rol para los dos puestos (`vocal_titular` y
//    `vocal_suplente`) no significa la misma persona. Las capacidades se
//    asignan por CARGO, no por cuenta: cambiás a alguien de vocal suplente y
//    conserva lo que le correspondía por el cargo.

import type { Rol } from './roles';

export const CAPACIDADES = [
  // Ver
  'ver_comunicacion_interna',
  'publicar_comunicacion_interna',
  'ver_parte_administrativo',
  'ver_parte_financiero',
  'publicar_parte',
  'ver_documentos_legajo',
  'descargar_documentos_legajo',
  'cargar_documentos_legajo',
  'ver_fotos',
  'comunicar_padres',
  'ver_vencimientos',
  'adherentes_seguro',
  'gestionar_seguro',
  'cargar_facturas',
  'emitir_recibos',
  'ver_inventario',
  'gestionar_inventario',
  'gestionar_prestamos',
] as const;

export type Capacidad = (typeof CAPACIDADES)[number];

/** Etiquetas legibles para la interfaz y para los mensajes de error. */
export const ETIQUETA_CAPACIDAD: Record<Capacidad, string> = {
  ver_comunicacion_interna: 'Ver las comunicaciones internas',
  publicar_comunicacion_interna: 'Escribir comunicaciones internas',
  ver_parte_administrativo: 'Ver el parte administrativo',
  ver_parte_financiero: 'Ver la parte de ingresos y egresos',
  publicar_parte: 'Cargar partes',
  ver_documentos_legajo: 'Ver los documentos de los legajos',
  descargar_documentos_legajo: 'Descargar documentos de los legajos',
  cargar_documentos_legajo: 'Cargar documentos a los legajos',
  ver_fotos: 'Ver las fotos internas',
  comunicar_padres: 'Mandar comunicaciones a las familias',
  ver_vencimientos: 'Ver los vencimientos de cuotas y seguro',
  adherentes_seguro: 'Ver quién está adherido al seguro',
  gestionar_seguro: 'Cargar y actualizar adherentes al seguro',
  cargar_facturas: 'Cargar facturas',
  emitir_recibos: 'Emitir recibos',
  ver_inventario: 'Ver el inventario',
  gestionar_inventario: 'Modificar el inventario',
  gestionar_prestamos: 'Registrar préstamos de equipos',
};

// ---------------------------------------------------------------------------
// La matriz
// ---------------------------------------------------------------------------
//
// Leída de izquierda a derecha, cada fila es un puesto de la junta. Lo que
// está debajo de la raya de una celda no se ve; no es que se oculte, es que
// no existe.
//
// Decisiones que_no son obvias y conviene no volver a preguntar:
//
//  - EL TESORERO VE LA PARTE FINANCIERA Y EL PRESIDENTE TAMBIÉN. Un presidente
//    que aprueba el gasto sin ver la plata es un presidente de mentira.
//
//  - EL SECRETARIO NO VE LA PARTE FINANCIERA. Lleva el acta de las reuniones;
//    el estado de cuenta lo firma el tesorero y lo aprueba el presidente. Que
//    el secretario lo vea no aporta nada y expone datos del banco.
//
//  - EL TESORERO NO VE LOS PARTES ADMINISTRATIVOS. Es la información
//    institucional que le toca a la secretaría. Puede ver el parte financiero,
//    que es lo suyo.
//
//  - LOS VOCALES NO ESCRIBEN NADA. Solo leen. Un vocal que publica una
//    comunicación interna no tiene por qué decidir qué ve el resto de la
//    junta.

const CAPACIDADES_PRESIDENTE: readonly Capacidad[] = [
  'ver_comunicacion_interna',
  'publicar_comunicacion_interna',
  'ver_parte_administrativo',
  'ver_parte_financiero',
  'publicar_parte',
  'ver_documentos_legajo',
  'descargar_documentos_legajo',
  'cargar_documentos_legajo',
  'ver_fotos',
  'comunicar_padres',
  'ver_vencimientos',
  'adherentes_seguro',
  'gestionar_seguro',
  'cargar_facturas',
  'emitir_recibos',
  'ver_inventario',
  'gestionar_inventario',
  'gestionar_prestamos',
];

const CAPACIDADES_SECRETARIO: readonly Capacidad[] = [
  'ver_comunicacion_interna',
  'publicar_comunicacion_interna',
  'ver_parte_administrativo',
  'publicar_parte',
  'ver_documentos_legajo',
  'descargar_documentos_legajo',
  'cargar_documentos_legajo',
  'ver_fotos',
  'comunicar_padres',
  'ver_vencimientos',
  'adherentes_seguro',
  'gestionar_seguro',
];

const CAPACIDADES_TESORERO: readonly Capacidad[] = [
  'ver_comunicacion_interna',
  'ver_parte_financiero',
  // Puede CARGAR el parte financiero aunque no pueda cargar el administrativo.
  // La API vuelve a mirar qué tipo es: tener `publicar_parte` no le abre la
  // secretaría, solo le deja escribir lo suyo.
  //
  // Sin esta línea el tesorero podía leer el parte de ingresos y egresos pero
  // no escribirlo, que es al revés de como funciona una tesorería. Se detectó
  // probando por cargo contra producción.
  'publicar_parte',
  'ver_fotos',
  'comunicar_padres',
  'ver_vencimientos',
  'adherentes_seguro',
  'gestionar_seguro',
  'cargar_facturas',
  'emitir_recibos',
  'ver_inventario',
  'gestionar_inventario',
  'gestionar_prestamos',
];

const CAPACIDADES_VOCAL: readonly Capacidad[] = [
  'ver_comunicacion_interna',
  'ver_fotos',
];

export const CAPACIDADES_POR_ROL: Record<Rol, readonly Capacidad[]> = {
  // El admin es la mano derecha: ve todo y escribe todo. Si no puede cargar un
  // documento, el club se frena esperando a que esté el presidente.
  admin: CAPACIDADES_PRESIDENTE,
  presidente: CAPACIDADES_PRESIDENTE,
  secretario: CAPACIDADES_SECRETARIO,
  tesorero: CAPACIDADES_TESORERO,
  vocal_titular: CAPACIDADES_VOCAL,
  vocal_suplente: CAPACIDADES_VOCAL,
  socio_benefactor: [],
  socio_cadete: [],
};

export function puede(rol: string | undefined | null, capacidad: Capacidad): boolean {
  if (!rol) return false;
  const lista = CAPACIDADES_POR_ROL[rol as Rol];
  return !!lista && lista.includes(capacidad);
}

/** Todas las capacidades de un rol de una vez. Para pintar y esconder cosas. */
export function capacidadesDe(rol: string | undefined | null): Capacidad[] {
  if (!rol) return [];
  return [...(CAPACIDADES_POR_ROL[rol as Rol] ?? [])];
}

/**
 * El tesorero, como excepción y no como permiso.
 *
 * Guarda un solo secreto: la parte de ingresos y egresos. No se modela como
 * capacidad porque no se agrega ni se quita —es el puesto— y porque casi todo
 * lo demás ya tiene su propia capacidad.
 */
export function esTesorero(rol: string | undefined | null): boolean {
  return rol === 'tesorero';
}

/**
 * Permisos que se pueden quitar a un rol concreto.
 *
 * La matriz es el punto de partida, no la ley. Cuando un club se organiza
 * distinto, lo que se ajusta es esta lista, no cada pantalla. El veto sobre
 * estas tres es deliberado:
 *
 *  - `ver_comunicacion_interna`: es la nota interna. Si se puede sacar, la nota
 *    deja de ser interna.
 *  - `ver_parte_financiero`: los números del club.
 *  - `gestionar_seguro`: los datos de salud de los pibes.
 */
export const NO_CONFIGURABLES: readonly Capacidad[] = [
  'ver_comunicacion_interna',
  'ver_parte_financiero',
  'gestionar_seguro',
];
