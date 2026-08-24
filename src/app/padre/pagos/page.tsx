'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { uploadComprobante } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, ExternalLink, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { MESES } from '@/lib/constants';

export default function PadrePagos() {
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await udb.select('cuotas', '*, familias(perfiles!deportista_perfil_id(nombre, apellido))');
    setCuotas(data || []);
  }
  const handleUpload = async (cuotaId: string, file: File) => {
    setUploadingId(cuotaId);
    const url = await uploadComprobante(cuotaId, file);
    if (url) { await udb.update('cuotas', { comprobante_url: url, metodo_pago: 'transferencia' }, { id: cuotaId }); toast.success('Comprobante subido'); load(); }
    setUploadingId(null);
  };

  const pagadas = cuotas.filter(c => c.estado === 'pagada');
  const pendientes = cuotas.filter(c => c.estado === 'pendiente');
  const totalPendiente = pendientes.reduce((s: number, c: any) => s + Number(c.monto), 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Mis Pagos</h1><p className="text-gray-400 text-sm mt-1">Gestioná tus cuotas y comprobantes</p></div>

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
            <div><p className="text-xs text-gray-400">Pagadas</p><p className="text-lg font-bold text-[#DC2626]">{pagadas.length}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center"><Clock className="h-5 w-5 text-amber-400" /></div>
            <div><p className="text-xs text-gray-400">Pendiente</p><p className="text-lg font-bold text-amber-400">${totalPendiente.toLocaleString('es-AR')}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Quotas */}
      {cuotas.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800"><CardContent className="py-12 text-center"><DollarSign className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No hay cuotas registradas</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {cuotas.sort((a: any, b: any) => b.anio - a.anio || b.mes - a.mes).map((c) => {
            const hijo = c.familias?.perfiles;
            return (
              <Card key={c.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${c.estado === 'pagada' ? 'bg-[#DC2626]/10' : 'bg-amber-500/10'}`}>
                        {c.estado === 'pagada' ? <CheckCircle className="h-5 w-5 text-[#DC2626]" /> : <Clock className="h-5 w-5 text-amber-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-white">{MESES[c.mes - 1]} {c.anio}</p>
                        {hijo && <p className="text-xs text-gray-400">Hijo: {hijo.nombre} {hijo.apellido}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-16 sm:ml-0">
                      <span className="text-lg font-bold text-white">${Number(c.monto).toLocaleString('es-AR')}</span>
                      <Badge variant={c.estado === 'pagada' ? 'default' : 'secondary'} className={c.estado === 'pagada' ? 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}>
                        {c.estado}
                      </Badge>
                      {c.comprobante_url && (
                        <a href={c.comprobante_url} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white"><ExternalLink className="h-4 w-4 mr-1" />Ver</Button>
                        </a>
                      )}
                      {c.estado === 'pendiente' && !c.comprobante_url && (
                        <label className="cursor-pointer">
                          <Button variant="outline" size="sm" disabled={uploadingId === c.id} className="border-gray-700 text-gray-300 hover:text-white">
                            <Upload className="h-4 w-4 mr-1" />{uploadingId === c.id ? 'Subiendo...' : 'Subir comprobante'}
                          </Button>
                          <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(c.id, file); }} />
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
