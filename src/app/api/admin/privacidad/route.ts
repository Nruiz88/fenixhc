import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireModulo } from '@/lib/auth';

// Lectura de la bitácora de accesos y del historial de bajas, para el panel.
//
// Solo el módulo 'configuracion' (admin y presidente) entra acá. La bitácora
// dice quién abrió qué DNI: es información sobre la conducta de la directiva,
// y si lacould ver cualquiera, el registro no sirve para nada.

export async function GET(request: NextRequest) {
  try {
    const auth = await requireModulo('configuracion');
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const p = request.nextUrl.searchParams;
    const limite = Math.min(Number(p.get('limite')) || 200, 500);

    const [accesos, bajas] = await Promise.all([
      query<any>(
        `SELECT a.id, a.tipo_documento, a.proposito, a.ip, a.created_at,
                a.perfil_destino_id,
                ACC.nombre AS destino_nombre, ACC.apellido AS destino_apellido,
                ACC.dni     AS destino_dni,
                QUI.nombre  AS autor_nombre, QUI.apellido AS autor_apellido,
                QUI.rol     AS autor_rol, QUI.email AS autor_email
         FROM accesos_datos_sensibles a
         LEFT JOIN perfiles ACC ON ACC.id = a.perfil_destino_id
         LEFT JOIN usuarios  QUI ON QUI.id  = a.usuario_id
         ORDER BY a.created_at DESC
         LIMIT ${Math.floor(limite)}`
      ),
      query<any>(
        `SELECT id, perfil_id, solicitante_nombre, solicitante_email,
                motivo, estado, notas, created_at, resuelta_at
         FROM solicitudes_baja
         ORDER BY created_at DESC
         LIMIT 100`
      ),
    ]);

    // Perfiles que todavía se pueden dar de baja: socios activos, no los que
    // ya están anonimizados.
    const candidatos = await query<any>(
      `SELECT p.id, p.nombre, p.apellido, p.dni, p.rol, p.correo,
              (SELECT COUNT(*) FROM deportistas d WHERE d.perfil_id = p.id) AS es_jugador
       FROM perfiles p
       WHERE p.apellido <> 'DADO DE BAJA'
       ORDER BY p.apellido, p.nombre
       LIMIT 500`
    );

    return NextResponse.json({
      data: { accesos, bajas, candidatos },
    });
  } catch (err: any) {
    console.error('Privacidad GET:', err);
    return NextResponse.json({ error: 'No se pudo cargar la información de privacidad' }, { status: 500 });
  }
}
