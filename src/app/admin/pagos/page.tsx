'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { money, mesNombre, fecha, periodo as fmtPeriodo } from '@/lib/format';
import { mysqlDateTime } from '@/lib/dates';
import { useConfigCuotas } from '@/lib/useConfigCuotas';
import { aplicarBeca } from '@/lib/cuotas';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Toolbar, Hint, tonoEstadoCuota } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { DesgloseCuota, PillRecargo } from '@/components/admin/cuota';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, Clock, DollarSign, FileText, Search, X, Eye,
  Plus, AlertTriangle, XCircle, Paperclip, CalendarPlus,
} from 'lucide-react';

type Filtro = 'todas' | 'pendiente' | 'pagada' | 'rechazada';

const SIN_SEL = '__sin_seleccion__';

const FORM_VACIO = {
  familia_id: '',
  mes: String(new Date().getMonth() + 1),
  anio: String(new Date().getFullYear()),
  monto: '',
  metodo: 'transferencia',
};

const EMITIR_VACIO = {
  familia_id: '',
  mes: String(new Date().getMonth() + 1),
  anio: String(new Date().getFullYear()),
  monto: '',
};

const MESES = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: mesNombre(i + 1),
}));

const METODOS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'debito', label: 'Débito automático' },
  { value: 'credito', label: 'Tarjeta de crédito' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'mercadopago', label: 'MercadoPago (cobro online)' },
];

export default function AdminPagos() {
  const { calcular, listo: configLista, config } = useConfigCuotas();
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [anioFiltro, setAnioFiltro] = useState('todos');
  const [mesFiltro, setMesFiltro] = useState('todos');

  const [aVer, setAVer] = useState<any | null>(null);
  const [aRechazar, setARechazar] = useState<any | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  const [asignarAbierto, setAsignarAbierto] = useState(false);
  const [form, setForm] = useState({ ...FORM_VACIO });

  const [emitirAbierto, setEmitirAbierto] = useState(false);
  const [emitirModo, setEmitirModo] = useState<'una' | 'todas'>('una');
  const [emitirForm, setEmitirForm] = useState({ ...EMITIR_VACIO });
  const [emitiendo, setEmitiendo] = useState(false);

  async function cargar() {
    setCargando(true);
    const [{ data: c }, { data: f }] = await Promise.all([
      db.view<any>('admin_cuotas', { limit: 1000 }),
      db.view<any>('admin_familias'),
    ]);
    setCuotas(c ?? []);
    setFamilias(f ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  // Cifras del filtro actual, no de todo el historial: al buscar un socio
  // concreto el tesorero quiere ver cuánto debe esa persona, no el total
  // histórico del club.
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return cuotas
      .filter((c) => (filtro === 'todas' ? true : c.estado === filtro))
      .filter((c) => (anioFiltro === 'todos' ? true : c.anio === Number(anioFiltro)))
      .filter((c) => (mesFiltro === 'todos' ? true : c.mes === Number(mesFiltro)))
      .filter((c) => {
        if (!q) return true;
        const p = c.familias?.padre;
        const h = c.familias?.hijo;
        return [p?.nombre, p?.apellido, p?.correo, h?.nombre, h?.apellido, fmtPeriodo(c.mes, c.anio)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  }, [cuotas, filtro, busqueda, anioFiltro, mesFiltro]);

  const anios = useMemo(
    () => [...new Set(cuotas.map((c) => c.anio))].filter(Number.isFinite).sort((a, b) => b - a),
    [cuotas]
  );

  // Las opciones llevan la etiqueta visible: si no, el trigger muestra el UUID
  // de la familia en vez de los nombres.
  const opcionesFamilia = useMemo(
    () =>
      familias.length === 0
        ? [{ value: SIN_SEL, label: 'No hay familias vinculadas' }]
        : familias.map((f) => ({
            value: f.id,
            label: `${f.padre?.nombre ?? ''} ${f.padre?.apellido ?? ''}${
              f.hijo ? ` — ${f.hijo.nombre} ${f.hijo.apellido}` : ''
            }${Number(f.beca_porcentaje) > 0 ? ` · beca ${f.beca_porcentaje}%` : ''}`.trim(),
          })),
    [familias]
  );

  const opcionesAnio = useMemo(
    () => [
      { value: 'todos', label: 'Todos' },
      ...anios.map((a) => ({ value: String(a), label: String(a) })),
    ],
    [anios]
  );

  const resumen = useMemo(() => {
    const pagadas = filtradas.filter((c) => c.estado === 'pagada');
    const pendientes = filtradas.filter((c) => c.estado === 'pendiente');

    // Lo cobrado usa `monto_pagado` (lo que entró de verdad, con recargo) y
    // cae al monto base en las cuotas pagadas antes de que existiera esa
    // columna. Lo pendiente suma el total con recargo vigente, que es lo que
    // el club tiene derecho a cobrar hoy, no lo que figura en el catálogo.
    const cobradoDe = (c: any) => Number(c.monto_pagado) > 0 ? Number(c.monto_pagado) : Number(c.monto);
    const aCobrarDe = (c: any) =>
      calcular(Number(c.monto), Number(c.mes), Number(c.anio), c.vencimiento_override, Number(c.beca_porcentaje)).total;

    return {
      cobradas: pagadas.length,
      montoCobrado: pagadas.reduce((s, c) => s + cobradoDe(c), 0),
      pendientes: pendientes.length,
      montoPendiente: pendientes.reduce((s, c) => s + aCobrarDe(c), 0),
      recargoPorCobrar: pendientes.reduce(
        (s, c) => s + (aCobrarDe(c) - Number(c.monto)),
        0
      ),
      conComprobante: pendientes.filter((c) => c.comprobante_url).length,
    };
  }, [filtradas, calcular, configLista]);

  async function aprobar(c: any) {
    setProcesando(c.id);

    // Lo que entra en caja se calcula con el recargo vigente y se guarda en
    // `monto_pagado`. Sin esto, el recargo que efectivamente pagó el socio
    // desaparecía: la cuota decía $75.000, entró $78.750, y la contabilidad
    // reportaba $75.000.
    const r = calcular(Number(c.monto), Number(c.mes), Number(c.anio), c.vencimiento_override, Number(c.beca_porcentaje));

    // El filtro por `estado: 'pendiente'` es la protección contra una
    // aprobación vieja: si MercadoPago acreditó la cuota mientras la pantalla
    // estaba abierta, la fila ya no es pendiente y este UPDATE no la toca.
    const { data, error } = await db.update(
      'cuotas',
      {
        estado: 'pagada',
        fecha_pago: mysqlDateTime(),
        monto_pagado: r.total,
      },
      { id: c.id, estado: 'pendiente' }
    );
    setProcesando(null);

    if (error) { toast.error(error); return; }

    const affected = Number((data as { affected?: number } | null)?.affected ?? 0);
    if (affected === 0) {
      toast.info('La cuota ya estaba paga o cambió de estado. Actualizá la lista.');
      setAVer(null);
      await cargar();
      return;
    }

    toast.success(`Cuota de ${fmtPeriodo(c.mes, c.anio)} marcada como pagada`, {
      description:
        r.porcentaje > 0
          ? `${c.familias?.padre?.nombre} ${c.familias?.padre?.apellido} · ${money(r.total)} (incluye ${money(r.recargo)} de recargo)`
          : `${c.familias?.padre?.nombre} ${c.familias?.padre?.apellido} · ${money(r.total)}`,
    });
    setAVer(null);
    await cargar();
  }

  async function rechazar() {
    if (!aRechazar) return;
    const { data, error } = await db.update(
      'cuotas',
      { estado: 'pendiente', comprobante_url: null, fecha_pago: null, monto_pagado: null },
      // Solo se rechaza una cuota todavía pendiente. Si MercadoPago la pagó
      // mientras el modal estaba abierto, no se le borra el pago.
      { id: aRechazar.id, estado: 'pendiente' }
    );
    if (error) { toast.error(error); return; }

    const affected = Number((data as { affected?: number } | null)?.affected ?? 0);
    if (affected === 0) {
      toast.info('La cuota ya cambió de estado. Actualizá la lista.');
      setARechazar(null);
      setAVer(null);
      await cargar();
      return;
    }

    toast.success('Comprobante rechazado. La cuota vuelve a pendiente para que la persona lo vuelva a subir.');
    setARechazar(null);
    setAVer(null);
    await cargar();
  }

  /** Abre el alta de pago con el monto base que definió la administración. */
  function abrirAlta() {
    setForm({ ...FORM_VACIO, monto: config ? String(config.montoBase) : '' });
    setAsignarAbierto(true);
  }

  const familiaSeleccionada = familias.find((f) => f.id === form.familia_id);
  const becaSeleccionada = Number(familiaSeleccionada?.beca_porcentaje ?? 0);

  /**
   * Al elegir la familia se completa el monto con la beca ya aplicada.
   *
   * El alta manual registra una cuota pagada. Si el jugador tiene beca, cobrar
   * el precio de lista sería un error difícil de ver después, porque la cuota
   * queda saldada y nadie vuelve a mirarla.
   */
  function elegirFamiliaPago(valor: string) {
    const familiaId = valor === SIN_SEL ? '' : (valor ?? '');
    const familia = familias.find((f) => f.id === familiaId);
    const beca = Number(familia?.beca_porcentaje ?? 0);
    const base = Number(config?.montoBase ?? 0);

    setForm((f) => ({
      ...f,
      familia_id: familiaId,
      monto: base > 0 ? String(aplicarBeca(base, beca).monto) : f.monto,
    }));
  }

  /** Abre la emisión de cuotas pendientes con el monto base configurado. */
  function abrirEmision() {
    setEmitirModo('una');
    setEmitirForm({
      ...EMITIR_VACIO,
      familia_id: familias[0]?.id ?? '',
      monto: config ? String(config.montoBase) : '',
    });
    setEmitirAbierto(true);
  }

  async function emitir(e: React.FormEvent) {
    e.preventDefault();

    if (familias.length === 0) {
      toast.error('No hay familias vinculadas. Creá el vínculo primero en Vínculos familiares.');
      return;
    }
    if (emitirModo === 'una' && !emitirForm.familia_id) {
      toast.error('Elegí la familia');
      return;
    }

    const monto = Number(emitirForm.monto);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast.error('El monto de cada cuota tiene que ser mayor a cero');
      return;
    }

    setEmitiendo(true);
    try {
      const res = await fetch('/api/admin/emitir-cuota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: emitirModo,
          familiaId: emitirModo === 'una' ? emitirForm.familia_id : undefined,
          mes: Number(emitirForm.mes),
          anio: Number(emitirForm.anio),
          monto,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudieron emitir las cuotas');

      const data = json.data;
      const becadas =
        data.becadas > 0
          ? ` ${data.becadas} ${data.becadas === 1 ? 'cuota quedó' : 'cuotas quedaron'} en $0 por beca del 100%.`
          : '';

      if (data.creadas === 0) {
        toast.info('No se creó ninguna cuota nueva', {
          description: `Las cuotas de ${data.periodo} ya existían (${data.omitidas} omitidas).`,
        });
      } else {
        toast.success(
          `${data.creadas} ${data.creadas === 1 ? 'cuota emitida' : 'cuotas emitidas'}`,
          {
            description:
              data.omitidas > 0
                ? `${data.omitidas} ya existían y se omitieron. Período ${data.periodo}.${becadas}`
                : `Período ${data.periodo} · ${money(data.monto)} por cuota.${becadas}`,
          }
        );
      }

      setEmitirAbierto(false);
      await cargar();
    } catch (err) {
      toast.error('No se pudieron emitir las cuotas', {
        description: err instanceof Error ? err.message : 'Error de conexión',
      });
    } finally {
      setEmitiendo(false);
    }
  }

  async function asignar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.familia_id || !form.mes || !form.anio || !form.monto) {
      toast.error('Completá familia, mes, año y monto');
      return;
    }
    const monto = Number(form.monto);
    if (!Number.isFinite(monto) || monto <= 0) { toast.error('El monto tiene que ser mayor a cero'); return; }

    // Se valida contra la lista ya cargada porque el índice único de la base
    // es (familia, mes, año) y un insert duplicado revienta con un error de
    // SQL que no le dice nada a quien la está cargando.
    const existe = cuotas.find(
      (c) => c.familia_id === form.familia_id &&
             c.mes === Number(form.mes) &&
             c.anio === Number(form.anio)
    );
    if (existe) {
      toast.error(`Esa familia ya tiene cuota cargada para ${fmtPeriodo(form.mes, form.anio)}`);
      return;
    }

    setGuardando(true);
    const { error } = await db.insert('cuotas', {
      familia_id: form.familia_id,
      mes: Number(form.mes),
      anio: Number(form.anio),
      monto,
      // El precio de lista queda guardado aunque la cuota ya esté pagada: es
      // lo que permite mostrar cuánto se descontó por la beca.
      monto_lista: becaSeleccionada > 0 ? Number(config?.montoBase ?? monto) : monto,
      beca_porcentaje: becaSeleccionada,
      estado: 'pagada',
      fecha_pago: mysqlDateTime(),
      tipo_socio: 'benefactor',
      metodo_pago: form.metodo,
    });
    setGuardando(false);

    if (error) { toast.error(error); return; }
    toast.success('Pago registrado');
    setForm({ ...FORM_VACIO });
    setAsignarAbierto(false);
    await cargar();
  }

  const hayFiltros = filtro !== 'todas' || anioFiltro !== 'todos' || mesFiltro !== 'todos' || !!busqueda;

  // Recargo de la cuota abierta en el modal, para comparar el importe del
  // comprobante contra el total que corresponde.
  const recModal = aVer
    ? calcular(Number(aVer.monto), Number(aVer.mes), Number(aVer.anio), aVer.vencimiento_override, Number(aVer.beca_porcentaje))
    : { montoBase: 0, porcentaje: 0, recargo: 0, total: 0, diasVencida: 0, fechaHito: null, diasParaProximo: null, becaPorcentaje: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos de cuotas"
        description="Emitir las cuotas del mes, aprobar comprobantes y registrar pagos."
        actions={
          <>
            <Button variant="outline" onClick={abrirAlta}>
              <Plus className="h-4 w-4" />Registrar pago
            </Button>
            <Button onClick={abrirEmision}>
              <CalendarPlus className="h-4 w-4" />Emitir cuotas
            </Button>
          </>
        }
      />

      {resumen.conComprobante > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/25 bg-warn/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warn" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-warn">
                {resumen.conComprobante} {resumen.conComprobante === 1 ? 'comprobante espera' : 'comprobantes esperan'} tu revisión
              </p>
              <p className="truncate text-xs text-warn/80">
                Los socios subieron el comprobante de su pago. Revisá que el importe coincida antes de aprobar.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => { setFiltro('pendiente'); setBusqueda(''); }}>
            Verlas
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cobrado" value={money(resumen.montoCobrado)}
          hint={`${resumen.cobradas} cuotas`} tone="ok" icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Pendiente de cobro"
          value={money(resumen.montoPendiente)}
          hint={
            resumen.recargoPorCobrar > 0
              ? `Incluye ${money(resumen.recargoPorCobrar)} de recargo`
              : `${resumen.pendientes} cuotas`
          }
          tone="warn" icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Para revisar" value={resumen.conComprobante}
          hint="Comprobantes sin aprobar" tone={resumen.conComprobante > 0 ? 'brand' : 'neutral'} icon={<Paperclip className="h-4 w-4" />}
        />
        <StatCard
          label="Total en la vista" value={money(resumen.montoCobrado + resumen.montoPendiente)}
          hint={`${filtradas.length} cuotas`} icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Lista */}
      <Panel
        title="Cuotas"
        description={`${filtradas.length} de ${cuotas.length}`}
        bodyClassName="p-0"
      >
        <div className="space-y-3 border-b border-line p-3">
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o período"
                  className="pl-8"
                  aria-label="Buscar cuotas"
                />
              </div>
              {hayFiltros && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setBusqueda(''); setFiltro('todas'); setAnioFiltro('todos'); setMesFiltro('todos'); }}
                >
                  <X className="h-4 w-4" />Limpiar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={mesFiltro}
                onValueChange={(v) => v && setMesFiltro(v)}
                items={[{ value: 'todos', label: 'Todos los meses' }, ...MESES]}
              >
                <SelectTrigger className="w-36"><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los meses</SelectItem>
                  {MESES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anioFiltro} onValueChange={(v) => v && setAnioFiltro(v)} items={opcionesAnio}>
                <SelectTrigger className="w-28"><SelectValue placeholder="Año" /></SelectTrigger>
                <SelectContent>
                  {opcionesAnio.map((a) => (
                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Toolbar>

          <div className="flex flex-wrap gap-1.5">
            {([
              ['todas', 'Todas'],
              ['pendiente', 'Pendientes'],
              ['pagada', 'Pagadas'],
              ['rechazada', 'Rechazadas'],
            ] as [Filtro, string][]).map(([valor, etiqueta]) => (
              <Button
                key={valor}
                size="sm"
                variant={filtro === valor ? 'default' : 'outline'}
                onClick={() => setFiltro(valor)}
              >
                {etiqueta}
              </Button>
            ))}
          </div>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="h-6 w-6" />}
            title={cuotas.length === 0 ? 'Todavía no hay cuotas emitidas' : 'Ninguna cuota coincide con el filtro'}
            description={
              cuotas.length === 0
                ? 'Emití las cuotas del mes para que las familias las vean y paguen, o registrá un pago que llegó por otro canal.'
                : 'Probá con otro nombre, otro mes o quitá los filtros.'
            }
            action={
              cuotas.length === 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={abrirEmision}>
                    <CalendarPlus className="h-4 w-4" />Emitir cuotas
                  </Button>
                  <Button variant="outline" onClick={abrirAlta}>
                    <Plus className="h-4 w-4" />Registrar pago
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiltro('todas');
                    setBusqueda('');
                    setAnioFiltro('todos');
                    setMesFiltro('todos');
                  }}
                >
                  Ver todas
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtradas.map((c) => {
              const padre = c.familias?.padre;
              const hijo = c.familias?.hijo;
              const tono = tonoEstadoCuota(c.estado);
              const comprobante = c.estado === 'pendiente' && c.comprobante_url;
              const rec = calcular(Number(c.monto), Number(c.mes), Number(c.anio), c.vencimiento_override, Number(c.beca_porcentaje));
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span
                    className={
                      c.estado === 'pagada'
                        ? 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok'
                        : comprobante
                          ? 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-info/10 text-info'
                          : 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warn/10 text-warn'
                    }
                  >
                    {c.estado === 'pagada' ? <CheckCircle2 className="h-5 w-5" /> : comprobante ? <FileText className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-main">
                        {padre?.nombre} {padre?.apellido}
                      </p>
                      <StatusPill tone={tono.tone}>{tono.label}</StatusPill>
                      {c.metodo_pago === 'mercadopago' && (
                        <StatusPill tone="info">MercadoPago</StatusPill>
                      )}
                      {comprobante && <StatusPill tone="info"><Paperclip className="h-3 w-3" />Para revisar</StatusPill>}
                      {Number(c.beca_porcentaje) > 0 && (
                        <StatusPill tone="info">Beca {Number(c.beca_porcentaje)}%</StatusPill>
                      )}
                      {c.estado === 'pendiente' && rec.porcentaje > 0 && (
                        <PillRecargo porcentaje={rec.porcentaje} />
                      )}
                    </div>
                    <p className="truncate text-xs text-dim">
                      {fmtPeriodo(c.mes, c.anio)}
                      {hijo ? ` · ${hijo.nombre} ${hijo.apellido}` : ''}
                      {c.fecha_pago ? ` · pagado el ${fecha(c.fecha_pago)}` : ''}
                    </p>
                  </div>

                  {/* Pagada muestra lo que entró; pendiente muestra lo que
                      hay que cobrar hoy, base más recargo. Son dos números
                      distintos a propósito y no se deben unificar. */}
                  {c.estado === 'pagada' && Number(c.monto_pagado) > 0 ? (
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold tabular text-ok">
                        {money(Number(c.monto_pagado))}
                      </span>
                      {Number(c.monto_pagado) > Number(c.monto) && (
                        <span className="block text-[11px] tabular text-dim">
                          base {money(c.monto)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <DesgloseCuota
                      compacto
                      montoBase={rec.montoBase}
                      montoLista={Number(c.monto_lista ?? c.monto)}
                      becaPorcentaje={rec.becaPorcentaje}
                      porcentaje={rec.porcentaje}
                      recargo={rec.recargo}
                      total={rec.total}
                    />
                  )}

                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.comprobante_url && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-dim hover:text-info"
                        onClick={() => setAVer(c)}
                        aria-label={`Ver comprobante de ${padre?.nombre}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    {c.estado === 'pendiente' && (
                      <Button
                        size="sm"
                        variant="success"
                        disabled={procesando === c.id}
                        onClick={() => aprobar(c)}
                      >
                        {procesando === c.id ? 'Aprobando…' : 'Aprobar'}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Comprobante */}
      <Dialog open={!!aVer} onOpenChange={(o) => !o && setAVer(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain sm:max-w-2xl">
          {aVer && (
            <>
              <DialogHeader>
                <DialogTitle>Comprobante de pago</DialogTitle>
                <DialogDescription>
                  {aVer.familias?.padre?.nombre} {aVer.familias?.padre?.apellido} ·{' '}
                  {mesNombre(aVer.mes)} {aVer.anio}
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-hidden rounded-lg border border-line bg-surface-2">
                {aVer.comprobante_url?.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={aVer.comprobante_url}
                    className="h-[55dvh] min-h-64 w-full"
                    title="Comprobante de pago"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={aVer.comprobante_url}
                    alt={`Comprobante de ${aVer.familias?.padre?.nombre}`}
                    className="max-h-[55dvh] w-full object-contain"
                  />
                )}
              </div>

              <Hint>
                Verificá que el importe del comprobante sea el mismo que figura
                abajo antes de aprobar. Si no coincide, rechazalo para que la
                persona lo vuelva a subir.
              </Hint>

              <DesgloseCuota
                montoBase={recModal.montoBase}
                montoLista={Number(aVer.monto_lista ?? aVer.monto)}
                becaPorcentaje={recModal.becaPorcentaje}
                porcentaje={recModal.porcentaje}
                recargo={recModal.recargo}
                total={recModal.total}
                diasVencida={recModal.diasVencida}
                fechaHito={recModal.fechaHito}
                diasParaProximo={recModal.diasParaProximo}
              />

              {aVer.estado === 'pendiente' && (
                <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
                  <Button variant="outline" onClick={() => setARechazar(aVer)}>
                    <XCircle className="h-4 w-4" />Rechazar
                  </Button>
                  <Button variant="success" disabled={procesando === aVer.id} onClick={() => aprobar(aVer)}>
                    <CheckCircle2 className="h-4 w-4" />
                    {procesando === aVer.id ? 'Aprobando…' : 'Aprobar pago'}
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Rechazo */}
      <Confirmar
        abierto={!!aRechazar}
        onCerrar={() => setARechazar(null)}
        onConfirmar={rechazar}
        titulo="Rechazar el comprobante"
        descripcion={`La cuota de ${aRechazar?.familias?.padre?.nombre} ${aRechazar?.familias?.padre?.apellido} por ${money(aRechazar?.monto)} vuelve a pendiente y se borra el comprobante adjunto. La persona va a ver que el pago no fue aceptado.`}
        textoConfirmar="Rechazar"
      />

      {/* Alta de pago */}
      <Dialog open={asignarAbierto} onOpenChange={(o) => !o && setAsignarAbierto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar un pago</DialogTitle>
            <DialogDescription>
              Para cuando la persona paga por otro medio y no sube el comprobante
              desde el portal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={asignar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="familia">Familia *</Label>
              <Select
                value={form.familia_id || SIN_SEL}
                onValueChange={(v) => elegirFamiliaPago(v ?? '')}
                items={opcionesFamilia}
              >
                <SelectTrigger id="familia"><SelectValue placeholder="Elegí la familia" /></SelectTrigger>
                <SelectContent>
                  {opcionesFamilia.map((f) => (
                    <SelectItem key={f.value} value={f.value} disabled={familias.length === 0}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {familias.length === 0 && (
                <p className="text-[11px] text-warn">
                  No hay vínculos familiares. Crealo primero en Vínculos familiares.
                </p>
              )}
              {becaSeleccionada > 0 && (
                <p className="text-[11px] text-info">
                  Este jugador tiene beca del {becaSeleccionada}%. El monto ya incluye
                  el descuento y la cuota no lleva recargo.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="mes">Mes *</Label>
                <Select value={form.mes} onValueChange={(v) => v && setForm({ ...form, mes: v })} items={MESES}>
                  <SelectTrigger id="mes"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anio">Año *</Label>
                <Input id="anio" type="number" value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monto">Monto *</Label>
                <Input id="monto" type="number" step="0.01" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="metodo">Cómo se pagó</Label>
              <Select value={form.metodo} onValueChange={(v) => v && setForm({ ...form, metodo: v })} items={METODOS}>
                <SelectTrigger id="metodo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
              <Button type="button" variant="outline" onClick={() => setAsignarAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando || familias.length === 0}>
                {guardando ? 'Guardando…' : 'Registrar pago'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Emisión de cuotas pendientes */}
      <Dialog open={emitirAbierto} onOpenChange={(o) => !o && setEmitirAbierto(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Emitir cuotas</DialogTitle>
            <DialogDescription>
              Crea cuotas pendientes para que las familias las vean en su portal
              y puedan pagar. Las cuotas que ya existen para ese período se
              omiten.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={emitir} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={emitirModo === 'una' ? 'default' : 'outline'}
                onClick={() => setEmitirModo('una')}
              >
                Una familia
              </Button>
              <Button
                type="button"
                variant={emitirModo === 'todas' ? 'default' : 'outline'}
                onClick={() => setEmitirModo('todas')}
                disabled={familias.length === 0}
              >
                Todas ({familias.length})
              </Button>
            </div>

            {emitirModo === 'una' && (
              <div className="space-y-1.5">
                <Label htmlFor="emitir-familia">Familia *</Label>
                <Select
                  value={emitirForm.familia_id || SIN_SEL}
                  onValueChange={(v) => setEmitirForm({
                    ...emitirForm,
                    familia_id: v === SIN_SEL ? '' : (v ?? ''),
                  })}
                  items={opcionesFamilia}
                >
                  <SelectTrigger id="emitir-familia"><SelectValue placeholder="Elegí la familia" /></SelectTrigger>
                  <SelectContent>
                    {opcionesFamilia.map((f) => (
                      <SelectItem key={f.value} value={f.value} disabled={familias.length === 0}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="emitir-mes">Mes *</Label>
                <Select
                  value={emitirForm.mes}
                  onValueChange={(v) => v && setEmitirForm({ ...emitirForm, mes: v })}
                  items={MESES}
                >
                  <SelectTrigger id="emitir-mes"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emitir-anio">Año *</Label>
                <Input
                  id="emitir-anio"
                  type="number"
                  value={emitirForm.anio}
                  onChange={(e) => setEmitirForm({ ...emitirForm, anio: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emitir-monto">Monto de lista por cuota *</Label>
                <Input
                  id="emitir-monto"
                  type="number"
                  step="0.01"
                  min="0"
                  value={emitirForm.monto}
                  onChange={(e) => setEmitirForm({ ...emitirForm, monto: e.target.value })}
                  required
                />
              </div>
            </div>

            {familias.length === 0 && (
              <p className="rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-xs text-warn">
                No hay familias vinculadas. Creá el vínculo primero en Vínculos familiares.
              </p>
            )}

            <div className="rounded-lg border border-info/25 bg-info/10 px-3 py-2 text-xs text-info">
              {emitirModo === 'una'
                ? `Se emite 1 cuota de ${money(Number(emitirForm.monto) || 0)} para ${mesNombre(Number(emitirForm.mes))} ${emitirForm.anio}.`
                : `Se emiten hasta ${familias.length} cuotas de ${money(Number(emitirForm.monto) || 0)} c/u para ${mesNombre(Number(emitirForm.mes))} ${emitirForm.anio}.`}
              {' '}Las que ya existan se omiten. A los jugadores con beca se les aplica
              el descuento automáticamente y no pagan recargo.
            </div>

            <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
              <Button type="button" variant="outline" onClick={() => setEmitirAbierto(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  emitiendo ||
                  familias.length === 0 ||
                  !emitirForm.monto ||
                  (emitirModo === 'una' && !emitirForm.familia_id)
                }
              >
                {emitiendo ? 'Emitiendo…' : 'Emitir cuota(s)'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
