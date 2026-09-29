import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    //requiere sesión: el propietario de la suscripción es siempre el
    // usuario autenticado, nunca un id enviado por el cliente.
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    // La columna es usuario_id (ver mariadb/01_schema.sql).
    await execute(
      `INSERT INTO push_subscriptions (id, usuario_id, endpoint, p256dh, auth, activa)
       VALUES (UUID(), ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE usuario_id = VALUES(usuario_id), p256dh = VALUES(p256dh), auth = VALUES(auth), activa = 1`,
      [
        user.id,
        subscription.endpoint,
        subscription.keys?.p256dh || '',
        subscription.keys?.auth || '',
      ]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 });
    }

    // Acotado al usuario: no se puede dar de baja la suscripción de otro.
    await execute(
      'UPDATE push_subscriptions SET activa = 0 WHERE endpoint = ? AND usuario_id = ?',
      [endpoint, user.id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
