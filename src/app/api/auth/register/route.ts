import { NextRequest, NextResponse } from 'next/server';
import { queryOne, insert, uuid } from '@/lib/db';
import { hashPassword, createToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      rol = 'padre',
      nombre, apellido, dni, cuil, email, password,
      telefono = '', direccion = '',
      // Optional child registration
      hijo_nombre, hijo_apellido, hijo_dni, hijo_email, hijo_password,
    } = body;

    // Validation
    if (!nombre || !apellido || !dni || !email || !password) {
      return NextResponse.json({ error: 'Campos obligatorios faltantes' }, { status: 400 });
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
    if (rol === 'padre' && hijo_nombre && hijo_apellido && hijo_dni && hijo_email && hijo_password) {
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

      childId = hijoPerfilId;
    }

    const token = createToken({ id: userId, rol, nombre, apellido, email });

    const response = NextResponse.json({ success: true, userId, childId });
    setAuthCookie(response, token);
    return response;
  } catch (err: any) {
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 });
  }
}
