'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { fecha, fechaHora } from '@/lib/format';
import { PageHeader, Panel, EmptyState, StatusPill, Toolbar, Hint, type StatusTone } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Megaphone, Plus, Pencil, Trash2, Star, Search, X, ExternalLink, FileText,
} from 'lucide-react';

const TIPOS = [
  { value: 'general', label: 'General' },
  { value: 'deportivo', label: 'Deportivo' },
  { value: 'pago', label: 'Pago' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'evento', label: 'Evento' },
];

const ESTADOS = [
  { value: 'borrador', label: 'Borrador' },
  { value: 'publicado', label: 'Publicado' },
  { value: 'archivado', label: 'Archivado' },
];

const TONO_TIPO: Record<string, StatusTone> = {
  general: 'neutral',
  deportivo: 'info',
  pago: 'warn',
  urgente: 'danger',
  evento: 'brand',
};

const TONO_ESTADO: Record<string, StatusTone> = {
  borrador: 'neutral',
  publicado: 'ok',
  archivado: 'warn',
};

const FORM_VACIO = {
  titulo: '',
  resumen: '',
  contenido: '',
  tipo: 'general',
  estado: 'publicado',
  imagen_url: '',
  destacado: false,
};

export default function AdminComunicadosPage() {
  const [comunicados, setComunicados] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [aBorrar, setABorrar] = useState<any | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await db.select<any>('comunicados', '*', undefined, {
      order: { column: 'created_at', ascending: false },
      limit: 200,
    });
    setComunicados(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return comunicados
      .filter((c) => (filtro === 'todos' ? true : c.estado === filtro))
      .filter((c) =>
        !q ? true : `${c.titulo} ${c.resumen ?? ''} ${c.contenido ?? ''}`.toLowerCase().includes(q)
      );
  }, [comunicados, filtro, busqueda]);

  const publicados = comunicados.filter((c) => c.estado === 'publicado').length;
  const borradores = comunicados.filter((c) => c.estado === 'borrador').length;

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_VACIO });
    setAbierto(true);
  }

  function abrirEdicion(c: any) {
    setEditando(c);
    setForm({
      titulo: c.titulo ?? '',
      resumen: c.resumen ?? '',
      contenido: c.contenuto ?? '',
      tipo: c.tipo ?? 'general',
      estado: c.estado ?? 'publicado',
      imagen_url: c.imagen_url ?? '',
      destacado: !!c.destacado,
    });
    setAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titulo.trim() || !form.contenido.trim()) {
      toast.error('Falta el título o el contenido');
      return;
    }

    setGuardando(true);
    const payload = {
      titulo: form.titulo.trim(),
      resumen: form.resumen.trim() || null,
      contenido: form.contenido.trim(),
      tipo: form.tipo,
      estado: form.estado,
      imagen_url: form.imagen_url.trim() || null,
      destacado: form.destacado,
      // La fecha de publicación se actualiza solo cuando pasa de borrador a
      // publicado. Si no, un comunicado republicado por error aparecía como
      // nuevo en la web y los socios lo leían dos veces.
      fecha_publicacion:
        form.estado === 'publicado' ? new Date().toISOString() : (editando?.fecha_publicacion ?? null),
    };

    const res = editando
      ? await db.update('comunicados', payload, { id: editando.id })
      : await db.insert('comunicados', payload);
    setGuardando(false);

    if (res.error) { toast.error(res.error); return; }
    toast.success(
      editando
        ? 'Comunicado actualizado'
        : form.estado === 'publicado'
          ? 'Comunicado publicado. Ya está visible en la web.'
          : 'Comunicado guardado como borrador.'
    );
    setAbierto(false);
    await cargar();
  }

  async function eliminar() {
    if (!aBorrar) return;
    const { error } = await db.delete('comunicados', { id: aBorrar.id });
    if (error) { toast.error(error); return; }
    toast.success('Comunicado eliminado');
    setABorrar(null);
    await cargar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comunicados"
        description="Avisos que se publican en la web del club. Un borrador no lo ve nadie."
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Nuevo comunicado</Button>}
      />

      <Hint>
        Un comunicado en <strong>borrador</strong> queda guardado pero no se
        muestra. Sirve para escribir el texto y revisarlo antes de publicar.
      </Hint>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { etiqueta: 'Total', valor: comunicados.length, tone: 'neutral' as StatusTone },
          { etiqueta: 'Publicados', valor: publicados, tone: 'ok' as StatusTone },
          { etiqueta: 'Borradores', valor: borradores, tone: 'neutral' as StatusTone },
          { etiqueta: 'Archivados', valor: comunicados.filter((c) => c.estado === 'archivado').length, tone: 'warn' as StatusTone },
        ].map((s) => (
          <div key={s.etiqueta} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dim">{s.etiqueta}</p>
            <p className="mt-1 text-2xl font-bold tabular text-main">{s.valor}</p>
          </div>
        ))}
      </div>

      <Panel
        title="Comunicados del club"
        description={`${visibles.length} de ${comunicados.length}`}
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
                  placeholder="Buscar por título o texto"
                  className="pl-8"
                  aria-label="Buscar comunicados"
                />
              </div>
              {(busqueda || filtro !== 'todos') && (
                <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setFiltro('todos'); }}>
                  <X className="h-4 w-4" />Limpiar
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ['todos', 'Todos'],
                ['publicado', 'Publicados'],
                ['borrador', 'Borradores'],
                ['archivado', 'Archivados'],
              ].map(([valor, etiqueta]) => (
                <Button key={valor} size="sm" variant={filtro === valor ? 'default' : 'outline'} onClick={() => setFiltro(valor)}>
                  {etiqueta}
                </Button>
              ))}
            </div>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title={comunicados.length === 0 ? 'Todavía no hay comunicados' : 'Ningún comunicado coincide'}
            description={
              comunicados.length === 0
                ? 'Escribí el primer aviso para los socios. Podés guardarlo como borrador y publicarlo cuando esté listo.'
                : 'Probá con otra palabra o quitá el filtro de estado.'
            }
            action={
              comunicados.length === 0 ? (
                <Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Escribir el primero</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setFiltro('todos'); }}>Ver todos</Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visibles.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-muted">
                  {c.destacado ? <Star className="h-4 w-4 text-warn" /> : <FileText className="h-4 w-4" />}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-main">{c.titulo}</p>
                    <StatusPill tone={TONO_ESTADO[c.estado] ?? 'neutral'}>{c.estado}</StatusPill>
                    <StatusPill tone={TONO_TIPO[c.tipo] ?? 'neutral'}>{c.tipo}</StatusPill>
                    {c.destacado && <StatusPill tone="warn">Destacado</StatusPill>}
                  </div>
                  {c.resumen && (
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">{c.resumen}</p>
                  )}
                  <p className="mt-1 text-[11px] text-dim">
                    Creado el {fechaHora(c.created_at)}
                    {c.estado === 'publicado' && c.fecha_publicacion
                      ? ` · publicado el ${fecha(c.fecha_publicacion)}`
                      : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {c.estado === 'publicado' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-dim hover:text-main"
                      onClick={() => window.open('/comunicados', '_blank')}
                      aria-label="Ver en la web"
                      title="Ver en la web"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" className="text-dim hover:text-main" onClick={() => abrirEdicion(c)} aria-label={`Editar ${c.titulo}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="text-dim hover:text-danger" onClick={() => setABorrar(c)} aria-label={`Eliminar ${c.titulo}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Editor */}
      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar comunicado' : 'Nuevo comunicado'}</DialogTitle>
            <DialogDescription>
              El título y el resumen son los que se ven en la lista de la web.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="titulo">Título *</Label>
              <Input id="titulo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={255} required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resumen">Resumen <span className="font-normal text-dim">(opcional)</span></Label>
              <Input
                id="resumen" value={form.resumen}
                onChange={(e) => setForm({ ...form, resumen: e.target.value })}
                placeholder="Dos líneas para que se entienda de qué se trata sin abrirlo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="contenido">Contenido *</Label>
              <Textarea
                id="contenido" value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                placeholder="Escribí el comunicado completo."
                rows={10} required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tipo">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => v && setForm({ ...form, tipo: v })}>
                  <SelectTrigger id="tipo"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="estado">Estado</Label>
                <Select value={form.estado} onValueChange={(v) => v && setForm({ ...form, estado: v })}>
                  <SelectTrigger id="estado"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="imagen">Link de imagen <span className="font-normal text-dim">(opcional)</span></Label>
              <Input
                id="imagen" type="url" value={form.imagen_url}
                onChange={(e) => setForm({ ...form, imagen_url: e.target.value })}
                placeholder="https://…"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={form.destacado}
                onChange={(e) => setForm({ ...form, destacado: e.target.checked })}
                className="h-4 w-4 rounded border-line accent-brand"
              />
              Destacar en la portada
            </label>

            <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : form.estado === 'publicado' ? 'Publicar' : 'Guardar borrador'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirmar
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        onConfirmar={eliminar}
        titulo="Eliminar el comunicado"
        descripcion={`Se va a eliminar "${aBorrar?.titulo}" de forma permanente. Si solo querés que deje de aparecer en la web, archivalo en lugar de eliminarlo.`}
      />
    </div>
  );
}
