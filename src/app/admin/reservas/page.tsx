'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Calendar, MapPin, Clock, XCircle } from 'lucide-react';

export default function AdminReservas() {
  const [reservas, setReservas] = useState<any[]>([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await db.select('reservas', '*, canchas(nombre), perfiles(nombre, apellido)', undefined, { order: { column: 'fecha', ascending: false } });
    setReservas(data || []);
  }
  const handleCancel = async (id: string) => { await db.update('reservas', { estado: 'cancelada' }, { id }); toast.success('Reserva cancelada'); load(); };

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Gestión de Reservas</h1><p className="text-gray-400 text-sm mt-1">{reservas.length} reservas registradas</p></div>

      {reservas.length > 0 ? (
        <div className="space-y-3">
          {reservas.map((r) => (
            <Card key={r.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#7F1D1D] flex items-center justify-center text-white shrink-0">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{r.canchas?.nombre || 'Cancha'}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{r.fecha}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.hora_inicio} - {r.hora_fin}</span>
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.perfiles?.nombre} {r.perfiles?.apellido}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-16 sm:ml-0">
                    <Badge variant={r.estado === 'confirmada' ? 'default' : 'secondary'} className={r.estado === 'confirmada' ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : r.estado === 'cancelada' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}>
                      {r.estado}
                    </Badge>
                    {r.estado === 'confirmada' && (
                      <Button variant="ghost" size="sm" onClick={() => handleCancel(r.id)} className="text-gray-500 hover:text-red-400"><XCircle className="h-4 w-4 mr-1" />Cancelar</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">No hay reservas registradas</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
