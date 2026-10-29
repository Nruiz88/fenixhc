import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaccion } from '@/lib/db';
import { requireModulo } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';

// Borrado definitivo de una cuenta desde el panel de usuarios.
//
// No reemplaza a la baja de datos personales (lib/baja.ts): la baja anonimiza
// y conserva la contabilidad; esto borra la cuenta y su ficha. Por eso solo se
// permite cuando no queda historia colgando. Si la persona tiene cuotas o
// recibos, borrarla tiraría abajo pagos reales (las FK de familias son
// CASCADE), así que se rechaza y se sugiere la baja.
//
// El resto de las relaciones se resuelve solo: la mayoría de las FK contra
// `perfiles` son SET NULL o CASCADE. La excepción es avisos_familias, que
// RESTRICT: si la persona envió avisos, la base no deja borrarla y se devuelve
// un 409 explicando que hay que darla de baja.

const CONFIRMACION =
  'Se borra la cuenta, la ficha y los datos personales. No se puede deshacer.';

export async function POST(request: NextRequest) {
  try {
    // Mismo permiso que crear y editar cuentas: solo quien administra usuarios.
    const auth = await requireModulo('usuarios');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson<{ id?: string; confirmar?: boolean }>(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const { id, confirmar } = leido.data;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Falta el usuario a eliminar' }, { status: 400 });
    }

    if (!confirmar) {
      return NextResponse.json(
        { error: 'Falta la confirmación', requiereConfirmacion: true, mensaje: CONFIRMACION },
        { status: 400 }
      );
    }

    // Nadie se borra a sí mismo: perdería la sesión y podría dejar al club sin
    // la persona que estaba administrando. Si hace falta, lo borra otro admin.
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: 'No podés eliminar tu propia cuenta. Pedile a otro administrador que lo haga.' },
        { status: 400 }
      );
    }

    const usuario = await queryOne<{
      id: string; email: string; rol: string; roles: unknown;
    }>('SELECT id, email, rol, roles FROM usuarios WHERE id = ?', [id]);

    if (!usuario) {
      return NextResponse.json({ error: 'El usuario no existe o ya fue eliminado' }, { status: 404 });
    }

    const perfil = await queryOne<{ id: string; nombre: string; apellido: string }>(
      'SELECT id, nombre, apellido FROM perfiles WHERE usuario_id = ?',
      [id]
    );

    // Sin ficha se puede borrar igual (cuenta huérfana), pero se necesitan los
    // datos para las verificaciones que siguen.
    const perfilId = perfil?.id ?? null;

    // --- Último administrador ---------------------------------------------
    // Se mira la lista completa de roles, no solo el principal, porque un
    // admin puede tener además un rol de socio. Solo cuentan los verificados:
    // una cuenta que no puede entrar no sirve para administrar el club.
    let esAdmin = usuario.rol === 'admin';
    if (!esAdmin && usuario.roles) {
      try {
        const lista = typeof usuario.roles === 'string'
          ? JSON.parse(usuario.roles)
          : usuario.roles;
        esAdmin = Array.isArray(lista) && lista.includes('admin');
      } catch {
        esAdmin = false;
      }
    }

    if (esAdmin) {
      const otros = await queryOne<{ c: number }>(
        `SELECT COUNT(*) AS c FROM usuarios
          WHERE id != ? AND email_verificado = 1
            AND (rol = 'admin'
                 OR JSON_CONTAINS(COALESCE(roles, JSON_ARRAY()), '"admin"'))`,
        [id]
      );
      if (Number(otros?.c ?? 0) === 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar al único administrador. Creá otro admin primero.' },
          { status: 409 }
        );
      }
    }

    // --- Historial contable ------------------------------------------------
    // Las cuotas y los recibos cuelgan de familias con ON DELETE CASCADE. Si
    // se borrara la cuenta sin mirar esto, desaparecerían pagos reales y la
    // contabilidad del club quedaría incompleta sin que nadie lo note.
    if (perfilId) {
      const historial = await queryOne<{ cuotas: number; recibos: number }>(
        `SELECT
           (SELECT COUNT(*) FROM cuotas c
              JOIN familias f ON c.familia_id = f.id
             WHERE f.padre_perfil_id = ? OR f.deportista_perfil_id = ?) AS cuotas,
           (SELECT COUNT(*) FROM recibos r
              JOIN familias f ON r.familia_id = f.id
             WHERE f.padre_perfil_id = ? OR f.deportista_perfil_id = ?) AS recibos`,
        [perfilId, perfilId, perfilId, perfilId]
      );

      if (Number(historial?.cuotas ?? 0) > 0 || Number(historial?.recibos ?? 0) > 0) {
        return NextResponse.json(
          {
            error:
              'Esta persona tiene cuotas o recibos registrados. Para no perder la contabilidad, usá "Dar de baja" en Datos personales: conserva los pagos y borra la identidad.',
          },
          { status: 409 }
        );
      }
    }

    // --- Borrado -----------------------------------------------------------
    // Una sola sentencia: las FK en cascada se encargan de ficha, familias,
    // deportista, reservas y notificaciones. Todo dentro de una transacción
    // para que un error a mitad de camino no deje la cuenta a medio borrar.
    await transaccion(async (conn) => {
      const [resultado] = await conn.execute(
        'DELETE FROM usuarios WHERE id = ?',
        [id]
      );
      if (!(resultado as { affectedRows?: number })?.affectedRows) {
        throw new Error('El usuario no existe o ya fue eliminado');
      }
    });

    return NextResponse.json({
      success: true,
      mensaje: `${perfil ? `${perfil.nombre} ${perfil.apellido}` : usuario.email} fue eliminado. Su cuenta ya no existe.`,
    });
  } catch (err: unknown) {
    const errno = (err as { errno?: number })?.errno;
    const code = (err as { code?: string })?.code;

    // 1451 = ER_ROW_IS_REFERENCED_2. Pasa cuando la persona envió avisos a
    // familias (esa FK es RESTRICT, a propósito: no se puede perder el registro
    // de quién mandó el aviso).
    if (errno === 1451 || code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json(
        {
          error:
            'Esta cuenta tiene registros asociados que impiden borrarla (por ejemplo, avisos enviados a familias). Usá "Dar de baja" en Datos personales para conservar el historial.',
        },
        { status: 409 }
      );
    }

    console.error('Delete user error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error && err.message
          ? err.message
          : 'No se pudo eliminar el usuario',
      },
      { status: 500 }
    );
  }
}
