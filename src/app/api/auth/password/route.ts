import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { queryOne, execute } from '@/lib/db';
import { requireAuth, hashPassword, verifyPassword, setAuthCookie, createToken } from '@/lib/auth';
import { passwordSchema, firstError } from '@/lib/schemas';

// Cambiar la contraseña del usuario autenticado.
//
// Exige la contraseña ACTUAL: sin eso, cualquiera con un JWT robado o una
// sesión compartida en un equipo público podía cambiar la clave y quedarse
// con la cuenta (y echar al dueño). Reautenticar es la barrera.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data as any;
    const { currentPassword, password } = body ?? {};

    if (!currentPassword) {
      return NextResponse.json({ error: 'Ingresá tu contraseña actual' }, { status: 400 });
    }

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
    }

    const nueva = parsed.data;
    if (nueva === currentPassword) {
      return NextResponse.json({ error: 'La contraseña nueva debe ser distinta de la actual' }, { status: 400 });
    }

    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM usuarios WHERE id = ? LIMIT 1',
      [auth.user.id]
    );
    if (!user) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 });
    }

    // Mensaje genérico: no revelamos si la contraseña actual es la única
    // diferencia con algo adivinado.
    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 403 });
    }

    await execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [
      await hashPassword(nueva),
      auth.user.id,
    ]);

    // Se renueva el token para mantener la sesión abierta.
    const response = NextResponse.json({ ok: true });
    setAuthCookie(response, createToken(auth.user));
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar la contraseña' }, { status: 500 });
  }
}
