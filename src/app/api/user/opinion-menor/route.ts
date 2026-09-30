import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { registrarOpinionMenor, opinionVigente } from '@/lib/consentimientos-db';
import { opinionVeda, edadCumplida, type Finalidad, type Opinion } from '@/lib/consentimientos';

// El menor expresa su propia opinión, desde su portal.
//
// POR QUÉ EXISTE SEPARADO DE TODO LO DEMÁS
//
// El sistema ya le da una cuenta propia al jugador. Entonces un pibe de 12
// años puede entrar y decir que no a que le guarden la foto del DNI, sin que
// tenga que convencer a su madre.
//
// Esto no es un detalle simpático: el Código Civil exige que en los actos que
// afectan al menor se tenga en cuenta SU opinión. Si el único canal para
// opinar es que el adulto le pregunte y le anote lo que quiera, el registro
// existe pero el derecho no.
//
// Y tiene un efecto concreto: desde acá, si el menor se opone, la puerta del
// DNI se cierra para todos —incluido el padre— hasta que la opinión cambie.
// Ver /api/user/query, donde se valida antes de guardar la documentación.

const FINALIDADES_OPINABLES: Finalidad[] = ['documentacion_dni', 'imagenes', 'datos_deportivos'];

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const leido = await leerJson<{ finalidad?: string; opinion?: string }>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const finalidad = leido.data.finalidad as Finalidad;
    const opinion = leido.data.opinion as Opinion;

    if (!FINALIDADES_OPINABLES.includes(finalidad)) {
      return NextResponse.json({ error: 'Ese tema no admite opinión' }, { status: 400 });
    }
    if (!['a_favor', 'en_contra', 'no_consultado'].includes(opinion)) {
      return NextResponse.json({ error: 'Opinión inválida' }, { status: 400 });
    }

    // Solo sobre sí mismo. Que el endpoint exija que el perfil sea el del que
    // está logueado no es una formalidad: si se pudiera opinar por otro,
    // cualquiera firmaría "sí" en nombre de un menor.
    const perfil = await queryOne<any>(
      `SELECT p.id, p.nombre, p.apellido, d.fecha_nacimiento
         FROM perfiles p
         JOIN deportistas d ON d.perfil_id = p.id
        WHERE p.id = ? AND p.apellido <> 'DADO DE BAJA'`,
      [user.id]
    );

    if (!perfil) {
      return NextResponse.json(
        { error: 'Esta cuenta no corresponde a un jugador inscripto.' },
        { status: 404 }
      );
    }

    const edad = perfil.fecha_nacimiento ? edadCumplida(perfil.fecha_nacimiento) : null;

    await registrarOpinionMenor({
      menorPerfilId: perfil.id,
      consulta: finalidad,
      opinion,
      // `propia`, no `transmitida_por_representante`: esta vez la dijo el
      // menor. Es la diferencia que hace útil el registro.
      origen: 'propia',
      recogidaPor: perfil.id,
      edadAlConsultar: edad,
    });

    const mensaje =
      opinion === 'en_contra'
        ? 'Registrado. El club no va a hacer esto hasta que cambies de opinión. Tu familia va a ver que lo pediste, pero no puede hacer nada al respecto.'
        : 'Registrado.';

    return NextResponse.json({ success: true, mensaje });
  } catch (err: any) {
    console.error('Opinion del menor:', err);
    return NextResponse.json({ error: 'No pudimos registrar tu opinión' }, { status: 500 });
  }
}

/** Las opiniones propias del jugador que está mirando. */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { user } = auth;

    const filas = await query<{ consulta: Finalidad; opinion: Opinion; registrada_en: string }>(
      `SELECT consulta, opinion, registrada_en
         FROM opiniones_menor
        WHERE menor_perfil_id = ? AND origen = 'propia'
        ORDER BY registrada_en DESC`,
      [user.id]
    );

    // Una fila por finalidad: la última gana.
    const vigente: Partial<Record<Finalidad, Opinion>> = {};
    for (const f of filas) {
      if (!(f.consulta in vigente)) vigente[f.consulta] = f.opinion;
    }

    return NextResponse.json({ data: { opiniones: vigente } });
  } catch (err: any) {
    console.error('Opiniones del menor GET:', err);
    return NextResponse.json({ error: 'No se pudo cargar' }, { status: 500 });
  }
}
