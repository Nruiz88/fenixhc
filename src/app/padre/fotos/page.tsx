'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { uploadGaleria } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Trash2, Image } from 'lucide-react';

export default function PadreFotos() {
  const [fotos, setFotos] = useState<any[]>([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await udb.select('fotos_galeria', '*', undefined, { order: { column: 'created_at', ascending: false }, limit: 50 });
    setFotos(data || []);
  }
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await uploadGaleria('padre', file);
    if (url) { await udb.insert('fotos_galeria', { url, es_video: file.type.startsWith('video/'), descripcion: file.name }); toast.success('Archivo subido'); load(); }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Mis Fotos</h1><p className="text-gray-400 text-sm mt-1">{fotos.length} archivos</p></div>
        <label className="cursor-pointer"><Button className="bg-[#DC2626] hover:bg-[#B91C1C]"><Upload className="h-4 w-4 mr-2" />Subir</Button><input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} /></label>
      </div>
      {fotos.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800"><CardContent className="py-16 text-center"><Image className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No hay archivos subidos</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {fotos.map((f) => (
            <div key={f.id} className="relative group rounded-xl overflow-hidden bg-gray-800 aspect-square">
              {f.es_video ? <video src={f.url} className="w-full h-full object-cover" /> : <img src={f.url} alt="" className="w-full h-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <button onClick={async () => { await udb.update('fotos_galeria', {}, { id: f.id }); setFotos(fotos.filter(x => x.id !== f.id)); }} className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
