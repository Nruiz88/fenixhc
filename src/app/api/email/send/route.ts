import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { query, execute } from '@/lib/db';
import { requireModulo } from '@/lib/auth';
import { sendEmail } from '@/lib/email';
import { rateLimit } from '@/lib/rateLimit';

// Email templates
const TEMPLATES: Record<string, { getSubject: (data: any) => string; html: (data: any) => string }> = {
  comunicado: {
    getSubject: (data: any) => `Fenix Roller Hockey - ${data.titulo}`,
    html: (data: any) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;">
        <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#fff;font-size:24px;margin:0;">🏑 FENIX ROLLER HOCKEY</h1>
          </div>
          <div style="background:#1a1a1a;border-radius:16px;padding:32px;border:1px solid #333;">
            <div style="display:inline-block;padding:4px 12px;border-radius:20px;background:#DC2626;color:#fff;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:16px;">
              ${data.tipo || 'General'}
            </div>
            <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">${data.titulo}</h2>
            ${data.resumen ? `<p style="color:#999;font-size:14px;margin:0 0 16px;">${data.resumen}</p>` : ''}
            <div style="border-top:1px solid #333;padding-top:16px;margin-top:16px;">
              <p style="color:#ccc;font-size:14px;line-height:1.6;white-space:pre-wrap;">${data.contenido || ''}</p>
            </div>
          </div>
          <p style="color:#666;font-size:12px;text-align:center;margin-top:24px;">
            Este email fue enviado por Fenix Roller Hockey
          </p>
        </div>
      </body>
      </html>
    `,
  },
  cuota_pendiente: {
    getSubject: () => 'Fenix Roller Hockey - Cuota pendiente',
    html: (data: any) => `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin:0;padding:0;background:#0A0A0A;font-family:system-ui,-apple-system,sans-serif;">
        <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
          <div style="text-align:center;margin-bottom:30px;">
            <h1 style="color:#fff;font-size:24px;margin:0;">🏑 FENIX ROLLER HOCKEY</h1>
          </div>
          <div style="background:#1a1a1a;border-radius:16px;padding:32px;border:1px solid #333;">
            <h2 style="color:#fff;font-size:20px;margin:0 0 12px;">Cuota Pendiente</h2>
            <p style="color:#999;font-size:14px;margin:0 0 16px;">Hola ${data.nombre}, tenés una cuota pendiente de pago.</p>
            <div style="background:#2a2a2a;border-radius:12px;padding:20px;margin:16px 0;">
              <p style="color:#fff;font-size:28px;font-weight:bold;margin:0;">$${data.monto?.toLocaleString()}</p>
              <p style="color:#999;font-size:13px;margin:4px 0 0;">Mes: ${data.mes} ${data.anio}</p>
            </div>
            <p style="color:#999;font-size:13px;">Recordá subir tu comprobante de pago desde tu panel.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
};

/**
 * Escapa texto para interpolarlo en el HTML de un email.
 *
 * Sin esto, un comunicado con `<a href="...">` o `<img onerror=...>` se
 * inyecta tal cual en el mail. En el navegador de la página el React lo
 * escapa solo, pero acá el HTML se arma con template strings: lo que se
 * escribe en la pantalla llega crudo al cliente de correo. Con eso, un
 * secretario (o una sesión comprometida) puede mandar phishing con el
 * dominio del club.
 */
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Escapa en profundidad los valores que la plantilla va a interpolar. */
function escaparObjeto(o: any): any {
  if (typeof o === 'string') return esc(o);
  if (Array.isArray(o)) return o.map(escaparObjeto);
  if (o && typeof o === 'object') {
    const salida: Record<string, any> = {};
    for (const [k, v] of Object.entries(o)) salida[k] = escaparObjeto(v);
    return salida;
  }
  return o;
}

// Tope de destinatarios por envío. El club tiene unas decenas de socios; un
// límite de 500 deja margen de sobra y evita que un endpoint quede como
// relay para spam.
const MAX_DESTINATARIOS = 500;

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModulo('comunicados');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Un envío es una acción cara y visible para todos. Sin este límite, un
    // rol con permiso de comunicados puede mandar cientos de lotes por hora
    // y quemarle la cuota de Resend y la reputación del dominio.
    if (!rateLimit(`email:${auth.user.id}`, 10, 3_600_000)) {
      return NextResponse.json(
        { error: 'Alcanzaste el límite de envíos por hora. Probá más tarde.' },
        { status: 429 }
      );
    }

    const leido = await leerJson<{ tipo?: string; destinatarios?: string | string[]; data?: any }>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const { tipo, destinatarios, data } = leido.data;

    if (!tipo || !TEMPLATES[tipo]) {
      return NextResponse.json({ error: 'Tipo de email inválido' }, { status: 400 });
    }

    const template = TEMPLATES[tipo];

    // Buscar emails de destinatarios
    let emails: string[] = [];

    if (destinatarios === 'todos') {
      const rows = await query<{ correo: string }>('SELECT correo FROM perfiles WHERE correo IS NOT NULL');
      emails = rows.map((r) => r.correo).filter(Boolean);
    } else if (destinatarios === 'benefactores') {
      const rows = await query<{ correo: string }>(
        "SELECT correo FROM perfiles WHERE rol = 'socio_benefactor' AND correo IS NOT NULL"
      );
      emails = rows.map((r) => r.correo).filter(Boolean);
    } else if (destinatarios === 'cadetes') {
      const rows = await query<{ correo: string }>(
        "SELECT correo FROM perfiles WHERE rol = 'socio_cadete' AND correo IS NOT NULL"
      );
      emails = rows.map((r) => r.correo).filter(Boolean);
    } else if (Array.isArray(destinatarios)) {
      // Lista explícita: se valida cada dirección y se limita la cantidad.
      // Antes se aceptaba tal cual, lo que convertía el endpoint en un relay
      // de spam con el dominio del club.
      emails = destinatarios.filter((d) => typeof d === 'string' && EMAIL_RE.test(d.trim())).map((d) => d.trim());
    }

    if (emails.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No hay destinatarios válidos' });
    }

    if (emails.length > MAX_DESTINATARIOS) {
      return NextResponse.json(
        { error: `Máximo ${MAX_DESTINATARIOS} destinatarios por envío` },
        { status: 400 }
      );
    }

    // Se eliminan duplicados: la misma dirección dos veces en el mismo envío
    // hace que Resend lo rechace o que la persona reciba el mail dos veces.
    emails = [...new Set(emails)];

    // Se escapan los DATOS, no la plantilla. Escapar la plantilla entera
    // convertiría sus propios <div> en texto y el mail llegaría roto; lo que
    // hay que neutralize es lo que viene del usuario.
    const datos = escaparObjeto(data);
    const subject = template.getSubject(datos).slice(0, 250);
    const html = template.html(datos);

    // Envío real. Si no hay RESEND_API_KEY configurado, sendEmail() es un
    // no-op y lo loguea (ver lib/email.ts).
    let enviados = 0;
    const fallos: string[] = [];
    for (const to of emails) {
      const r = await sendEmail({ to, subject, html });
      if (r.sent) enviados++;
      else fallos.push(`${to}: ${r.motivo ?? 'error'}${r.error ? ` (${r.error})` : ''}`);
    }
    if (fallos.length > 0) {
      console.warn(`📧 Fallaron ${fallos.length}/${emails.length} envíos:`, fallos.slice(0, 5));
    }

    // Guardar registro del email enviado
    await execute(
      `INSERT INTO notificaciones (id, titulo, mensaje, tipo, destinatario_rol, enviada_email, created_by) VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
      [
        subject,
        data?.resumen || data?.contenido || '',
        tipo === 'cuota_pendiente' ? 'pago' : 'general',
        destinatarios === 'benefactores' ? 'socio_benefactor' : 'todos',
        enviados > 0 ? 1 : 0,
        auth.user.id,
      ]
    );

    return NextResponse.json({
      ok: true,
      sent: enviados,
      destinatarios: emails.length,
      subject,
      message: `Email enviado a ${emails.length} destinatarios`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
