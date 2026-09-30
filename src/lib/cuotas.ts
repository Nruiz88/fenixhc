// Cálculo de recargos de cuota.
//
// Reglas (definidas con el club, ver mariadb/06_configuracion_cuota.sql):
//
// - El recargo se CALCULA, no se guarda. `cuotas.monto` es siempre el monto
//   base; el recargo se deriva de la fecha. Así, cambiar un porcentaje hoy
//   recalcula las cuotas pendientes de mañana sin tocar la base, y nunca
//   queda un recargo viejo congelado sobre una cuota que ya se cobró.
//
// - Los hitos se toman del mes SIGUIENTE al de la cuota. La cuota de marzo
//   vence el 10 de abril. De ese modo una cuota del mes en curso nunca tiene
//   recargo, que es lo que espera la gente al ver "0% de recargo".
//
// - El día del hito puede no existir en un mes corto (el 30 de febrero). En
//   ese caso se usa el último día real de ese mes, que es lo que hace un
//   calendario de paper. Truncar al último día corre el vencimiento un
//   poquito antes de lo que el club espera, que es el lado correcto del error.
//
// Este archivo es lógica pura y lo importan tanto el servidor como los
// componentes de cliente, así que no puede arrastrar el pool de MySQL. El
// acceso a la configuración vive en `cuotas-db.ts`.

export interface Vencimiento {
  id: string;
  dia: number;
  porcentaje: number;
  etiqueta: string | null;
  activo: boolean;
  orden: number;
}

export interface ConfigCuotas {
  montoBase: number;
  vencimientos: Vencimiento[];
}

export interface ResultadoRecargo {
  /** Monto base de la cuota, sin recargo. */
  montoBase: number;
  /** Porcentaje que aplica hoy (0 si no venció ningún hito). */
  porcentaje: number;
  /** Monto del recargo en pesos. */
  recargo: number;
  /** Lo que hay que cobrar hoy: base + recargo. */
  total: number;
  /** Fecha del hito que rige hoy, o null si todavía no venció ninguno. */
  hito: Vencimiento | null;
  /** Fecha en que se cumplió el hito vigente. */
  fechaHito: Date | null;
  /** Días corridos desde el hito vigente. 0 si no venció. */
  diasVencida: number;
  /** Próximo hito y su fecha, para poder avisarle al socio. */
  proximo: { vencimiento: Vencimiento; fecha: Date } | null;
  /** Días hasta el próximo hito. */
  diasParaProximo: number | null;
}

/**
 * Cantidad de días del mes siguiente al de la cuota.
 *
 * `mes` viene en base 1 (enero = 1). En JavaScript `new Date` usa base 0, así
 * que el mes siguiente al de la cuota es el índice `mes`. El último día de un
 * mes es el día 0 del mes siguiente: `new Date(anio, mes + 1, 0)`.
 *
 * Ojo con el +1: con `new Date(anio, mes, 0)` se obtendría el último día del
 * mes de la cuota y no el del siguiente, y el clamp no se aplicaría nunca.
 */
function diasDelMesSiguiente(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate();
}

/**
 * Fecha del hito: día del mes siguiente al de la cuota.
 *
 * Dos cuidados:
 *
 * - `new Date(anio, mes, dia)` con mes 1-12 resuelve solo el cambio de año
 *   (diciembre + 1 = enero siguiente).
 *
 * - Un día que no existe en meses cortos hay que clampear a mano. El 30 de
 *   febrero, `new Date(2026, 2, 30)` no da el 28 de febrero sino el 2 de
 *   marzo: JS desborda al mes siguiente. Eso corría el vencimiento dos días
 *   tarde y cobraba recargo sobre una cuota que todavía no había vencido.
 */
function fechaHito(mes: number, anio: number, dia: number): Date {
  const ultimoDia = diasDelMesSiguiente(anio, mes);
  return new Date(anio, mes, Math.min(dia, ultimoDia), 0, 0, 0, 0);
}

/** Compara solo día, mes y año, ignorando la hora. */
function aFecha(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Calcula el recargo que aplica hoy para una cuota.
 *
 * El hike vigente es el último hito cuya fecha ya pasó. Si el socio paga
 * tarde, el recargo sube solo; si paga antes del primer hito, no hay recargo.
 */
export function calcularRecargo(
  montoBase: number,
  mes: number,
  anio: number,
  vencimientos: Vencimiento[],
  hoy: Date = new Date(),
  override?: string | Date | null
): ResultadoRecargo {
  const base = Number(montoBase) || 0;

  // Sin vencimientos cargados no hay recargo posible. Es el caso de una
  // instalación recién hecha: es preferible no cobrar recargo a cobrar uno
  // inventado.
  if (!vencimientos.length) {
    return {
      montoBase: base, porcentaje: 0, recargo: 0, total: base,
      hito: null, fechaHito: null, diasVencida: 0,
      proximo: null, diasParaProximo: null,
    };
  }

  const activos = vencimientos
    .filter((v) => v.activo)
    .slice()
    .sort((a, b) => a.dia - b.dia);

  const hoyMs = aFecha(hoy);

  /**
   * Con un vencimiento pactado puntualmente (override) se corre toda la
   * escala: la fecha acordada es el primer hito, y los siguientes caen a la
   * misma cantidad de días de diferencia que entre los hitos de la regla
   * general.
   *
   * Ej: con hitos 10/20/30 y un acuerdo de vencimiento el 15 de mayo, el
   * primer tramo arranca el 15, el segundo el 25 y el tercero el 5 de junio.
   * Así el acuerdo mueve toda la escala en vez de dejar los otros dos hitos
   * clavados en el día 20 y 30, que es lo que rompía antes: con la cuota
   * vencida un solo día después del acuerdo ya saltaba directo al 20%.
   */
  const fechas: { vencimiento: Vencimiento; fecha: Date }[] = override
    ? (() => {
        const base = typeof override === 'string' ? new Date(`${override}T00:00:00`) : override;
        const diaBase = activos[0]?.dia ?? 10;
        return activos.map((v) => {
          const f = new Date(base.getTime());
          f.setDate(f.getDate() + (v.dia - diaBase));
          f.setHours(0, 0, 0, 0);
          return { vencimiento: v, fecha: f };
        });
      })()
    : activos.map((v) => ({ vencimiento: v, fecha: fechaHito(mes, anio, v.dia) }));

  let vigente: Vencimiento | null = null;
  let fechaVigente: Date | null = null;
  let proximo: { vencimiento: Vencimiento; fecha: Date } | null = null;

  for (const { vencimiento, fecha } of fechas) {
    // Estrictamente menor: el recargo arranca al día SIGUIENTE del hito.
    // El día del hito todavía se puede pagar sin recargo, que es lo que
    // entiende alguien que lee "vence el día 10".
    if (aFecha(fecha) < hoyMs) {
      vigente = vencimiento;
      fechaVigente = fecha;
    } else if (!proximo) {
      proximo = { vencimiento, fecha };
    }
  }

  const pct = vigente ? Number(vigente.porcentaje) : 0;
  const recargo = (base * pct) / 100;

  return {
    montoBase: base,
    porcentaje: pct,
    // Redondeo a 2 decimales: la base se guarda con 2, y sin redondear el
    // 5% de un monto con centavos produce fracciones que no cierran contra
    // lo que efectivamente entró en caja.
    recargo: Math.round(recargo * 100) / 100,
    total: Math.round((base + recargo) * 100) / 100,
    hito: vigente,
    fechaHito: fechaVigente,
    diasVencida: fechaVigente ? Math.round((hoyMs - aFecha(fechaVigente)) / 86400000) : 0,
    proximo,
    diasParaProximo: proximo ? Math.round((aFecha(proximo.fecha) - hoyMs) / 86400000) : null,
  };
}
