import { NextRequest, NextResponse } from 'next/server';
import { queryOne, insert, uuid } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { generarYEnviarVerificacion } from '@/lib/verification';
import { getBaseUrl } from '@/lib/url';

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`register:ip:${clientIp(request)}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: 'Demasiados registros desde esta IP. Intentá en unos minutos.' }, { status: 429 });
    }

    const body = await request.json();
    const {
      rol: rolSolicitado = 'padre',
      nombre, apellido, dni, cuil, email, password,
      telefono = '', direccion = '',
      // Optional child registration
      hijo_nombre, hijo_apellido, hijo_dni, hijo_email, hijo_password,
    } = body;

    // El registro es público: nunca se acepta 'admin' desde el body, solo
    // 'padre' o 'deportista'. Sin esto cualquiera se auto-asignaba admin.
    if (!['padre', 'deportista'].includes(rolSolicitado)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }
    const rol = rolSolicitado;

    // Validation
    if (!nombre || !apellido || !dni || !email || !password) {
      return NextResponse.json({ error: 'Campos obligatorios faltantes' }, { status: 400 });
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }

    // Check email exists
    const existing = await queryOne('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    // Check DNI exists
    const existingDni = await queryOne('SELECT id FROM perfiles WHERE dni = ?', [dni]);
    if (existingDni) {
      return NextResponse.json({ error: 'El DNI ya está registrado' }, { status: 409 });
    }

    // Todo se valida ANTES de escribir: si el alta del hijo falla, no debe
    // quedar un padre huérfano ya insertado.
    const registraHijo = rol === 'padre' && !!(hijo_nombre && hijo_apellido && hijo_dni && hijo_email && hijo_password);
    if (registraHijo) {
      if (hijo_password.length < 6) {
        return NextResponse.json({ error: 'La contraseña del hijo debe tener al menos 6 caracteres' }, { status: 400 });
      }
      if (typeof hijo_email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hijo_email)) {
        return NextResponse.json({ error: 'Email del hijo inválido' }, { status: 400 });
      }
      if (String(hijo_email).toLowerCase() === String(email).toLowerCase()) {
        return NextResponse.json({ error: 'El email del hijo debe ser distinto al del padre' }, { status: 400 });
      }
      const hijoExiste = await queryOne('SELECT id FROM usuarios WHERE email = ?', [hijo_email]);
      if (hijoExiste) {
        return NextResponse.json({ error: 'El email del hijo ya está registrado' }, { status: 409 });
      }
      const hijoDniExiste = await queryOne('SELECT id FROM perfiles WHERE dni = ?', [hijo_dni]);
      if (hijoDniExiste) {
        return NextResponse.json({ error: 'El DNI del hijo ya está registrado' }, { status: 409 });
      }
    }

    const hash = await hashPassword(password);
    const userId = uuid();
    // El perfil comparte el mismo id que el usuario para mantener
    // la compatibilidad con las queries existentes (perfiles.id == usuario id)
    const perfilId = userId;

    // Create usuario
    await insert(
      'INSERT INTO usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, ?)',
      [userId, email, hash, rol]
    );

    // Create perfil
    await insert(
      'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [perfilId, userId, rol, nombre, apellido, dni, cuil || null, email, telefono, direccion]
    );

    // If padre and child data provided
    let childId = null;
    if (registraHijo) {
      const hijoUserId = uuid();
      const hijoPerfilId = hijoUserId;
      const hijoHash = await hashPassword(hijo_password);

      await insert(
        'INSERT INTO usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, ?)',
        [hijoUserId, hijo_email, hijoHash, 'deportista']
      );

      await insert(
        'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, correo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [hijoPerfilId, hijoUserId, 'deportista', hijo_nombre, hijo_apellido, hijo_dni, hijo_email]
      );

      await insert(
        'INSERT INTO deportistas (id, perfil_id) VALUES (?, ?)',
        [uuid(), hijoPerfilId]
      );

      // Link parent-child
      await insert(
        'INSERT INTO familias (id, padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES (?, ?, ?, ?)',
        [uuid(), perfilId, hijoPerfilId, 'padre']
      );

      // El hijo también tiene que verificar su email para poder entrar.
      await generarYEnviarVerificacion(
        hijoUserId, hijo_email, hijo_nombre, getBaseUrl(request)
      );

      childId = hijoPerfilId;
    }

    // Verificación de email: se manda el link pero NO se abre sesión.
    // El usuario tiene que confirmar su email antes de poder entrar.
    const base = getBaseUrl(request);
    const { ok: emailEnviado, devToken } = await generarYEnviarVerificacion(
      userId, email, nombre, base
    );

    // Si el envío falló de verdad (no es lo mismo que "no hay API key"), la
    // cuenta queda creada pero bloqueada: se loguea para que el club lo
    // resuelva con /api/auth/resend-verification o desde el panel.
    if (!emailEnviado && !devToken) {
      console.error(`No se pudo enviar la verificación a ${email} (usuario ${userId})`);
    }

    const response = NextResponse.json({
      success: true,
      userId,
      childId,
      requiresVerification: true,
      // Solo si RESEND_API_KEY no está configurado (dev): se muestra el link
      // en pantalla para poder completar la verificación sin email.
      devVerificationUrl: devToken ? `${base}/verificar?token=${devToken}` : undefined,
    });
    return response;
  } catch (err: any) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 });
  }
}
