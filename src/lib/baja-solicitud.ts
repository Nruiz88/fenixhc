// Validación de los pedidos de baja de datos.
//
// Vive aparte de los endpoints por dos motivos. El primero, que las dos vías
// —el formulario público y el portal del socio— validan cosas distintas pero
// comparten el mismo campo `motivo`, y mantener el listado en dos lugares hace
// que uno se actualice y el otro no. El segundo, más importante: son reglas,
// no plumbing. Un endpoint se lee para ver qué devuelve; estas reglas se
// leen para ver qué garantiza el club.
//
// Lo que garantizan estas funciones es el mínimo para que un pedido sea
// atendible. Un pedido sin DNI no se puede verificar, y un pedido sin
// verificar es un pedido que puede ser de cualquiera.

export const MOTIVOS_SOLICITUD = [
  'renuncia',
  'baja_social',
  'solicitud_tutor',
  'otro',
] as const;

export type MotivoSolicitud = (typeof MOTIVOS_SOLICITUD)[number];

/** Los máximos de campo, para recortar antes de llegar al INSERT. */
export const LARGO = {
  nombre: 150,
  email: 255,
  relacion: 60,
  motivo: 2000,
  documento: 30,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Lee un campo del pedido como texto.
 *
 * El cuerpo del POST es `unknown`: un cliente puede mandar un número, un
 * array, un null. `String(x ?? '')` no alcanza para eso —de un array sale
 * "1,2" y de un objeto "[object Object]"—, y un DNI "[object Object]" es
 * todavía peor que un DNI ausente: pasa por el filtro y no encuentra ficha.
 */
function texto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  if (valor == null) return '';
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor);
  return '';
}

/** Un DNI es de 6 a 10 dígitos. Menos no es un documento; más, no existe. */
export function documentoValido(documento: string): boolean {
  return /^\d{6,10}$/.test(documento);
}

/**
 * Saca todo lo que no sea dígito.
 *
 * La gente escribe "12.345.678", "12345678" o "dni 12345678" y espera que el
 * club lo entienda. Deletear en vez de rechazar es lo razonable acá: el campo
 * se usa para encontrar la ficha, no para decidir nada.
 */
export function normalizarDocumento(valor: unknown): string {
  return texto(valor).replace(/\D/g, '');
}

export function normalizarEmail(valor: unknown): string {
  return texto(valor).trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  return EMAIL_RE.test(email);
}

/**
 * Un motivo desconocido se guarda como 'otro' en vez de rechazarse.
 *
 * El club no tiene por qué saber de antemano por qué pide la baja alguien, y
 * negarse a registrar el pedido por un motivo no previsto sería darle a
 * quien lo hace una razón para no insistir.
 */
export function normalizarMotivo(valor: unknown): MotivoSolicitud {
  const v = texto(valor);
  return (MOTIVOS_SOLICITUD as readonly string[]).includes(v)
    ? (v as MotivoSolicitud)
    : 'otro';
}

export interface PedidoPublico {
  nombre: string;
  email: string;
  documento: string;
  relacion: string;
  motivo: MotivoSolicitud;
  comentario: string;
  /** Un solo mensaje: se muestra arriba del formulario, no campo por campo. */
  error?: string;
}

type Resultado = { ok: true; datos: PedidoPublico } | { ok: false; error: string };

/**
 * Valida el pedido del formulario anónimo.
 *
 * Devuelve el primer problema encontrado en vez de una lista de todos. Con
 * cuatro campos, un mensaje a la vez es más fácil de corregir que un bloque de
 * errores; y el que se equivoca dos veces suele ver los mensajes mejor que
 * uno solo que enumera todo lo que falta.
 *
 * Lo que es demasiado largo se rechaza en vez de recortarse. Guardar los
 * primeros 2000 caracteres de un motivo y dar por registrado el pedido sería
 * mentira: quien lo escribió cree que el club leyó lo que puso, y el club
 * tiene una versión distinta guardada. Preferimos que rehaga el pedido.
 */
export function validarPedidoPublico(entrada: Record<string, unknown>): Resultado {
  const nombre = texto(entrada.nombre).trim();
  const email = normalizarEmail(entrada.email);
  const documento = normalizarDocumento(entrada.documento);
  const relacion = texto(entrada.relacion).trim();
  const comentario = texto(entrada.comentario).trim();

  if (nombre.length < 3) {
    return { ok: false, error: 'Escribí el nombre completo de la persona' };
  }
  if (nombre.length > LARGO.nombre) {
    return { ok: false, error: 'El nombre es demasiado largo' };
  }
  if (!emailValido(email)) {
    return { ok: false, error: 'Revisá el email: no parece una dirección válida' };
  }
  if (!documentoValido(documento)) {
    return {
      ok: false,
      error: 'El DNI de la persona debe tener entre 6 y 10 dígitos, solo números',
    };
  }
  if (relacion.length > LARGO.relacion) {
    return { ok: false, error: 'La relación escrita es demasiado larga' };
  }
  if (comentario.length > LARGO.motivo) {
    return { ok: false, error: 'El comentario es demasiado largo' };
  }

  return {
    ok: true,
    datos: {
      nombre: nombre.slice(0, LARGO.nombre),
      email: email.slice(0, LARGO.email),
      documento: documento.slice(0, LARGO.documento),
      relacion,
      motivo: normalizarMotivo(entrada.motivo),
      comentario,
    },
  };
}

/**
 * Junta el vínculo y el comentario en el único campo de texto que tiene la
 * tabla, sin perder de dónde vino cada parte.
 *
 * Los dos van juntos al mismo `notas`. Es lo que hay; pero separarlos con el
 * rótulo de origen evita que un admin lea "no queremos más" sin saber si lo
 * dijo el padre del jugador o el propio socio.
 */
export function componerNotas(parts: { vinculo?: string; comentario?: string }): string | null {
  const vinculo = texto(parts.vinculo).trim();
  const comentario = texto(parts.comentario).trim();
  const lineas = [
    vinculo ? `Vínculo declarado: ${vinculo}` : '',
    comentario ? `Comentario: ${comentario}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, LARGO.motivo);

  return lineas || null;
}
