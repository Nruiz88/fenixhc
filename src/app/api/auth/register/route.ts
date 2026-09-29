import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { queryOne, insert, uuid } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { generarYEnviarVerificacion } from '@/lib/verification';
import { getBaseUrl } from '@/lib/url';
import { z } from 'zod';
import {
  emailSchema, passwordSchema, dniSchema, nombreSchema, apellidoSchema,
  rolPublicoSchema, firstError,
} from '@/lib/schemas';

/** Valida con zod y devuelve un NextResponse 400 si no pasa. */
function parseOr400<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const res = schema.safeParse(value);
  if (!res.success) {
    throw new ZodFail(firstError(res.error));
  }
  return res.data;
}

/** Excepción interna para abortar con 400 sin repetir el if en cada campo. */
class ZodFail extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`register:ip:${clientIp(request)}`, 5, 10 * 60_000)) {
      return NextResponse.json({ error: 'Demasiados registros desde esta IP. Intentá en unos minutos.' }, { status: 429 });
    }

    const leido = await leerJson(request);
    if (!leido.ok) return RESP_BAD_JSON();
    const body = leido.data as any;
    const {
      rol: rolSolicitado = 'socio_benefactor',
      nombre: nombreRaw, apellido: apellidoRaw, dni: dniRaw, cuil: cuilRaw,
      email: emailRaw, password: passwordRaw,
      telefono = '', direccion = '',
      // Optional child registration
      hijo_nombre, hijo_apellido, hijo_dni, hijo_email, hijo_password,
    } = body;

    // El registro es público: nunca se acepta 'admin' desde el body, solo
    // 'padre' o 'deportista'. Sin esto cualquiera se auto-asignaba admin.
    const rolParsed = rolPublicoSchema.safeParse(rolSolicitado);
    if (!rolParsed.success) {
      return NextResponse.json({ error: 'Rol inválido' }, { status: 400 });
    }
    const rol = rolParsed.data;

    // Se valida campo por campo. parse() tira una excepción de zod con un
    // mensaje ya en español, que se traduce a la respuesta de más abajo.
    const nombre = parseOr400(nombreSchema, nombreRaw);
    const apellido = parseOr400(apellidoSchema, apellidoRaw);
    const dniVal = parseOr400(dniSchema, dniRaw);
    const emailVal = parseOr400(emailSchema, emailRaw);
    const passwordVal = parseOr400(passwordSchema, passwordRaw);

    // Check email exists
    const existing = await queryOne('SELECT id FROM usuarios WHERE email = ?', [emailVal]);
    if (existing) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 409 });
    }

    // Check DNI exists
    const existingDni = await queryOne('SELECT id FROM perfiles WHERE dni = ?', [dniVal]);
    if (existingDni) {
      return NextResponse.json({ error: 'El DNI ya está registrado' }, { status: 409 });
    }

    // Todo se valida ANTES de escribir: si el alta del hijo falla, no debe
    // quedar un padre huérfano ya insertado.
    const registraHijo = rol === 'socio_benefactor' && !!(hijo_nombre && hijo_apellido && hijo_dni && hijo_email && hijo_password);
    let hijoEmailVal = '';
    let hijoPasswordVal = '';
    let hijoNombreVal = '';
    let hijoApellidoVal = '';
    let hijoDniFinal = '';
    if (registraHijo) {
      hijoEmailVal = parseOr400(emailSchema, hijo_email);
      hijoPasswordVal = parseOr400(passwordSchema, hijo_password);
      hijoNombreVal = parseOr400(nombreSchema, hijo_nombre);
      hijoApellidoVal = parseOr400(apellidoSchema, hijo_apellido);
      hijoDniFinal = parseOr400(dniSchema, hijo_dni);

      if (hijoEmailVal.toLowerCase() === emailVal.toLowerCase()) {
        throw new ZodFail('El email del hijo debe ser distinto al del padre');
      }
      const hijoExiste = await queryOne('SELECT id FROM usuarios WHERE email = ?', [hijoEmailVal]);
      if (hijoExiste) {
        return NextResponse.json({ error: 'El email del hijo ya está registrado' }, { status: 409 });
      }
      const hijoDniExiste = await queryOne('SELECT id FROM perfiles WHERE dni = ?', [hijoDniFinal]);
      if (hijoDniExiste) {
        return NextResponse.json({ error: 'El DNI del hijo ya está registrado' }, { status: 409 });
      }
    }

    const hash = await hashPassword(passwordVal);
    const userId = uuid();
    // El perfil comparte el mismo id que el usuario para mantener
    // la compatibilidad con las queries existentes (perfiles.id == usuario id)
    const perfilId = userId;

    // Create usuario
    await insert(
      'INSERT INTO usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, ?)',
      [userId, emailVal, hash, rol]
    );

    // Create perfil
    await insert(
      'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        perfilId, userId, rol,
        nombre, apellido, dniVal, cuilRaw || null, emailVal,
        telefono, direccion,
      ]
    );

    // If padre and child data provided
    let childId = null;
    if (registraHijo) {
      const hijoUserId = uuid();
      const hijoPerfilId = hijoUserId;
      const hijoHash = await hashPassword(hijoPasswordVal);

      await insert(
        'INSERT INTO usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, ?)',
        [hijoUserId, hijoEmailVal, hijoHash, 'socio_cadete']
      );

      await insert(
        'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, correo) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          hijoPerfilId, hijoUserId, 'socio_cadete',
          hijoNombreVal, hijoApellidoVal, hijoDniFinal, hijoEmailVal,
        ]
      );

      await insert(
        'INSERT INTO deportistas (id, perfil_id) VALUES (?, ?)',
        [uuid(), hijoPerfilId]
      );

      // Link parent-child. Ojo: tipo_vinculo describe la RELACION familiar
      // ('padre'|'madre'|'tutor'), no el rol del usuario, asi que no se renombra.
      await insert(
        'INSERT INTO familias (id, padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES (?, ?, ?, ?)',
        [uuid(), perfilId, hijoPerfilId, 'padre']
      );

      // El hijo también tiene que verificar su email para poder entrar.
      await generarYEnviarVerificacion(
        hijoUserId, hijoEmailVal, hijoNombreVal, getBaseUrl(request)
      );

      childId = hijoPerfilId;
    }

    // Verificación de email: se manda el link pero NO se abre sesión.
    // El usuario tiene que confirmar su email antes de poder entrar.
    const base = getBaseUrl(request);
    const { ok: emailEnviado, devToken } = await generarYEnviarVerificacion(
      userId, emailVal, nombre, base
    );

    // Si el envío falló de verdad (no es lo mismo que "no hay API key"), la
    // cuenta queda creada pero bloqueada: se loguea para que el club lo
    // resuelva con /api/auth/resend-verification o desde el panel.
    if (!emailEnviado && !devToken) {
      console.error(`No se pudo enviar la verificación a ${emailVal} (usuario ${userId})`);
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
    // Fallo de validación de un campo: es un error del cliente, no del servidor.
    if (err instanceof ZodFail) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('Register error:', err);
    return NextResponse.json({ error: 'Error al crear la cuenta' }, { status: 500 });
  }
}
