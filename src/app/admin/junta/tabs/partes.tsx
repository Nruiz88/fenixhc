'use client';

import { useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { fecha } from '@/lib/format';
import { useJunta, accionJunta } from '../use-junta';
import { Plus, Loader2, ClipboardList } from 'lucide-react';

// Partes: el acta de la reunión.
//
// SON DOS Y NO UNO. El administrativo lleva las decisiones de la junta; el
// financiero, el estado de cuenta que firma el tesorero y aprueba el presidente.
// La API decide a cuál puede entrar cada cargo, así que el tesorero ve esta
// pestaña con un solo botón y la secretaría con el otro.

interface Parte {
  id: string;
  titulo: string;
  fecha_reunion: string;
  contenido: string;
  asistentes: string | null;
  decisiones: string | null;
  autor_nombre: string | null;
}

export function TabPartes() {
  const [tipo, setTipo] = useState<'administrativo' | 'financiero'>('administrativo');
  const { datos, cargando, fallo, recargar } = useJunta<{
    tipo: string;
    lista: Parte[];
    puedeCargar: boolean;
  }>('partes', { tipo });

  const [abriendo, setAbriendo] = useState<Parte | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    fecha_reunion: new Date().toISOString().slice(0, 10),
    contenido: '',
    asistentes: '',
    decisiones: '',
  });
  const [guardando, setGuardando] = useState(false);

  const lista = datos?.lista ?? [];

  async function guardar() {
    if (!form.titulo.trim() || !form.contenido.trim()) return;
    setGuardando(true);
    const ok = await accionJunta('partes', { accion: 'crear', tipo, ...form }, 'Parte cargado');
    setGuardando(false);
    if (ok) {
      setNuevo(false);
      setForm({ ...form, titulo: '', contenido: '', asistentes: '', decisiones: '' });
      await recargar();
    }
  }

  return (
    <>
      <Panel
        title="Partes"
        description={`${lista.length} ${lista.length === 1 ? 'parte' : 'partes'}`}
        bodyClassName="p-0"
        actions={
          datos?.puedeCargar ? (
            <Button size="sm" onClick={() => setNuevo(true)}>
              <Plus className="h-4 w-4" />
              Cargar parte
            </Button>
          ) : undefined
        }
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <button
              type="button"
              onClick={() => setTipo('administrativo')}
              className={
                tipo === 'administrativo'
                  ? 'rounded-md bg-surface-3 px-3 py-1.5 text-sm font-medium text-main'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted hover:text-main'
              }
            >
              Administrativo
            </button>
            <button
              type="button"
              onClick={() => setTipo('financiero')}
              className={
                tipo === 'financiero'
                  ? 'rounded-md bg-surface-3 px-3 py-1.5 text-sm font-medium text-main'
                  : 'rounded-md px-3 py-1.5 text-sm text-muted hover:text-main'
              }
            >
              Ingresos y egresos
            </button>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : fallo ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{fallo}</p>
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title="Todavía no hay partes"
            description="El acta de cada reunión queda acá, con su fecha y quién la cargó."
          />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setAbriendo(p)}
                  className="block w-full p-4 text-left transition-colors hover:bg-surface-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={p.fecha_reunion === new Date().toISOString().slice(0, 10) ? 'brand' : 'neutral'}>
                      {fecha(p.fecha_reunion)}
                    </StatusPill>
                    <p className="text-sm font-medium text-main">{p.titulo}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{p.contenido}</p>
                  <p className="mt-1.5 text-[11px] text-dim">{p.autor_nombre ?? 'Sin autor'}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Hint>
        El parte no se borra ni se edita después de cargado. Si algo quedó mal,
        se carga otro que lo corrija.
      </Hint>

      {/* Ver */}
      <Dialog open={!!abriendo} onOpenChange={(o) => { if (!o) setAbriendo(null); }}>
        <DialogContent className="max-w-2xl">
          {abriendo && (
            <>
              <DialogHeader>
                <DialogTitle>{abriendo.titulo}</DialogTitle>
                <DialogDescription>
                  {fecha(abriendo.fecha_reunion)} · {abriendo.autor_nombre ?? 'Sin autor'}
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[60vh] space-y-4 overflow-y-auto">
                <section>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-dim">Contenido</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                    {abriendo.contenido}
                  </p>
                </section>
                {abriendo.asistentes && (
                  <section>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dim">Asistentes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{abriendo.asistentes}</p>
                  </section>
                )}
                {abriendo.decisiones && (
                  <section>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-dim">Decisiones</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{abriendo.decisiones}</p>
                  </section>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAbriendo(null)}>Cerrar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Cargar */}
      <Dialog open={nuevo} onOpenChange={(o) => { if (!o) setNuevo(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cargar parte {tipo === 'financiero' ? 'de ingresos y egresos' : 'administrativo'}</DialogTitle>
            <DialogDescription>
              Queda asentado con tu nombre y la fecha. No se edita después.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha de la reunión *</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={form.fecha_reunion}
                  onChange={(e) => setForm({ ...form, fecha_reunion: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="titulo-parte">Título *</Label>
                <Input
                  id="titulo-parte"
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ej: Comisión directiva 12 de octubre"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contenido-parte">Contenido *</Label>
              <Textarea
                id="contenido-parte"
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                rows={10}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="asistentes">Asistentes</Label>
                <Textarea
                  id="asistentes"
                  value={form.asistentes}
                  onChange={(e) => setForm({ ...form, asistentes: e.target.value })}
                  rows={4}
                  placeholder="Uno por línea"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="decisiones">Decisiones</Label>
                <Textarea
                  id="decisiones"
                  value={form.decisiones}
                  onChange={(e) => setForm({ ...form, decisiones: e.target.value })}
                  rows={4}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNuevo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={guardar}
              disabled={guardando || !form.titulo.trim() || !form.contenido.trim()}
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Cargar el parte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
