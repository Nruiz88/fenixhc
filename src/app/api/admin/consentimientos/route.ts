import { NextRequest, NextResponse } from 'next/server';
import { requireModulo } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { query, queryOne } from '@/lib/db';
import {
  estadoConsentimientos,
  registrarConsentimientos,
  registrarOpinionMenor,
  revocarConsentimiento,
  opinionVigente,
  alertasConsentimientos,
} from '@/lib/consentimientos-db';
import { opinionVeda, type Finalidad, type Opinion } from '@/lib/consentimientos';
import { clientIp } from '@/lib/rateLimit';

// Bandeja de consentimientos: quién autorizó qué, y qué hay que mirar.
//
// Módulo `configuracion`: es lo mismo que el resto de privacidad. El mismo
// razonamiento de siempre —esta pantalla es más delicada que la de socios,
// porque muestra qué consentimientos firmados NO tiene el club.

export async function GET(request: NextRequest) {
  try {
    const auth = await requireModulo('configuracion');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const url = new URL(request.url);
    const perfil = url.searchParams.get('perfil');

    const alertas = await alertasConsentimientos();

    // Vista de una persona: el detalle de cada finalidad, para poder corregir.
    if (perfil) {
      const persona = await queryOne<any>(
        `SELECT p.id, p.nombre, p.apellido, p.dni, p.rol, d.fecha_nacimiento, d.categoria,
                f.tipo_vinculo
           FROM perfiles p
           LEFT JOIN deportistas d ON d.perfil_id = p.id
           LEFT JOIN familias f ON f.deportista_perfil_id = p.id
          WHERE p.id = ?`,
        [perfil]
      );

      if (!persona) {
        return NextResponse.json({ error: 'La persona no existe' }, { status: 404 });
      }

      const estado = await estadoConsentimientos(perfil);

      // La opinión del menor manda sobre todo lo que toque documentación e
      // imágenes. Por eso viaja en la respuesta aunque no haya ningún
      // consentimiento: la tiene que ver quien va a autorizar algo.
      const opiniones = await query<any>(
        `SELECT consulta, opinion, origen, edad_al_consultar, registrada_en
           FROM opiniones_menor
          WHERE menor_perfil_id = ?
          ORDER BY registrada_en DESC`,
        [perfil]
      );

      return NextResponse.json({ data: { persona, estado, opiniones } });
    }

    // Vista general: todos con su estado y las alertas arriba.
    const filas = await query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni, p.rol, p.correo,
              d.fecha_nacimiento, d.categoria, d.dni_frente_url IS NOT NULL AS tiene_doc,
              DATE_ADD(d.fecha_nacimiento, INTERVAL 18 YEAR) AS mayoria_al
         FROM perfiles p
         LEFT JOIN deportistas d ON d.perfil_id = p.id
        WHERE p.apellido <> 'DADO DE BAJA'
        ORDER BY (d.fecha_nacimiento IS NULL), p.apellido, p.nombre`
    );

    return NextResponse.json({ data: { personas: filas, alertas } });
  } catch (err: any) {
    console.error('Consentimientos GET:', err);
    return NextResponse.json({ error: 'No se pudieron cargar los consentimientos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireModulo('configuracion');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const leido = await leerJson<{
      accion?: 'otorgar' | 'revocar' | 'opinion';
      perfil_id?: string;
      finalidad?: Finalidad;
      consentimiento_id?: string;
      opinion?: Opinion;
      motivo?: string;
      /** Quién autoriza, cuando no es el titular. */
      otorgante_perfil_id?: string | null;
      otorgante_tipo?: string;
      vinculo?: string | null;
    }>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const { accion, perfil_id, finalidad, consentimiento_id, opinion } = leido.data;

    if (!accion || !perfil_id) {
      return NextResponse.json({ error: 'Falta la acción o la persona' }, { status: 400 });
    }

    const persona = await queryOne<any>(
      `SELECT p.id, p.nombre, p.apellido, d.fecha_nacimiento
         FROM perfiles p
         LEFT JOIN deportistas d ON d.perfil_id = p.id
        WHERE p.id = ?`,
      [perfil_id]
    );
    if (!persona) {
      return NextResponse.json({ error: 'La persona no existe' }, { status: 404 });
    }

    // --- Registrar la opinión del menor ------------------------------------
    // Va antes de autorizar. Si el menor se opone, la operación tiene que
    // quedar bloqueada, y eso se decide mirando la opinión más reciente, no
    // la más antigua.
    if (accion === 'opinion') {
      if (!opinion) {
        return NextResponse.json({ error: 'Falta la opinión' }, { status: 400 });
      }
      await registrarOpinionMenor({
        menorPerfilId: perfil_id,
        consulta: (finalidad ?? 'documentacion_dni') as Finalidad,
        opinion,
        // Lo recoge alguien del club, no el menor: por eso `propia` no aplica.
        origen: 'transmitida_por_representante',
        recogidaPor: auth.user.id,
        edadAlConsultar: persona.fecha_nacimiento ? new Date().getFullYear() - Number(persona.fecha_nacimiento.slice(0, 4)) : null,
      });
      return NextResponse.json({ success: true, mensaje: 'Opinión registrada.' });
    }

    // --- Otorgar ------------------------------------------------------------
    if (accion === 'otorgar') {
      if (!finalidad) {
        return NextResponse.json({ error: 'Falta la finalidad' }, { status: 400 });
      }

      const opinionActual = await opinionVigente(perfil_id, finalidad);
      if (opinionVeda(opinionActual)) {
        return NextResponse.json(
          {
            error:
              'El jugador se opuso a esta finalidad. Su opinión prevalece sobre la del representante: no se puede registrar el consentimiento mientras siga en contra.',
            necesitaCambioDeOpinion: true,
          },
          { status: 409 }
        );
      }

      await registrarConsentimientos({
        titularPerfilId: perfil_id,
        otorgantePerfilId: leido.data.otorgante_perfil_id ?? null,
        otorganteTipo: (leido.data.otorgante_tipo as any) ?? 'titular',
        vinculo: (leido.data.vinculo as any) ?? null,
        finalidades: [finalidad],
        edadAlOtorgar: persona.fecha_nacimiento
          ? new Date().getFullYear() - Number(persona.fecha_nacimiento.slice(0, 4))
          : null,
        ip: clientIp(request),
        userAgent: request.headers.get('user-agent'),
        canal: 'presencial',
        registradoPor: auth.user.id,
      });

      return NextResponse.json({
        success: true,
        mensaje: `Consentimiento de "${finalidad}" registrado a nombre de ${persona.nombre} ${persona.apellido}.`,
      });
    }

    // --- Revocar ------------------------------------------------------------
    if (!consentimiento_id) {
      return NextResponse.json({ error: 'Falta el consentimiento a revocar' }, { status: 400 });
    }

    await revocarConsentimiento({
      consentimientoId: consentimiento_id,
      revocadoPor: auth.user.id,
      revocadoPorTipo: 'representante',
      motivo: leido.data.motivo ?? null,
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Consentimiento revocado. La revocación queda asentada; el registro original no se borra.',
    });
  } catch (err: any) {
    console.error('Consentimientos POST:', err);
    return NextResponse.json({ error: 'No se pudo completar la operación' }, { status: 500 });
  }
}
