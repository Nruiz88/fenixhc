import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const { subscription, userId } = await request.json();

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    await execute(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, activa)
       VALUES (UUID(), ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), activa = 1`,
      [
        userId || user?.id || null,
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
    const { endpoint } = await request.json();

    await execute('UPDATE push_subscriptions SET activa = 0 WHERE endpoint = ?', [endpoint]);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
