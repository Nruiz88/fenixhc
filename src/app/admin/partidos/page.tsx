'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { fecha } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import { PageHeader, StatCard, Panel, EmptyState, StatusPill, Toolbar, type StatusTone } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CalendarDays, MapPin, Clock, Pencil, Trash2, Trophy, Home, Plane } from 'lucide-react';

const ESTADOS = [
  { value: 'programado', label: 'Programado' },
  { value: 'en_juego', label: 'En juego' },
  { value: 'finalizado', label: 'Finalizado' },
  { value: 'suspendido', label: 'Suspendido' },
  { value: 'cancelado', label: 'Cancelado' },
];

const TONO_ESTADO: Record<string, StatusTone> = {
  programado: 'info',
  en_juego: 'brand',
  finalizado: 'neutral',
  suspendido: 'warn',
  cancelado: 'danger',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  programado: 'Programado',
  en_juego: 'En juego',
  finalizado: 'Finalizado',
  suspendido: 'Suspendido',
  cancelado: 'Cancelado',
};

const TONO_RESULTADO: Record<string, 'ok' | 'neutral' | 'danger'> = {
  ganado: 'ok',
  empatado: 'neutral',
  perdido: 'danger',
};

const FORM_VACIO = {
  fecha: '', hora: '', rival: '', cancha: 'Cancha Principal',
  es_local: 'true', competencia: 'Liga Local', jornada: '',
  estado: 'programado', goles_nuestros: '', goles_rival: '', notas: '',
};

const SIN_SEL = '__sin_seleccion__';

export default function AdminPartidos() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [form, setForm] = useState({ ...FORM_VACIO });
  const [soloFuturos, setSoloFuturos] = useState(false);
  const [aBorrar, setABorrar] = useState<any | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await db.select<any>('partidos', '*', undefined, {
      order: { column: 'fecha', ascending: false },
      limit: 500,
    });
    setPartidos(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const hoy = todayISO();
    return partidos
      .filter((p) => (soloFuturos ? String(p.fecha) >= hoy : true))
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  }, [partidos, soloFuturos]);

  const jugados = partidos.filter((p) => p.estado === 'finalizado');
  const ganados = jugados.filter((p) => p.resultado === 'ganado').length;
  const perdidos = jugados.filter((p) => p.resultado === 'perdido').length;

  function abrirNuevo() {
    setEditando(null);
    setForm({ ...FORM_VACIO, fecha: todayISO() });
    setAbierto(true);
  }

  function abrirEdicion(p: any) {
    setEditando(p);
    setForm({
      fecha: String(p.fecha).slice(0, 10),
      hora: p.hora ? String(p.hora).slice(0, 5) : '',
      rival: p.rival ?? '',
      cancha: p.cancha ?? 'Cancha Principal',
      es_local: String(!!p.es_local),
      competencia: p.competencia ?? '',
      jornada: p.jornada ?? '',
      estado: p.estado ?? 'programado',
      goles_nuestros: p.goles_nuestros?.toString() ?? '',
      goles_rival: p.goles_rival?.toString() ?? '',
      notas: p.notas ?? '',
    });
    setAbierto(true);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fecha || !form.rival.trim()) { toast.error('Falta la fecha o el rival'); return; }

    // El resultado se deriva del marcador, no se carga a mano: dejarlo en un
    // select obligaba a mantener dos cosas consistentes a mano y terminaba
    // mostrando "ganado 2 a 3".
    const gs = form.goles_nuestros === '' ? null : Number(form.goles_nuestros);
    const gr = form.goles_rival === '' ? null : Number(form.goles_rival);
    const resultado =
      form.estado === 'finalizado' && gs !== null && gr !== null
        ? gs > gr ? 'ganado' : gs < gr ? 'perdido' : 'empatado'
        : null;

    const datos = {
      fecha: form.fecha,
      hora: form.hora || null,
      rival: form.rival.trim(),
      cancha: form.cancha || null,
      es_local: form.es_local === 'true',
      competencia: form.competencia || null,
      jornada: form.jornada || null,
      estado: form.estado,
      goles_nuestros: gs,
      goles_rival: gr,
      notas: form.notas || null,
      resultado,
    };

    setGuardando(true);
    const res = editando
      ? await db.update('partidos', datos, { id: editando.id })
      : await db.insert('partidos', datos);
    setGuardando(false);

    if (res.error) { toast.error(res.error); return; }

    toast.success(editando ? 'Partido actualizado' : 'Partido agregado al calendario');
    setAbierto(false);
    await cargar();
  }

  async function eliminar() {
    if (!aBorrar) return;
    const { error } = await db.delete('partidos', { id: aBorrar.id });
    if (error) { toast.error(error); return; }
    toast.success('Partido eliminado');
    setABorrar(null);
    await cargar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partidos"
        description="Calendario del club. Los partidos finalizados muestran el marcador y el resultado."
        actions={<Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Nuevo partido</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Partidos cargados" value={partidos.length} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Ganados" value={ganados} hint={`${jugados.length} jugados`} tone="ok" icon={<Trophy className="h-4 w-4" />} />
        <StatCard label="Perdidos" value={perdidos} tone="danger" />
      </div>

      <Panel
        title="Calendario"
        description={`${visibles.length} de ${partidos.length} partidos`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <Button size="sm" variant={soloFuturos ? 'default' : 'outline'} onClick={() => setSoloFuturos((v) => !v)}>
              Solo próximos
            </Button>
            <p className="shrink-0 text-xs text-dim">
              {partidos.length - jugados.length} sin jugar
            </p>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<Trophy className="h-6 w-6" />}
            title={partidos.length === 0 ? 'El calendario está vacío' : 'No hay partidos con este filtro'}
            description={
              partidos.length === 0
                ? 'Agregá el primer partido. Con la fecha y el rival alcanza; lo demás se completa después.'
                : 'Desactivá "Solo próximos" para ver también los partidos ya jugados.'
            }
            action={
              partidos.length === 0 ? (
                <Button onClick={abrirNuevo}><Plus className="h-4 w-4" />Agregar partido</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setSoloFuturos(false)}>Ver todos</Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visibles.map((p) => {
              const conMarcador = p.goles_nuestros !== null && p.goles_rival !== null;
              return (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <span
                    className={
                      p.es_local
                        ? 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-info/10 text-info'
                        : 'grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-warn/10 text-warn'
                    }
                    title={p.es_local ? 'Local' : 'Visitante'}
                  >
                    {p.es_local ? <Home className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-main">{p.rival}</p>
                      {conMarcador && (
                        <span className="shrink-0 text-sm font-bold tabular text-main">
                          {p.goles_nuestros} – {p.goles_rival}
                        </span>
                      )}
                      {p.resultado && (
                        <StatusPill tone={TONO_RESULTADO[p.resultado]}>
                          {p.resultado === 'ganado' ? 'Ganado' : p.resultado === 'perdido' ? 'Perdido' : 'Empatado'}
                        </StatusPill>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dim">
                      <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{fecha(p.fecha)}</span>
                      {p.hora && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{String(p.hora).slice(0, 5)}</span>}
                      {p.cancha && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.cancha}</span>}
                      {p.competencia && <span>{p.competencia}{p.jornada ? ` · ${p.jornada}` : ''}</span>}
                    </div>
                  </div>

                  <StatusPill tone={TONO_ESTADO[p.estado] ?? 'neutral'}>
                    {ETIQUETA_ESTADO[p.estado] ?? p.estado}
                  </StatusPill>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon-sm" className="text-dim hover:text-main" onClick={() => abrirEdicion(p)} aria-label={`Editar partido contra ${p.rival}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="text-dim hover:text-danger" onClick={() => setABorrar(p)} aria-label={`Eliminar partido contra ${p.rival}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Alta / edición */}
      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar partido' : 'Nuevo partido'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'Modificá los datos y guardá los cambios.'
                : 'Con la fecha y el rival alcanza para empezar. El resto se completa cuando se sepa.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardar} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="fecha">Fecha *</Label>
                <Input id="fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hora">Hora</Label>
                <Input id="hora" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rival">Rival *</Label>
                <Input id="rival" value={form.rival} onChange={(e) => setForm({ ...form, rival: e.target.value })} placeholder="Nombre del equipo" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sede">Local o visitante</Label>
                <Select value={form.es_local} onValueChange={(v) => v && setForm({ ...form, es_local: v })}>
                  <SelectTrigger id="sede"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Local (de casa)</SelectItem>
                    <SelectItem value="false">Visitante (fuera)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cancha">Cancha</Label>
                <Input id="cancha" value={form.cancha} onChange={(e) => setForm({ ...form, cancha: e.target.value })} />
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
              <div className="space-y-1.5">
                <Label htmlFor="competencia">Competencia</Label>
                <Input id="competencia" value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="Liga local, torneo..." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jornada">Jornada o fecha</Label>
                <Input id="jornada" value={form.jornada} onChange={(e) => setForm({ ...form, jornada: e.target.value })} placeholder="Ej: Fecha 3, Octavos" />
              </div>
            </div>

            {form.estado === 'finalizado' && (
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gn">Goles nuestros</Label>
                  <Input id="gn" type="number" min="0" value={form.goles_nuestros} onChange={(e) => setForm({ ...form, goles_nuestros: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gr">Goles del rival</Label>
                  <Input id="gr" type="number" min="0" value={form.goles_rival} onChange={(e) => setForm({ ...form, goles_rival: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label htmlFor="notas">Notas</Label>
                  <Input id="notas" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
                </div>
                <p className="text-[11px] text-dim sm:col-span-3">
                  El resultado (ganado, empatado o perdido) se calcula solo a
                  partir del marcador.
                </p>
              </div>
            )}

            <DialogFooter className="!mx-0 !mb-0 !rounded-none !border-0 !bg-transparent !p-0">
              <Button type="button" variant="outline" onClick={() => setAbierto(false)}>Cancelar</Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Agregar partido'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Confirmar
        abierto={!!aBorrar}
        onCerrar={() => setABorrar(null)}
        onConfirmar={eliminar}
        titulo="Eliminar el partido"
        descripcion={`Se va a eliminar el partido contra ${aBorrar?.rival} del ${fecha(aBorrar?.fecha)}, con su marcador y sus notas.`}
      />
    </div>
  );
}
