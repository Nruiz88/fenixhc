// Tokens de verificación de email.
//
// El token viaja por email en claro pero en la base solo se guarda su
// SHA-256: si alguien lee la tabla `usuarios` no puede reutilizar los tokens
// para verificar cuentas ajenas. El token es de un solo uso (se borra al
// verificar) y expira.

import { randomBytes, createHash } from 'crypto';
import { execute, query } from './db';
import { sendEmail, verificacionEmail } from './email';

const TTL_HORAS = 24;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface VerifyResult {
  ok: boolean;
  motivo?: 'invalido' | 'expirado' | 'ya-verificado';
}

/**
 * Genera un token, lo hashea en la base y envía el email con el link.
 * Devuelve el token en claro solo para poder armar el link en el email.
 */
export async function generarYEnviarVerificacion(
  usuarioId: string,
  email: string,
  nombre: string,
  baseUrl: string
): Promise<{ ok: boolean; devToken?: string }> {
  const token = randomBytes(32).toString('hex');
  const hash = hashToken(token);

  await execute(
    `UPDATE usuarios
        SET verification_token = ?, verification_expires_at = DATE_ADD(NOW(), INTERVAL ? HOUR), verification_sent_at = NOW()
      WHERE id = ?`,
    [hash, TTL_HORAS, usuarioId]
  );

  const link = `${baseUrl}/verificar?token=${token}`;
  const { subject, html, text } = verificacionEmail({ nombre, link });
  const res = await sendEmail({ to: email, subject, html, text });

  // Si no hay API key (dev / deploy sin configurar) devolvemos el token para
  // poder mostrar el link en pantalla en vez de dejar al usuario sin salida.
  return { ok: res.sent, devToken: res.sent ? undefined : token };
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
