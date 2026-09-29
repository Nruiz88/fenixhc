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

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendResult> {
  const resend = getClient();
  if (!resend) {
    console.log(`📧 [email deshabilitado] to=${opts.to} subject="${opts.subject}"`);
    return { sent: false, motivo: 'sin-key' };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.text ? { text: opts.text } : {}),
    });
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
