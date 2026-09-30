'use client';

import { useState } from 'react';
import { Panel, EmptyState, StatusPill, Hint, Toolbar, StatCard } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { fecha } from '@/lib/format';
import { useJunta, accionJunta } from '../use-junta';
import { Boxes, Plus, Loader2, HandCoins, Undo2 } from 'lucide-react';

// Equipos: qué tiene el club, dónde está y quién lo tiene.
//
// La pregunta de todos los veranos es "¿cuántos sticks tenemos?". Sin esto la
// respuesta vive en la cabeza de uno, y cuando esa persona no está, no está.
//
// `cantidad_total` y `cantidad_prestada` van separadas a propósito. Si el
// total se reescribiera en cada préstamo, se pierde la historia de cuánto había.

interface Item {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  cantidad_total: number;
  cantidad_prestada: number;
  cantidad_disponible: number;
  estado: string;
  ubicacion: string | null;
}

interface Prestamo {
  id: string;
  item_nombre: string;
  persona_nombre: string;
  cantidad: number;
  fecha_prestamo: string;
  fecha_estimada_devolucion: string | null;
  estado: string;
}

const CATEGORIAS = [
  ['sticks', 'Sticks'],
  ['tickets', 'Tickets'],
  ['pads', 'Pads'],
  ['porterias', 'Porterías'],
  ['balones', 'Balones'],
  ['indumentaria', 'Indumentaria'],
  ['otros', 'Otros'],
] as const;

export function TabInventario() {
  const { datos, cargando, fallo, recargar } = useJunta<{
    items: Item[];
    prestamos: Prestamo[];
    puedeGestionar: boolean;
    puedePrestar: boolean;
  }>('inventario');

  const [editando, setEditando] = useState<Item | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const [prestamos, setPrestamos] = useState(false);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    categoria: 'sticks',
    cantidad_total: '',
    estado: 'activo',
    ubicacion: '',
  });
  const [formPrestamo, setFormPrestamo] = useState({
    item_id: '',
    persona_nombre: '',
    cantidad: '1',
    fecha_estimada_devolucion: '',
  });
  const [guardando, setGuardando] = useState(false);

  const items = datos?.items ?? [];
  const activos = datos?.prestamos ?? [];
  const faltantes = items.filter((i) => i.cantidad_disponible <= 0 && i.estado === 'activo').length;

  async function guardarItem() {
    if (!form.nombre.trim() || !form.cantidad_total) return;
    setGuardando(true);
    const ok = await accionJunta(
      'inventario',
      { accion: 'guardar-item', id: editando?.id, ...form },
      editando ? 'Equipo actualizado' : 'Equipo cargado'
    );
    setGuardando(false);
    if (ok) {
      setEditando(null);
      setNuevo(false);
      setForm({ nombre: '', descripcion: '', categoria: 'sticks', cantidad_total: '', estado: 'activo', ubicacion: '' });
      await recargar();
    }
  }

  async function prestar() {
    if (!formPrestamo.item_id || !formPrestamo.persona_nombre.trim()) return;
    setGuardando(true);
    const ok = await accionJunta(
      'inventario',
      { accion: 'prestar', ...formPrestamo },
      'Préstamo registrado'
    );
    setGuardando(false);
    if (ok) {
      setPrestamos(false);
      setFormPrestamo({ item_id: '', persona_nombre: '', cantidad: '1', fecha_estimada_devolucion: '' });
      await recargar();
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Tipos de equipo" value={items.length} />
        <StatCard
          label="Unidades totales"
          value={items.reduce((s, i) => s + Number(i.cantidad_total), 0)}
        />
        <StatCard
          label="Prestadas ahora"
          value={items.reduce((s, i) => s + Number(i.cantidad_prestada), 0)}
          tone="info"
        />
        <StatCard
          label="Sin stock"
          value={faltantes}
          tone={faltantes > 0 ? 'warn' : 'ok'}
          hint={faltantes > 0 ? 'No queda ninguna' : 'Todo disponible'}
        />
      </div>

      <Panel
        title="Inventario de equipos"
        description={`${items.length} tipos`}
        bodyClassName="p-0"
        actions={
          datos?.puedeGestionar ? (
            <Button size="sm" onClick={() => setNuevo(true)}>
              <Plus className="h-4 w-4" />
              Cargar equipo
            </Button>
          ) : undefined
        }
      >
        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : fallo ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{fallo}</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Boxes className="h-6 w-6" />}
            title="No hay equipos cargados"
            description="Sticks, tickets, porterías. Lo que el club tiene y tiene que devolver."
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-main">{i.nombre}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StatusPill
                      tone={
                        i.estado === 'activo' ? 'neutral' : i.estado === 'baja' ? 'danger' : 'warn'
                      }
                    >
                      {i.estado === 'activo' ? 'Activo' : i.estado === 'baja' ? 'De baja' : 'En reparación'}
                    </StatusPill>
                    <StatusPill
                      tone={
                        Number(i.cantidad_disponible) > 0
                          ? 'ok'
                          : Number(i.cantidad_prestada) > 0
                            ? 'warn'
                            : 'neutral'
                      }
                    >
                      {i.cantidad_disponible} disponibles
                    </StatusPill>
                    <span className="text-[11px] text-dim">
                      de {i.cantidad_total} · {i.cantidad_prestada} prestados
                    </span>
                    {i.ubicacion && <span className="text-[11px] text-dim">· {i.ubicacion}</span>}
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {datos?.puedePrestar && Number(i.cantidad_disponible) > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFormPrestamo({ item_id: i.id, persona_nombre: '', cantidad: '1', fecha_estimada_devolucion: '' });
                        setPrestamos(true);
                      }}
                    >
                      <HandCoins className="h-3.5 w-3.5" />
                      Prestar
                    </Button>
                  )}
                  {datos?.puedeGestionar && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditando(i);
                        setForm({
                          nombre: i.nombre,
                          descripcion: i.descripcion ?? '',
                          categoria: i.categoria,
                          cantidad_total: String(i.cantidad_total),
                          estado: i.estado,
                          ubicacion: i.ubicacion ?? '',
                        });
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Préstamos abiertos"
        description={`${activos.length} sin devolver`}
        bodyClassName="p-0"
      >
        {activos.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-dim">No hay nada prestado.</p>
        ) : (
          <ul className="divide-y divide-line">
            {activos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm text-main">
                    {p.cantidad} × {p.item_nombre}
                  </p>
                  <p className="mt-0.5 text-[11px] text-dim">
                    {p.persona_nombre} · desde {fecha(p.fecha_prestamo)}
                    {p.fecha_estimada_devolucion ? ` · vuelve ${fecha(p.fecha_estimada_devolucion)}` : ''}
                  </p>
                </div>
                {datos?.puedePrestar && (
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await accionJunta('inventario', { accion: 'cerrar-prestamo', id: p.id, resultado: 'devuelto' });
                        recargar();
                      }}
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Devuelto
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await accionJunta('inventario', { accion: 'cerrar-prestamo', id: p.id, resultado: 'perdido' });
                        recargar();
                      }}
                    >
                      Perdido
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Hint>
        Un equipo marcado como perdido sale del inventario. Si se pierde más de
        lo que el club puede reponer, conviene pasarlo a "de baja" para que
        alguien lo decida formalmente.
      </Hint>

      {/* Cargar / editar equipo */}
      <Dialog open={nuevo || !!editando} onOpenChange={(o) => { if (!o) { setNuevo(false); setEditando(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? `Editar ${editando.nombre}` : 'Cargar equipo'}</DialogTitle>
            <DialogDescription>
              Al editar, el total no baja la cantidad que ya está prestada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="i-nombre">Nombre *</Label>
                <Input id="i-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Sticks juniors" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-categoria">Categoría</Label>
                <select
                  id="i-categoria"
                  value={form.categoria}
                  onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                >
                  {CATEGORIAS.map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="i-cant">Cantidad *</Label>
                <Input
                  id="i-cant"
                  value={form.cantidad_total}
                  onChange={(e) => setForm({ ...form, cantidad_total: e.target.value })}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-estado">Estado</Label>
                <select
                  id="i-estado"
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                >
                  <option value="activo">Activo</option>
                  <option value="reparacion">En reparación</option>
                  <option value="baja">De baja</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="i-ubicacion">Ubicación</Label>
                <Input id="i-ubicacion" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} placeholder="Depósito" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="i-desc">Descripción</Label>
              <Textarea id="i-desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setNuevo(false); setEditando(null); }} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardarItem} disabled={guardando || !form.nombre.trim() || !form.cantidad_total}>
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prestar */}
      <Dialog open={prestamos} onOpenChange={(o) => setPrestamos(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prestar equipo</DialogTitle>
            <DialogDescription>
              Queda registrado quién se lo llevó y cuándo. Sin eso, el que falte
              después no tiene dueño.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-persona">Quién se lo lleva *</Label>
              <Input
                id="p-persona"
                value={formPrestamo.persona_nombre}
                onChange={(e) => setFormPrestamo({ ...formPrestamo, persona_nombre: e.target.value })}
                placeholder="Nombre y apellido"
              />
              <p className="text-[11px] text-dim">
                No hace falta que sea socio: puede ser el entrenador de una escuela.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-cant">Cantidad *</Label>
                <Input
                  id="p-cant"
                  value={formPrestamo.cantidad}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, cantidad: e.target.value })}
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-vuelve">Vuelve</Label>
                <Input
                  id="p-vuelve"
                  type="date"
                  value={formPrestamo.fecha_estimada_devolucion}
                  onChange={(e) => setFormPrestamo({ ...formPrestamo, fecha_estimada_devolucion: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPrestamos(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={prestar}
              disabled={guardando || !formPrestamo.persona_nombre.trim()}
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <HandCoins className="h-4 w-4" />}
              Registrar el préstamo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
