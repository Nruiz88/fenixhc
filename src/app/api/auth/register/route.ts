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
import {
  validarConsentimientos,
  edadCumplida,
  fechaNacimientoValida,
  VINCULOS,
  type Vinculo,
  type Opinion,
} from '@/lib/consentimientos';
import {
  registrarConsentimientos,
  registrarOpinionMenor,
} from '@/lib/consentimientos-db';

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
      // Finalidades consentidas, del catálogo de lib/consentimientos.
      // Antes esto era un booleano: "acepta el aviso". Ahora es la lista de
      // lo que efectivamente aceptó, porque es lo que se guarda como prueba
      // y no se puede guardar "aceptó todo".
      consentimientos: consentimientosRaw = [],
      // Vínculo con el jugador que se inscribe. Antes el código ponía
      // 'padre' fijo: una madre quedaba asentada como padre.
      vinculo: vinculoRaw = null,
      // Optional child registration
      hijo_nombre, hijo_apellido, hijo_dni, hijo_email, hijo_password,
      hijo_fecha_nacimiento = null,
      hijo_opinion = null,
    } = body;

    const ip = clientIp(request);
    const userAgent = request.headers.get('user-agent') ?? null;

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

    // --- El vínculo ------------------------------------------------------
    // Antes estaba fijo en 'padre'. Una madre que inscribe a su hija quedaba
    // asentada como si fuera el padre, y ese campo es la evidencia de quién
    // representa a quién: el acta de consentimiento se apoyaba en un dato
    // falso.
    const vinculo: Vinculo | null = (VINCULOS as string[]).includes(String(vinculoRaw))
      ? (vinculoRaw as Vinculo)
      : null;

    if (registraHijo && !vinculo) {
      return NextResponse.json(
        { error: 'Indicá si sos la madre, el padre o la persona tutora legal del jugador.' },
        { status: 400 }
      );
    }

    // --- Consentimientos del jugador --------------------------------------
    let consHijo: ReturnType<typeof validarConsentimientos> | null = null;
    let edadHijo: number | null = null;

    if (registraHijo) {
      hijoEmailVal = parseOr400(emailSchema, hijo_email);
      hijoPasswordVal = parseOr400(passwordSchema, hijo_password);
      hijoNombreVal = parseOr400(nombreSchema, hijo_nombre);
      hijoApellidoVal = parseOr400(apellidoSchema, hijo_apellido);
      hijoDniFinal = parseOr400(dniSchema, hijo_dni);

      if (!fechaNacimientoValida(hijo_fecha_nacimiento)) {
        return NextResponse.json(
          { error: 'Falta la fecha de nacimiento del jugador, o no es una fecha válida.' },
          { status: 400 }
        );
      }

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

      edadHijo = edadCumplida(hijo_fecha_nacimiento as string);

      consHijo = validarConsentimientos({
        consentimiento: {
          marcadas: Array.isArray(consentimientosRaw) ? consentimientosRaw : [],
        },
        menor: {
          nombre: hijoNombreVal,
          fechaNacimiento: hijo_fecha_nacimiento as string,
          opinion: (hijo_opinion as Opinion) ?? 'no_consultado',
        },
        vinculo,
        esAltaDeMenor: true,
      });
      if (!consHijo.ok) {
        return NextResponse.json({ error: consHijo.error }, { status: 400 });
      }
    }

    // --- Consentimientos del titular --------------------------------------
    // Se validan ANTES de escribir nada. Si el consentimiento no es válido, no
    // se crea la cuenta: una cuenta creada sin consentimiento no tiene a quién
    // pertenecer.
    //
    // Un adulto no necesita representante, así que se valida con
    // esAltaDeMenor: false y sin vínculo.
    const consAdulto = validarConsentimientos({
      consentimiento: { marcadas: Array.isArray(consentimientosRaw) ? consentimientosRaw : [] },
      menor: { nombre },
      vinculo: null,
      esAltaDeMenor: false,
    });
    if (!consAdulto.ok) {
      return NextResponse.json({ error: consAdulto.error }, { status: 400 });
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

    // Constancia del consentimiento del titular. Va después de crear el
    // perfil porque necesita su id, pero antes que nada del hijo.
    await registrarConsentimientos({
      titularPerfilId: perfilId,
      otorganteTipo: 'titular',
      finalidades: consAdulto.finalidades,
      edadAlOtorgar: null,
      ip,
      userAgent,
      canal: 'registro',
    });

    // If padre and child data provided
    let childId = null;
    if (registraHijo && consHijo?.ok) {
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
        'INSERT INTO deportistas (id, perfil_id, fecha_nacimiento) VALUES (?, ?, ?)',
        [uuid(), hijoPerfilId, hijo_fecha_nacimiento]
      );

      // Link parent-child. Ojo: tipo_vinculo describe la RELACION familiar
      // ('padre'|'madre'|'tutor'), no el rol del usuario, asi que no se renombra.
      // Y ahora se guarda la que declaró el titular, no una fija: antes una
      // madre quedaba asentada como si fuera el padre.
      await insert(
        'INSERT INTO familias (id, padre_perfil_id, deportista_perfil_id, tipo_vinculo) VALUES (?, ?, ?, ?)',
        [uuid(), perfilId, hijoPerfilId, vinculo]
      );

      // Constancia del consentimiento DEL JUEGOR, otorgado por el
      // representante. El titular es el menor; el otorgante es el adulto.
      // Confundir esos dos campos es justo el error que hace imposible
      // responder quién consintió qué.
      await registrarConsentimientos({
        titularPerfilId: hijoPerfilId,
        otorgantePerfilId: perfilId,
        otorganteTipo: vinculo as 'padre' | 'madre' | 'tutor',
        vinculo,
        finalidades: consHijo.finalidades,
        edadAlOtorgar: edadHijo,
        ip,
        userAgent,
        canal: 'registro',
      });

      // La opinión del menor se guarda SIEMPRE, incluso cuando no se le
      // preguntó. "No se le preguntó" es información: dice que el club no
      // detectó a alguien que tenía derecho a opinar.
      await registrarOpinionMenor({
        menorPerfilId: hijoPerfilId,
        consulta: 'documentacion_dni',
        opinion: (hijo_opinion as Opinion) ?? 'no_consultado',
        origen: 'transmitida_por_representante',
        recogidaPor: perfilId,
        edadAlConsultar: edadHijo,
      });

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
