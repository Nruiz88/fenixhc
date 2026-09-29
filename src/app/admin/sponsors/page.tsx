'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, type StatusTone } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Star, Plus, Pencil, Trash2, EyeOff, Eye, ExternalLink, Trophy, Handshake } from 'lucide-react';

const TIERS = [
  { value: 'gold', label: 'Gold (principal)', tone: 'warn' as StatusTone },
  { value: 'silver', label: 'Silver (secundario)', tone: 'neutral' as StatusTone },
  { value: 'bronze', label: 'Bronze (terciario)', tone: 'brand' as StatusTone },
];

const TIER_POR_NOMBRE = new Map(TIERS.map((t) => [t.value, t]));

const FORM_VACIO = {
  nombre: '',
  logo_url: '',
  sitio_web: '',
  tier: 'bronze',
  descripcion: '',
  activo: true,
};

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [aBorrar, setABorrar] = useState<any | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await db.select<any>('sponsors', '*', undefined, {
      order: { column: 'orden', ascending: true },
      limit: 200,
    });
    setSponsors(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  // Agrupados por categoría: en la web los sponsors se muestran por tier, y
  // administrationarlos mezclados obligaba a ordenar mentalmente.
  const porTier = useMemo(
    () =>
      TIERS.map((t) => ({
        ...t,
        items: sponsors.filter((s) => s.tier === t.value),
      })),
    [sponsors]
  );

  const activos = sponsors.filter((s) => s.activo).length;

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_VACIO });
    setAbierto(true);
  }

  function abrirEdicion(s: any) {
    setEditando(s);
    setForm({
      nombre: s.nombre ?? '',
      logo_url: s.logo_url ?? '',
      sitio_web: s.sitio_web ?? '',
      tier: s.tier ?? 'bronze',
      descripcion: s.descripcion ?? '',
      activo: !!s.activo,
    });
    setAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim()) { toast.error('Falta el nombre del sponsor'); return; }

    setGuardando(true);
    const payload = {
      nombre: form.nombre.trim(),
      logo_url: form.logo_url.trim() || null,
      sitio_web: form.sitio_web.trim() || null,
      tier: form.tier,
      descripcion: form.descripcion.trim() || null,
      activo: form.activo,
      orden: editando
        ? editando.orden
        : Math.max(0, ...sponsors.map((s) => Number(s.orden) || 0)) + 1,
    };

    const res = editando
      ? await db.update('sponsors', payload, { id: editando.id })
      : await db.insert('sponsors', payload);
    setGuardando(false);

    if (res.error) { toast.error(res.error); return; }
    toast.success(editando ? 'Sponsor actualizado' : 'Sponsor agregado');
    setAbierto(false);
    await cargar();
  }

  async function eliminar() {
    if (!aBorrar) return;
    const { error } = await db.delete('sponsors', { id: aBorrar.id });
    if (error) { toast.error(error); return; }
    toast.success('Sponsor eliminado');
    setABorrar(null);
    await cargar();
  }

  async function alternarActivo(s: any) {
    const { error } = await db.update('sponsors', { activo: !s.activo }, { id: s.id });
    if (error) { toast.error(error); return; }
    await cargar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsors"
        description="Empresas que apoyan al club. Aparecen en la web, ordenadas por categoría."
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Agregar sponsor</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sponsors" value={sponsors.length} icon={<Handshake className="h-4 w-4" />} />
        <StatCard label="Activos" value={activos} hint={`${sponsors.length - activos} ocultos`} tone="ok" />
        {TIERS.map((t) => (
          <StatCard
            key={t.value}
            label={t.label.split(' ')[0]}
            value={sponsors.filter((s) => s.tier === t.value).length}
            tone={t.tone}
          />
        ))}
      </div>

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : sponsors.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Handshake className="h-6 w-6" />}
            title="Todavía no hay sponsors cargados"
            description="Agregá el primero con el botón de arriba. Aparece en la sección de patrocinadores de la web."
            action={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Agregar el primero</Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {porTier.map((grupo) => {
            if (grupo.items.length === 0) return null;
            return (
              <Panel
                key={grupo.value}
                title={grupo.label.split(' ')[0]}
                description={`${grupo.items.length} ${grupo.items.length === 1 ? 'sponsor' : 'sponsors'}`}
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {grupo.items.map((s) => (
                    <article
                      key={s.id}
                      className={`rounded-lg border border-line bg-surface-2 p-3 ${s.activo ? '' : 'opacity-60'}`}
                    >
                      <div className="flex items-start gap-3">
                        {s.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.logo_url}
                            alt={`Logo de ${s.nombre}`}
                            className="h-12 w-12 shrink-0 rounded-lg bg-white/5 object-contain p-1"
                          />
                        ) : (
                          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
                            <Trophy className="h-5 w-5" />
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium text-main">{s.nombre}</p>
                            {!s.activo && <StatusPill tone="neutral">Oculto</StatusPill>}
                          </div>
                          {s.descripcion && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.descripcion}</p>
                          )}
                          {s.sitio_web && (
                            <a
                              href={s.sitio_web}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-brand hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 shrink-0" />
                              <span className="truncate">{s.sitio_web.replace(/^https?:\/\//, '')}</span>
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-1 border-t border-line pt-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-dim hover:text-main"
                          onClick={() => alternarActivo(s)}
                          aria-label={s.activo ? 'Ocultar de la web' : 'Mostrar en la web'}
                          title={s.activo ? 'Ocultar de la web' : 'Mostrar en la web'}
                        >
                          {s.activo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-dim hover:text-main" onClick={() => abrirEdicion(s)} aria-label={`Editar ${s.nombre}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" className="text-dim hover:text-danger" onClick={() => setABorrar(s)} aria-label={`Eliminar ${s.nombre}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar sponsor' : 'Nuevo sponsor'}</DialogTitle>
            <DialogDescription>
              El nombre es lo único obligatorio. El logo y el sitio web son
              opcionales.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre *</Label>
              <Input id="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tier">Categoría</Label>
              <Select value={form.tier} onValueChange={(v) => v && setForm({ ...form, tier: v })}>
                <SelectTrigger id="tier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIERS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="logo">Link del logo <span className="font-normal text-dim">(opcional)</span></Label>
              <Input id="logo" type="url" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
              <p className="text-[11px] text-dim">Una imagen cuadrada se ve mejor en la grilla.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="web">Sitio web <span className="font-normal text-dim">(opcional)</span></Label>
              <Input id="web" type="url" value={form.sitio_web} onChange={(e) => setForm({ ...form, sitio_web: e.target.value })} placeholder="https://…" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Descripción <span className="font-normal text-dim">(opcional)</span></Label>
              <Textarea id="desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                className="h-4 w-4 rounded border-line accent-brand"
              />
              Mostrar en la web
            </label>

            <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar sponsor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirmar
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        onConfirmar={eliminar}
        titulo="Eliminar el sponsor"
        descripcion={`Se va a eliminar ${aBorrar?.nombre} de la web de forma permanente. Si solo querés dejar de mostrarlo, ocultalo en lugar de eliminarlo.`}
      />
    </div>
  );
}
