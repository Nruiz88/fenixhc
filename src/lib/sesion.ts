/**
 * Que hacer cuando una llamada autenticada responde 401.
 *
 * POR QUE ESTE ARCHIVO EXISTE
 *
 * El token lleva dentro el momento del ultimo cambio de clave del usuario
 * (ver `AuthUser.pc` en `lib/auth.ts`). Al entrar a una API se compara ese
 * sello con el de la base: si la clave cambio despues de que el token se
 * emitio, el token nacio de una clave que ya no existe y se descarta.
 *
 * Eso es lo que hace que cambiar la clave cierre las sesiones abiertas de esa
 * cuenta — y solo de esa cuenta, sin rotar el secreto global.
 *
 * POR QUE HACE FALTA ESTE LADO DEL CLIENTE
 *
 * Una sesion que se cae por cambio de clave es uso normal, no una excepcion:
 * alguien cambia la clave desde el celu y sigue con el navegador del escritorio
 * abierto. Antes de esto, un 401 era casi imposible y devolver
 * `{ data: null }` sin mas era inofensivo.
 *
 * Ahora, sin este manejo, esa persona ve tablas vacias y botones que no hacen
 * nada, sin entender por que. Se traduce "tu sesion vencio" por "la pagina esta
 * rota". Y el otro extremo — el ladron con la clave robada — se queda trabado
 * igual, que es lo correcto, pero con una pantalla en blanco en vez de un
 * ingreso.
 *
 * SOLO EN EL NAVEGADOR
 *
 * Nada de esto corre en el servidor: en un route handler no hay `window`, y en
 * un Server Component no se puede redirigir al cliente desde acá. El proxy ya
 * manda a `/login` cuando el token directamente no verifica; esto cubre el
 * caso que el proxy todavia no puede ver, que es un token bien formado pero con
 * el sello viejo.
 */

let redirigiendo = false;

/**
 * Manda a la pantalla de ingreso, una sola vez.
 *
 * Un panel carga varias tablas en paralelo. Si cada una redirigiera por su
 * cuenta, el login se abriria cinco veces y la ultima navegacion gana.
 */
export function alLogin(): void {
  if (redirigiendo) return;
  if (typeof window === 'undefined') return;

  redirigiendo = true;

  // Se manda el destino para que el ingreso devuelva a la persona a donde
  // estaba, en vez de al panel vacio.
  const destino = window.location.pathname + window.location.search;
  window.location.href = `/login?redirect=${encodeURIComponent(destino)}`;
}

/** El texto de error que ve la persona cuando su sesion se cae. */
export const ERROR_SESION_VENCIDA = 'Tu sesion vencio. Volve a entrar.';
