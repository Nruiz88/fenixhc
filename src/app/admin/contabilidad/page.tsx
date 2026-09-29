export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireModulo } from '@/lib/auth';
import { calcularReporteContable, fechaValida } from '@/lib/contabilidad';
import { money, percent, fecha, antiguedad, periodo as fmtPeriodo, mesNombre } from '@/lib/format';
import { todayISO, monthStartISO, monthEndISO } from '@/lib/dates';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Toolbar, Hint } from '@/components/admin/ui';
import { BarrasComposicion, BarrasAntiguedad, GraficoMensual } from '@/components/admin/charts';
import { Button } from '@/components/ui/button';
import { Download, Wallet, AlertTriangle, ArrowRight } from 'lucide-react';

export default async function ContabilidadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await requireModulo('contabilidad');
  if ('error' in auth) redirect('/admin/dashboard');

  const sp = await searchParams;
  const one = (k: string, d: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : d);

  const anioHoy = new Date().getFullYear();
  const mesHoy = new Date().getMonth() + 1;

  const desde = fechaValida(one('desde', monthStartISO()), monthStartISO());
  const hasta = fechaValida(one('hasta', todayISO()), todayISO());
  const anio = Math.min(Math.max(Number(one('anio', String(anioHoy))) || anioHoy, 2000), 2100);
  const mes = Math.min(Math.max(Number(one('mes', String(mesHoy))) || mesHoy, 1), 12);
  const preset = one('preset', 'mes');

  const r = await calcularReporteContable({ desde, hasta, anio, mes });

  // Presets: los tres períodos que realmente se piden. Se ofrecen como
  // links con las fechas ya en la URL, así el botón "atrás" del navegador
  // funciona y el filtro se puede compartir por mail.
  const hoyStr = todayISO();
  const presets = [
    { clave: 'mes', etiqueta: 'Mes en curso', desde: monthStartISO(), hasta: hoyStr },
    { clave: 'mes-anterior', etiqueta: 'Mes anterior', desde: monthStartISO(-1), hasta: monthEndISO(-1) },
    { clave: 'anio', etiqueta: 'Año en curso', desde: `${anioHoy}-01-01`, hasta: hoyStr },
  ];

  const sinClasificar = [...r.categoriasIngreso, ...r.categoriasEgreso]
    .filter((c) => c.etiqueta === 'Sin clasificar');
  const montoSinClasificar = sinClasificar.reduce((s, c) => s + c.valor, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contabilidad"
        description="Cómo viene el mes: cuánto entró, cuánto salió, cuánto falta cobrar y a quién."
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/admin/finanzas" />}>
              Ver movimientos
            </Button>
            <Button size="sm" render={<Link href="/admin/reportes" />}>
              <Download className="h-4 w-4" />Exportar
            </Button>
          </>
        }
      />

      {/* Filtro de período */}
      <Panel bodyClassName="p-3">
        <Toolbar>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Link key={p.clave} href={`/admin/contabilidad?preset=${p.clave}&desde=${p.desde}&hasta=${p.hasta}`}>
                  <Button size="sm" variant={preset === p.clave ? 'default' : 'outline'}>
                    {p.etiqueta}
                  </Button>
                </Link>
              ))}
            </div>
            <form className="flex items-end gap-2" method="get">
              <input type="hidden" name="preset" value={preset} />
              <label className="flex flex-col gap-1 text-[11px] text-dim">
                Desde
                <input
                  type="date" name="desde" defaultValue={desde}
                  className="h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-dim">
                Hasta
                <input
                  type="date" name="hasta" defaultValue={hasta}
                  className="h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                />
              </label>
              <Button type="submit" variant="outline" size="sm">Aplicar</Button>
            </form>
          </div>
          <p className="shrink-0 text-xs text-dim">
            {fecha(desde)} — {fecha(hasta)} · {r.periodo.dias} días
          </p>
        </Toolbar>
      </Panel>

      {montoSinClasificar > 0 && (
        <Hint tone="warn">
          Hay {money(montoSinClasificar)} en movimientos sin categoría reconocida.
          Los montos están incluidos en los totales de arriba, pero no se pueden
          desglosar. Corregí la categoría al cargarlos en{' '}
          <Link href="/admin/finanzas" className="underline">Finanzas</Link>.
        </Hint>
      )}

      {/* Cifras principales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos del período" value={money(r.resumen.ingresos)}
          tone="ok" icon={<ArrowRight className="h-4 w-4 rotate-[-45deg]" />}
        />
        <StatCard
          label="Egresos del período" value={money(r.resumen.egresos)}
          tone="danger" icon={<ArrowRight className="h-4 w-4 rotate-45" />}
        />
        <StatCard
          label="Resultado" value={money(r.resumen.resultado)}
          hint={r.resumen.ingresos > 0 ? `Margen ${percent(r.resumen.margen, 1)}` : 'Sin ingresos en el período'}
          tone={r.resumen.resultado >= 0 ? 'ok' : 'danger'}
        />
        <StatCard
          label="Saldo en caja" value={money(r.resumen.saldoEnCaja)}
          hint="Acumulado histórico" tone="brand" icon={<Wallet className="h-4 w-4" />}
        />
      </div>

      {/* Gráfico 12 meses + antigüedad de cartera */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Panel
          title="Ingresos y egresos por mes"
          description="Últimos 12 meses con movimientos cargados"
          className="xl:col-span-3"
        >
          <GraficoMensual datos={r.serie} />
        </Panel>

        <Panel title="Cuotas por cobrar" description="Distribución por antigüedad" className="xl:col-span-2">
          <BarrasAntiguedad bloques={r.cartera.bloques} />
          <div className="mt-4 space-y-1 border-t border-line pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Total pendiente</span>
              <span className="font-semibold tabular text-main">{money(r.cartera.total)}</span>
            </div>
            {r.cartera.vencido > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-warn">De eso, ya vencido</span>
                <span className="font-semibold tabular text-warn">{money(r.cartera.vencido)}</span>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Composición por categoría */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="De dónde vino el dinero" description={`Total ${money(r.resumen.ingresos)}`}>
          <BarrasComposicion datos={r.categoriasIngreso} vacio="No hay ingresos cargados en este período." />
        </Panel>
        <Panel title="A dónde se fue el dinero" description={`Total ${money(r.resumen.egresos)}`}>
          <BarrasComposicion datos={r.categoriasEgreso} vacio="No hay egresos cargados en este período." />
        </Panel>
      </div>

      {/* Cobranza del mes */}
      <Panel
        title={`Cobranza de ${mesNombre(mes)} ${anio}`}
        description="Sobre las cuotas emitidas, cuántas se cobraron"
        actions={<Button variant="outline" size="sm" render={<Link href="/admin/pagos" />}>Ir a pagos</Button>}
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Emitido" value={money(r.cuotasDelMes.montoEmitido)} hint={`${r.cuotasDelMes.emitidas} cuotas`} />
          <StatCard label="Cobrado" value={money(r.cuotasDelMes.cobrado)} hint={`${r.cuotasDelMes.pagadas} cuotas`} tone="ok" />
          <StatCard
            label="Pendiente de cobro"
            value={money(r.cuotasDelMes.montoEmitido - r.cuotasDelMes.cobrado)}
            hint={`${r.cuotasDelMes.pendientes} cuotas`}
            tone="warn"
          />
          <StatCard
            label="Cobranza"
            value={r.cuotasDelMes.montoEmitido > 0 ? percent(r.cuotasDelMes.cobranza, 0) : '—'}
            hint="Del total emitido"
            tone={r.cuotasDelMes.cobranza >= 0.8 ? 'ok' : 'warn'}
          />
        </div>
      </Panel>

      {/* Detalle de la cartera */}
      <Panel
        title="Quién debe qué"
        description={`${r.cartera.filas.length} cuotas pendientes, de la más antigua a la más reciente.`}
        bodyClassName="p-0"
      >
        {r.cartera.filas.length === 0 ? (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="No hay cuotas pendientes"
            description="Todos los socios están al día. Acá aparecen las cuotas emitidas que todavía no se cobraron."
          />
        ) : (
          <>
            {/* Tabla en pantallas grandes */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-dim">
                    <th className="px-4 py-2.5 font-medium">Socio</th>
                    <th className="px-4 py-2.5 font-medium">Jugador</th>
                    <th className="px-4 py-2.5 font-medium">Período</th>
                    <th className="px-4 py-2.5 text-right font-medium">Monto</th>
                    <th className="px-4 py-2.5 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {r.cartera.filas.map((f) => (
                    <tr key={f.id} className="transition-colors hover:bg-surface-2">
                      <td className="px-4 py-2.5">
                        <p className="truncate font-medium text-main" title={f.socio}>{f.socio}</p>
                        {f.contacto && <p className="truncate text-xs text-dim">{f.contacto}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {f.jugador ? <span className="truncate">{f.jugador}</span> : <span className="text-dim">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{fmtPeriodo(f.mes, f.anio)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular text-main">{money(f.monto)}</td>
                      <td className="px-4 py-2.5">
                        {f.vencido
                          ? <StatusPill tone="danger">{antiguedad(f.vencimiento)}</StatusPill>
                          : <StatusPill tone="ok">Al día</StatusPill>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas en móvil: cinco columnas no entran */}
            <ul className="divide-y divide-line md:hidden">
              {r.cartera.filas.map((f) => (
                <li key={f.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-main">{f.socio}</p>
                      {f.jugador && <p className="truncate text-xs text-dim">{f.jugador}</p>}
                    </div>
                    <span className="shrink-0 font-semibold tabular text-main">{money(f.monto)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill tone={f.vencido ? 'danger' : 'ok'}>
                      {f.vencido ? antiguedad(f.vencimiento) : 'Al día'}
                    </StatusPill>
                    <span className="text-xs text-dim">{fmtPeriodo(f.mes, f.anio)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
}
