import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { leerConfigCuotasSegura } from '@/lib/cuotas-db';

// Configuración de cuotas para el portal de socios.
//
// El socio tiene que poder ver el recargo que se le aplica: es su dinero y
// la ley de defensa del consumidor exige que se информа antes de cobrarlo,
// no después. Por eso la tasa de recargo es pública para los socios
// autenticados. Lo que NO se les expone es el margen ni ningún otro dato
// financiero del club.

export async function GET() {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const config = await leerConfigCuotasSegura();

    return NextResponse.json({
      data: {
        montoBase: config.montoBase,
        vencimientos: config.vencimientos
          .filter((v) => v.activo)
          .map((v) => ({ dia: v.dia, porcentaje: Number(v.porcentaje), etiqueta: v.etiqueta })),
      },
    });
  } catch (err: any) {
    console.error('Cuota config (usuario):', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
