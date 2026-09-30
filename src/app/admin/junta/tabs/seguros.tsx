'use client';

import { useMemo, useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar, StatCard } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { fecha } from '@/lib/format';
import { useJunta, accionJunta } from '../use-junta';
import { ShieldCheck, Loader2, Search } from 'lucide-react';

// Seguro: quién está adherido y quién falta.
//
// La pantalla está ordenada al revés de lo habitual: no por nombre, sino por
// lo que hay que hacer. Arriba, la cuenta de cuántos están al día y cuántos no.
// Abajo, la lista. Cuando llega el corte, la pregunta es "¿quién falta?", y
// esa respuesta tiene que estar en la primera pantalla, no en el tercer
// scroll.

interface Adherente {
  id: string | null;
  jugador_perfil_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  estado: string;
  fecha_vencimiento: string | null;
  monto: number | null;
  pagado: number;
}

interface Config {
  monto_base: number;
  meses_vigencia: number;
  dias_aviso: number;
}

const ESTADOS = [
  ['pendiente', 'Pendiente'],
  ['adherido', 'Adherido'],
  ['renovado', 'Renovado'],
  ['baja', 'Dado de baja'],
] as const;

const TONO: Record<string, 'ok' | 'warn' | 'danger' | 'neutral'> = {
  adherido: 'ok',
  renovado: 'ok',
  pendiente: 'warn',
  baja: 'neutral',
};

export function TabSeguros() {
  const { datos, cargando, fallo, recargar } = useJunta<{
    lista: Adherente[];
    config: Config;
    puedeGestionar: boolean;
  }>('seguros');
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Adherente | null>(null);
  const [form, setForm] = useState({
    estado: 'pendiente',
    fecha_adhesion: '',
    fecha_vencimiento: '',
    monto: '',
    pagado: false,
    notas: '',
  });
  const [guardando, setGuardando] = useState(false);

  const lista = datos?.lista ?? [];
  const cfg = datos?.config;

  const cuentas = useMemo(() => {
    const adheridos = lista.filter((a) => a.estado === 'adherido' || a.estado === 'renovado').length;
    const pendientes = lista.filter((a) => (a.estado ?? 'pendiente') === 'pendiente').length;
    const porCobrar = lista
      .filter((a) => a.estado !== 'baja' && !a.pagado)
      .reduce((s, a) => s + Number(a.monto ?? cfg?.monto_base ?? 0), 0);

    const hoy = new Date().toISOString().slice(0, 10);
    const vencenPronto = lista.filter(
      (a) => a.estado !== 'baja' && a.fecha_vencimiento && a.fecha_vencimiento <= hoy
    ).length;

    return { adheridos, pendientes, porCobrar, vencenPronto };
  }, [lista, cfg]);

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter((a) =>
      [a.nombre, a.apellido, a.dni].some((v) => String(v).toLowerCase().includes(t))
    );
  }, [lista, busqueda]);

  async function guardar() {
    if (!editando) return;
    setGuardando(true);
    const ok = await accionJunta(
      'seguros',
      {
        accion: 'guardar',
        jugador_perfil_id: editando.jugador_perfil_id,
        ...form,
        monto: form.monto || String(cfg?.monto_base ?? ''),
      },
      'Seguro actualizado'
    );
    setGuardando(false);
    if (ok) {
      setEditando(null);
      await recargar();
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Adheridos" value={cuentas.adheridos} tone="ok" />
        <StatCard label="Sin seguro" value={cuentas.pendientes} tone={cuentas.pendientes > 0 ? 'warn' : 'ok'} />
        <StatCard label="Ya vencidos" value={cuentas.vencenPronto} tone={cuentas.vencenPronto > 0 ? 'danger' : 'ok'} />
        <StatCard
          label="Por cobrar"
          value={new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(cuentas.porCobrar)}
        />
      </div>

      <Panel
        title="Adherentes al seguro"
        description={`${filtrados.length} de ${lista.length} jugadores`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o DNI…"
                className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-main placeholder:text-dim"
              />
            </div>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : fallo ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{fallo}</p>
        ) : filtrados.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title="No hay jugadores"
            description="Aparecen los que están inscriptos."
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtrados.map((a) => (
              <li key={a.jugador_perfil_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-main">
                    <span className="font-medium">{a.nombre} {a.apellido}</span>
                    <span className="ml-2 font-mono text-xs text-dim">{a.dni}</span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={TONO[a.estado] ?? 'warn'}>
                      {ESTADOS.find(([v]) => v === a.estado)?.[1] ?? 'Pendiente'}
                    </StatusPill>
                    {a.fecha_vencimiento && (
                      <span className="text-[11px] text-dim">
                        {a.estado === 'baja' ? 'venció' : 'vence'} {fecha(a.fecha_vencimiento)}
                      </span>
                    )}
                    {!a.pagado && a.estado !== 'baja' && (
                      <StatusPill tone="warn">Sin pagar</StatusPill>
                    )}
                  </div>
                </div>
                {datos?.puedeGestionar && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditando(a);
                      setForm({
                        estado: a.estado ?? 'pendiente',
                        fecha_adhesion: '',
                        fecha_vencimiento: a.fecha_vencimiento ?? '',
                        monto: a.monto != null ? String(a.monto) : String(cfg?.monto_base ?? ''),
                        pagado: !!a.pagado,
                        notas: '',
                      });
                    }}
                  >
                    Cargar
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Hint>
        El estado no se deduce del pago. Se paga y después llega la baja; se
        renueva con la documentación al día; o se da de baja. Son tres hechos
        distintos y quedan anotados por separado, con historial.
      </Hint>

      <Dialog open={!!editando} onOpenChange={(o) => { if (!o) setEditando(null); }}>
        <DialogContent>
          {editando && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Seguro de {editando.nombre} {editando.apellido}
                </DialogTitle>
                <DialogDescription>DNI {editando.dni}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="estado">Estado</Label>
                  <select
                    id="estado"
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value })}
                    className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                  >
                    {ESTADOS.map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="f-adhesion">Fecha de adhesión</Label>
                    <Input
                      id="f-adhesion"
                      type="date"
                      value={form.fecha_adhesion}
                      onChange={(e) => setForm({ ...form, fecha_adhesion: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="f-vencimiento">Vence</Label>
                    <Input
                      id="f-vencimiento"
                      type="date"
                      value={form.fecha_vencimiento}
                      onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="f-monto">Monto</Label>
                  <Input
                    id="f-monto"
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    placeholder={String(cfg?.monto_base ?? '')}
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-muted">
                  <input
                    type="checkbox"
                    checked={form.pagado}
                    onChange={(e) => setForm({ ...form, pagado: e.target.checked })}
                    className="h-4 w-4 accent-[var(--brand)]"
                  />
                  Está pagado
                </label>

                <div className="space-y-1.5">
                  <Label htmlFor="f-notas">Nota</Label>
                  <Textarea
                    id="f-notas"
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditando(null)} disabled={guardando}>
                  Cancelar
                </Button>
                <Button onClick={guardar} disabled={guardando}>
                  {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  Guardar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
