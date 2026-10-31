import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { query } from './db';

// Credenciales de MercadoPago guardadas en la base.
//
// El club las carga desde el panel, no por variables de entorno. Eso obliga a
// que el Access Token viva en la base, y una base respaldada o volcada en un
// incidente no debería entregar la llave para cobrar en nombre del club.
// Por eso el token y el secreto de webhooks se guardan cifrados con AES-256-GCM
// y una clave derivada del JWT_SECRET (que ya es obligatorio en producción y
// nunca se guarda en la base).
//
// Si se rota el JWT_SECRET, las credenciales guardadas dejan de poder leerse.
// La pantalla lo detecta y pide volver a ingresarlas; no se pierde nada más.

const CLAVES = [
  'mp_habilitado',
  'mp_access_token',
  'mp_public_key',
  'mp_webhook_secret',
] as const;

export interface ConfigMercadoPago {
  habilitado: boolean;
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
  /** true cuando había un valor cifrado que no se pudo descifrar. */
  errorCredenciales: boolean;
}

export interface DatosConfigMercadoPago {
  habilitado?: boolean;
  /** undefined = no tocar, null = borrar, string = guardar. */
  accessToken?: string | null;
  publicKey?: string | null;
  webhookSecret?: string | null;
}

function claveDeCifrado(): Buffer {
  const secreto =
    process.env.JWT_SECRET || 'dev-only-insecure-secret-cambiar-en-produccion';
  return createHash('sha256').update(`fenix:mercadopago:${secreto}`).digest();
}

/** Cifra un texto. Formato: v1:<iv>:<tag>:<contenido>, todo en base64url. */
export function cifrar(valor: string): string {
  if (!valor) return '';
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', claveDeCifrado(), iv);
  const contenido = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    contenido.toString('base64url'),
  ].join(':');
}

/** Descifra un valor. Los valores sin prefijo `v1:` se devuelven tal cual. */
export function descifrar(valor: string): string {
  if (!valor) return '';
  if (!valor.startsWith('v1:')) return valor;

  const [, ivB64, tagB64, contenidoB64] = valor.split(':');
  if (!ivB64 || !tagB64 || !contenidoB64) throw new Error('Formato cifrado inválido');

  const decipher = createDecipheriv(
    'aes-256-gcm',
    claveDeCifrado(),
    Buffer.from(ivB64, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plano = Buffer.concat([
    decipher.update(Buffer.from(contenidoB64, 'base64url')),
    decipher.final(),
  ]);
  return plano.toString('utf8');
}

function descifrarSeguro(valor: string | undefined): { valor: string; error: boolean } {
  if (!valor) return { valor: '', error: false };
  try {
    return { valor: descifrar(valor), error: false };
  } catch (err) {
    console.error('No se pudo descifrar una credencial de MercadoPago:', err);
    return { valor: '', error: true };
  }
}

async function leerFilas(): Promise<Map<string, string>> {
  const filas = await query<{ clave: string; valor: string }>(
    `SELECT clave, valor FROM configuracion_club
      WHERE clave IN (${CLAVES.map(() => '?').join(',')})`,
    [...CLAVES]
  );
  return new Map(filas.map((f) => [f.clave, f.valor]));
}

export async function leerConfigMercadoPago(): Promise<ConfigMercadoPago> {
  const filas = await leerFilas();
  const token = descifrarSeguro(filas.get('mp_access_token'));
  const secreto = descifrarSeguro(filas.get('mp_webhook_secret'));

  return {
    habilitado: filas.get('mp_habilitado') === '1',
    accessToken: token.valor,
    publicKey: filas.get('mp_public_key') ?? '',
    webhookSecret: secreto.valor,
    errorCredenciales: token.error || secreto.error,
  };
}

/**
 * ¿Se pueden iniciar cobros online ahora?
 *
 * Descifra la credencial a propósito: si el JWT_SECRET cambió y el token ya no
 * se puede leer, el portal tiene que ocultar el botón en vez de ofrecer un
 * pago que va a fallar al hacer clic.
 */
export async function mercadopagoHabilitado(): Promise<boolean> {
  try {
    const config = await leerConfigMercadoPago();
    return config.habilitado && !!config.accessToken && !config.errorCredenciales;
  } catch (err) {
    // Si la migración 15 todavía no corrió, el portal sigue funcionando sin
    // pago online en vez de romperse entero.
    console.warn('No se pudo leer la configuración de MercadoPago:', err);
    return false;
  }
}

async function guardarClave(clave: string, valor: string, descripcion: string) {
  await query(
    `INSERT INTO configuracion_club (clave, valor, descripcion)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), descripcion = VALUES(descripcion)`,
    [clave, valor, descripcion]
  );
}

/**
 * Guarda solo los campos enviados.
 *
 * Un string vacío se interpreta como "borrar": el formulario no manda el
 * campo si la persona no lo tocó, así que no hay forma de borrar una
 * credencial por accidente al dejar un input en blanco.
 */
export async function guardarConfigMercadoPago(datos: DatosConfigMercadoPago) {
  if (datos.habilitado !== undefined) {
    await guardarClave(
      'mp_habilitado',
      datos.habilitado ? '1' : '0',
      'Cobros online con MercadoPago habilitados (1) o pausados (0)'
    );
  }

  if (datos.accessToken !== undefined) {
    const valor = (datos.accessToken ?? '').trim();
    await guardarClave(
      'mp_access_token',
      valor ? cifrar(valor) : '',
      'Access Token de MercadoPago (cifrado por la aplicación)'
    );
  }

  if (datos.publicKey !== undefined) {
    await guardarClave(
      'mp_public_key',
      (datos.publicKey ?? '').trim(),
      'Public Key de MercadoPago'
    );
  }

  if (datos.webhookSecret !== undefined) {
    const valor = (datos.webhookSecret ?? '').trim();
    await guardarClave(
      'mp_webhook_secret',
      valor ? cifrar(valor) : '',
      'Secreto de firma de webhooks de MercadoPago (cifrado por la aplicación)'
    );
  }
}
