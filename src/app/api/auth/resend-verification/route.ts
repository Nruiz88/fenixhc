import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { queryOne, query } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { reenviarVerificacion } from '@/lib/verification';
import { getBaseUrl } from '@/lib/url';
import { emailSchema } from '@/lib/schemas';

// Respuesta idéntica exista o no la cuenta: evita enumerar qué emails están
// registrados y no revela si la contraseña falló.
const GENERICO = 'Si la cuenta existe y no está verificada, te enviamos un nuevo enlace.';

// Reenvía el email de verificación.
//
// Exige email + contraseña: si no, cualquiera podría generar emails a
// cualquier dirección usando este endpoint (abuso deresh / spam y permitir
// enumerar qué emails existen en el sistema).
export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`resend-verif:ip:${clientIp(request)}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: 'Demasiados reenvíos. Esperá unos minutos.' }, { status: 429 });
    }

    const leido = await leerJson<{ email?: string; password?: string }>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const { email: emailRaw, password } = leido.data;

    if (!emailRaw || !password) {
      return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
    }

    const emailParsed = emailSchema.safeParse(emailRaw);
    if (!emailParsed.success) {
      // Mismo mensaje que el caso "no existe": no revelamos qué emails están
      // registrados.
      return NextResponse.json({ ok: true, message: GENERICO });
    }
    const email = emailParsed.data;

    const user = await queryOne(
      'SELECT id, password_hash, email_verificado FROM usuarios WHERE email = ?',
      [email]
    );
    // Mismo mensaje para email inexistente y contraseña incorrecta: no
    // revelamos qué emails están registrados.
    if (!user) {
      return NextResponse.json({ ok: true, message: GENERICO });
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ ok: true, message: GENERICO });
    }

    if (user.email_verificado) {
      return NextResponse.json({ ok: true, message: 'Esta cuenta ya está verificada.' });
    }

    const perfil = await query<{ nombre: string }>(
      'SELECT nombre FROM perfiles WHERE usuario_id = ? LIMIT 1',
      [user.id]
    );
    const nombre = perfil[0]?.nombre || 'socio';
    const { devToken } = await reenviarVerificacion(user.id, email, nombre, getBaseUrl(request));

    return NextResponse.json({
      ok: true,
      message: GENERICO,
      // Solo en dev (sin RESEND_API_KEY), para poder completar el flujo.
      devVerificationUrl: devToken ? `${getBaseUrl(request)}/verificar?token=${devToken}` : undefined,
    });
  } catch (err: any) {
    console.error('Resend verification error:', err);
    return NextResponse.json({ error: 'Error al reenviar la verificación' }, { status: 500 });
  }
}
