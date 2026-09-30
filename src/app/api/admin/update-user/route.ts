import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute, insert, uuid } from '@/lib/db';
import { requireModulo, hashPassword } from '@/lib/auth';
import { reenviarVerificacion } from '@/lib/verification';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { ROL_LABEL, type Rol } from '@/lib/roles';
import {
  emailSchema, passwordSchema, dniSchema, nombreSchema, apellidoSchema,
  rolAdminSchema, firstError,
} from '@/lib/schemas';

// Edición de usuarios y cambio de rol desde el panel.
//
// Va en un endpoint propio y no en el genérico de queries por tres motivos:
//
//  1) El rol vive en DOS columnas (usuarios.rol y perfiles.rol). Si se
//     actualiza una sola, el login usa el de usuarios y el panel muestra el
//     de perfiles, y quedan mostrando cosas distintas sin que nada falle.
//
//  2) Hay reglas que no se pueden expresar como un UPDATE: no puede quedar
//     el club sin ningún admin, y nadie puede quitarse su propio admin.
//
//  3) La contraseña se hashea. El endpoint genérico escribe texto plano y su
//     whitelist ni siquiera incluye `usuarios`, pero depender de eso es
//     fragile: si alguien la agrega, hay contraseñas en claro en la base.

const PERMITIDOS = new Set<string>([
  'nombre', 'apellido', 'dni', 'cuil', 'telefono', 'direccion',
]);

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireModulo('usuarios');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson<Record<string, unknown>>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data;

    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) {
      return NextResponse.json({ error: 'Falta el usuario a editar' }, { status: 400 });
    }

    const usuario = await queryOne<{ id: string; email: string; rol: string; email_verificado: number }>(
      'SELECT id, email, rol, email_verificado FROM usuarios WHERE id = ?',
      [id]
    );
    if (!usuario) {
      return NextResponse.json({ error: 'El usuario no existe' }, { status: 404 });
    }

    const perfil = await queryOne<{ id: string; dni: string; nombre: string; apellido: string }>(
      'SELECT id, dni, nombre, apellido FROM perfiles WHERE usuario_id = ?',
      [id]
    );
    if (!perfil) {
      return NextResponse.json({ error: 'El usuario no tiene ficha de perfil' }, { status: 404 });
    }
    const perfilActual = perfil;

    // --- Rol -------------------------------------------------------------
    let rolNuevo: string = usuario.rol;

    if (body.rol !== undefined) {
      const parsed = rolAdminSchema.safeParse(body.rol);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
      }
      rolNuevo = parsed.data;

      if (rolNuevo !== usuario.rol) {
        // Nadie se quita su propio admin. Sin esto, un admin abre su ficha,
        // se degrada a vocal por error y el club puede quedar sin nadie que
        // administre los usuarios. Que otro admin lo haga si hace falta.
        if (usuario.rol === 'admin' && id === auth.user.id) {
          return NextResponse.json(
            { error: 'No podés cambiar tu propio rol. Pedile a otro administrador que lo haga.' },
            { status: 400 }
          );
        }

        // Tiene que quedar al menos un admin en el club.
        if (usuario.rol === 'admin') {
          const [otros] = await query<{ c: number }>(
            "SELECT COUNT(*) AS c FROM usuarios WHERE rol = 'admin' AND id != ?",
            [id]
          );
          if (Number(otros?.c ?? 0) === 0) {
            return NextResponse.json(
              { error: 'No se puede dejar el club sin administradores. Creá otro admin primero.' },
              { status: 400 }
            );
          }
        }
      }
    }

    // --- Email -----------------------------------------------------------
    let emailNuevo = usuario.email;

    if (body.email !== undefined && body.email !== usuario.email) {
      const parsed = emailSchema.safeParse(body.email);
      if (!parsed.success) {
        return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
      }
      emailNuevo = parsed.data;

      const ocupado = await queryOne<{ id: string }>(
        'SELECT id FROM usuarios WHERE email = ? AND id != ?',
        [emailNuevo, id]
      );
      if (ocupado) {
        return NextResponse.json({ error: 'Ese email ya está en uso por otra cuenta' }, { status: 409 });
      }
    }

    // --- Contraseña ------------------------------------------------------
    let hashNuevo: string | null = null;

    if (body.password) {
      const parsed = passwordSchema.safeParse(body.password);
      if (!parsed.success) {
        return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
      }
      hashNuevo = await hashPassword(parsed.data);
    }

    // --- Datos de perfil -------------------------------------------------
    const cambios: Record<string, unknown> = {};

    for (const campo of PERMITIDOS) {
      if (body[campo] === undefined) continue;

      if (campo === 'dni') {
        const parsed = dniSchema.safeParse(body.dni);
        if (!parsed.success) {
          return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
        }
        // El DNI es UNIQUE: puede estar tomado por otra ficha.
        const ocupado = await queryOne<{ id: string }>(
          'SELECT id FROM perfiles WHERE dni = ? AND id != ?',
          [parsed.data, perfil.id]
        );
        if (ocupado) {
          return NextResponse.json({ error: 'Ese DNI ya está registrado en otra ficha' }, { status: 409 });
        }
        cambios.dni = parsed.data;
        continue;
      }

      if (campo === 'nombre' || campo === 'apellido') {
        const parsed = campo === 'nombre' ? nombreSchema.safeParse(body.nombre) : apellidoSchema.safeParse(body.apellido);
        if (!parsed.success) {
          return NextResponse.json({ error: firstError(parsed.error) }, { status: 400 });
        }
        cambios[campo] = parsed.data;
        continue;
      }

      // cuil, telefono y direccion: texto libre, null si viene vacío.
      cambios[campo] = body[campo] ? String(body[campo]).slice(0, 255) : null;
    }

    // --- Email cambiado: hay que volver a verificar ------------------------
    // La dirección nueva es otra casilla y nadie confirmó que le pertenezca.
    // Por eso email_verificado vuelve a 0 y se manda un token nuevo. Sin esto,
    // cualquiera podría poner el email de un tercero y quedarse con la
    // cuenta ya validada.
    const emailCambiado = emailNuevo !== usuario.email;
    let verifEnviada = false;
    let tokenDev: string | undefined;

    if (emailCambiado) {
      await execute(
        'UPDATE usuarios SET email_verificado = 0, verification_token = NULL, verification_expires_at = NULL WHERE id = ?',
        [id]
      );
      // El nombre sale del perfil ya actualizado, así que el email de
      // verificación dice el nombre nuevo y no el viejo.
      const nombreParaElMail =
        (typeof cambios.nombre === 'string' ? cambios.nombre : perfilActual.nombre) || 'Socio';
      const r = await reenviarVerificacion(
        id,
        emailNuevo,
        nombreParaElMail,
        process.env.APP_URL || ''
      );
      verifEnviada = r.ok;
      tokenDev = r.devToken;
    }

    // --- Escritura -------------------------------------------------------
    if (hashNuevo) {
      await execute('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hashNuevo, id]);
    }
    if (emailNuevo !== usuario.email) {
      await execute('UPDATE usuarios SET email = ? WHERE id = ?', [emailNuevo, id]);
    }
    if (rolNuevo !== usuario.rol) {
      // Las dos columnas, siempre juntas.
      await execute('UPDATE usuarios SET rol = ? WHERE id = ?', [rolNuevo, id]);
      await execute('UPDATE perfiles SET rol = ? WHERE id = ?', [rolNuevo, perfil.id]);
    }

    if (Object.keys(cambios).length) {
      const sets = Object.keys(cambios).map((k) => `${k} = ?`).join(', ');
      await execute(`UPDATE perfiles SET ${sets} WHERE id = ?`, [...Object.values(cambios), perfil.id]);
    }

    // El correo del perfil es una copia del de usuarios. Si divergen, el
    // socio recibe los avisos a una casilla que ya no controla.
    if (emailNuevo !== usuario.email) {
      await execute('UPDATE perfiles SET correo = ? WHERE id = ?', [emailNuevo, perfil.id]);
    }

    // --- Ficha de deportista ---------------------------------------------
    // Un socio cadete necesita su fila en `deportistas` para que el portal y
    // las cuotas funcionen. Al pasarlo a un cargo de directiva, la fila se
    // conserva: borrarla tiraría abajo el historial del jugador.
    if (rolNuevo === 'socio_cadete' && usuario.rol !== 'socio_cadete') {
      const existente = await queryOne<{ id: string }>(
        'SELECT id FROM deportistas WHERE perfil_id = ?',
        [perfil.id]
      );
      if (!existente) {
        await insert('INSERT INTO deportistas (id, perfil_id) VALUES (?, ?)', [uuid(), perfil.id]);
      }
    }

    const avisos: string[] = [];
    if (emailCambiado) {
      avisos.push(
        verifEnviada
          ? `Se cambió el email. Le llegó un correo a ${emailNuevo} para confirmar la cuenta: hasta que lo confirme no puede entrar.`
          : `Se cambió el email y no se pudo enviar el correo de verificación. Pedile que entre y la reenvíe desde su portal.`
      );
    }
    if (rolNuevo !== usuario.rol) {
      avisos.push(
        `El rol pasó de ${ROL_LABEL[usuario.rol as Rol] ?? usuario.rol} a ${ROL_LABEL[rolNuevo as Rol] ?? rolNuevo}. ` +
          'La persona tiene que cerrar sesión y volver a entrar para que el cambio le aplique.'
      );
    }

    return NextResponse.json({
      success: true,
      cambios: {
        email: emailNuevo,
        rol: rolNuevo,
        password: !!hashNuevo,
        perfil: cambios,
      },
      avisos,
      // En desarrollo, donde no hay Resend configurado, se devuelve el token
      // para poder mostrar el link. En producción `verifEnviada` es true y
      // esto va en null.
      linkVerificacion: tokenDev ? `${process.env.APP_URL || ''}/verificar?token=${tokenDev}` : null,
    });
  } catch (err: any) {
    console.error('Update user error:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar el usuario' }, { status: 500 });
  }
}
