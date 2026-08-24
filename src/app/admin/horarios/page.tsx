'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/adminQuery';
import { Clock, Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, Save, X, Target, Dumbbell, Brain, Swords, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const TIPOS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  'Técnico': { icon: Target, color: '#DC2626', bg: 'bg-[#DC2626]/10' },
  'Físico': { icon: Dumbbell, color: '#3B82F6', bg: 'bg-blue-500/10' },
  'Táctico': { icon: Brain, color: '#8B5CF6', bg: 'bg-violet-500/10' },
  'Partido': { icon: Swords, color: '#F59E0B', bg: 'bg-amber-500/10' },
  'Libre': { icon: Trophy, color: '#10B981', bg: 'bg-emerald-500/10' },
};

const TIPOS_LISTA = ['Técnico', 'Físico', 'Táctico', 'Partido', 'Libre'];
const NIVELES = ['Todos', 'Avanzados', 'Juveniles'];

interface Horario {
  id: string;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  tipo: string;
  descripcion: string | null;
  nivel: string;
  activo: boolean;
  orden: number;
}

export default function AdminHorariosPage() {
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Horario | null>(null);
  const [form, setForm] = useState({
    dia: 'Lunes',
    hora_inicio: '16:00',
    hora_fin: '18:00',
    tipo: 'Técnico',
    descripcion: '',
    nivel: 'Todos',
    activo: true,
    orden: 0,
  });

  const loadHorarios = async () => {
    setLoading(true);
    const { data } = await db.select<Horario[]>('horarios_entrenamiento', '*', undefined, { order: { column: 'orden', ascending: true } });
    setHorarios(data || []);
    setLoading(false);
  };

  useEffect(() => { loadHorarios(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxOrden = Math.max(0, ...horarios.map(h => h.orden));
    const payload = {
      ...form,
      descripcion: form.descripcion || null,
      orden: editing ? form.orden : maxOrden + 1,
    };

    if (editing) {
      const { error } = await db.update('horarios_entrenamiento', payload, { id: editing.id });
      if (!error) {
        toast.success('Horario actualizado');
        setShowForm(false);
        setEditing(null);
        resetForm();
        loadHorarios();
      } else {
        toast.error('Error al actualizar');
      }
    } else {
      const { error } = await db.insert('horarios_entrenamiento', payload);
      if (!error) {
        toast.success('Horario creado');
        setShowForm(false);
        resetForm();
        loadHorarios();
      } else {
        toast.error('Error al crear');
      }
    }
  };

  const handleEdit = (h: Horario) => {
    setEditing(h);
    setForm({
      dia: h.dia,
      hora_inicio: h.hora_inicio,
      hora_fin: h.hora_fin,
      tipo: h.tipo,
      descripcion: h.descripcion || '',
      nivel: h.nivel,
      activo: h.activo,
      orden: h.orden,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este horario?')) return;
    const { error } = await db.delete('horarios_entrenamiento', { id });
    if (!error) {
      toast.success('Horario eliminado');
      loadHorarios();
    } else {
      toast.error('Error al eliminar');
    }
  };

  const toggleActivo = async (h: Horario) => {
    await db.update('horarios_entrenamiento', { activo: !h.activo }, { id: h.id });
    loadHorarios();
  };

  const resetForm = () => {
    setForm({ dia: 'Lunes', hora_inicio: '16:00', hora_fin: '18:00', tipo: 'Técnico', descripcion: '', nivel: 'Todos', activo: true, orden: 0 });
    setEditing(null);
  };

  const getTipoConfig = (tipo: string) => TIPOS_CONFIG[tipo] || TIPOS_CONFIG['Técnico'];

  // Group by day
  const horariosPorDia = DIAS.reduce((acc, dia) => {
    acc[dia] = horarios.filter(h => h.dia === dia).sort((a, b) => a.orden - b.orden);
    return acc;
  }, {} as Record<string, Horario[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Horarios de Entrenamiento</h1>
          <p className="text-sm text-gray-400 mt-1">Gestioná los horarios que se muestran en la página pública</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
          <Plus className="h-4 w-4" /> Nuevo Horario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: horarios.length },
          { label: 'Activos', value: horarios.filter(h => h.activo).length },
          { label: 'Días con clases', value: Object.keys(horariosPorDia).filter(d => horariosPorDia[d].length > 0).length },
          { label: 'Tipos', value: new Set(horarios.map(h => h.tipo)).size },
        ].map((s, i) => (
          <Card key={i} className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-[#DC2626]" />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-gray-900 border-gray-800 border-[#DC2626]/30">
          <CardHeader className="border-b border-gray-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-lg">
              {editing ? 'Editar Horario' : 'Nuevo Horario'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Día *</Label>
                  <select value={form.dia} onChange={e => setForm({ ...form, dia: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Hora Inicio *</Label>
                  <Input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Hora Fin *</Label>
                  <Input type="time" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Tipo *</Label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    {TIPOS_LISTA.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Nivel</Label>
                  <select value={form.nivel} onChange={e => setForm({ ...form, nivel: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="space-y-2 flex items-end">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-[#DC2626] focus:ring-[#DC2626]" />
                    <Label htmlFor="activo" className="text-gray-400 text-sm cursor-pointer">Activo (visible en página pública)</Label>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-3">
                  <Label className="text-gray-400 text-sm">Descripción</Label>
                  <Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Dribling, pases y recepción" className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
                  <Save className="h-4 w-4" /> {editing ? 'Actualizar' : 'Crear'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="border-gray-700 text-gray-400 hover:text-white">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Schedule by Day */}
      <div className="space-y-4">
        {loading ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-[#DC2626] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-4">Cargando horarios...</p>
            </CardContent>
          </Card>
        ) : horarios.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Clock className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No hay horarios configurados</p>
              <p className="text-xs text-gray-600 mt-1">Creá el primer horario con el botón de arriba</p>
            </CardContent>
          </Card>
        ) : (
          DIAS.map(dia => {
            const items = horariosPorDia[dia];
            if (!items || items.length === 0) return null;
            return (
              <div key={dia}>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="h-1 w-4 bg-[#DC2626] rounded-full" />
                  {dia}
                </h3>
                <div className="space-y-2">
                  {items.map(h => {
                    const config = getTipoConfig(h.tipo);
                    const Icon = config.icon;
                    return (
                      <Card key={h.id} className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-all ${!h.activo ? 'opacity-50' : ''}`}>
                        <CardContent className="p-4 flex items-center gap-4">
                          {/* Icon */}
                          <div className={`h-11 w-11 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                            <Icon className="h-5 w-5" style={{ color: config.color }} />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-white">{h.tipo}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-gray-500 uppercase">{h.nivel}</span>
                              {!h.activo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-900/30 text-yellow-500 uppercase">Inactivo</span>}
                            </div>
                            {h.descripcion && <p className="text-sm text-gray-400 mt-0.5">{h.descripcion}</p>}
                          </div>

                          {/* Time */}
                          <div className="text-right shrink-0">
                            <span className="text-sm font-mono text-gray-300 bg-gray-800 px-3 py-1.5 rounded-lg">
                              {h.hora_inicio.slice(0, 5)} - {h.hora_fin.slice(0, 5)}
                            </span>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => toggleActivo(h)} className={`h-8 w-8 p-0 ${h.activo ? 'text-emerald-400 hover:text-yellow-400' : 'text-yellow-400 hover:text-emerald-400'}`} title={h.activo ? 'Desactivar' : 'Activar'}>
                              {h.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(h)} className="h-8 w-8 p-0 text-gray-500 hover:text-blue-400" title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(h.id)} className="h-8 w-8 p-0 text-gray-500 hover:text-red-400" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
