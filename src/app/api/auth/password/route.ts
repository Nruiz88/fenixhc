import { NextRequest, NextResponse } from 'next/server';
import { execute } from '@/lib/db';
import { requireAuth, hashPassword, setAuthCookie, createToken } from '@/lib/auth';

// Cambiar la contraseña del usuario autenticado
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { password } = await request.json();
    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    const hash = await hashPassword(password);
    await execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, auth.user.id]);

    // Renovar el token para mantener la sesión activa
    const token = createToken(auth.user);
    const response = NextResponse.json({ ok: true });
    setAuthCookie(response, token);
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar la contraseña' }, { status: 500 });
  }
}
