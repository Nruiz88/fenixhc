import { NextRequest, NextResponse } from 'next/server';
import { verificarToken } from '@/lib/verification';

// GET /api/auth/verify?token=...  ->  confirma el email y marca la cuenta.
// El token es de un solo uso y expira a las 24h.
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') || '';
    const result = await verificarToken(token);

    if (result.ok) {
      return NextResponse.json({ success: true });
    }

    const status = result.motivo === 'expirado' ? 410 : 400;
    const mensaje =
      result.motivo === 'expirado'
        ? 'El enlace venció. Pedí uno nuevo.'
        : result.motivo === 'ya-verificado'
          ? 'Este email ya estaba verificado.'
          : 'Enlace inválido.';

    return NextResponse.json({ error: mensaje, motivo: result.motivo }, { status });
  } catch (err: any) {
    console.error('Verify error:', err);
    return NextResponse.json({ error: 'Error al verificar' }, { status: 500 });
  }
}
