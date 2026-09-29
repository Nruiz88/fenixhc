'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { PageHeader, Panel, EmptyState, StatusPill, Hint } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, Plus, Pencil, Trash2, EyeOff, Target, Dumbbell, Brain, Swords, Trophy } from 'lucide-react';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const TIPOS = [
  { value: 'Técnico', label: 'Técnico', icon: Target,   tone: 'bg-brand/10 text-brand' },
  { value: 'Físico',  label: 'Físico',  icon: Dumbbell, tone: 'bg-info/10 text-info' },
  { value: 'Táctico', label: 'Táctico', icon: Brain,    tone: 'bg-warn/10 text-warn' },
  { value: 'Partido', label: 'Partido', icon: Swords,   tone: 'bg-danger/10 text-danger' },
  { value: 'Libre',   label: 'Libre',   icon: Trophy,   tone: 'bg-ok/10 text-ok' },
];

const NIVELES = ['Todos', 'Avanzados', 'Juveniles'];

const TIPO_POR_NOMBRE = new Map(TIPOS.map((t) => [t.value, t]));
const TIPO_GENERICO = { value: '—', label: '—', icon: Clock, tone: 'bg-surface-3 text-muted' };

const hora = (v: string) => String(v ?? '').slice(0, 5);

const FORM_VACIO = {
  dia: 'Lunes',
  hora_inicio: '16:00',
  hora_fin: '18:00',
  tipo: 'Técnico',
  descripcion: '',
  nivel: 'Todos',
  activo: true,
};

export default function AdminHorariosPage() {
  const [horarios, setHorarios] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [aBorrar, setABorrar] = useState<any | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await db.select<any>('horarios_entrenamiento', '*', undefined, {
      order: { column: 'orden', ascending: true },
      limit: 200,
    });
    setHorarios(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  // Agrupado por día, en el orden de la semana. Ver los horarios en el
  // orden en que se entrena es la única forma de detectar un choque de
  // horarios; una lista plana por `orden` no lo muestra.
  const porDia = useMemo(() => {
    return DIAS.map((dia) => ({
      dia,
      items: horarios
        .filter((h) => h.dia === dia)
        .sort((a, b) => hora(a.hora_inicio).localeCompare(hora(b.hora_inicio))),
    }));
  }, [horarios]);

  const activos = horarios.filter((h) => h.activo).length;

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_VACIO });
    setAbierto(true);
  }

  function abrirEdicion(h: any) {
    setEditando(h);
    setForm({
      dia: h.dia,
      hora_inicio: hora(h.hora_inicio),
      hora_fin: hora(h.hora_fin),
      tipo: h.tipo,
      descripcion: h.descripcion ?? '',
      nivel: h.nivel ?? 'Todos',
      activo: !!h.activo,
    });
    setAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (hora(form.hora_fin) <= hora(form.hora_inicio)) {
      toast.error('La hora de fin tiene que ser posterior a la de inicio');
      return;
    }

    setGuardando(true);
    const payload = {
      dia: form.dia,
      hora_inicio: form.hora_inicio,
      hora_fin: form.hora_fin,
      tipo: form.tipo,
      descripcion: form.descripcion.trim() || null,
      nivel: form.nivel,
      activo: form.activo,
      // El orden solo importa al crear: define en qué posición aparece el
      // bloque dentro del día. Al editar se conserva.
      orden: editando
        ? editando.orden
        : Math.max(0, ...horarios.map((h) => Number(h.orden) || 0)) + 1,
    };

    const res = editando
      ? await db.update('horarios_entrenamiento', payload, { id: editando.id })
      : await db.insert('horarios_entrenamiento', payload);
    setGuardando(false);

    if (res.error) { toast.error(res.error); return; }

    toast.success(editando ? 'Horario actualizado' : 'Horario agregado a la semana');
    setAbierto(false);
    await cargar();
  }

  async function eliminar() {
    if (!aBorrar) return;
    const { error } = await db.delete('horarios_entrenamiento', { id: aBorrar.id });
    if (error) { toast.error(error); return; }
    toast.success('Horario eliminado');
    setABorrar(null);
    await cargar();
  }

  async function alternarActivo(h: any) {
    const { error } = await db.update('horarios_entrenamiento', { activo: !h.activo }, { id: h.id });
    if (error) { toast.error(error); return; }
    await cargar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horarios de entrenamiento"
        description={`${activos} bloques activos en la semana.`}
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Agregar horario</Button>}
      />

      <Hint>
        Un horario desactivado sigue cargado pero no aparece en la web. Sirve
        para dejar de publicar un bloque en verano sin borrar el histórico.
      </Hint>

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : horarios.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Clock className="h-6 w-6" />}
            title="No hay horarios cargados"
            description="Agregá el primer bloque de entrenamiento. Aparece en la web pública y en el portal de los socios."
            action={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Agregar el primero</Button>}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {porDia.map(({ dia, items }) => (
            <Panel
              key={dia}
              title={dia}
              description={items.length ? `${items.length} ${items.length === 1 ? 'bloque' : 'bloques'}` : undefined}
              bodyClassName={items.length ? 'p-0' : 'p-0'}
            >
              {items.length === 0 ? (
                <p className="px-4 py-5 text-center text-xs text-dim">Sin entrenamiento</p>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((h) => {
                    const tipo = TIPO_POR_NOMBRE.get(h.tipo) ?? TIPO_GENERICO;
                    const Icono = tipo.icon;
                    return (
                      <li
                        key={h.id}
                        className={`flex items-center gap-3 px-4 py-3 ${h.activo ? '' : 'opacity-50'}`}
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tipo.tone}`}>
                          <Icono className="h-4 w-4" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-main">{h.tipo}</p>
                          <p className="truncate text-xs text-dim">
                            {hora(h.hora_inicio)} – {hora(h.hora_fin)} · {h.nivel}
                          </p>
                          {h.descripcion && (
                            <p className="mt-0.5 truncate text-xs text-dim" title={h.descripcion}>{h.descripcion}</p>
                          )}
                        </div>

                        {!h.activo && <StatusPill tone="neutral"><EyeOff className="h-3 w-3" />Inactivo</StatusPill>}

                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-dim hover:text-main"
                            onClick={() => alternarActivo(h)}
                            aria-label={h.activo ? 'Desactivar horario' : 'Activar horario'}
                            title={h.activo ? 'Desactivar' : 'Activar'}
                          >
                            {h.activo ? <EyeOff className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-dim hover:text-main" onClick={() => abrirEdicion(h)} aria-label="Editar horario">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-dim hover:text-danger" onClick={() => setABorrar(h)} aria-label="Eliminar horario">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          ))}
        </div>
      )}

      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar horario' : 'Nuevo horario'}</DialogTitle>
            <DialogDescription>
              Define el día, la franja horaria y el tipo de entrenamiento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dia">Día</Label>
                <Select value={form.dia} onValueChange={(v) => v && setForm({ ...form, dia: v })}>
                  <SelectTrigger id="dia"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
                <Label htmlFor="inicio">Hora de inicio</Label>
                <Input id="inicio" type="time" value={form.hora_inicio} onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fin">Hora de fin</Label>
                <Input id="fin" type="time" value={form.hora_fin} onChange={(e) => setForm({ ...form, hora_fin: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nivel">Nivel</Label>
                <Select value={form.nivel} onValueChange={(v) => v && setForm({ ...form, nivel: v })}>
                  <SelectTrigger id="nivel"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVELES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="desc">Descripción <span className="font-normal text-dim">(opcional)</span></Label>
                <Input id="desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Llevarunitas. Se juega con protecciones." />
              </div>
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
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar horario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirmar
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        onConfirmar={eliminar}
        titulo="Eliminar el horario"
        descripcion={`Se va a eliminar el bloque de ${aBorrar?.tipo} del ${aBorrar?.dia}, de ${hora(aBorrar?.hora_inicio)} a ${hora(aBorrar?.hora_fin)}. Si solo querés dejar de publicarlo, desactivalo en lugar de eliminarlo.`}
      />
    </div>
  );
}
