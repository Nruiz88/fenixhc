'use client';

import { useMemo, useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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

const FORMAS = [
  ['efectivo', 'Efectivo'],
  ['transferencia', 'Transferencia'],
  ['debito', 'Débito'],
  ['credito', 'Crédito'],
  ['cheque', 'Cheque'],
] as const;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function plata(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(n));
}

export function TabRecibos() {
  const [filtro, setFiltro] = useState<'emitido' | 'anulado' | ''>('emitido');
  const { datos, cargando, fallo, recargar } = useJunta<{ lista: Recibo[] }>('recibos', {
    estado: filtro,
  });
  const [nuevo, setNuevo] = useState(false);
  const [anulando, setAnulando] = useState<Recibo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [form, setForm] = useState({
    monto: '',
    forma_pago: 'efectivo',
    concepto: '',
    cuota_id: '',
  });

  const lista = datos?.lista ?? [];

  async function emitir() {
    if (!form.monto.trim()) return;
    setGuardando(true);
    const ok = await accionJunta('recibos', { accion: 'emitir', ...form }, 'Recibo emitido');
    setGuardando(false);
    if (ok) {
      setNuevo(false);
      setForm({ monto: '', forma_pago: 'efectivo', concepto: '', cuota_id: '' });
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
          <Button size="sm" onClick={() => setNuevo(true)}>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir recibo</DialogTitle>
            <DialogDescription>
              El número es correlativo y automático. Para atarlo a una cuota, elegí
              el socio desde Pagos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
