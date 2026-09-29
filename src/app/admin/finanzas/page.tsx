'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { money, fecha } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { PageHeader, StatCard, Panel, EmptyState, Toolbar, Hint } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { TrendingUp, TrendingDown, Plus, Trash2, Receipt, Search, X } from 'lucide-react';

// Categorías con su valor guardado en la base. Son las mismas que agrupa
// /admin/contabilidad, así que lo que se carga acá aparece ordenado en los
// reportes. Son un select y no texto libre a propósito: con texto libre cada
// persona escribía "alquiler", "Alquiler", "alquiler cancha" y el desglose por
// categoría quedaba partido en tres filas que no sumaban al total.
const CATEGORIAS_EGRESO = [
  { value: 'alquiler', label: 'Alquiler de cancha o sede' },
  { value: 'servicios', label: 'Servicios (luz, gas, agua, internet)' },
  { value: 'insumos', label: 'Insumos y material deportivo' },
  { value: 'equipamiento', label: 'Equipamiento e indumentaria' },
  { value: 'viajes', label: 'Viajes y competencias' },
  { value: 'arbitraje', label: 'Árbitros y comisiones' },
  { value: 'sueldos', label: 'Sueldos y honorarios' },
  { value: 'seguros', label: 'Seguros y ART' },
  { value: 'otros', label: 'Otros gastos' },
];

const CATEGORIAS_INGRESO = [
  { value: 'cuota', label: 'Cuotas de socios' },
  { value: 'sponsor', label: 'Sponsor o contribución' },
  { value: 'donacion', label: 'Donación' },
  { value: 'evento', label: 'Evento o torneo' },
  { value: 'mercado_canchas', label: 'Alquiler de canchas' },
  { value: 'otros', label: 'Otros ingresos' },
];

const METODOS = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'debito', label: 'Débito automático' },
  { value: 'credito', label: 'Tarjeta de crédito' },
  { value: 'cheque', label: 'Cheque' },
];

const ETIQUETA_CATEGORIA = new Map<string, string>([
  ...CATEGORIAS_EGRESO.map((c) => [c.value, c.label] as const),
  ...CATEGORIAS_INGRESO.map((c) => [c.value, c.label] as const),
]);

type Tipo = 'ingreso' | 'egreso';

// Valor centinela para "Sin categoría" en el Select. No se puede usar string
// vacío: base-ui trata el valor vacío como "nada seleccionado" y no dispara
// el onValueChange, así que la opción quedaba sin poder elegirse.
const SIN_CATEGORIA = '__sin_categoria__';

const FORM_VACIO = {
  tipo: 'egreso' as Tipo,
  concepto: '',
  monto: '',
  categoria: '',
  fecha: todayISO(),
  metodo_pago: 'efectivo',
  descripcion: '',
};

export default function AdminFinanzas() {
  const [finanzas, setFinanzas] = useState<any[]>([]);
  const [cuotasAnio, setCuotasAnio] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | Tipo>('todos');
  const [form, setForm] = useState(FORM_VACIO);
  const [aBorrar, setABorrar] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const { data } = await db.select<any>('finanzas', '*', undefined, {
        order: { column: 'fecha', ascending: false },
        limit: 1000,
      });
      setFinanzas(data ?? []);
      setCargando(false);
    })();
  }, []);

  // Las cuotas cobradas se consultan aparte porque viven en otra tabla:
  // son el ingreso del club por cuotas, no un movimiento de caja.
  useEffect(() => {
    (async () => {
      const { data } = await db.select<any>('cuotas', 'monto', { anio, estado: 'pagada' });
      setCuotasAnio(data ?? []);
    })();
  }, [anio]);

  // El selector de año se arma con los años que de verdad hay cargados en
  // vez de una lista fija: si el club carga 2027, tiene que aparecer.
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>(finanzas.map((f) => Number(String(f.fecha).slice(0, 4))));
    set.add(new Date().getFullYear());
    return [...set].filter(Number.isFinite).sort((a, b) => b - a);
  }, [finanzas]);

  const delAnio = useMemo(
    () => finanzas.filter((f) => Number(String(f.fecha).slice(0, 4)) === anio),
    [finanzas, anio]
  );

  const ingresos = delAnio.filter((f) => f.tipo === 'ingreso').reduce((s, f) => s + Number(f.monto), 0);
  const egresos = delAnio.filter((f) => f.tipo === 'egreso').reduce((s, f) => s + Number(f.monto), 0);
  const cobradoCuotas = cuotasAnio.reduce((s: number, c: any) => s + Number(c.monto), 0);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return delAnio
      .filter((f) => (filtroTipo === 'todos' ? true : f.tipo === filtroTipo))
      .filter((f) =>
        !q
          ? true
          : [f.concepto, f.categoria, f.descripcion, f.metodo_pago]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
      );
  }, [delAnio, busqueda, filtroTipo]);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();

    const monto = Number(form.monto);
    if (!form.concepto.trim()) { toast.error('Escribí el concepto'); return; }
    if (!Number.isFinite(monto) || monto <= 0) { toast.error('El monto tiene que ser mayor a cero'); return; }

    setGuardando(true);
    const { error } = await db.insert('finanzas', {
      tipo: form.tipo,
      concepto: form.concepto.trim(),
      monto,
      categoria: form.categoria || null,
      fecha: form.fecha,
      metodo_pago: form.metodo_pago,
      descripcion: form.descripcion.trim() || null,
    });
    setGuardando(false);

    if (error) { toast.error(error); return; }

    toast.success(form.tipo === 'egreso' ? 'Gasto registrado' : 'Ingreso registrado');
    // Se conservan tipo, fecha y método: cargar cinco gastos seguidos del
    // mismo día no debería obligar a elegirlos cinco veces.
    setForm((f) => ({ ...FORM_VACIO, tipo: f.tipo, fecha: f.fecha, metodo_pago: f.metodo_pago }));

    const { data } = await db.select<any>('finanzas', '*', undefined, {
      order: { column: 'fecha', ascending: false },
      limit: 1000,
    });
    setFinanzas(data ?? []);
  }

  async function eliminar() {
    if (!aBorrar) return;
    const { error } = await db.delete('finanzas', { id: aBorrar.id });
    if (error) { toast.error(error); return; }
    toast.success('Movimiento eliminado');
    setABorrar(null);
    const { data } = await db.select<any>('finanzas', '*', undefined, {
      order: { column: 'fecha', ascending: false },
      limit: 1000,
    });
    setFinanzas(data ?? []);
  }

  const categorias = form.tipo === 'egreso' ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzas"
        description="Cargá cada pago y cada gasto del club. Es la fuente de los números de Contabilidad."
        actions={
          <Select value={String(anio)} onValueChange={(v) => v && setAnio(Number(v))}>
            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              {aniosDisponibles.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      <Hint>
        Las cuotas de los socios se registran en <strong>Pagos de cuotas</strong>, no acá.
        Si cargás un cobro de cuota también como movimiento de caja, el
        ingreso va a aparecer duplicado en los reportes.
      </Hint>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ingresos en caja" value={money(ingresos)} tone="ok" icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard label="Cuotas cobradas" value={money(cobradoCuotas)} hint={`${cuotasAnio.length} cuotas del ${anio}`} tone="info" />
        <StatCard label="Egresos" value={money(egresos)} tone="danger" icon={<TrendingDown className="h-4 w-4" />} />
        <StatCard
          label="Resultado"
          value={money(ingresos - egresos)}
          hint="Ingresos de caja menos egresos"
          tone={ingresos - egresos >= 0 ? 'ok' : 'danger'}
        />
      </div>

      {/* Formulario de carga */}
      <Panel
        title="Registrar un movimiento"
        description="Elegí si es gasto o ingreso, después completá el concepto y el monto."
      >
        <div className="mb-4 inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
          {(['egreso', 'ingreso'] as Tipo[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((f) => ({ ...f, tipo: t, categoria: '' }))}
              className={
                form.tipo === t
                  ? `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      t === 'egreso' ? 'bg-danger/15 text-danger' : 'bg-ok/15 text-ok'
                    }`
                  : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-main'
              }
            >
              {t === 'egreso' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {t === 'egreso' ? 'Gasto' : 'Ingreso'}
            </button>
          ))}
        </div>

        <form onSubmit={registrar} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="concepto">Concepto *</Label>
            <Input
              id="concepto"
              value={form.concepto}
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
              placeholder={form.tipo === 'egreso' ? 'Ej: Factura de luz de la sede' : 'Ej: Donación de la empresa XYZ'}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto">Monto *</Label>
            <Input
              id="monto"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: e.target.value })}
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoria">Categoría</Label>
            <Select
              value={form.categoria || SIN_CATEGORIA}
              onValueChange={(v) => setForm({ ...form, categoria: v === SIN_CATEGORIA ? '' : (v ?? '') })}
            >
              <SelectTrigger id="categoria"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SIN_CATEGORIA}>Sin categoría</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="metodo">Cómo se pagó</Label>
            <Select value={form.metodo_pago} onValueChange={(v) => v && setForm({ ...form, metodo_pago: v })}>
              <SelectTrigger id="metodo"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METODOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="descripcion">
              Detalle <span className="font-normal text-dim">(opcional)</span>
            </Label>
            <Input
              id="descripcion"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Nro. de factura, con quién fue, para qué"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={guardando} variant={form.tipo === 'egreso' ? 'destructive' : 'success'}>
              <Plus className="h-4 w-4" />
              {guardando
                ? 'Guardando…'
                : form.tipo === 'egreso'
                  ? 'Registrar gasto'
                  : 'Registrar ingreso'}
            </Button>
          </div>
        </form>
      </Panel>

      {/* Historial */}
      <Panel
        title={`Movimientos de ${anio}`}
        description={`${visibles.length} de ${delAnio.length} movimientos`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por concepto o categoría"
                  className="pl-8"
                  aria-label="Buscar movimientos"
                />
              </div>
              {(busqueda || filtroTipo !== 'todos') && (
                <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltroTipo('todos'); }}>
                  <X className="h-4 w-4" />Limpiar
                </Button>
              )}
            </div>
            <div className="flex gap-1.5">
              {(['todos', 'ingreso', 'egreso'] as const).map((t) => (
                <Button key={t} size="sm" variant={filtroTipo === t ? 'default' : 'outline'} onClick={() => setFiltroTipo(t)}>
                  {t === 'todos' ? 'Todos' : t === 'ingreso' ? 'Ingresos' : 'Egresos'}
                </Button>
              ))}
            </div>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title={
              delAnio.length === 0
                ? `Todavía no cargaste movimientos en ${anio}`
                : 'Ningún movimiento coincide con el filtro'
            }
            description={
              delAnio.length === 0
                ? 'Usá el formulario de arriba para registrar el primer gasto o ingreso del año.'
                : 'Probá con otra palabra o volvé a ver todos los movimientos.'
            }
            action={
              delAnio.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setFiltroTipo('todos'); }}>
                  Ver todos
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visibles.map((f) => {
              const ingreso = f.tipo === 'ingreso';
              return (
                <li key={f.id} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span
                    className={
                      ingreso
                        ? 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ok/10 text-ok'
                        : 'grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger'
                    }
                  >
                    {ingreso ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-main">{f.concepto}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dim">
                      <span>{fecha(f.fecha)}</span>
                      {f.categoria && (
                        <span>{ETIQUETA_CATEGORIA.get(f.categoria) ?? f.categoria}</span>
                      )}
                      {f.metodo_pago && f.metodo_pago !== 'efectivo' && (
                        <span className="capitalize">{f.metodo_pago}</span>
                      )}
                      {f.descripcion && <span className="truncate">· {f.descripcion}</span>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        ingreso ? 'text-sm font-semibold tabular text-ok' : 'text-sm font-semibold tabular text-danger'
                      }
                    >
                      {ingreso ? '+' : '−'}{money(f.monto)}
                    </span>
                    {/* Siempre visible, no solo con hover: en una pantalla
                        táctil no existe hover y el botón quedaba inalcanzable. */}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-dim hover:text-danger"
                      onClick={() => setABorrar(f)}
                      aria-label={`Eliminar ${f.concepto}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Confirmar
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        onConfirmar={eliminar}
        titulo="Eliminar el movimiento"
        descripcion={`Se va a eliminar "${aBorrar?.concepto}" por ${money(aBorrar?.monto)} del ${fecha(aBorrar?.fecha)}. Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
