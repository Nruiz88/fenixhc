import { NextRequest, NextResponse } from 'next/server';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { queryOne, uuid, transaccion } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { generarTokenVerificacion, enviarVerificacion } from '@/lib/verification';
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
      // Finalidades del JUEGOR a cargo. Van separadas de las del titular y NO se
      // suman: antes el formulario mandaba una sola lista mezclada, y eso hacía
      // que una casilla marcada por el padre para sí mismo llegara como si la
      // hubiera marcado para el hijo. Con el menor diciendo "no", el padre quedaba
      // bloqueado por una finalidad que nunca autorizó para el otro, y el
      // mensaje le pedía desmarcar algo que él sí había marcado.
      consentimientosHijo: consentimientosHijoRaw = [],
      // Vínculo con el jugador que se inscribe. Antes el código ponía
      // 'padre' fijo: una madre quedaba asentada como padre.
      vinculo: vinculoRaw = null,
      // Optional child registration
      hijo_nombre, hijo_apellido, hijo_dni, hijo_email, hijo_password,
      hijo_fecha_nacimiento = null,
      hijo_opinion = null,
      // Fecha de nacimiento de quien se registra como jugador por su cuenta.
      // Antes no se pedía en esa ruta, y por eso un menor podía abrirse su
      // propia cuenta de cadete sin pasar por nadie.
      fecha_nacimiento = null,
    } = body;

    const fechaNacimientoPropia = fecha_nacimiento;

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

    // Un jugador que se registra SOLO es un caso aparte del alta de un hijo,
    // y era un agujero: la ruta de "socio_cadete" no pedía fecha de
    // nacimiento ni vínculo, así que un menor podía crear su propia cuenta
    // saltándose todo el régimen de menores, y su consentimiento quedaba
    // registrado como si fuera un adulto consentiendo por sí mismo.
    //
    // Tampoco alcanzaba con cerrárselo al padre: se verificó funcionando. La
    // cuenta quedaba creada, con rol de cadete, sin ficha de deportista y con
    // consentimiento de documentación registrado.
    //
    // La regla que cierra el camino es la del mundo real: un menor no contrata
    // con el club por su cuenta. Si al declarar la edad resulta ser menor, la
    // inscripción la tiene que hacer madre, padre o tutor.
    let edadPropio: number | null = null;

    if (rol === 'socio_cadete') {
      if (!fechaNacimientoValida(fechaNacimientoPropia)) {
        return NextResponse.json(
          { error: 'Necesitamos tu fecha de nacimiento para saber cómo hay que tratarte.' },
          { status: 400 }
        );
      }

      edadPropio = edadCumplida(fechaNacimientoPropia as string);

      if (edadPropio !== null && edadPropio < 18) {
        return NextResponse.json(
          {
            error:
              'Para inscribirte como jugador menor de edad tiene que hacerlo tu madre, tu padre o tu tutor legal. Es la única forma de que el club pueda pedir el consentimiento de alguien que puede darlo.',
            necesitaTutor: true,
          },
          { status: 400 }
        );
      }
    }

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
          marcadas: Array.isArray(consentimientosHijoRaw) ? consentimientosHijoRaw : [],
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
    const consBase = validarConsentimientos({
      consentimiento: { marcadas: Array.isArray(consentimientosRaw) ? consentimientosRaw : [] },
      menor: { nombre },
      vinculo: null,
      esAltaDeMenor: false,
    });
    if (!consBase.ok) {
      return NextResponse.json({ error: consBase.error }, { status: 400 });
    }

    // Un jugador adulto que se registra solo revalida con su propia fecha: el
    // cálculo de edad es el que acaba de decidir que puede hacerlo por su
    // cuenta, y conviene que el consentimiento se registre contra ese mismo
    // dato y no contra un campo en blanco.
    const consAdulto = rol === 'socio_cadete'
      ? validarConsentimientos({
          consentimiento: {
            marcadas: Array.isArray(consentimientosRaw) ? consentimientosRaw : [],
          },
          menor: { nombre, fechaNacimiento: fechaNacimientoPropia as string },
          vinculo: null,
          esAltaDeMenor: false,
        })
      : consBase;
    if (!consAdulto.ok) {
      return NextResponse.json({ error: consAdulto.error }, { status: 400 });
    }

    const hash = await hashPassword(passwordVal);
    const userId = uuid();
    // El perfil comparte el mismo id que el usuario para mantener
    // la compatibilidad con las queries existentes (perfiles.id == usuario id)
    const perfilId = userId;
    const hijoUserId = uuid();
    const hijoPerfilId = hijoUserId;
    const hijoHash = registraHijo ? await hashPassword(hijoPasswordVal) : null;
    const base = getBaseUrl(request);

    // -------------------------------------------------------------------------
    // UNA SOLA TRANSACCIÓN
    // -------------------------------------------------------------------------
    // Todo lo que escribe va adentro, incluidas las dos actas de consentimiento
    // y la opinión del menor. Antes cada INSERT iba por el pool: si el alta del
    // hijo fallaba, el padre ya estaba insertado y con su consentimiento
    // registrado, y el reintento moría con "El email ya está registrado".
    // Quedaba una cuenta que el club no puede usar y que el padre no puede
    // recuperar.
    //
    // Los tokens de verificación entran acá porque son una escritura. El CORREO
    // se manda después del commit: un email que salió no se deshace con un
    // rollback, y mandarlo desde adentro dejaría la transacción abierta durante
    // una llamada a la red.
    const { tokenPadre, tokenHijo } = await transaccion(async (conn) => {
      await conn.execute(
        'INSERT INTO usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, ?)',
        [userId, emailVal, hash, rol]
      );

      await conn.execute(
        'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, cuil, correo, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          perfilId, userId, rol,
          nombre, apellido, dniVal, cuilRaw || null, emailVal,
          telefono, direccion,
        ]
      );

      // Constancia del consentimiento del titular.
      await registrarConsentimientos({
        titularPerfilId: perfilId,
        otorganteTipo: 'titular',
        finalidades: consAdulto.finalidades,
        edadAlOtorgar: null,
        ip,
        userAgent,
        canal: 'registro',
        conn,
      });

      // Un jugador que se registra por su cuenta también necesita ficha de
      // deportista. Antes no se creaba, y el resultado era una cuenta con rol
      // de cadete que no estaba en ninguna lista: invisible para el panel de
      // jugadores y sin lugar donde guardar nada.
      if (rol === 'socio_cadete') {
        await conn.execute(
          'INSERT INTO deportistas (id, perfil_id, fecha_nacimiento) VALUES (?, ?, ?)',
          [uuid(), perfilId, fechaNacimientoPropia]
        );
      }

      // If padre and child data provided
      let tokenHijo: string | null = null;
      if (registraHijo && consHijo?.ok) {
        await conn.execute(
          'INSERT INTO usuarios (id, email, password_hash, rol) VALUES (?, ?, ?, ?)',
          [hijoUserId, hijoEmailVal, hijoHash, 'socio_cadete']
        );

        await conn.execute(
          'INSERT INTO perfiles (id, usuario_id, rol, nombre, apellido, dni, correo) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            hijoPerfilId, hijoUserId, 'socio_cadete',
            hijoNombreVal, hijoApellidoVal, hijoDniFinal, hijoEmailVal,
          ]
        );

        await conn.execute(
          'INSERT INTO deportistas (id, perfil_id, fecha_nacimiento) VALUES (?, ?, ?)',
          [uuid(), hijoPerfilId, hijo_fecha_nacimiento]
        );

        // Link parent-child. Ojo: tipo_vinculo describe la RELACION familiar
        // ('padre'|'madre'|'tutor'), no el rol del usuario, asi que no se renombra.
        // Y ahora se guarda la que declaró el titular, no una fija: antes una
        // madre quedaba asentada como si fuera el padre.
        await conn.execute(
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
          conn,
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
          conn,
        });

        // El token del hijo se anota acá, pero el correo se manda después del
        // commit. Es el mismo camino que el del padre, por eso no hay dos finales
        // distintos que recordar.
        tokenHijo = await generarTokenVerificacion(hijoUserId, conn);
      }

      const tokenPadre = await generarTokenVerificacion(userId, conn);
      return { tokenPadre, tokenHijo };
    });

    // -------------------------------------------------------------------------
    // Commit hecho. Ahora sí se manda el correo.
    // -------------------------------------------------------------------------
    // El hijo también tiene que verificar su email para poder entrar.
    if (tokenHijo) {
      await enviarVerificacion({
        email: hijoEmailVal,
        nombre: hijoNombreVal,
        token: tokenHijo,
        baseUrl: base,
      });
    }

    const padre = await enviarVerificacion({
      email: emailVal,
      nombre,
      token: tokenPadre,
      baseUrl: base,
    });

    // Si el envío falló de verdad (no es lo mismo que "no hay API key"), la
    // cuenta queda creada pero bloqueada: se loguea para que el club lo
    // resuelva con /api/auth/resend-verification o desde el panel.
    if (!padre.ok) {
      console.error(`No se pudo enviar la verificación a ${emailVal} (usuario ${userId})`);
    }

    const response = NextResponse.json({
      success: true,
      userId,
      childId: registraHijo ? hijoPerfilId : null,
      requiresVerification: true,
      // Solo si RESEND_API_KEY no está configurado (dev): se muestra el link
      // en pantalla para poder completar la verificación sin email.
      devVerificationUrl: padre.ok ? undefined : `${base}/verificar?token=${tokenPadre}`,
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
