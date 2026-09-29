import { NextResponse } from 'next/server';

/**
 * Lee el body JSON de un request y devuelve 400 si viene mal formado.
 *
 * Sin esto, `await request.json()` revienta cuando el cliente manda algo que
 * no es JSON (un curl mal citado, un proxy que parte el body, un cliente
 * roto) y el `catch` general responde 500. Eso está mal por dos motivos:
 * un body inválido es un error del solicitante, no una falla del servidor, y
 * un 500 hace creer que el servicio está caído y llena el log de errores con
 * ruido que esconde los problemas de verdad.
 *
 * Devuelve `{ ok: false }` para que el handler responda y salga, o
 * `{ ok: true, data }` con el body ya parseado.
 */
export async function leerJson<T = Record<string, unknown>>(
  request: Request
): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: (await request.json()) as T };
  } catch {
    return { ok: false };
  }
}

export const RESP_BAD_JSON = () =>
  NextResponse.json({ error: 'Datos enviados mal formados' }, { status: 400 });
