// Cálculos contables del club.
//
// Todo vive acá y en un solo lugar, y la página de /admin/contabilidad lo
// usa. Si estos cálculos estuvieran embebidos en el JSX, cada cambio de
// fórmula obligaría a revisar la pantalla, y tarde o temprano el gráfico
// mostraría una cosa y el total otra.
//
// Dos decisiones que conviene no revertir sin pensarlo:
//
// 1) Los ingresos NO suman cuotas + caja. Las cuotas cobradas viven en la
//    tabla `cuotas` y los movimientos de caja en `finanzas`. Una cuota pagada
//    puede haberse registrado en las dos tablas (el tesorero marca la cuota
//    como pagada y además carga el ingreso en caja), y si se suman las dos
//    el club aparece con el doble de ingresos. Acá se usa `finanzas` como
//    fuente de la caja y las cuotas se muestran aparte, como referencia.
//
// 2) La antigüedad de una cuota se deriva de su período (mes/anio), porque
//    la tabla `cuotas` no tiene columna de vencimiento. Es una limitación
//    real del modelo: no se puede saber si una cuota de marzo se venció el
//    5 de abril o el 30.

import { query } from './db';

const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Valida fechas ISO simples (YYYY-MM-DD). Cualquier otra cosa cae al valor por defecto. */
export function fechaValida(v: unknown, fallback: string): string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return fallback;
  return Number.isNaN(new Date(`${v}T00:00:00Z`).getTime()) ? fallback : v;
}

export interface Categoria {
  etiqueta: string;
  valor: number;
  porcentaje: number;
}

/**
 * Normaliza el texto libre de `finanzas.categoria`.
 *
 * La columna es un VARCHAR y cada persona escribía distinto: "alquiler",
 * "Alquiler", "alquiler cancha", "luz". Agrupar crudo produce tres filas
 * que no suman al total del período, y el reporte queda sin cerrar. Lo que
 * no se reconoce cae en "Sin clasificar", que se muestra explícitamente en
 * la pantalla para que se corrija la carga en vez de perder el dato en
 * silencio.
 */
export function normalizarCategoria(categoria: unknown, tipo: 'ingreso' | 'egreso'): string {
  const c = String(categoria ?? '').trim().toLowerCase();
  if (!c) return 'Sin clasificar';

  if (tipo === 'ingreso') {
    if (/cuota|socio|membres/.test(c)) return 'Cuotas de socios';
    if (/sponsor|contrib/.test(c)) return 'Sponsors';
    if (/venta|entrada|torneo|cancha/.test(c)) return 'Ventas y otros ingresos';
    if (/donac/.test(c)) return 'Donaciones';
    return 'Sin clasificar';
  }

  if (/alquiler|luz|agua|internet|impuesto|tribut|gstas|gas|seguro|art/.test(c)) {
    return 'Alquiler y servicios';
  }
  if (/insumo|material|hockey|equipo|indumentaria|transitori/.test(c)) {
    return 'Insumos y equipamiento';
  }
  if (/sueldo|honorario|personal|subcontrat/.test(c)) return 'Personal';
  if (/transporte|viaje|viatic|nafta|combustible/.test(c)) return 'Transporte y viáticos';
  if (/arbitro|cancha|alquiler.*cancha|bede/.test(c)) return 'Canchas y competencia';
  if (/seguro/.test(c)) return 'Seguros';
  return 'Sin clasificar';
}

export interface ReporteContable {
  periodo: { desde: string; hasta: string; anio: number; mes: number; dias: number };
  resumen: {
    ingresos: number;
    egresos: number;
    resultado: number;
    margen: number;
    saldoEnCaja: number;
    ingresosTotales: number;
    egresosTotales: number;
  };
  categoriasIngreso: Categoria[];
  categoriasEgreso: Categoria[];
  cuotasDelMes: {
    emitidas: number;
    montoEmitido: number;
    cobrado: number;
    pagadas: number;
    pendientes: number;
    cobranza: number;
  };
  cartera: {
    total: number;
    vencido: number;
    vigente: number;
    filas: FilaCartera[];
    bloques: BloqueAntiguedad[];
  };
  serie: { periodo: string; ingresos: number; egresos: number }[];
}

export interface FilaCartera {
  id: string;
  monto: number;
  mes: number;
  anio: number;
  vencimiento: Date;
  socio: string;
  jugador: string | null;
  contacto: string | null;
  dias: number;
  vencido: boolean;
}

export interface BloqueAntiguedad {
  clave: string;
  etiqueta: string;
  test: (dias: number) => boolean;
  cantidad: number;
  total: number;
}

const BLOQUES: Omit<BloqueAntiguedad, 'cantidad' | 'total'>[] = [
  { clave: 'al_dia', etiqueta: 'Al día', test: (d) => d === 0 },
  { clave: '1_30', etiqueta: '1 a 30 días', test: (d) => d >= 1 && d <= 30 },
  { clave: '31_60', etiqueta: '31 a 60 días', test: (d) => d > 30 && d <= 60 },
  { clave: '61_90', etiqueta: '61 a 90 días', test: (d) => d > 60 && d <= 90 },
  { clave: 'mas_90', etiqueta: 'Más de 90 días', test: (d) => d > 90 },
];

const ETIQUETA_TIPO_SOCIO: Record<string, string> = {
  cadete: 'Cadete',
  activo: 'Activo',
  benefactor: 'Benefactor',
};

export function etiquetaTipoSocio(v: string): string {
  return ETIQUETA_TIPO_SOCIO[v] ?? v;
}

export async function calcularReporteContable(opts: {
  desde: string;
  hasta: string;
  anio: number;
  mes: number;
}): Promise<ReporteContable> {
  const { desde, hasta, anio, mes } = opts;

  const [movs, cuotaMes, hist, serie, cartera] = await Promise.all([
    query<any>(
      `SELECT tipo, categoria, metodo_pago, COUNT(*) AS movimientos, SUM(monto) AS total
       FROM finanzas
       WHERE fecha BETWEEN ? AND ?
       GROUP BY tipo, categoria, metodo_pago`,
      [desde, hasta]
    ),
    query<any>(
      `SELECT COUNT(*) AS emitidas,
              COALESCE(SUM(monto), 0) AS montoEmitido,
              COALESCE(SUM(CASE WHEN estado='pagada' THEN monto ELSE 0 END), 0) AS cobrado,
              COUNT(CASE WHEN estado='pagada'    THEN 1 END) AS pagadas,
              COUNT(CASE WHEN estado='pendiente' THEN 1 END) AS pendientes
       FROM cuotas WHERE anio = ? AND mes = ?`,
      [anio, mes]
    ),
    query<any>(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
         COALESCE(SUM(CASE WHEN tipo='egreso'  THEN monto ELSE 0 END), 0) AS egresos
       FROM finanzas`
    ),
    query<any>(
      `SELECT DATE_FORMAT(fecha,'%Y-%m') AS periodo,
              COALESCE(SUM(CASE WHEN tipo='ingreso' THEN monto ELSE 0 END), 0) AS ingresos,
              COALESCE(SUM(CASE WHEN tipo='egreso'  THEN monto ELSE 0 END), 0) AS egresos
       FROM finanzas
       WHERE fecha >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 11 MONTH),'%Y-%m-01')
         AND fecha <  DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH),'%Y-%m-01')
       GROUP BY periodo ORDER BY periodo`
    ),
    // Límite de 1000: es suficiente para leer la cartera, y si algún día
    // hace falta más, la página avisa que la lista está recortada en vez
    // de mostrar un total incompleto como si fuera completo.
    query<any>(
      `SELECT c.id, c.monto, c.mes, c.anio, c.tipo_socio,
              pp.nombre AS pn, pp.apellido AS pa, pp.correo AS pc, pp.telefono AS pt,
              dp.nombre AS hn, dp.apellido AS ha
       FROM cuotas c
       INNER JOIN familias f ON f.id = c.familia_id
       LEFT JOIN perfiles pp ON pp.id = f.padre_perfil_id
       LEFT JOIN perfiles dp ON dp.id = f.deportista_perfil_id
       WHERE c.estado = 'pendiente'
       ORDER BY c.anio, c.mes
       LIMIT 1000`
    ),
  ]);

  const ingresos = movs.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + n(m.total), 0);
  const egresos = movs.filter((m) => m.tipo === 'egreso').reduce((s, m) => s + n(m.total), 0);

  const ingresosHist = n(hist[0]?.ingresos);
  const egresosHist = n(hist[0]?.egresos);

  const agrupar = (tipo: 'ingreso' | 'egreso'): Categoria[] => {
    const base = tipo === 'ingreso' ? ingresos : egresos;
    const mapa = new Map<string, number>();
    for (const m of movs.filter((x) => x.tipo === tipo)) {
      const cat = normalizarCategoria(m.categoria, tipo);
      mapa.set(cat, (mapa.get(cat) ?? 0) + n(m.total));
    }
    return [...mapa.entries()]
      .map(([etiqueta, valor]) => ({ etiqueta, valor, porcentaje: base > 0 ? valor / base : 0 }))
      .sort((a, b) => b.valor - a.valor);
  };

  const hoy = new Date();
  const filas: FilaCartera[] = cartera.map((r) => {
    const mesesAtraso = (hoy.getFullYear() - n(r.anio)) * 12 + (hoy.getMonth() + 1 - n(r.mes));
    const dias = Math.max(0, Math.round(mesesAtraso * 30.44));
    const padre = [r.pn, r.pa].filter(Boolean).join(' ');
    const hijo = [r.hn, r.ha].filter(Boolean).join(' ');
    return {
      id: r.id,
      monto: n(r.monto),
      mes: n(r.mes),
      anio: n(r.anio),
      // La cuota de un mes se entiende vencida al día siguiente de cerrar
      // ese mes; se usa el día 1 del mes siguiente como referencia de cálculo.
      vencimiento: new Date(n(r.anio) || hoy.getFullYear(), n(r.mes) || 1, 1),
      socio: padre || hijo || 'Sin nombre',
      jugador: hijo && hijo !== padre ? hijo : null,
      contacto: r.pc || r.pt || null,
      dias,
      vencido: dias > 0,
    };
  });

  const bloques = BLOQUES.map((b) => {
    const items = filas.filter((f) => b.test(f.dias));
    return { ...b, cantidad: items.length, total: items.reduce((s, f) => s + f.monto, 0) };
  });

  const totalCobrar = filas.reduce((s, f) => s + f.monto, 0);
  const vencido = bloques.filter((b) => b.clave !== 'al_dia').reduce((s, b) => s + b.total, 0);

  const cs = cuotaMes[0] ?? {};
  const emitido = n(cs.montoEmitido);

  const dias = Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1;

  return {
    periodo: { desde, hasta, anio, mes, dias: Math.max(dias, 1) },
    resumen: {
      ingresos,
      egresos,
      resultado: ingresos - egresos,
      margen: ingresos > 0 ? (ingresos - egresos) / ingresos : 0,
      saldoEnCaja: ingresosHist - egresosHist,
      ingresosTotales: ingresosHist,
      egresosTotales: egresosHist,
    },
    categoriasIngreso: agrupar('ingreso'),
    categoriasEgreso: agrupar('egreso'),
    cuotasDelMes: {
      emitidas: n(cs.emitidas),
      montoEmitido: emitido,
      cobrado: n(cs.cobrado),
      pagadas: n(cs.pagadas),
      pendientes: n(cs.pendientes),
      cobranza: emitido > 0 ? n(cs.cobrado) / emitido : 0,
    },
    cartera: {
      total: totalCobrar,
      vencido,
      vigente: totalCobrar - vencido,
      filas,
      bloques,
    },
    serie: serie.map((s: any) => ({
      periodo: s.periodo,
      ingresos: n(s.ingresos),
      egresos: n(s.egresos),
    })),
  };
}
