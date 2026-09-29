import { NextRequest, NextResponse } from 'next/server';
import { queryOne, insert, uuid } from '@/lib/db';
import { requireAuth, hashPassword } from '@/lib/auth';

// Alta de usuarios desde el panel del club. El admin sí puede crear cuentas
// de cualquier rol (a diferencia del registro público, que solo admite
// padre/deportista), pero el rol se valida contra la lista cerrada.
const ROLES_VALIDOS = ['admin', 'padre', 'deportista'];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(['admin']);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      email, password, nombre, apellido,
      dni, cuil, telefono = '', direccion = '',
      rol = 'padre',
    } = body;

    if (!email || !password || !nombre || !apellido) {
      return NextResponse.json({ error: 'Email, contraseña, nombre y apellido son obligatorios' }, { status: 400 });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }

    const emailExists = await queryOne('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (emailExists) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    // El DNI es NOT NULL UNIQUE en perfiles: si no se manda, se deriva del id
    // para no romper el alta.
    const dniFinal = dni && String(dni).trim() ? String(dni).trim() : `P${uuid().replace(/-/g, '').slice(0, 12)}`;
    const dniExists = await queryOne('SELECT id FROM perfiles WHERE dni = ?', [dniFinal]);
    if (dniExists) {
      return NextResponse.json({ error: 'El DNI ya está registrado' }, { status: 409 });
    }

    const userId = uuid();
    // perfiles.id === usuarios.id (misma convención que el registro público).
    const hash = await hashPassword(password);

    // Alta desde el panel: el admin da la clave y entrega las credenciales en
    // persona, así que la cuenta nace verificada. Quien se registra por
    // /registro sí tiene que pasar por el email.
    await insert(
      'INSERT INTO usuarios (id, email, password_hash, rol, email_verificado) VALUES (?, ?, ?, ?, 1)',
      [userId, email, hash, rol]
    );

    await insert(
      'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, userId, rol, nombre, apellido, dniFinal, cuil || null, email, telefono, direccion]
    );

    // Un deportista necesita su fila en `deportistas` para que el portal y las
    // cuotas funcionen; un padre no.
    if (rol === 'deportista') {
      await insert('INSERT INTO deportistas (id, perfil_id) VALUES (?, ?)', [uuid(), userId]);
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: err.message || 'Error al crear el usuario' }, { status: 500 });
  }
}
