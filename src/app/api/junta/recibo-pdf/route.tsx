import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { puede } from '@/lib/capacidades';
import { obtenerRecibo, marcarReciboDescargado } from '@/lib/junta-db';
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import React from 'react';

// El recibo en PDF.
//
// POR QUÉ SE GENERA ACÁ Y NO EN EL NAVEGADOR
//
// El tesorero lo entrega o lo manda por mail. Si el PDF se hiciera en el
// que se corte el papel al pasar de página. Un comprobante cortado a la mitad no lo
// puede aceptar el banco.
//Acceptar el banco.
//
// LO QUE SE COMPRUEBA
//
// La capacidad, antes de tocar nada. Un recibo dice cuánto pagó una familia:
// eso es dato financiero de un tercero y no se sirve a quien no puede emitir
// recibos.
//
// Un recibo ANULADO también se puede descargar, y sale con la marca. Un papel
// que ya no vale igual tiene que poder mostrarse para demostrar que existió.

export const dynamic = 'force-dynamic';

const estilos = StyleSheet.create({
  pagina: {
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#111827',
  },
  cabecera: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: '#DC2626',
    paddingBottom: 12,
    marginBottom: 20,
  },
  club: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#DC2626' },
  clubSub: { fontSize: 8, color: '#6B7280', marginTop: 2 },
  numero: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  numeroSub: { fontSize: 8, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  anulado: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: '#DC2626',
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-end',
    borderRadius: 2,
  },
  anuladoTexto: { color: '#DC2626', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  fila: { flexDirection: 'row', marginBottom: 8 },
  etiqueta: { width: 110, color: '#6B7280', fontSize: 9 },
  valor: { flex: 1, fontSize: 10 },
  montoCaja: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  montoTexto: { fontSize: 11, color: '#374151' },
  montoValor: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#111827' },
 Hr: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', marginVertical: 16 },
  nota: { fontSize: 8, color: '#6B7280', lineHeight: 1.5 },
  firma: { marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' },
  firmaCaja: { width: 200, borderTopWidth: 1, borderTopColor: '#9CA3AF', paddingTop: 4 },
  firmaTexto: { fontSize: 8, color: '#6B7280', textAlign: 'center' },
});

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function plata(n: number): string {
  return `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(n))}`;
}

function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-');
  if (!a || !m || !d) return iso;
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`;
}

function ReciboDoc({
  numero,
  monto,
  fecha,
  formaPago,
  concepto,
  socio,
  dni,
  cuota,
  estado,
  anuladoMotivo,
}: {
  numero: string;
  monto: number;
  fecha: string;
  formaPago: string;
  concepto: string | null;
  socio: string | null;
  dni: string | null;
  cuota: string | null;
  estado: string;
  anuladoMotivo: string | null;
}) {
  return (
    <Document title={`Recibo ${numero}`} author="Fenix Roller Hockey">
      <Page size="A4" style={estilos.pagina}>
        <View style={estilos.cabecera}>
          <View>
            <Text style={estilos.club}>FENIX ROLLER HOCKEY</Text>
            <Text style={estilos.clubSub}>Club Deportivo · Asociación Civil sin fines de lucro</Text>
          </View>
          <View>
            <Text style={estilos.numero}>{numero}</Text>
            <Text style={estilos.numeroSub}>Recibo de pago</Text>
          </View>
        </View>

        {/* Un recibo anulado tiene que decirselo al que lo tiene en la mano.
            Un papel que ya no vale, impreso sin marca, es el peor resultado
            posible: alguien lo cobra. */}
        {estado === 'anulado' && (
          <View style={estilos.anulado}>
            <Text style={estilos.anuladoTexto}>ANULADO — NO VÁLIDO</Text>
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Fecha</Text>
            <Text style={estilos.valor}>{fechaLarga(fecha)}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Socio</Text>
            <Text style={estilos.valor}>{socio ?? '—'}</Text>
          </View>
          {dni && (
            <View style={estilos.fila}>
              <Text style={estilos.etiqueta}>DNI</Text>
              <Text style={estilos.valor}>{dni}</Text>
            </View>
          )}
          {cuota && (
            <View style={estilos.fila}>
              <Text style={estilos.etiqueta}>Corresponde a</Text>
              <Text style={estilos.valor}>{cuota}</Text>
            </View>
          )}
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Concepto</Text>
            <Text style={estilos.valor}>{concepto ?? 'Cuota mensual'}</Text>
          </View>
          <View style={estilos.fila}>
            <Text style={estilos.etiqueta}>Forma de pago</Text>
            <Text style={estilos.valor}>{formaPago}</Text>
          </View>
        </View>

        <View style={estilos.montoCaja}>
          <Text style={estilos.montoTexto}>Total pagado</Text>
          <Text style={estilos.montoValor}>{plata(monto)}</Text>
        </View>

        {estado === 'anulado' && anuladoMotivo && (
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontSize: 9, color: '#DC2626', fontFamily: 'Helvetica-Bold' }}>
              Motivo de la anulación:
            </Text>
            <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 2 }}>{anuladoMotivo}</Text>
          </View>
        )}

        <View style={estilos.Hr} />

        <Text style={estilos.nota}>
          Recibo emitido por el club como comprobante de percepción de pago.
          Las cuotas mensuales y el seguro de accidentes de los jugadores se rigen
          por los estatutos del club y por las resoluciones de la Comisión
          Directiva que los apruebe. Conservar este comprobante.
        </Text>

        <View style={estilos.firma}>
          <View style={estilos.firmaCaja}>
            <Text style={estilos.firmaTexto}>Recibí conforme</Text>
          </View>
          <View style={estilos.firmaCaja}>
            <Text style={estilos.firmaTexto}>Por el club</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    if (!puede(auth.user.rol, 'emitir_recibos')) {
      return NextResponse.json(
        { error: 'Tu cargo no tiene permiso para emitir recibos.' },
        { status: 403 }
      );
    }

    const id = new URL(request.url).searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Falta el recibo' }, { status: 400 });
    }

    const r = await obtenerRecibo(id);
    if (!r) {
      return NextResponse.json({ error: 'El recibo no existe' }, { status: 404 });
    }

    const buffer = await renderToBuffer(
      <ReciboDoc
        numero={r.numero}
        monto={Number(r.monto)}
        fecha={r.fecha_emision}
        formaPago={
          ['efectivo', 'transferencia', 'debito', 'credito', 'cheque']
            .map((k) => ({ k, l: { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito', cheque: 'Cheque' }[k] }))
            .find((x) => x.k === r.forma_pago)?.l ?? r.forma_pago
        }
        concepto={r.concepto}
        socio={r.socio_nombre}
        dni={r.socio_dni}
        cuota={r.mes != null && r.anio != null ? `Cuota de ${MESES[r.mes - 1]} de ${r.anio}` : null}
        estado={r.estado}
        anuladoMotivo={r.anulado_motivo}
      />
    );

    // Se anota la descarga. Sirve para saber qué comprobante se entregó a
    // quién: en un reclamo, "el club nunca nos dio recibo" se responde mirando
    // esto.
    await marcarReciboDescargado(id, auth.user.id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${r.numero}.pdf"`,
        // El recibo se genera por parámetro: que nadie pueda meter una URL
        // externa en el href y que el navegador la use.
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: any) {
    console.error('Recibo PDF:', err);
    return NextResponse.json({ error: 'No se pudo generar el recibo' }, { status: 500 });
  }
}
