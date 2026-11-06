'use client';

import { useMemo, useRef, useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fecha } from '@/lib/format';
import { useJunta, accionJunta } from '../use-junta';
import { Receipt, Plus, Loader2, Ban, Download } from 'lucide-react';

// Recibos: el papel que emite el club.
//
// El comprobante que sube el padre y el recibo que da el club son dos cosas
// distintas. El primero prueba que pagó; el segundo prueba que cobró. El banco
// y el contador trabajan con estos.
//
// NUNCA SE BORRAN. Si uno salió mal, se anula y se emite otro que lo reemplaza:
// los dos quedan, con el motivo y quién lo anuló.

interface Recibo {
  id: string;
  numero: string;
  monto: number;
  fecha_emision: string;
  forma_pago: string;
  concepto: string | null;
  estado: string;
  anulado_motivo: string | null;
  descargado_en: string | null;
  socio_nombre: string | null;
  socio_dni: string | null;
  mes: number | null;
  anio: number | null;
}

interface Familia {
  id: string;
  padre_nombre: string | null;
  padre_apellido: string | null;
  padre_dni: string | null;
  hijo_nombre: string | null;
  hijo_apellido: string | null;
}

interface Cuota {
  id: string;
  familia_id: string;
  mes: number;
  anio: number;
  monto: number;
  estado: string;
}

const FORMAS = [
  ['efectivo', 'Efectivo'],
  ['transferencia', 'Transferencia'],
  ['debito', 'Débito'],
  ['credito', 'Crédito'],
  ['cheque', 'Cheque'],
] as const;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Base UI no dispara onValueChange con un string vacío: la opción quedaría sin
// poder elegirse. El centinela representa "sin socio" / "sin cuota".
const SIN_SEL = '__sin_seleccion__';

function plata(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n));
}

/** "Pérez, Juan — Pedro Pérez": se busca por apellido, no por UUID. */
function nombreFamilia(f: Familia) {
  const padre = [f.padre_apellido, f.padre_nombre].filter(Boolean).join(', ');
  const hijo = [f.hijo_nombre, f.hijo_apellido].filter(Boolean).join(' ');
  return hijo ? `${padre || 'Familia'} — ${hijo}` : padre || 'Familia sin datos';
}

const FORM_VACIO = {
  monto: '',
  forma_pago: 'efectivo',
  concepto: '',
  familia_id: '',
  cuota_id: '',
};

export function TabRecibos() {
  const [filtro, setFiltro] = useState<'emitido' | 'anulado' | ''>('emitido');
  const { datos, cargando, fallo, recargar } = useJunta<{
    lista: Recibo[];
    familias: Familia[];
  }>('recibos', {
    estado: filtro,
  });
  const [nuevo, setNuevo] = useState(false);
  const [anulando, setAnulando] = useState<Recibo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cargandoCuotas, setCargandoCuotas] = useState(false);

  // Evita que una respuesta vieja de cuotas pise a la de la familia elegida
  // después. Sin esto, elegir dos socios seguidos deja las cuotas del primero.
  const pedidoCuotas = useRef(0);

  const lista = useMemo(() => datos?.lista ?? [], [datos]);
  const familias = useMemo(() => datos?.familias ?? [], [datos]);

  const opcionesFamilia = useMemo(
    () =>
      familias.map((f) => ({
        value: f.id,
        label: nombreFamilia(f),
      })),
    [familias]
  );

  const opcionesCuota = useMemo(
    () =>
      cuotas.map((c) => ({
        value: c.id,
        label: `Cuota ${MESES[c.mes - 1] ?? c.mes} ${c.anio} · ${plata(c.monto)} · ${
          c.estado === 'pagada' ? 'pagada' : c.estado
        }`,
      })),
    [cuotas]
  );

  async function cargarCuotas(familiaId: string) {
    const pedido = ++pedidoCuotas.current;

    if (!familiaId) {
      setCuotas([]);
      setCargandoCuotas(false);
      return;
    }

    setCargandoCuotas(true);
    try {
      const res = await fetch(`/api/junta/recibos?familia=${encodeURIComponent(familiaId)}`);
      const json = await res.json();
      if (pedido !== pedidoCuotas.current) return;
      setCuotas(res.ok ? json.data?.cuotas ?? [] : []);
    } catch {
      if (pedido === pedidoCuotas.current) setCuotas([]);
    } finally {
      if (pedido === pedidoCuotas.current) setCargandoCuotas(false);
    }
  }

  function abrirNuevo() {
    pedidoCuotas.current++; // descarta cualquier pedido de cuotas que siga en vuelo
    setForm({ ...FORM_VACIO });
    setCuotas([]);
    setNuevo(true);
  }

  function elegirFamilia(familiaId: string) {
    // Al cambiar de socio la cuota anterior ya no sirve.
    setForm((f) => ({ ...f, familia_id: familiaId, cuota_id: '' }));
    cargarCuotas(familiaId);
  }

  function elegirCuota(cuotaId: string) {
    const cuota = cuotas.find((c) => c.id === cuotaId);

    if (!cuota) {
      setForm((f) => ({ ...f, cuota_id: '' }));
      return;
    }

    setForm((f) => ({
      ...f,
      cuota_id: cuota.id,
      familia_id: cuota.familia_id,
      // El monto y el concepto se completan con la cuota, pero el concepto
      // respeta lo que la persona ya haya escrito.
      monto: String(Number(cuota.monto)),
      concepto: f.concepto.trim()
        ? f.concepto
        : `Cuota ${MESES[cuota.mes - 1] ?? cuota.mes} ${cuota.anio}`,
    }));
  }

  async function emitir() {
    if (!form.monto.trim()) return;
    setGuardando(true);
    const ok = await accionJunta('recibos', { accion: 'emitir', ...form }, 'Recibo emitido');
    setGuardando(false);
    if (ok) {
      setNuevo(false);
      setForm({ ...FORM_VACIO });
      setCuotas([]);
      await recargar();
    }
  }

  async function anular() {
    if (!anulando || !motivo.trim()) return;
    setGuardando(true);
    const ok = await accionJunta(
      'recibos',
      { accion: 'anular', id: anulando.id, motivo },
      'Recibo anulado'
    );
    setGuardando(false);
    if (ok) {
      setAnulando(null);
      setMotivo('');
      await recargar();
    }
  }

  const totales = useMemo(
    () => ({
      cantidad: lista.filter((r) => r.estado === 'emitido').length,
      monto: lista.filter((r) => r.estado === 'emitido').reduce((s, r) => s + Number(r.monto), 0),
    }),
    [lista]
  );

  return (
    <>
      <Panel
        title="Recibos"
        description={`${totales.cantidad} emitidos · ${plata(totales.monto)}`}
        bodyClassName="p-0"
        actions={
          <Button size="sm" onClick={abrirNuevo}>
            <Plus className="h-4 w-4" />
            Emitir recibo
          </Button>
        }
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            {(['', 'emitido', 'anulado'] as const).map((e) => (
              <button
                key={e || 'todos'}
                type="button"
                onClick={() => setFiltro(e)}
                className={
                  filtro === e
                    ? 'rounded-md bg-surface-3 px-3 py-1.5 text-sm font-medium text-main'
                    : 'rounded-md px-3 py-1.5 text-sm text-muted hover:text-main'
                }
              >
                {e === '' ? 'Todos' : e === 'emitido' ? 'Válidos' : 'Anulados'}
              </button>
            ))}
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : fallo ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{fallo}</p>
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title="No hay recibos"
            description="Los recibos que emite el club quedan numerados y no se borran."
          />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-main">
                    <span className="font-mono text-xs text-dim">{r.numero}</span>{' '}
                    <span className="font-medium">{plata(r.monto)}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={r.estado === 'emitido' ? 'ok' : 'danger'}>
                      {r.estado === 'emitido' ? 'Válido' : 'Anulado'}
                    </StatusPill>
                    {r.socio_nombre && <span className="text-[11px] text-dim">{r.socio_nombre}</span>}
                    <span className="text-[11px] text-dim">
                      {fecha(r.fecha_emision)}
                      {r.mes != null && r.anio != null ? ` · cuota ${MESES[r.mes - 1]} ${r.anio}` : ''}
                    </span>
                    <span className="text-[11px] text-dim">
                      {FORMAS.find(([v]) => v === r.forma_pago)?.[1] ?? r.forma_pago}
                    </span>
                  </div>
                  {r.anulado_motivo && (
                    <p className="mt-1 text-[11px] text-danger">Anulado: {r.anulado_motivo}</p>
                  )}
                </div>

                <div className="flex gap-1.5">
                  {r.estado === 'emitido' && (
                    <>
                      <a
                        href={`/api/junta/recibo-pdf?id=${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-main"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setAnulando(r);
                          setMotivo('');
                        }}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Anular
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Hint>
        Un recibo anulado no desaparece: queda con el motivo y con quién lo anuló.
        Si hay que corregirlo se emite otro que lo reemplaza. Es lo que necesita el
        banco para conciliar.
      </Hint>

      {/* Emitir */}
      <Dialog open={nuevo} onOpenChange={(o) => { if (!o) setNuevo(false); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>Emitir recibo</DialogTitle>
            <DialogDescription>
              El número es correlativo y automático. Si el recibo corresponde a una
              cuota, elegí el socio y la cuota acá mismo. Si no, dejalo sin socio
              para un recibo general.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="r-familia">Socio (opcional)</Label>
              <Select
                value={form.familia_id || SIN_SEL}
                onValueChange={(v) => elegirFamilia(v === SIN_SEL ? '' : (v ?? ''))}
                items={[
                  { value: SIN_SEL, label: 'Sin socio · recibo general' },
                  ...opcionesFamilia,
                ]}
              >
                <SelectTrigger id="r-familia" className="w-full">
                  <SelectValue placeholder="Elegí el socio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SIN_SEL}>Sin socio · recibo general</SelectItem>
                  {opcionesFamilia.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-dim">
                El recibo queda a nombre del socio. Es el dato que ven el banco y el
                contador.
              </p>
            </div>

            {form.familia_id && (
              <div className="space-y-1.5">
                <Label htmlFor="r-cuota">Cuota (opcional)</Label>
                <Select
                  value={form.cuota_id || SIN_SEL}
                  onValueChange={(v) => elegirCuota(v === SIN_SEL ? '' : (v ?? ''))}
                  items={[
                    { value: SIN_SEL, label: 'Sin cuota · solo el socio' },
                    ...opcionesCuota,
                  ]}
                >
                  <SelectTrigger id="r-cuota" className="w-full">
                    <SelectValue placeholder="Elegí la cuota" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SIN_SEL}>Sin cuota · solo el socio</SelectItem>
                    {opcionesCuota.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-dim">
                  {cargandoCuotas
                    ? 'Cargando las cuotas del socio…'
                    : cuotas.length === 0
                      ? 'Ese socio no tiene cuotas pendientes ni del año en curso.'
                      : 'Al elegir una cuota se completan el monto y el concepto. Emitir el recibo no la marca como pagada.'}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="r-monto">Monto *</Label>
                <Input
                  id="r-monto"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                  placeholder="15.000,50"
                />
                <p className="text-[11px] text-dim">Se puede escribir 15.000,50 o 15000.50.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-forma">Forma de pago</Label>
                <select
                  id="r-forma"
                  value={form.forma_pago}
                  onChange={(e) => setForm({ ...form, forma_pago: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                >
                  {FORMAS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="r-concepto">Concepto</Label>
              <Input
                id="r-concepto"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Cuota de octubre"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={emitir} disabled={guardando || !form.monto.trim()}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              Emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Anular */}
      <Dialog open={!!anulando} onOpenChange={(o) => { if (!o) setAnulando(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular el recibo {anulando?.numero}</DialogTitle>
            <DialogDescription>
              No se borra: queda anotado el motivo y quién lo anuló.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="r-motivo">Motivo *</Label>
            <Input
              id="r-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: monto cargado mal, se emitió el R-2026-00012 corregido"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAnulando(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={anular} disabled={guardando || !motivo.trim()}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
              Anular el recibo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
