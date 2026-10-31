import { createHmac, timingSafeEqual } from 'node:crypto';

// Cliente mínimo de MercadoPago (Checkout Pro).
//
// No se usa el SDK oficial a propósito: lo único que necesitamos son tres
// llamadas REST y la validación de la firma del webhook. Agregar una
// dependencia entera para eso suma superficie de actualización y hace más
// difícil auditar qué se manda realmente a MercadoPago.
//
// Este archivo corre SOLO en el servidor: usa `node:crypto` y recibe el
// Access Token. Nunca debe importarse desde un componente de cliente.

const API = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15_000;

export interface PagoMercadoPago {
  id: number | string;
  status: string;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount: number;
  currency_id?: string | null;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  date_approved?: string | null;
  date_created?: string | null;
}

export interface PreferenciaMercadoPago {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
}

export interface ItemPreferencia {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
  currency_id: string;
}

export interface DatosPreferencia {
  items: ItemPreferencia[];
  payer: { name: string; surname: string; email: string };
  external_reference: string;
  notification_url: string;
  back_urls: { success: string; failure: string; pending: string };
  auto_return?: 'approved';
  statement_descriptor?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Origen público de la app.
 *
 * `APP_URL` manda porque detrás de Traefik/Coolify el origen del request
 * puede ser el host interno. El fallback sirve para desarrollo local.
 */
export function origenPublico(request?: Request): string {
  const configurado = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (configurado) return configurado;
  if (request) return new URL(request.url).origin;
  return '';
}

export function urlWebhook(request?: Request): string {
  const origen = origenPublico(request);
  return origen ? `${origen}/api/pagos/mercadopago/webhook` : '/api/pagos/mercadopago/webhook';
}

async function pedir<T>(ruta: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    // Sin timeout, una caída de MercadoPago deja la request colgada hasta que
    // el proxy la corte. 15 s es más que suficiente para su API.
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  });

  const texto = await res.text();
  let json: { message?: string; error?: string } | null = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* respuesta no JSON */ }

  if (!res.ok) {
    const detalle =
      json?.message ||
      json?.error ||
      `MercadoPago respondió ${res.status}`;
    const error = new Error(String(detalle)) as Error & { status?: number };
    // El status se conserva para que el webhook distinga "este pago no
    // existe" (no reintentar) de una caída temporal (sí reintentar).
    error.status = res.status;
    throw error;
  }

  return json as T;
}

/** Crea una preferencia de Checkout Pro. */
export async function crearPreferencia(
  accessToken: string,
  datos: DatosPreferencia
): Promise<PreferenciaMercadoPago> {
  return pedir<PreferenciaMercadoPago>('/checkout/preferences', accessToken, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

/** Trae el pago real desde MercadoPago. El webhook es solo una señal. */
export async function obtenerPago(
  accessToken: string,
  pagoId: string
): Promise<PagoMercadoPago> {
  if (!/^[A-Za-z0-9_-]+$/.test(pagoId)) {
    throw new Error('Identificador de pago inválido');
  }
  return pedir<PagoMercadoPago>(`/v1/payments/${encodeURIComponent(pagoId)}`, accessToken);
}

/**
 * Punto de entrada para el checkout según el tipo de credencial.
 *
 * Con credenciales de prueba MercadoPago devuelve `sandbox_init_point`; con
 * producción, `init_point`. Usar el de producción con un token TEST manda a
 * la persona a un checkout que no acepta ese token.
 */
export function puntoDeInicio(
  preferencia: PreferenciaMercadoPago,
  accessToken: string
): string {
  const esPrueba = accessToken.trim().toUpperCase().startsWith('TEST-');
  if (esPrueba) return preferencia.sandbox_init_point || preferencia.init_point;
  return preferencia.init_point;
}

interface FirmaWebhook {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}

/**
 * Valida la firma `x-signature` del webhook.
 *
 * El manifiesto que firma MercadoPago es:
 *
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * `data.id` sale del query param (no del body) y se pasa a minúsculas cuando
 * es alfanumérico. Si falta `x-request-id`, ese par se omite: MercadoPago no
 * lo incluye en el manifiesto.
 *
 * Sin secreto configurado devuelve `true`: la autenticidad real la da la
 * consulta del pago a la API con nuestro Access Token. El secreto es una
 * capa extra para que ni siquiera se dispare esa consulta con un POST falso.
 */
export function firmaWebhookValida({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: FirmaWebhook): boolean {
  if (!secret) return true;
  if (!xSignature || !dataId) return false;

  const partes = new Map<string, string>();
  for (const parte of xSignature.split(',')) {
    const [clave, ...resto] = parte.split('=');
    if (!clave || resto.length === 0) continue;
    partes.set(clave.trim(), resto.join('=').trim());
  }

  const ts = partes.get('ts');
  const v1 = partes.get('v1');
  if (!ts || !v1) return false;

  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifiesto =
    `id:${id};` +
    (xRequestId ? `request-id:${xRequestId};` : '') +
    `ts:${ts};`;

  const esperado = createHmac('sha256', secret).update(manifiesto).digest('hex');
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(v1, 'utf8');

  // timingSafeEqual exige el mismo largo; comparar antes no filtra nada útil.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Suma de importes con redondeo a centavos.
 *
 * Se usa para comparar el total de la preferencia contra lo que informa
 * MercadoPago. Sin redondear, un total de 78750.00000000001 nunca coincidiría
 * con los 78750 que devuelve la API.
 */
export function redondearImporte(valor: number): number {
  return Math.round((Number(valor) || 0) * 100) / 100;
}
