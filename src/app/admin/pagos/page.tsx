'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { money, mesNombre, fecha, periodo as fmtPeriodo } from '@/lib/format';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Toolbar, Hint, tonoEstadoCuota } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, Clock, DollarSign, FileText, Search, X, Eye,
  Plus, AlertTriangle, XCircle, Paperclip,
} from 'lucide-react';

type Filtro = 'todas' | 'pendiente' | 'pagada' | 'rechazada';

const SIN_SEL = '__sin_seleccion__';
const MONTO_SUGERIDO = '75000';

const FORM_VACIO = {
  familia_id: '',
  mes: String(new Date().getMonth() + 1),
  anio: String(new Date().getFullYear()),
  monto: MONTO_SUGERIDO,
  metodo: 'transferencia',
};

export default function AdminPagos() {
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

  const resumen = useMemo(() => {
    const pagadas = filtradas.filter((c) => c.estado === 'pagada');
    const pendientes = filtradas.filter((c) => c.estado === 'pendiente');
    return {
      cobradas: pagadas.length,
      montoCobrado: pagadas.reduce((s, c) => s + Number(c.monto), 0),
      pendientes: pendientes.length,
      montoPendiente: pendientes.reduce((s, c) => s + Number(c.monto), 0),
      conComprobante: pendientes.filter((c) => c.comprobante_url).length,
    };
  }, [filtradas]);

  async function aprobar(c: any) {
    setProcesando(c.id);
    const { error } = await db.update(
      'cuotas',
      { estado: 'pagada', fecha_pago: new Date().toISOString() },
      { id: c.id }
    );
    setProcesando(null);

    if (error) { toast.error(error); return; }
    toast.success(`Cuota de ${fmtPeriodo(c.mes, c.anio)} marcada como pagada`, {
      description: `${c.familias?.padre?.nombre} ${c.familias?.padre?.apellido} · ${money(c.monto)}`,
    });
    setAVer(null);
    await cargar();
  }

  async function rechazar() {
    if (!aRechazar) return;
    const { error } = await db.update(
      'cuotas',
      { estado: 'pendiente', comprobante_url: null, fecha_pago: null },
      { id: aRechazar.id }
    );
    if (error) { toast.error(error); return; }
    toast.success('Comprobante rechazado. La cuota vuelve a pendiente para que la persona lo vuelva a subir.');
    setARechazar(null);
    setAVer(null);
    await cargar();
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
      estado: 'pagada',
      fecha_pago: new Date().toISOString(),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagos de cuotas"
        description="Aprobar comprobantes y registrar pagos que llegan por otros canales."
        actions={
          <Button onClick={() => setAsignarAbierto(true)}>
            <Plus className="h-4 w-4" />Registrar pago
          </Button>
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
          label="Pendiente de cobro" value={money(resumen.montoPendiente)}
          hint={`${resumen.pendientes} cuotas`} tone="warn" icon={<Clock className="h-4 w-4" />}
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
              <Select value={mesFiltro} onValueChange={(v) => v && setMesFiltro(v)}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Mes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los meses</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>{mesNombre(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={anioFiltro} onValueChange={(v) => v && setAnioFiltro(v)}>
                <SelectTrigger className="w-28"><SelectValue placeholder="Año" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  {anios.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
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
            title={cuotas.length === 0 ? 'Todavía no hay cuotas cargadas' : 'Ninguna cuota coincide con el filtro'}
            description={
              cuotas.length === 0
                ? 'Registrá el primer pago con el botón de arriba. Las cuotas se pueden cargar una por una o munculendo al cobrar.'
                : 'Probá con otro nombre, otro mes o quitá los filtros.'
            }
            action={
              <Button onClick={() => setAsignarAbierto(true)}>
                <Plus className="h-4 w-4" />Registrar el primero
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtradas.map((c) => {
              const padre = c.familias?.padre;
              const hijo = c.familias?.hijo;
              const tono = tonoEstadoCuota(c.estado);
              const comprobante = c.estado === 'pendiente' && c.comprobante_url;
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
                      {comprobante && <StatusPill tone="info"><Paperclip className="h-3 w-3" />Para revisar</StatusPill>}
                    </div>
                    <p className="truncate text-xs text-dim">
                      {fmtPeriodo(c.mes, c.anio)}
                      {hijo ? ` · ${hijo.nombre} ${hijo.apellido}` : ''}
                      {c.fecha_pago ? ` · pagado el ${fecha(c.fecha_pago)}` : ''}
                    </p>
                  </div>

                  <span className="shrink-0 text-sm font-semibold tabular text-main">{money(c.monto)}</span>

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
        <DialogContent className="sm:max-w-2xl">
          {aVer && (
            <>
              <DialogHeader>
                <DialogTitle>Comprobante de pago</DialogTitle>
                <DialogDescription>
                  {aVer.familias?.padre?.nombre} {aVer.familias?.padre?.apellido} ·{' '}
                  {mesNombre(aVer.mes)} {aVer.anio} · {money(aVer.monto)}
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-hidden rounded-lg border border-line bg-surface-2">
                {aVer.comprobante_url?.toLowerCase().endsWith('.pdf') ? (
                  <iframe src={aVer.comprobante_url} className="h-96 w-full" title="Comprobante de pago" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={aVer.comprobante_url}
                    alt={`Comprobante de ${aVer.familias?.padre?.nombre}`}
                    className="max-h-96 w-full object-contain"
                  />
                )}
              </div>

              <Hint>
                Verificá que el importe del comprobante sea el mismo que figura
                arriba antes de aprobar. Si no coincide, rechazalo para que la
                persona lo vuelva a subir.
              </Hint>

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
                onValueChange={(v) => setForm({ ...form, familia_id: v === SIN_SEL ? '' : (v ?? '') })}
              >
                <SelectTrigger id="familia"><SelectValue placeholder="Elegí la familia" /></SelectTrigger>
                <SelectContent>
                  {familias.length === 0 ? (
                    <SelectItem value={SIN_SEL} disabled>No hay familias vinculadas</SelectItem>
                  ) : (
                    familias.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.padre?.nombre} {f.padre?.apellido}
                        {f.hijo ? ` — ${f.hijo.nombre} ${f.hijo.apellido}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {familias.length === 0 && (
                <p className="text-[11px] text-warn">
                  No hay vínculos familiares. Crealo primero en Vínculos familiares.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="mes">Mes *</Label>
                <Select value={form.mes} onValueChange={(v) => v && setForm({ ...form, mes: v })}>
                  <SelectTrigger id="mes"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>{mesNombre(m)}</SelectItem>
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
              <Select value={form.metodo} onValueChange={(v) => v && setForm({ ...form, metodo: v })}>
                <SelectTrigger id="metodo"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="debito">Débito automático</SelectItem>
                  <SelectItem value="credito">Tarjeta de crédito</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
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
    </div>
  );
}
