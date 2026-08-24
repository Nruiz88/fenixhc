'use client';
import { useState, useEffect } from 'react';
import { udb } from '@/lib/userQuery';
import { uploadAvatar } from '@/lib/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { User, Save } from 'lucide-react';

export default function PadrePerfil() {
  const [perfil, setPerfil] = useState<any>(null);
  const [form, setForm] = useState({ nombre: '', apellido: '', telefono: '', direccion: '' });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    udb.select('perfiles', '*', undefined, { single: true }).then(({ data }) => {
      if (data) { setPerfil(data); setForm({ nombre: data.nombre, apellido: data.apellido, telefono: data.telefono || '', direccion: data.direccion || '' }); }
    });
  }, []);
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const { error } = await udb.update('perfiles', form, { id: perfil.id });
    if (error) toast.error('Error al guardar'); else toast.success('Perfil actualizado');
    setLoading(false);
  };
  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !perfil) return;
    const url = await uploadAvatar(perfil.id, file);
    if (url) { await udb.update('perfiles', { foto_url: url }, { id: perfil.id }); setPerfil({ ...perfil, foto_url: url }); toast.success('Foto actualizada'); }
  };
  if (!perfil) return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 border-2 border-[#DC2626]/30 border-t-emerald-500 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="text-2xl font-bold text-white">Mi Perfil</h1><p className="text-gray-400 text-sm mt-1">Gestioná tu información personal</p></div>
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col items-center mb-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={perfil.foto_url} />
              <AvatarFallback className="bg-gradient-to-br from-[#DC2626] to-[#7F1D1D] text-white text-2xl font-bold">{perfil.nombre?.[0]}{perfil.apellido?.[0]}</AvatarFallback>
            </Avatar>
            <label className="mt-3 text-sm text-[#DC2626] hover:text-[#DC2626] cursor-pointer transition-colors">Cambiar foto<input type="file" accept="image/*" className="hidden" onChange={handlePhoto} /></label>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Nombre</Label><Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
              <div className="space-y-2"><Label className="text-gray-400 text-sm">Apellido</Label><Input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
            </div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Teléfono</Label><Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
            <div className="space-y-2"><Label className="text-gray-400 text-sm">Dirección</Label><Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} className="bg-gray-800 border-gray-700 text-white" /></div>
            <div className="pt-2 text-xs text-gray-500 space-y-1">
              <p>DNI: <span className="text-gray-300">{perfil.dni}</span></p>
              <p>CUIL: <span className="text-gray-300">{perfil.cuil || '-'}</span></p>
              <p>Correo: <span className="text-gray-300">{perfil.correo}</span></p>
            </div>
            <Button type="submit" disabled={loading} className="bg-[#DC2626] hover:bg-[#B91C1C] w-full"><Save className="h-4 w-4 mr-2" />{loading ? 'Guardando...' : 'Guardar Cambios'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
