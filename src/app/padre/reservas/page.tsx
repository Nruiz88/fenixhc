'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, Clock, MapPin, Plus } from 'lucide-react';

export default function PadreReservas() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [canchas, setCanchas] = useState<any[]>([]);
  const [form, setForm] = useState({ cancha_id: '', fecha: '', hora_inicio: '', hora_fin: '' });
  useEffect(() => { load(); }, []);
  async function load() {
    const { data: c } = await udb.select('canchas', '*'); setCanchas((c || []).filter((ca: any) => ca.activa));
    const { data: r } = await udb.select('reservas', '*, canchas(nombre)', undefined, { order: { column: 'fecha', ascending: false } }); setReservas(r || []);
  }
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await udb.insert('reservas', { cancha_id: form.cancha_id, fecha: form.fecha, hora_inicio: form.hora_inicio, hora_fin: form.hora_fin });
    if (error) toast.error('Error al crear'); else { toast.success('Reserva creada'); setForm({ cancha_id: '', fecha: '', hora_inicio: '', hora_fin: '' }); load(); }
  };
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Reservas</h1><p className="text-gray-400 text-sm mt-1">Reservá turnos en las canchas</p></div>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3"><CardTitle className="text-white text-base flex items-center gap-2"><Plus className="h-4 w-4 text-[#DC2626]" /> Nueva Reserva</CardTitle></CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Cancha</Label><Select value={form.cancha_id} onValueChange={(v) => v && setForm({ ...form, cancha_id: v })}><SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{canchas.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Fecha</Label><Input type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Inicio</Label><Input type="time" value={form.hora_inicio} onChange={e => setForm({ ...form, hora_inicio: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Fin</Label><Input type="time" value={form.hora_fin} onChange={e => setForm({ ...form, hora_fin: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required /></div>
            <Button type="submit" className="self-end bg-[#DC2626] hover:bg-[#B91C1C]">Reservar</Button>
          </form>
        </CardContent>
      </Card>
      {reservas.length > 0 && (
        <div className="space-y-3">
          {reservas.map((r) => (
            <Card key={r.id} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#7F1D1D] flex items-center justify-center text-white shrink-0"><Calendar className="h-5 w-5" /></div>
                  <div>
                    <p className="text-sm font-medium text-white">{r.canchas?.nombre || 'Cancha'}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.fecha}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.hora_inicio} - {r.hora_fin}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-14 sm:ml-0">
                  <Badge variant={r.estado === 'confirmada' ? 'default' : 'secondary'} className={r.estado === 'confirmada' ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>{r.estado}</Badge>
                  {r.estado === 'confirmada' && <Button variant="ghost" size="sm" onClick={async () => { await udb.update('reservas', { estado: 'cancelada' }, { id: r.id }); load(); }} className="text-gray-500 hover:text-red-400">Cancelar</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
