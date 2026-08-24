'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Calendar, MapPin, Clock, Edit, Trash2, Trophy } from 'lucide-react';

export default function AdminPartidos() {
  const [partidos, setPartidos] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    fecha: '', hora: '', rival: '', cancha: 'Cancha Principal', es_local: 'true',
    competencia: 'Liga Local', jornada: '', estado: 'programado',
    goles_nuestros: '', goles_rival: '', notas: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await db.select('partidos', '*', undefined, { order: { column: 'fecha', ascending: true } });
    setPartidos(data || []);
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      fecha: form.fecha, hora: form.hora || null, rival: form.rival,
      cancha: form.cancha, es_local: form.es_local === 'true',
      competencia: form.competencia, jornada: form.jornada || null,
      estado: form.estado as any,
      goles_nuestros: form.goles_nuestros ? Number(form.goles_nuestros) : null,
      goles_rival: form.goles_rival ? Number(form.goles_rival) : null,
      notas: form.notas || null,
      resultado: form.estado === 'finalizado' && form.goles_nuestros && form.goles_rival
        ? (Number(form.goles_nuestros) > Number(form.goles_rival) ? 'ganado' : Number(form.goles_nuestros) < Number(form.goles_rival) ? 'perdido' : 'empatado')
        : null,
    };
    if (editing) {
      await db.update('partidos', data, { id: editing.id });
      toast.success('Partido actualizado');
    } else {
      await db.insert('partidos', data);
      toast.success('Partido creado');
    }
    setEditing(null);
    setForm({ fecha: '', hora: '', rival: '', cancha: 'Cancha Principal', es_local: 'true', competencia: 'Liga Local', jornada: '', estado: 'programado', goles_nuestros: '', goles_rival: '', notas: '' });
    load();
  };

  const handleEdit = (p: any) => {
    setEditing(p);
    setForm({
      fecha: p.fecha, hora: p.hora?.slice(0, 5) || '', rival: p.rival,
      cancha: p.cancha, es_local: String(p.es_local), competencia: p.competencia,
      jornada: p.jornada || '', estado: p.estado,
      goles_nuestros: p.goles_nuestros?.toString() || '', goles_rival: p.goles_rival?.toString() || '',
      notas: p.notas || '',
    });
  };

  const handleDelete = async (id: string) => { await db.delete('partidos', { id }); toast.success('Eliminado'); load(); };

  const estadoColors: Record<string, string> = {
    programado: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    en_juego: 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30',
    finalizado: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
    suspendido: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    cancelado: 'bg-red-500/10 text-red-400 border-red-500/30',
  };

  const resultadoColors: Record<string, string> = {
    ganado: 'text-[#DC2626]', empatado: 'text-amber-400', perdido: 'text-red-400',
  };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Calendario de Partidos</h1><p className="text-gray-400 text-sm mt-1">Gestioná los partidos del club</p></div>

      {/* Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#DC2626]" />
            {editing ? 'Editar Partido' : 'Nuevo Partido'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Fecha</Label><Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Hora</Label><Input type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Rival</Label><Input value={form.rival} onChange={e => setForm({ ...form, rival: e.target.value })} placeholder="Nombre del rival" className="bg-gray-800 border-gray-700 text-white" required /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Local / Visitante</Label><Select value={form.es_local} onValueChange={(v) => v && setForm({ ...form, es_local: v })}><SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">🏠 Local</SelectItem><SelectItem value="false">✈️ Visitante</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Cancha</Label><Input value={form.cancha} onChange={e => setForm({ ...form, cancha: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Competencia</Label><Input value={form.competencia} onChange={e => setForm({ ...form, competencia: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Jornada</Label><Input value={form.jornada} onChange={e => setForm({ ...form, jornada: e.target.value })} placeholder="Fecha 1, Octavos..." className="bg-gray-800 border-gray-700 text-white" /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Estado</Label><Select value={form.estado} onValueChange={(v) => v && setForm({ ...form, estado: v })}><SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="programado">Programado</SelectItem><SelectItem value="en_juego">En Juego</SelectItem><SelectItem value="finalizado">Finalizado</SelectItem><SelectItem value="suspendido">Suspendido</SelectItem><SelectItem value="cancelado">Cancelado</SelectItem></SelectContent></Select></div>
            </div>
            {form.estado === 'finalizado' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label className="text-gray-400 text-sm">Goles Nuestros</Label><Input type="number" min="0" value={form.goles_nuestros} onChange={e => setForm({ ...form, goles_nuestros: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
                <div className="space-y-2"><Label className="text-gray-400 text-sm">Goles Rival</Label><Input type="number" min="0" value={form.goles_rival} onChange={e => setForm({ ...form, goles_rival: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
                <div className="space-y-2"><Label className="text-gray-400 text-sm">Notas</Label><Input value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones..." className="bg-gray-800 border-gray-700 text-white" /></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="bg-[#DC2626] hover:bg-[#B91C1C]">{editing ? 'Actualizar' : 'Crear Partido'}</Button>
              {editing && <Button variant="outline" onClick={() => { setEditing(null); setForm({ fecha: '', hora: '', rival: '', cancha: 'Cancha Principal', es_local: 'true', competencia: 'Liga Local', jornada: '', estado: 'programado', goles_nuestros: '', goles_rival: '', notas: '' }); }} className="border-gray-700 text-gray-300">Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-blue-400" /> Partidos ({partidos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-800">
            {partidos.map((p) => (
              <div key={p.id} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${p.es_local ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-amber-500 to-orange-600'}`}>
                      {p.es_local ? '🏠' : '✈️'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{p.rival}</p>
                        {p.goles_nuestros !== null && p.goles_rival !== null && (
                          <span className={`text-sm font-bold ${resultadoColors[p.resultado || ''] || 'text-gray-400'}`}>
                            {p.goles_nuestros} - {p.goles_rival}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(p.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                        {p.hora && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{p.hora.slice(0, 5)}</span>}
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{p.cancha}</span>
                        <span className="text-gray-600">{p.competencia} {p.jornada && `• ${p.jornada}`}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-16 sm:ml-0">
                    <Badge className={estadoColors[p.estado] || estadoColors.programado}>{p.estado}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(p)} className="text-gray-500 hover:text-blue-400"><Edit className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)} className="text-gray-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
