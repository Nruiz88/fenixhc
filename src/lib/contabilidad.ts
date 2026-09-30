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
import { calcularRecargo } from './cuotas';
import { leerConfigCuotasSegura } from './cuotas-db';

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
    montoBase: number;
    recargo: number;
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
  /** Fecha del hito de vencimiento que rige hoy, o la primera si aún no venció. */
  vencimiento: Date | null;
  socio: string;
  jugador: string | null;
  contacto: string | null;
  /** Días desde que se cumplió el hito vigente. 0 si la cuota está al día. */
  dias: number;
  vencido: boolean;
  /** Porcentaje de recargo que aplica hoy. */
  porcentajeRecargo: number;
  /** Monto del recargo en pesos. */
  recargo: number;
  /** Lo que se puede cobrar hoy: base + recargo. */
  total: number;
  /** Etiqueta del tramo, para explicar en pantalla por qué hay recargo. */
  tramo: string | null;
}

/**
 * Tramo de antigüedad ya calculado.
 *
 * OJO: acá NO hay `test`, y es a propósito. Esta estructura cruza del
 * Server Component al Client Component (`BarrasAntiguedad`), y Next no puede
 * serializar funciones: la página entera devolvía 500 en producción con
 * "Functions cannot be passed directly to Client Components".
 *
 * La clasificación se hace acá, en el servidor, y de acá sale solo el
 * resultado. Si alguna vez hace falta filtrar en el cliente, se hace con
 * `clave` o con `porcentajeRecargo`, que sí son datos.
 */
export interface BloqueAntiguedad {
  clave: string;
  etiqueta: string;
  cantidad: number;
  total: number;
}

// Se clasifica por porcentaje de recargo y no por días: lo que le importa al
// tesorero de la cartera vencida es cuánto está costando cada tramo. Además
// evita inventar días para cuotas que no vencen por el paso del tiempo sino
// por un acuerdo puntual.
const TRAMOS: { clave: string; etiqueta: string; entra: (pct: number) => boolean }[] = [
  { clave: 'al_dia', etiqueta: 'Al día', entra: (pct) => pct === 0 },
  { clave: 'r1', etiqueta: 'Primer recargo', entra: (pct) => pct > 0 && pct <= 10 },
  { clave: 'r2', etiqueta: 'Segundo recargo', entra: (pct) => pct > 10 && pct <= 20 },
  { clave: 'r3', etiqueta: 'Tercer recargo o más', entra: (pct) => pct > 20 },
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

  const [movs, cuotaMes, hist, serie, cartera, config] = await Promise.all([
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
    leerConfigCuotasSegura(),
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
    // El recargo se calcula con las fechas reales de vencimiento configuradas
    // por el club, no con una aproximación por meses. Una cuenta de esta se
    // puede defended sin que el total de la cartera coincida con la suma de
    // las filas.
    const rec = calcularRecargo(
      n(r.monto),
      n(r.mes),
      n(r.anio),
      config.vencimientos,
      hoy,
      r.vencimiento_override
    );
    const padre = [r.pn, r.pa].filter(Boolean).join(' ');
    const hijo = [r.hn, r.ha].filter(Boolean).join(' ');

    return {
      id: r.id,
      monto: n(r.monto),
      mes: n(r.mes),
      anio: n(r.anio),
      // Si la cuota todavía no venció ningún hito, se muestra la fecha del
      // primer hito como "cuándo vence", no null: la pantalla necesita
      // sayingle al socio algo concreto.
      vencimiento: rec.fechaHito ?? (rec.proximo ? rec.proximo.fecha : null),
      socio: padre || hijo || 'Sin nombre',
      jugador: hijo && hijo !== padre ? hijo : null,
      contacto: r.pc || r.pt || null,
      dias: rec.diasVencida,
      vencido: rec.porcentaje > 0,
      porcentajeRecargo: rec.porcentaje,
      recargo: rec.recargo,
      total: rec.total,
      tramo: rec.hito?.etiqueta ?? null,
    };
  });

  const bloques = TRAMOS.map((t) => {
    const items = filas.filter((f) => t.entra(f.porcentajeRecargo));
    return {
      clave: t.clave,
      etiqueta: t.etiqueta,
      cantidad: items.length,
      total: items.reduce((s, f) => s + f.total, 0),
    };
  });

  // El total a cobrar incluye el recargo vigente: es lo que el club puede
  // exigir hoy. Mostrar sólo la suma de los montos base haría que la cartera
  // pareciera menor de lo que es, y que "deuda vencida" no cuadre con la
  // suma de los tramos de arriba.
  const totalCobrar = filas.reduce((s, f) => s + f.total, 0);
  const recargoPorCobrar = filas.reduce((s, f) => s + f.recargo, 0);
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
      // Reparto: total = base + recargo. Se muestra para que el tesorero
      // pueda decir "de los $X que tenemos que cobrar, $Y son recargos".
      montoBase: filas.reduce((s, f) => s + f.monto, 0),
      recargo: recargoPorCobrar,
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
