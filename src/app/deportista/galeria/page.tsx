'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { uploadGaleria } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Upload, Image, Video } from 'lucide-react';

export default function DeportistaGaleria() {
  const [fotos, setFotos] = useState<any[]>([]);
  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await udb.select('fotos_galeria', '*, perfiles(nombre, apellido)', undefined, { order: { column: 'created_at', ascending: false }, limit: 50 });
    setFotos(data || []);
  }
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const url = await uploadGaleria('deportista', file);
    if (url) { await udb.insert('fotos_galeria', { url, es_video: file.type.startsWith('video/'), descripcion: file.name }); toast.success('Subido'); load(); }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Galería</h1><p className="text-gray-400 text-sm mt-1">{fotos.length} archivos compartidos</p></div>
        <label className="cursor-pointer"><Button className="bg-blue-600 hover:bg-blue-700"><Upload className="h-4 w-4 mr-2" />Subir</Button><input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} /></label>
      </div>
      {fotos.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800"><CardContent className="py-16 text-center"><Image className="h-12 w-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No hay archivos</p><p className="text-xs text-gray-600 mt-1">Subí fotos o videos del club</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {fotos.map((f) => (
            <div key={f.id} className="relative group rounded-xl overflow-hidden bg-gray-800 aspect-square">
              {f.es_video ? (
                <div className="relative w-full h-full">
                  <video src={f.url} className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1"><Video className="h-3 w-3 text-white" /></div>
                </div>
              ) : (
                <img src={f.url} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              {f.descripcion && <p className="absolute bottom-2 left-2 right-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">{f.descripcion}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
