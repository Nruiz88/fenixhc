import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { puede } from '@/lib/capacidades';
import { obtenerRecibo, marcarReciboDescargado } from '@/lib/junta-db';
import PDFDocument from 'pdfkit';

// El recibo en PDF.
//
// POR QUÉ PDFKIT Y NO @REACT-PDF/RENDERER
//
// Se empezó con react-pdf porque ya estaba en el proyecto. No funciona en un
// route handler: es un renderer de React de CLIENTE, y acá el JSX lo compila el
// transform de React Server Components, que produce objetos que su reconciliador
// no sabe leer. Falla con "Cannot read properties of null (reading 'props')",
// un error que dice más del framework que del error.
//
// pdfkit no sabe qué es React. Para un recibo —un diseño fijo, sin estado, sin
// interacción— eso es exactamente lo que se quiere: sin reconciliador que
// pueda romperse.
//
// POR QUÉ SE GENERA ACÁ Y NO EN EL NAVEGADOR
//
// El tesorero lo entrega en mano o lo manda por mail. Si el PDF se hiciera en
// el navegador dependería de que tenga la impresora puesta y de que el papel no
// se corte al pasar de página. Un comprobante cortado a la mitad no lo puede
// aceptar el banco.
//
// LO QUE SE COMPRUEBA ANTES DE GENERAR NADA
//
// La capacidad. Un recibo dice cuánto pagó una familia: es dato financiero de un
// tercero y no se sirve a quien no puede emitir recibos.
//
// Un recibo ANULADO también se descarga, y sale con la marca. Un papel que ya no
// vale, impreso sin marca, es el peor resultado posible: alguien lo cobra.

export const dynamic = 'force-dynamic';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const FORMAS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia bancaria',
  debito: 'Débito automático',
  credito: 'Tarjeta de crédito',
  cheque: 'Cheque',
};

function plata(n: number): string {
  return `$ ${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 }).format(Number(n))}`;
}

function fechaLarga(iso: string): string {
  const [a, m, d] = String(iso).split('-');
  if (!a || !m || !d) return iso;
  return `${Number(d)} de ${MESES[Number(m) - 1]} de ${a}`;
}

/**
 * Dibuja el recibo.
 *
 * Todo con Helvetica: es una de las 14 fuentes base del PDF, así que viaja
 * dentro del archivo sin embedir nada y soporta acentos y ñ. Con una fuente
 * custom hay que registrar el archivo y el peso sube a hundreds de KB por un
 * comprobante de una hoja.
 */
function dibujarRecibo(doc: PDFKit.PDFDocument, r: any): void {
  const M = 50; // margen
  const ANCHO = doc.page.width - M * 2;
  const ROJO = '#DC2626';
  const GRIS = '#6B7280';

  // --- Cabecera ---
  doc.rect(M, 48, ANCHO, 2).fill(ROJO);
  doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(17).text('FENIX ROLLER HOCKEY', M, 60);
  doc
    .fillColor(GRIS)
    .font('Helvetica')
    .fontSize(8.5)
    .text('Club Deportivo · Asociación Civil sin fines de lucro', M, doc.y + 2);

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(15).text(r.numero, M, 58, {
    width: ANCHO,
    align: 'right',
  });
  doc.fillColor(GRIS).font('Helvetica').fontSize(8.5).text('Recibo de pago', M, doc.y + 1, {
    width: ANCHO,
    align: 'right',
  });

  // --- Marca de anulado ---
  //
  // Va arriba del cuerpo y bien visible. Un papel que ya no vale, impreso sin
  // marca, es el peor resultado posible: alguien lo cobra.
  if (r.estado === 'anulado') {
    doc.moveDown(0.8);
    const y = doc.y;
    doc.roundedRect(M, y, 132, 24, 3).strokeColor(ROJO).lineWidth(1.6).stroke();
    doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(12).text('ANULADO', M, y + 7, {
      width: 132,
      align: 'center',
    });
    doc.fillColor(GRIS).font('Helvetica').fontSize(8).text('No válido para pago', M + 140, y + 8);
    doc.y = y + 34;
  }

  doc.moveDown(1.4);

  // --- Datos ---
  const filas: [string, string][] = [
    ['Fecha', fechaLarga(r.fecha_emision)],
    ['Socio', r.socio_nombre || '—'],
  ];
  if (r.socio_dni) filas.push(['DNI', r.socio_dni]);
  if (r.mes != null && r.anio != null) filas.push(['Corresponde a', `Cuota de ${MESES[r.mes - 1]} de ${r.anio}`]);
  filas.push(['Concepto', r.concepto || 'Cuota mensual']);
  filas.push(['Forma de pago', FORMAS[r.forma_pago] || r.forma_pago]);

  const ETIQUETA_W = 105;
  for (const [etiqueta, valor] of filas) {
    const y = doc.y;
    doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(etiqueta, M, y, { width: ETIQUETA_W });
    doc.fillColor('#111827').fontSize(10).text(valor, M + ETIQUETA_W, y, {
      width: ANCHO - ETIQUETA_W,
    });
    doc.moveDown(0.45);
  }

  // --- Monto ---
  doc.moveDown(0.8);
  const yCaja = doc.y;
  doc.roundedRect(M, yCaja, ANCHO, 46, 4).fillColor('#F9FAFB').fill();
  doc.roundedRect(M, yCaja, ANCHO, 46, 4).strokeColor('#E5E7EB').lineWidth(1).stroke();
  doc.fillColor('#374151').font('Helvetica').fontSize(11).text('Total pagado', M + 16, yCaja + 17);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(17).text(plata(Number(r.monto)), M, yCaja + 13, {
    width: ANCHO - 16,
    align: 'right',
  });
  doc.y = yCaja + 58;

  // --- Motivo de anulación ---
  if (r.estado === 'anulado' && r.anulado_motivo) {
    doc.moveDown(0.4);
    doc.fillColor(ROJO).font('Helvetica-Bold').fontSize(9).text('Motivo de la anulación:', M, doc.y);
    doc.moveDown(0.2);
    doc.fillColor(GRIS).font('Helvetica').fontSize(9).text(r.anulado_motivo, M, doc.y, { width: ANCHO });
  }

  // --- Pie ---
  doc.moveDown(1.4);
  const yLinea = doc.y;
  doc.strokeColor('#E5E7EB').lineWidth(1);
  doc.moveTo(M, yLinea).lineTo(M + ANCHO, yLinea).stroke();

  doc.moveDown(0.8);
  doc.fillColor(GRIS).fontSize(8).lineGap(2.5).text(
    'Recibo emitido por el club como comprobante de percepción de pago. Las cuotas mensuales y el seguro de accidentes de los jugadores se rigen por los estatutos del club y por las resoluciones de la Comisión Directiva que los apruebe. Conservar este comprobante.',
    M,
    doc.y,
    { width: ANCHO }
  );

  // --- Firmas ---
  const FIRMA_W = 190;
  const yFirma = doc.page.height - 110;
  doc.lineGap(0).strokeColor('#9CA3AF');
  doc.moveTo(M, yFirma).lineTo(M + FIRMA_W, yFirma).stroke();
  doc.moveTo(M + ANCHO - FIRMA_W, yFirma).lineTo(M + ANCHO, yFirma).stroke();
  doc.fillColor(GRIS).fontSize(8).text('Recibí conforme', M, yFirma + 6, { width: FIRMA_W, align: 'center' });
  doc.text('Por el club', M + ANCHO - FIRMA_W, yFirma + 6, { width: FIRMA_W, align: 'center' });
}

/** pdfkit escribe por chunks: se juntan en un Buffer. */
function aBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    doc.on('data', (c: Buffer) => trozos.push(c));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
    doc.end();
  });
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

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `Recibo ${r.numero}`,
      Author: 'Fenix Roller Hockey',
    } });
    dibujarRecibo(doc, r);
    const buffer = await aBuffer(doc);

    // Se anota la descarga. Sirve para saber qué comprobante se entregó a
    // quién: ante un reclamo, "el club nunca nos dio recibo" se responde
    // mirando esto.
    await marcarReciboDescargado(id, auth.user.id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${r.numero}.pdf"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err: any) {
    console.error('Recibo PDF:', err);
    return NextResponse.json({ error: 'No se pudo generar el recibo' }, { status: 500 });
  }
}
