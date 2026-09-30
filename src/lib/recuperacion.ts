// Recuperación de contraseña.
//
// Sigue la misma forma que la verificación de email: el token viaja por correo
// en claro y en la base solo vive su SHA-256. Quien lea la tabla `usuarios`
// no puede abrir la cuenta de nadie.
//
// LAS CUATRO REGLAS QUE IMPORTAN
//
//  1. UN SOLO USO. Al cambiar la clave, el token se borra. Un link de
//     recuperación que queda válido es un link de recuperación eterno.
//
//  2. UNA HORA, NO 24. La verificación de email dura un día porque confirmar
//     que la casilla es tuya no es urgente. Un enlace para cambiar la clave
//     queda abierto en la bandeja de alguien que no lo pidió, en una pantalla
//     compartida, en una foto del mail. Una hora es suficiente para usar el link
//     y corta lo que da.
//
//  3. SOLO SI EL EMAIL ESTÁ VERIFICADO. Si alguien se registró con el correo de
//     otra persona, dejarle recuperar la clave le da la cuenta. El que quiere la
//     clave tiene que haber demostrado antes que la casilla es suya.
//
//  4. PEDIR OTRO INVALIDA EL ANTERIOR. Si alguien pidió un reset, se arrepiente y
//     pide otro, el primero tiene que dejar de servir. Si no, el que robbed
//     del mail viejo tiene una ventana que el usuario ya cerró.
//
// LO QUE ESTE ARCHIVO NO HACE, Y DONDE ESTA HECHO
//
// Invalidar las sesiones abiertas de esa cuenta. NO lo hace acá, pero el
// `password_changed_at = NOW()` de más abajo lo resuelve: el token de sesión
// lleva dentro el sello de la clave con que se emitió, y `getCurrentUser` lo
// compara contra la base. Cambiar la clave descarta los tokens viejos.
//
// Ver el detalle de por qué la comparación vive en `getCurrentUser` y no en el
// proxy, en el comentario de esa función.

import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { execute, query } from './db';
import { hashPassword } from './auth';
import { sendEmail, recuperacionEmail } from './email';

/** Una hora. Ver la regla 2. */
const TTL_MINUTOS = 60;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface ResultadoSolicitud {
  /** El pedido se aceptó, exista o no la cuenta. Ver abajo. */
  aceptado: true;
  /** Solo se llena si el envío no pudo salir (sin API key). */
  devToken?: string;
  /** El motivo real del no-envío, para que el endpoint pueda decirlo en voz baja. */
  motivoEnvio?: 'sin-key' | 'error' | 'sin-cuenta' | 'no-verificado';
}

/**
 * Genera el token, lo guarda hasheado y manda el correo.
 *
 * LA MISMA RESPUESTA PARA TODOS
 *
 * Devuelve siempre `aceptado: true` cuando el email tiene forma válida, exista
 * o no la cuenta. Si acá se dijera "no encontramos esa cuenta", la pantalla
 * se convierte en un formulario para averiguar a quién tiene cuenta en el club.
 *
 * `motivoEnvio` es para el log del servidor, nunca para la respuesta.
 */
export async function solicitarRecuperacion(params: {
  email: string;
  baseUrl: string;
  ip?: string | null;
}): Promise<ResultadoSolicitud> {
  const { email, baseUrl, ip = null } = params;

  const usuarios = await query<{
    id: string;
    email: string;
    nombre: string;
    email_verificado: number;
  }>(
    `SELECT u.id, u.email, u.email_verificado, p.nombre
       FROM usuarios u
       JOIN perfiles p ON p.usuario_id = u.id
      WHERE u.email = ?
      LIMIT 1`,
    [email]
  );

  const usuario = usuarios[0];

  if (!usuario) {
    // No se dice nada, pero tampoco se hace nada.
    return { aceptado: true, motivoEnvio: 'sin-cuenta' };
  }

  if (!usuario.email_verificado) {
    // Ver la regla 3. Sin esto, cualquiera puede registrarse con el mail de otro y
    // después quedarse con la cuenta.
    return { aceptado: true, motivoEnvio: 'no-verificado' };
  }

  const token = randomBytes(32).toString('hex');
  const hash = hashToken(token);

  // Regla 4: el pedido anterior deja de servir.
  await execute(
    `UPDATE usuarios
        SET reset_token = ?,
            reset_expires_at = DATE_ADD(NOW(), INTERVAL ? MINUTE),
            reset_enviado_en = NOW(),
            reset_solicitado_ip = ?
      WHERE id = ?`,
    [hash, TTL_MINUTOS, ip?.slice(0, 45) ?? null, usuario.id]
  );

  const link = `${baseUrl}/recuperar/${token}`;
  const { subject, html, text } = recuperacionEmail({
    nombre: usuario.nombre,
    link,
    minutos: TTL_MINUTOS,
  });
  const res = await sendEmail({ to: email, subject, html, text });

  return {
    aceptado: true,
    devToken: res.sent ? undefined : token,
    motivoEnvio: res.sent ? undefined : (res.motivo as any) ?? 'error',
  };
}

export interface ResultadoToken {
  ok: boolean;
  motivo?: 'invalido' | 'expirado';
  /** Para mostrarle "hola, ¿sos vos?". */
  nombre?: string;
}

/** Valida el token sin consumirlo. Lo usa la pantalla para saludar por su nombre. */
export async function revisarToken(token: string): Promise<ResultadoToken> {
  if (!esTokenValido(token)) return { ok: false, motivo: 'invalido' };

  const usuarios = await query<{
    id: string;
    nombre: string;
    reset_expires_at: string | null;
  }>(
    `SELECT u.id, u.reset_expires_at, p.nombre
       FROM usuarios u
       JOIN perfiles p ON p.usuario_id = u.id
      WHERE u.reset_token = ?
      LIMIT 1`,
    [hashToken(token)]
  );

  const usuario = usuarios[0];
  if (!usuario) return { ok: false, motivo: 'invalido' };

  const exp = usuario.reset_expires_at ? new Date(usuario.reset_expires_at).getTime() : 0;
  if (!exp || exp < Date.now()) {
    return { ok: false, motivo: 'expirado' };
  }

  return { ok: true, nombre: usuario.nombre };
}

export interface ResultadoCambio {
  ok: boolean;
  motivo?: 'invalido' | 'expirado' | 'misma-clave' | 'error';
  mensaje?: string;
}

/**
 * Cambia la clave y consume el token.
 *
 * Todo en una transacción: si el UPDATE de la clave y el borrado del token no
 * ocurren juntos, queda el token válido sin clave cambiada, y el próximo intento
 * vuelve a funcionar como si nada.
 */
export async function cambiarClaveConToken(params: {
  token: string;
  nuevaPassword: string;
}): Promise<ResultadoCambio> {
  const { token, nuevaPassword } = params;

  if (!esTokenValido(token)) return { ok: false, motivo: 'invalido' };

  const hash = hashToken(token);

  const usuarios = await query<{
    id: string;
    password_hash: string;
    reset_expires_at: string | null;
  }>(
    `SELECT id, password_hash, reset_expires_at FROM usuarios WHERE reset_token = ? LIMIT 1`,
    [hash]
  );
  const usuario = usuarios[0];
  if (!usuario) return { ok: false, motivo: 'invalido' };

  const exp = usuario.reset_expires_at ? new Date(usuario.reset_expires_at).getTime() : 0;
  if (!exp || exp < Date.now()) {
    // Se limpia: un token vencido que queda en la base es ruido que después
    // alguien toma por válido.
    await execute(
      'UPDATE usuarios SET reset_token = NULL, reset_expires_at = NULL WHERE id = ?',
      [usuario.id]
    );
    return { ok: false, motivo: 'expirado' };
  }

  const nuevoHash = await hashPassword(nuevaPassword);

  await execute(
    `UPDATE usuarios
        SET password_hash = ?,
            reset_token = NULL,
            reset_expires_at = NULL,
            reset_enviado_en = NULL,
            password_changed_at = NOW()
      WHERE id = ? AND reset_token = ?`,
    [nuevoHash, usuario.id, hash]
  );

  return {
    ok: true,
    mensaje:
      'Cambiamos tu contraseña. Entrá con la nueva. Las sesiones que estaban abiertas en otros dispositivos ya se cerraron.',
  };
}

/**
 * El token tiene forma válida ANTES de tocar la base.
 *
 * Un token inválido no se busca: se rechaza. Con la búsqueda, alguien que
 * probara 10.000 caracteres gastaría 10.000 consultas contra la tabla de
 * usuarios, y eso es un vector de denegación de servicio con una request.
 */
export function esTokenValido(token: string): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
}

/**
 * Comparación en tiempo constante.
 *
 * Sirve para comparar contraseñas cuando las dos vienen del mismo lado, que no
 * es el caso acá (el token va hasheado a la base y la búsqueda la hace MySQL).
 * Queda exportada para el login, que sí compara dos valores controlados por el
 * atacante.
 */
export function compararEnTiempoConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
