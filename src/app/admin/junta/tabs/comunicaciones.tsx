'use client';

import { useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { fechaHora } from '@/lib/format';
import { useJunta, accionJunta } from '../use-junta';
import { Plus, Loader2, Send, Archive, Pin, PinOff, Eye } from 'lucide-react';

// Comunicaciones internas: la parte "blog" del club.
//
// No es la misma pantalla que los comunicados públicos y no por el tono. Es
// por dónde sale: acá se escribe que un padre reclamó, que hay un
// conflicto entre dos familias o que una jugadora se lesionó. Eso no puede
// terminar en la web del club.
//
// Los borradores solo los ve quien puede escribir. No es que estén tapados:
// no llegan. Un `hidden` alcanza para un curioso con el inspector.

interface Item {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string;
  fijado: number;
  autor_nombre: string | null;
  estado: string;
  fecha_publicacion: string | null;
}

const CATEGORIAS = [
  ['general', 'General'],
  ['reunion', 'Reunión'],
  ['deportivo', 'Deportivo'],
  ['administrativo', 'Administrativo'],
  ['urgente', 'Urgente'],
] as const;

const ETIQUETA_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS);

const TONO: Record<string, 'neutral' | 'warn' | 'danger' | 'info'> = {
  general: 'neutral',
  reunion: 'info',
  deportivo: 'neutral',
  administrativo: 'neutral',
  urgente: 'danger',
};

export function TabComunicaciones() {
  const { datos, cargando, fallo, recargar } = useJunta<{ lista: Item[]; puedeEscribir: boolean }>(
    'comunicaciones',
    { todo: '1' }
  );
  const [filtro, setFiltro] = useState<'publicado' | 'borrador' | 'archivado'>('publicado');
  const [abriendo, setAbriendo] = useState<Item | null>(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    titulo: '',
    contenido: '',
    categoria: 'general',
    fijado: false,
  });
  const [guardando, setGuardando] = useState(false);

  const lista = (datos?.lista ?? []).filter((i) => i.estado === filtro);

  async function guardar() {
    if (!form.titulo.trim() || !form.contenido.trim()) {
      return;
    }
    setGuardando(true);
    const ok = await accionJunta(
      'comunicaciones',
      { accion: editando && abriendo?.id ? 'actualizar' : 'crear', id: abriendo?.id, ...form },
      'Guardado'
    );
    setGuardando(false);
    if (ok) {
      setEditando(false);
      setAbriendo(null);
      setForm({ titulo: '', contenido: '', categoria: 'general', fijado: false });
      await recargar();
    }
  }

  function nueva() {
    setForm({ titulo: '', contenido: '', categoria: 'general', fijado: false });
    setEditando(false);
    setAbriendo({ id: '', titulo: '', contenido: '', categoria: 'general', fijado: 0, autor_nombre: null, estado: 'borrador', fecha_publicacion: null });
  }

  return (
    <>
      <Panel
        title="Comunicaciones internas"
        description={`${lista.length} ${lista.length === 1 ? 'comunicación' : 'comunicaciones'}`}
        bodyClassName="p-0"
        actions={
          datos?.puedeEscribir ? (
            <Button size="sm" onClick={nueva}>
              <Plus className="h-4 w-4" />
              Escribir
            </Button>
          ) : undefined
        }
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            {(['publicado', 'borrador', 'archivado'] as const).map((e) =>
              datos?.puedeEscribir ? (
                <button
                  key={e}
                  type="button"
                  onClick={() => setFiltro(e)}
                  className={
                    filtro === e
                      ? 'rounded-md bg-surface-3 px-3 py-1.5 text-sm font-medium text-main'
                      : 'rounded-md px-3 py-1.5 text-sm text-muted hover:text-main'
                  }
                >
                  {e === 'publicado' ? 'Publicadas' : e === 'borrador' ? 'Borradores' : 'Archivadas'}
                </button>
              ) : null
            )}
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : fallo ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{fallo}</p>
        ) : lista.length === 0 ? (
          <EmptyState
            icon={<Send className="h-6 w-6" />}
            title={filtro === 'publicado' ? 'No hay comunicaciones internas' : `No hay ${filtro}s`}
            description={
              filtro === 'publicado'
                ? 'Cuando se cargue algo, aparece acá. Solo la directiva lo ve.'
                : 'Probá con otro estado.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {lista.map((i) => (
              <li key={i.id} className="p-4">
                <button
                  type="button"
                  onClick={() => {
                    setAbriendo(i);
                    setEditando(false);
                  }}
                  className="block w-full text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {!!i.fijado && <Pin className="h-3.5 w-3.5 text-brand" />}
                    <p className="text-sm font-medium text-main">{i.titulo}</p>
                    <StatusPill tone={TONO[i.categoria] ?? 'neutral'}>
                      {ETIQUETA_CATEGORIA[i.categoria] ?? i.categoria}
                    </StatusPill>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{i.contenido}</p>
                  <p className="mt-1.5 text-[11px] text-dim">
                    {i.autor_nombre ?? 'Sin autor'}
                    {i.fecha_publicacion ? ` · ${fechaHora(i.fecha_publicacion)}` : ''}
                  </p>
                </button>

                {datos?.puedeEscribir && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await accionJunta('comunicaciones', {
                          accion: i.fijado ? 'actualizar' : 'actualizar',
                          id: i.id,
                          fijado: !i.fijado,
                        });
                        recargar();
                      }}
                    >
                      {i.fijado ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      {i.fijado ? 'Desfijar' : 'Fijar'}
                    </Button>

                    {i.estado === 'borrador' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await accionJunta('comunicaciones', { accion: 'publicar', id: i.id }, 'Publicada');
                          recargar();
                        }}
                      >
                        <Send className="h-3.5 w-3.5" />
                        Publicar
                      </Button>
                    )}
                    {i.estado === 'publicado' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await accionJunta('comunicaciones', { accion: 'archivar', id: i.id });
                          recargar();
                        }}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archivar
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Hint>
        Lo que se escribe acá es del club por dentro. No se envía por correo ni
        sale en la web: queda en la sección de junta.
      </Hint>

      {/* Ver / escribir */}
      <Dialog open={!!abriendo} onOpenChange={(o) => { if (!o) setAbriendo(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar comunicación' : 'Comunicación interna'}</DialogTitle>
            <DialogDescription>
              {editando ? 'Los cambios no se pueden deshacer.' : 'Escribí lo que haya que dejar asentado.'}
            </DialogDescription>
          </DialogHeader>

          {editando ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="titulo">Título</Label>
                <Input id="titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="categoria">Categoría</Label>
                <select
                  id="categoria"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                >
                  {CATEGORIAS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contenido">Texto</Label>
                <Textarea
                  id="contenido"
                  value={form.contenido}
                  onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                  rows={12}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={form.fijado}
                  onChange={(e) => setForm({ ...form, fijado: e.target.checked })}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                Fijar arriba de todo
              </label>
            </div>
          ) : abriendo?.id ? (
            <article className="max-h-[60vh] space-y-3 overflow-y-auto">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={TONO[abriendo.categoria] ?? 'neutral'}>
                  {ETIQUETA_CATEGORIA[abriendo.categoria] ?? abriendo.categoria}
                </StatusPill>
                {!!abriendo.fijado && <StatusPill tone="brand">Fijada</StatusPill>}
                {abriendo.estado !== 'publicado' && (
                  <StatusPill tone="warn">{abriendo.estado}</StatusPill>
                )}
              </div>
              <p className="text-xs text-dim">
                {abriendo.autor_nombre ?? 'Sin autor'}
                {abriendo.fecha_publicacion ? ` · ${fechaHora(abriendo.fecha_publicacion)}` : ''}
              </p>
              {/* Texto plano con espacios respetados. Es deliberado: el club
                  escribe con párrafos, no con HTML, y guardar HTML en la base
                  es la forma más común de dejar un XSS esperando. */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">
                {abriendo.contenido}
              </p>
            </article>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="titulo-nuevo">Título *</Label>
                <Input id="titulo-nuevo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="categoria-nueva">Categoría</Label>
                <select
                  id="categoria-nueva"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                >
                  {CATEGORIAS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contenido-nuevo">Texto *</Label>
                <Textarea
                  id="contenido-nuevo"
                  value={form.contenido}
                  onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                  rows={10}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={form.fijado}
                  onChange={(e) => setForm({ ...form, fijado: e.target.checked })}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                Fijar arriba de todo
              </label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAbriendo(null)} disabled={guardando}>
              Cerrar
            </Button>
            {abriendo?.id && datos?.puedeEscribir && !editando && (
              <Button
                variant="outline"
                onClick={() => {
                  setForm({
                    titulo: abriendo.titulo,
                    contenido: abriendo.contenido,
                    categoria: abriendo.categoria,
                    fijado: !!abriendo.fijado,
                  });
                  setEditando(true);
                }}
              >
                Editar
              </Button>
            )}
            {datos?.puedeEscribir && (editando || !abriendo?.id) && (
              <Button
                onClick={guardar}
                disabled={guardando || !form.titulo.trim() || !form.contenido.trim()}
              >
                {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                {editando ? 'Guardar cambios' : 'Guardar como borrador'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
