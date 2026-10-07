// Envío de emails vía Resend.
//
// Si RESEND_API_KEY no está configurado, el envío es un no-op: se registra
// en consola y NO lanza. Eso permite que la app funcione en dev y en el
// deploy actual sin key, en vez de romper el registro de usuarios.
//
// En producción hay que setear RESEND_API_KEY y EMAIL_FROM.

import { Resend } from 'resend';

const FROM = process.env.EMAIL_FROM || 'Fenix Roller Hockey <noreply@clubhockey.com.ar>';

let client: Resend | null = null;
function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export interface SendResult {
  sent: boolean;
  /** 'enviado' = entregado a Resend. 'sin-key' = no había API key. */
  motivo?: 'enviado' | 'sin-key' | 'error';
  error?: string;
}

/**
 * Plantilla de Resend, si es que hay una cargada.
 *
 * El HTML de cada correo vive en dos lugares a propósito: el archivo de
 * `emails/` (versionado, revisable) y el dashboard de Resend (editable por la
 * directiva sin deploy). El archivo es la fuente de la verdad para reproducir
 * o auditar; el dashboard es donde se toca.
 */
export interface Plantilla {
  /** ID de la plantilla en Resend. Si falta, se manda el HTML embebido. */
  id?: string;
  variables: Record<string, string>;
}

/**
 * Lee el ID de una plantilla del entorno.
 *
 * El fallback a `undefined` es lo que hace segura esta función: sin ID se usa
 * el HTML embebido, así que si nadie crea la plantilla —o si alguien la rompe
 * en el dashboard y hay que sacarla del medio— la app sigue mandando correo.
 *
 * Pasa esto con el enlace de verificación y el de recuperación de clave: son
 * lo único que activa una cuenta. Si el botón del correo se rompe, nadie se
 * registra y el club no sabe ni por qué.
 */
export function idPlantilla(nombre: string): string | undefined {
  return process.env[nombre]?.trim() || undefined;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  plantilla?: Plantilla;
}): Promise<SendResult> {
  const resend = getClient();
  if (!resend) {
    console.log(`📧 [email deshabilitado] to=${opts.to} subject="${opts.subject}"`);
    return { sent: false, motivo: 'sin-key' };
  }

  // Con plantilla cargada manda el diseño de Resend y NO se manda `subject` ni
  // `html`: esos campos pasan a estar dentro de la plantilla y mandarlos también
  // acá es un conflicto. El `text` tampoco: el SDK lo prohíbe explícitamente
  // cuando hay `template` (la versión con template declara `text?: undefined`).
  //
  // Lo que significa eso para la parte de texto plano: cuando hay plantilla,
  // la genera Resend a partir del HTML. Sin plantilla se manda `text`, que es
  // el que armamos acá y del que depende que un correo no llegue vacío.
  const cuerpo = opts.plantilla?.id
    ? ({
        from: FROM,
        to: opts.to,
        template: { id: opts.plantilla.id, variables: opts.plantilla.variables },
      } as const)
    : ({
        from: FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      } as const);

  try {
    const { error } = await resend.emails.send(cuerpo as Parameters<typeof resend.emails.send>[0]);
    if (error) {
      console.error('Resend error:', error);
      return { sent: false, motivo: 'error', error: error.message };
    }
    return { sent: true, motivo: 'enviado' };
  } catch (err: any) {
    console.error('Email send exception:', err);
    return { sent: false, motivo: 'error', error: err?.message || 'error desconocido' };
  }
}

/** Plantilla de verificación de email. */
export function verificacionEmail(opts: {
  nombre: string;
  link: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Verificá tu email - Fenix Roller Hockey';
  const text = `Hola ${opts.nombre}, verificá tu email ingresando a: ${opts.link}`;
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="color:#fff;font-size:24px;margin:0;">🏑 FENIX ROLLER HOCKEY</h1>
        </div>
        <div style="background:#1a1a1a;border-radius:16px;padding:32px;border:1px solid #333;">
          <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Verificá tu email</h2>
          <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.6;">
            Hola ${opts.nombre}, falta confirmar tu email para poder entrar al portal.
          </p>
          <a href="${opts.link}"
             style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;
                    padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">
            Verificar mi email
          </a>
          <p style="color:#666;font-size:12px;margin:24px 0 0;line-height:1.6;">
            Si el botón no funciona, copiá esta URL en tu navegador:<br>
            <span style="color:#888;word-break:break-all;">${opts.link}</span>
          </p>
          <p style="color:#555;font-size:11px;margin:16px 0 0;">
            Si no te registraste, ignorá este mensaje.
          </p>
        </div>
      </div>
    </body>
    </html>`;
  return { subject, html, text };
}

/**
 * Plantilla de recuperación de clave.
 *
 * El texto importa tanto como el diseño. Este correo es el que decide si
 * alguien hace clic en un link que no pidió. Por eso dice:
 *
 *  - que vence en una hora,
 *  - que funciona UNA sola vez,
 *  - que si nadie lo pidió no hay que hacer nada ni responder nada,
 *  - que el club nunca pide la clave por correo.
 *
 * La última es la que evita el ataque. Si alguien se hace pasar por el club
 * para pedir la clave, el correo no le pide ninguna clave: ni al socio ni al
 * club. El link abre una pantalla donde se ESCRIBE la nueva clave, no un
 * formulario donde se manda la vieja.
 */
export function recuperacionEmail(opts: {
  nombre: string;
  link: string;
  minutos: number;
}): { subject: string; html: string; text: string } {
  const subject = 'Cambiá tu clave - Fenix Roller Hockey';

  const text = [
    `Hola ${opts.nombre},`,
    '',
    'Pediste cambiar la clave de tu cuenta. Entrá a este link para escribir una nueva:',
    opts.link,
    '',
    `El link vence en ${opts.minutos} minutos y funciona una sola vez.`,
    '',
    'Si no lo pediste vos, no hagas nada: no pasa nada y no tenés que responder nada.',
    'Nadie del club te va a pedir tu clave por correo.',
  ].join('\n');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="color:#fff;font-size:24px;margin:0;">🏑 FENIX ROLLER HOCKEY</h1>
        </div>
        <div style="background:#1a1a1a;border-radius:16px;padding:32px;border:1px solid #333;">
          <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Cambiar tu clave</h2>
          <p style="color:#999;font-size:14px;margin:0 0 24px;line-height:1.6;">
            Hola ${opts.nombre}, pediste cambiar la clave de tu cuenta del club.
            Escribí una nueva y entrá con ella.
          </p>
          <a href="${opts.link}"
             style="display:inline-block;background:#DC2626;color:#fff;text-decoration:none;
                    padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">
            Escribir mi nueva clave
          </a>
          <div style="margin:24px 0 0;padding:16px;background:#111;border-radius:10px;border:1px solid #2a2a2a;">
            <p style="color:#bbb;font-size:13px;margin:0 0 8px;line-height:1.6;">
              <strong style="color:#fff;">El link vence en ${opts.minutos} minutos</strong> y
              funciona una sola vez.
            </p>
            <p style="color:#888;font-size:12px;margin:0;line-height:1.6;">
              Si no lo pediste vos, no hagas nada. No pasa nada y no tenés que
              responder nada. Nadie del club te va a pedir tu clave por
              correo, nunca.
            </p>
          </div>
          <p style="color:#666;font-size:12px;margin:24px 0 0;line-height:1.6;">
            Si el botón no funciona, copiá esta URL en tu navegador:<br>
            <span style="color:#888;word-break:break-all;">${opts.link}</span>
          </p>
        </div>
      </div>
    </body>
    </html>`;

  return { subject, html, text };
}

/**
 * Aviso de pago pendiente.
 *
 * PLANTILLA Y MENSAJE SEPARADOS A PROPÓSITO
 *
 * `mensaje` lo arma `lib/avisos.ts` con los montos ya resueltos. Acá solo se lo
 * viste. La razón es que el texto que se guarda en `avisos_familias.detalle` es
 * EXACTAMENTE el que salió: si el HTML se armara acá y el registro guardara otra
 * cosa, el club no podría mostrar después lo que realmente se le mandó a una
 * familia que pregunta.
 *
 * El `text` va junto porque algunos clientes de correo no renderizan HTML y,
 * sin él, la familia recibe un correo vacío.
 */
export function emailAviso(opts: {
  nombre: string;
  mensaje: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Club Fénix: tenés una cuota pendiente';

  const text = opts.mensaje;

  // El mensaje viene con saltos de línea, y en HTML hay que convertirlos en <br>
  // o el correo entero aparece en una sola línea.
  const parrafos = opts.mensaje
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `<p style="color:#d4d4d8;font-size:15px;line-height:1.6;margin:0 0 14px;">${escapar(l)}</p>`)
    .join('\n        ');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;margin-bottom:30px;">
          <h1 style="color:#fff;font-size:24px;margin:0;">FENIX ROLLER HOCKEY</h1>
        </div>

        <div style="background:#131316;border:1px solid #26262c;border-radius:12px;padding:28px;">
          ${parrafos}
        </div>

        <div style="text-align:center;margin-top:30px;">
          <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0;">
            Este correo te lo manda el club porque tenés algo pendiente.<br>
            Si ya lo pagaste, contestá este mensaje y lo registramos.
          </p>
        </div>
      </div>
    </body>
    </html>`;

  return { subject, html, text };
}

/**
 * Escapa lo que va dentro del HTML del correo.
 *
 * El texto lo arma el club, pero igual se escapa: si algún día una familia
 * se llama con un nombre que parece HTML, ese nombre viaja en el correo de todos
 * los que comparten el motivo. Cuesta cuatro líneas y evita que un dato se
 * en código.
 */
function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
