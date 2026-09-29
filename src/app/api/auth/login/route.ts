import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { verifyPassword, createToken, setAuthCookie } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { emailSchema } from '@/lib/schemas';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';

export async function POST(request: NextRequest) {
  try {
    // Un body que no es JSON válido (curl mal citado, proxy que lo parte, un
    // cliente roto) es un error del solicitante, no una falla del servidor.
    const leido = await leerJson<{ email?: string; password?: string }>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const { email, password } = leido.data;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) {
      return NextResponse.json({ error: 'Email o contraseña inválidos' }, { status: 401 });
    }
    const emailLimpio = parsedEmail.data;

    // Anti fuerza bruta: por IP y por cuenta
    const ip = clientIp(request);
    if (!rateLimit(`login:ip:${ip}`, 20, 60_000) || !rateLimit(`login:email:${emailLimpio.toLowerCase()}`, 5, 60_000)) {
      return NextResponse.json({ error: 'Demasiados intentos. Esperá un minuto.' }, { status: 429 });
    }

    const user = await queryOne(
      'SELECT id, email, password_hash, rol, email_verificado, verification_sent_at FROM usuarios WHERE email = ?',
      [emailLimpio]
    );

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Verificación obligatoria: la contraseña correcta no alcanza si el
    // email no fue confirmado. Se responde 403 para que el front pueda
    // ofrecer "reenviar verificación".
    if (!user.email_verificado) {
      return NextResponse.json(
        {
          error: 'Verificá tu email para poder entrar',
          code: 'EMAIL_NO_VERIFICADO',
          verificationEnviado: user.verification_sent_at,
        },
        { status: 403 }
      );
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
