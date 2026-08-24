'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { uploadAvatar, uploadDni } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Upload, FileText } from 'lucide-react';

export default function DeportistaPerfil() {
  const [perfil, setPerfil] = useState<any>(null);
  const [deportista, setDeportista] = useState<any>(null);
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', direccion: '' });
  useEffect(() => {
    (async () => {
      const { data: p } = await udb.select('perfiles', '*', undefined, { single: true });
      if (p) { setPerfil(p); setForm({ nombre: p.nombre, apellido: p.apellido, telefono: p.telefono || '', direccion: p.direccion || '' }); }
      const { data: d } = await udb.select('deportistas', '*', undefined, { single: true });
      setDeportista(d);
    })();
  }, []);
  const handleSave = async (e: React.FormEvent) => { e.preventDefault(); const { error } = await udb.update('perfiles', form, { id: perfil.id }); if (error) toast.error('Error'); else toast.success('Actualizado'); };
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file || !perfil) return; const url = await uploadAvatar(perfil.id, file); if (url) { await udb.update('perfiles', { foto_url: url }, { id: perfil.id }); setPerfil({ ...perfil, foto_url: url }); toast.success('Foto actualizada'); } };
  const handleDni = async (e: React.ChangeEvent<HTMLInputElement>, side: 'frente' | 'fondo') => { const file = e.target.files?.[0]; if (!file || !perfil) return; const url = await uploadDni(perfil.id, file, side); if (url) { await udb.update('deportistas', { [side === 'frente' ? 'dni_frente_url' : 'dni_fondo_url']: url }, { perfil_id: perfil.id }); toast.success('DNI ' + side + ' subido'); } };

  if (!perfil) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Mi Perfil</h1><p className="text-gray-400 text-sm mt-1">Actualizá tu información</p></div>
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold">{perfil.nombre?.[0]}{perfil.apellido?.[0]}</div>
            <label className="mt-3 text-sm text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">Cambiar foto<input type="file" accept="image/*" className="hidden" onChange={handlePhoto} /></label>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Nombre</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Apellido</Label><Input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
            </div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Teléfono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Dirección</Label><Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
            <p className="text-xs text-gray-500">DNI: {perfil.dni}</p>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full"><Save className="h-4 w-4 mr-2" />Guardar</Button>
          </form>
        </CardContent>
      </Card>

      {/* DNI Upload */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2"><FileText className="h-4 w-4 text-blue-400" /> Fotos del DNI</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            {(['frente', 'fondo'] as const).map((side) => {
              const url = side === 'frente' ? deportista?.dni_frente_url : deportista?.dni_fondo_url;
              return (
                <div key={side}>
                  <p className="text-sm font-medium text-gray-300 mb-2 capitalize">{side}</p>
                  {url ? (
                    <div className="relative group rounded-xl overflow-hidden"><img src={url} className="w-full h-32 object-cover rounded-xl border border-gray-700" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><span className="text-white text-xs">DNI {side} ✓</span></div></div>
                  ) : (
                    <label className="block w-full h-32 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 transition-colors">
                      <Upload className="h-6 w-6 text-gray-600 mb-1" />
                      <span className="text-xs text-gray-500">Subir {side}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleDni(e, side)} />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
