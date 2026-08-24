'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ExternalLink, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { MESES } from '@/lib/constants';

export default function AdminPagos() {
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pagada' | 'pendiente'>('all');
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await db.select('cuotas', '*, familias(perfiles!padre_perfil_id(nombre, apellido), perfiles!deportista_perfil_id(nombre, apellido))');
    setCuotas(data || []);
  }
  const handleApprove = async (id: string) => {
    await db.update('cuotas', { estado: 'pagada', fecha_pago: new Date().toISOString() }, { id });
    toast.success('Cuota aprobada');
    load();
  };

  const filtered = cuotas.filter(c => filter === 'all' || c.estado === filter);
  const pagadas = cuotas.filter(c => c.estado === 'pagada').length;
  const pendientes = cuotas.filter(c => c.estado === 'pendiente').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Control de Pagos</h1>
        <p className="text-gray-400 text-sm mt-1">Gestión de cuotas y comprobantes</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center"><DollarSign className="h-5 w-5 text-blue-400" /></div>
            <div><p className="text-xs text-gray-400">Total Cuotas</p><p className="text-lg font-bold text-white">{cuotas.length}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#DC2626]/10 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-[#DC2626]" /></div>
            <div><p className="text-xs text-gray-400">Pagadas</p><p className="text-lg font-bold text-[#DC2626]">{pagadas}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="h-5 w-5 text-amber-400" /></div>
            <div><p className="text-xs text-gray-400">Pendientes</p><p className="text-lg font-bold text-amber-400">{pendientes}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['all', 'pagada', 'pendiente'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-[#DC2626] text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {f === 'all' ? 'Todas' : f === 'pagada' ? `Pagadas (${pagadas})` : `Pendientes (${pendientes})`}
          </button>
        ))}
      </div>

      {/* List */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-0">
          <div className="divide-y divide-gray-800">
            {filtered.map((c) => {
              const padre = c.familias?.perfiles;
              return (
                <div key={c.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${c.estado === 'pagada' ? 'bg-[#DC2626]/10' : 'bg-amber-500/10'}`}>
                      {c.estado === 'pagada' ? <CheckCircle className="h-5 w-5 text-[#DC2626]" /> : <Clock className="h-5 w-5 text-amber-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{MESES[c.mes - 1]} {c.anio}</p>
                      <p className="text-xs text-gray-500">Padre: {padre?.nombre} {padre?.apellido}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-14 sm:ml-0">
                    <span className="text-sm font-bold text-white w-24 text-right">${Number(c.monto).toLocaleString('es-AR')}</span>
                    <Badge variant={c.estado === 'pagada' ? 'default' : 'secondary'} className={c.estado === 'pagada' ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}>
                      {c.estado}
                    </Badge>
                    {c.comprobante_url && (
                      <a href={c.comprobante_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white"><ExternalLink className="h-4 w-4" /></Button>
                      </a>
                    )}
                    {c.estado === 'pendiente' && (
                      <Button size="sm" onClick={() => handleApprove(c.id)} className="bg-[#DC2626] hover:bg-[#B91C1C] text-white">Aprobar</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
