import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const perfil = await queryOne(
      'SELECT id, nombre, apellido, dni, cuil, telefono, direccion, foto_url FROM perfiles WHERE usuario_id = ?',
      [user.id]
    );

    return NextResponse.json({
      user: {
        ...user,
        perfil,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ user: null });
  }
}
