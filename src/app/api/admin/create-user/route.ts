import { NextRequest, NextResponse } from 'next/server';
import { queryOne, insert, uuid } from '@/lib/db';
import { requireModulo, hashPassword } from '@/lib/auth';
import {
  emailSchema, passwordSchema, dniSchema, nombreSchema, apellidoSchema,
  rolAdminSchema, firstError,
} from '@/lib/schemas';

// Alta de usuarios desde el panel del club. El admin sí puede crear cuentas
// de cualquier rol (a diferencia del registro público, que solo admite
// los dos roles de socio), pero el rol se valida contra la lista cerrada.

export async function POST(request: NextRequest) {
  try {
    // Solo quien puede administrar usuarios da de alta cuentas.
    const auth = await requireModulo('usuarios');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const {
      email: emailRaw, password: passwordRaw, nombre: nombreRaw, apellido: apellidoRaw,
      dni: dniRaw, cuil: cuilRaw, telefono = '', direccion = '',
      rol: rolRaw = 'socio_benefactor',
    } = body;

    const email = emailSchema.safeParse(emailRaw);
    const password = passwordSchema.safeParse(passwordRaw);
    const nombre = nombreSchema.safeParse(nombreRaw);
    const apellido = apellidoSchema.safeParse(apellidoRaw);
    const rol = rolAdminSchema.safeParse(rolRaw);

    if (!email.success) return NextResponse.json({ error: firstError(email.error) }, { status: 400 });
    if (!password.success) return NextResponse.json({ error: firstError(password.error) }, { status: 400 });
    if (!nombre.success) return NextResponse.json({ error: firstError(nombre.error) }, { status: 400 });
    if (!apellido.success) return NextResponse.json({ error: firstError(apellido.error) }, { status: 400 });
    if (!rol.success) return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });

    const emailVal = email.data;

    const emailExists = await queryOne('SELECT id FROM usuarios WHERE email = ?', [emailVal]);
    if (emailExists) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    // El DNI es NOT NULL UNIQUE en perfiles: si no se manda, se deriva del id
    // para no romper el alta.
    const dniPedido = dniSchema.safeParse(dniRaw);
    const dniFinal = dniPedido.success
      ? dniPedido.data
      : `P${uuid().replace(/-/g, '').slice(0, 12)}`;
    const dniExists = await queryOne('SELECT id FROM perfiles WHERE dni = ?', [dniFinal]);
    if (dniExists) {
      return NextResponse.json({ error: 'El DNI ya está registrado' }, { status: 409 });
    }

    const userId = uuid();
    // perfiles.id === usuarios.id (misma convención que el registro público).
    const hash = await hashPassword(password.data);

    // Alta desde el panel: el admin da la clave y entrega las credenciales en
    // persona, así que la cuenta nace verificada. Quien se registra por
    // /registro sí tiene que pasar por el email.
    await insert(
      'INSERT INTO usuarios (id, email, password_hash, rol, email_verificado) VALUES (?, ?, ?, ?, 1)',
      [userId, emailVal, hash, rol.data]
    );

    await insert(
      'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        userId, userId, rol.data, nombre.data, apellido.data, dniFinal,
        cuilRaw || null, emailVal, telefono, direccion,
      ]
    );

    // Un deportista necesita su fila en `deportistas` para que el portal y las
    // cuotas funcionen; un padre no.
    if (rol.data === 'socio_cadete') {
      await insert('INSERT INTO deportistas (id, perfil_id) VALUES (?, ?)', [uuid(), userId]);
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error('Create user error:', err);
    return NextResponse.json({ error: err.message || 'Error al crear el usuario' }, { status: 500 });
  }
}
