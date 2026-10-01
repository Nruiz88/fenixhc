import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { puede } from '@/lib/capacidades';
import { leerJson, RESP_BAD_JSON } from '@/lib/request';
import { listarAvisosPendientes, enviarAviso, historialAvisos } from '@/lib/avisos-db';
import { agruparParaAvisar, type CuotaParaAvisar, type Responsable, type SeguroParaAvisar } from '@/lib/avisos';

// Avisos a familias por cuotas vencidas y seguro sin adherir.
//
// POR QUÉ ESTO NO ES UN `POST` SOBRE CUALQUIER COSA
//
// La pantalla manda un aviso armado, no una cuota. El servidor vuelve a calcular
// la deuda desde la base antes de mandar: si el cliente dijera "debe $100" y en
// la base figure $120 con recargo, lo que sale es $120. Aceptar el monto del
// cliente sería abrir la puerta a mandar avisos con cualquier cifra.
//
// Y se manda a UN usuario, el que elige la pantalla. La autorización es "tenés
// `comunicar_padres`", no "sos el dueño de esa cuenta": es una tarea de
// directiva, no un dato de un socio.

function sinPermiso(rol: string, capacidad: string) {
  return NextResponse.json(
    { error: 'Tu cargo no puede enviar avisos a las familias', capacidad },
    { status: 403 }
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!puede(user.rol, 'comunicar_padres')) return sinPermiso(user.rol, 'comunicar_padres');

    const pendiente = request.nextUrl.searchParams.get('pendiente');

    if (pendiente) {
      // Texto completo del aviso de un socio, para editarlo antes de mandar.
      const lista = await listarAvisosPendientes();
      const item = lista.find((l) => l.familia.usuarioId === pendiente);

      if (!item) {
        return NextResponse.json({ error: 'Ese socio ya no tiene nada pendiente' }, { status: 404 });
      }
      return NextResponse.json({ data: item });
    }

    const [lista, historial] = await Promise.all([
      listarAvisosPendientes(),
      historialAvisos(30),
    ]);

    return NextResponse.json({
      data: {
        lista,
        historial,
        // Si no hay Resend, avisar por correo es imposible y hay que decirlo en
        // la pantalla. Callarlo y mandar solo al portal sería prometer por
        // correo algo que no sale.
        correoHabilitado: Boolean(process.env.RESEND_API_KEY),
      },
    });
  } catch (err: any) {
    console.error('Listar avisos:', err);
    return NextResponse.json({ error: 'No se pudo cargar la lista' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!puede(user.rol, 'comunicar_padres')) return sinPermiso(user.rol, 'comunicar_padres');

    const leido = await leerJson<{
      usuarioId?: string;
      mensaje?: string;
      cuotas?: CuotaParaAvisar[];
      seguros?: SeguroParaAvisar[];
      responsable?: Responsable;
      porCorreo?: boolean;
    }>(request);
    if (!leido.ok) return RESP_BAD_JSON();

    const { usuarioId, mensaje, cuotas, seguros, responsable, porCorreo } = leido.data ?? {};

    if (!usuarioId || !mensaje) {
      return NextResponse.json({ error: 'Falta el socio o el mensaje' }, { status: 400 });
    }

    if (typeof mensaje !== 'string' || !mensaje.trim() || mensaje.length > 4000) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío ni ser enorme' }, { status: 400 });
    }

    // El texto se manda, pero la cifra NO. La deuda se vuelve a calcular acá
    // desde los datos que trae el cliente y la regla del club, y si no hay nada
    // pendiente se corta: mandar un aviso de una cuota al día es la peor forma
    // de que alguien deje de leer.
    const familia = responsable
      ? agruparParaAvisar([responsable], cuotas ?? [], seguros ?? []).find(
          (f) => f.usuarioId === usuarioId
        )
      : undefined;

    if (!familia) {
      return NextResponse.json(
        { error: 'Ese socio no tiene nada pendiente. Volvé a cargar la lista.' },
        { status: 409 }
      );
    }

    const r = await enviarAviso({
      usuarioId,
      familia,
      mensaje: mensaje.trim(),
      enviadoPor: user.id,
      porCorreo: Boolean(porCorreo),
    });

    return NextResponse.json({ success: true, ...r });
  } catch (err: any) {
    console.error('Enviar aviso:', err);
    return NextResponse.json({ error: 'No se pudo enviar el aviso' }, { status: 500 });
  }
}