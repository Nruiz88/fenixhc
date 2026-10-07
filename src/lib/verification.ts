// Tokens de verificación de email.
//
// El token viaja por email en claro pero en la base solo se guarda su
// SHA-256: si alguien lee la tabla `usuarios` no puede reutilizar los tokens
// para verificar cuentas ajenas. El token es de un solo uso (se borra al
// verificar) y expira.

import { randomBytes, createHash } from 'crypto';
import { execute, query, type Ejecutable } from './db';
import { sendEmail, verificacionEmail, idPlantilla } from './email';

const TTL_HORAS = 24;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface VerifyResult {
  ok: boolean;
  motivo?: 'invalido' | 'expirado' | 'ya-verificado';
}

/**
 * Genera el token y lo deja anotado en la base. NO envía nada.
 *
 * Existe separada del envío a propósito. El alta de un socio escribe en cinco
 * tablas y tiene que ir en una transacción; mandar el correo desde adentro
 * significa mantener esa transacción abierta durante una llamada a la red, y
 * que un correo lento o caído haga perder el alta entera. También al revés: un
 * correo que salió no se puede deshacer con un ROLLBACK.
 *
 * El orden correcto es: transacción con las escrituras (incluido el token),
 * commit, y recién ahí el envío. Si el envío falla, la cuenta queda creada y
 * bloqueada, que es un estado que la secretaría puede resolver; lo que nunca
 * puede pasar es una cuenta a medio crear.
 */
export async function generarTokenVerificacion(
  usuarioId: string,
  conn?: Ejecutable | null
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const sql = `UPDATE usuarios
      SET verification_token = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR), verification_sent_at = NOW()
    WHERE id = ?`;

  if (conn) {
    await conn.execute(sql, [hashToken(token), TTL_HORAS, usuarioId]);
  } else {
    await execute(sql, [hashToken(token), TTL_HORAS, usuarioId]);
  }
  return token;
}

/** Manda el correo de verificación. No toca la base. */
export async function enviarVerificacion(opts: {
  email: string;
  nombre: string;
  token: string;
  baseUrl: string;
}): Promise<{ ok: boolean }> {
  const link = `${opts.baseUrl}/verificar?token=${opts.token}`;
  const { subject, html, text } = verificacionEmail({ nombre: opts.nombre, link });
  const res = await sendEmail({
    to: opts.email,
    subject,
    html,
    text,
    // Si no hay RESEND_TEMPLATE_VERIFICACION, esto queda undefined y se manda
    // el html de arriba. Ese camino es el que no puede romperse.
    plantilla: {
      id: idPlantilla('RESEND_TEMPLATE_VERIFICACION'),
      variables: { nombre: opts.nombre, link },
    },
  });
  return { ok: res.sent };
}

/**
 * Genera un token, lo hashea en la base y envía el email con el link.
 * Devuelve el token en claro solo para poder armar el link en el email.
 *
 * Es la composición de las dos de arriba, para los llamadores que no tienen
 * una transacción abierta (resend-verification, /api/auth/me).
 */
export async function generarYEnviarVerificacion(
  usuarioId: string,
  email: string,
  nombre: string,
  baseUrl: string
): Promise<{ ok: boolean; devToken?: string }> {
  const token = await generarTokenVerificacion(usuarioId);
  const { ok } = await enviarVerificacion({ email, nombre, token, baseUrl });

  // Si no hay API key (dev / deploy sin configurar) devolvemos el token para
  // poder mostrar el link en pantalla en vez de dejar al usuario sin salida.
  return { ok, devToken: ok ? undefined : token };
}

/** Verifica el token recibido y marca el email como verificado. */
export async function verificarToken(token: string): Promise<VerifyResult> {
  if (!token || token.length < 32 || !/^[a-f0-9]+$/.test(token)) {
    return { ok: false, motivo: 'invalido' };
  }

  const rows = await query<{ id: string; email_verificado: number; verification_expires_at: string | null }>(
    'SELECT id, email_verificado, verification_expires_at FROM usuarios WHERE verification_token = ? LIMIT 1',
    [hashToken(token)]
  );
  const user = rows[0];
  if (!user) return { ok: false, motivo: 'invalido' };
  if (user.email_verificado) return { ok: false, motivo: 'ya-verificado' };

  // Expirado (o ya vencido por reloj).
  const exp = user.verification_expires_at ? new Date(user.verification_expires_at).getTime() : 0;
  if (!exp || exp < Date.now()) {
    // Se limpia para que no quede un token vencido medio válido.
    await execute('UPDATE usuarios SET verification_token = NULL WHERE id = ?', [user.id]);
    return { ok: false, motivo: 'expirado' };
  }

  await execute(
    'UPDATE usuarios SET email_verificado = 1, verification_token = NULL, verification_expires_at = NULL WHERE id = ?',
    [user.id]
  );
  return { ok: true };
}

/** Reenvía la verificación. Devuelve true si se envió (o si no hay key). */
export async function reenviarVerificacion(
  usuarioId: string,
  email: string,
  nombre: string,
  baseUrl: string
): Promise<{ ok: boolean; devToken?: string }> {
  return generarYEnviarVerificacion(usuarioId, email, nombre, baseUrl);
}
