import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    // Anti fuerza bruta: por IP y por cuenta
    const ip = clientIp(request);
    if (!rateLimit(`login:ip:${ip}`, 20, 60_000) || !rateLimit(`login:email:${String(email).toLowerCase()}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiados intentos. Esperá un minuto.' }, { status: 429 });
    }

    const user = await queryOne(
      'SELECT id, email, password_hash, rol FROM usuarios WHERE email = ?',
      [email]
    );

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Get profile info
    const perfil = await queryOne(
      'SELECT nombre, apellido FROM perfiles WHERE usuario_id = ?',
      [user.id]
    );

    const token = createToken({
      id: user.id,
      rol: user.rol,
      nombre: perfil?.nombre || '',
      apellido: perfil?.apellido || '',
      email: user.email,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        rol: user.rol,
        nombre: perfil?.nombre,
        apellido: perfil?.apellido,
        email: user.email,
      },
    });

    setAuthCookie(response, token);
    return response;
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
