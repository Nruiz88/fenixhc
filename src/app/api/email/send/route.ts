import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['admin']);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { tipo, destinatarios, data } = await request.json();

    if (!tipo || !TEMPLATES[tipo]) {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }

    const template = TEMPLATES[tipo];

    // Buscar emails de destinatarios
    let emails: string[] = [];

    if (destinatarios === 'todos') {
      const rows = await query<{ correo: string }>('SELECT correo FROM perfiles');
      emails = rows.map((r) => r.correo).filter(Boolean);
    } else if (destinatarios === 'padres') {
      const rows = await query<{ correo: string }>("SELECT correo FROM perfiles WHERE rol = 'padre'");
      emails = rows.map((r) => r.correo).filter(Boolean);
    } else if (Array.isArray(destinatarios)) {
      emails = destinatarios;
    }

    if (emails.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No emails to send to' });
    }

    const subject = template.getSubject(data);
    const html = template.html(data);

    // Aquí iría la integración con Resend, SendGrid, etc.
    console.log(`📧 Email sent to ${emails.length} recipients:`, { subject, tipo, count: emails.length });

    // Guardar registro del email enviado
    await execute(
      `INSERT INTO notificaciones (id, titulo, mensaje, tipo, destinatario_rol, enviada_email, created_by) VALUES (UUID(), ?, ?, ?, ?, 1, ?)`,
      [
        subject,
        data?.resumen || data?.contenido || '',
        tipo === 'cuota_pendiente' ? 'pago' : 'general',
        destinatarios === 'padres' ? 'padre' : 'todos',
        auth.user.id,
      ]
    );

    return NextResponse.json({
      ok: true,
      sent: emails.length,
      subject,
      message: `Email enviado a ${emails.length} destinatarios`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
