'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/adminQuery';
import { Megaphone, Plus, Pencil, Trash2, Eye, EyeOff, Star, Clock, Save, X } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'general', label: 'General', color: 'bg-[#DC2626]', textColor: 'text-[#DC2626]' },
  { value: 'deportivo', label: 'Deportivo', color: 'bg-blue-600', textColor: 'text-blue-400' },
  { value: 'pago', label: 'Pago', color: 'bg-amber-600', textColor: 'text-amber-400' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-600', textColor: 'text-red-400' },
  { value: 'evento', label: 'Evento', color: 'bg-violet-600', textColor: 'text-violet-400' },
];

const ESTADOS = [
  { value: 'borrador', label: 'Borrador', color: 'bg-gray-600' },
  { value: 'publicado', label: 'Publicado', color: 'bg-emerald-600' },
  { value: 'archivado', label: 'Archivado', color: 'bg-yellow-600' },
];

interface Comunicado {
  id: string;
  titulo: string;
  resumen: string;
  contenido: string;
  tipo: string;
  estado: string;
  imagen_url: string | null;
  destacado: boolean;
  fecha_publicacion: string;
  created_at: string;
}

export default function AdminComunicadosPage() {
  const [comunicados, setComunicados] = useState<Comunicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Comunicado | null>(null);
  const [form, setForm] = useState({
    titulo: '',
    resumen: '',
    contenido: '',
    tipo: 'general',
    estado: 'publicado',
    imagen_url: '',
    destacado: false,
  });

  const loadComunicados = async () => {
    setLoading(true);
    const { data } = await db.select<Comunicado[]>('comunicados', '*', undefined, { order: { column: 'created_at', ascending: false } });
    setComunicados(data || []);
    setLoading(false);
  };

  useEffect(() => { loadComunicados(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      titulo: form.titulo,
      resumen: form.resumen || null,
      contenido: form.contenido,
      tipo: form.tipo,
      estado: form.estado,
      imagen_url: form.imagen_url || null,
      destacado: form.destacado,
      fecha_publicacion: new Date().toISOString(),
    };

    if (editing) {
      const { error } = await db.update('comunicados', payload, { id: editing.id });
      if (!error) {
        toast.success('Comunicado actualizado');
        setShowForm(false);
        setEditing(null);
        resetForm();
        loadComunicados();
      } else {
        toast.error('Error al actualizar');
      }
    } else {
      const { error } = await db.insert('comunicados', payload);
      if (!error) {
        toast.success('Comunicado creado');
        setShowForm(false);
        resetForm();
        loadComunicados();
      } else {
        toast.error('Error al crear');
      }
    }
  };

  const handleEdit = (c: Comunicado) => {
    setEditing(c);
    setForm({
      titulo: c.titulo,
      resumen: c.resumen || '',
      contenido: c.contenido,
      tipo: c.tipo,
      estado: c.estado,
      imagen_url: c.imagen_url || '',
      destacado: c.destacado,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este comunicado?')) return;
    const { error } = await db.delete('comunicados', { id });
    if (!error) {
      toast.success('Comunicado eliminado');
      loadComunicados();
    } else {
      toast.error('Error al eliminar');
    }
  };

  const toggleDestacado = async (c: Comunicado) => {
    await db.update('comunicados', { destacado: !c.destacado }, { id: c.id });
    loadComunicados();
  };

  const toggleEstado = async (c: Comunicado) => {
    const newEstado = c.estado === 'publicado' ? 'borrador' : 'publicado';
    await db.update('comunicados', { estado: newEstado }, { id: c.id });
    loadComunicados();
  };

  const resetForm = () => {
    setForm({ titulo: '', resumen: '', contenido: '', tipo: 'general', estado: 'publicado', imagen_url: '', destacado: false });
    setEditing(null);
  };

  const tipoInfo = (tipo: string) => TIPOS.find(t => t.value === tipo) || TIPOS[0];
  const estadoInfo = (estado: string) => ESTADOS.find(e => e.value === estado) || ESTADOS[0];

  const stats = {
    total: comunicados.length,
    publicados: comunicados.filter(c => c.estado === 'publicado').length,
    borradores: comunicados.filter(c => c.estado === 'borrador').length,
    destacados: comunicados.filter(c => c.destacado).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Comunicados</h1>
          <p className="text-sm text-gray-400 mt-1">Gestioná las noticias y comunicados del club</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
          <Plus className="h-4 w-4" /> Nuevo Comunicado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Megaphone, color: 'text-gray-400' },
          { label: 'Publicados', value: stats.publicados, icon: Eye, color: 'text-emerald-400' },
          { label: 'Borradores', value: stats.borradores, icon: EyeOff, color: 'text-yellow-400' },
          { label: 'Destacados', value: stats.destacados, icon: Star, color: 'text-[#DC2626]' },
        ].map((s, i) => (
          <Card key={i} className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <Card className="bg-gray-900 border-gray-800 border-[#DC2626]/30">
          <CardHeader className="border-b border-gray-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-lg">
              {editing ? 'Editar Comunicado' : 'Nuevo Comunicado'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-400 text-sm">Título *</Label>
                  <Input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Título del comunicado" className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-400 text-sm">Resumen</Label>
                  <Input value={form.resumen} onChange={e => setForm({ ...form, resumen: e.target.value })} placeholder="Breve resumen (opcional)" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-400 text-sm">Contenido *</Label>
                  <Textarea value={form.contenido} onChange={e => setForm({ ...form, contenido: e.target.value })} rows={6} placeholder="Escribí el contenido completo del comunicado..." className="bg-gray-800 border-gray-700 text-white resize-none" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Tipo</Label>
                  <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Estado</Label>
                  <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-400 text-sm">URL de imagen (opcional)</Label>
                  <Input value={form.imagen_url} onChange={e => setForm({ ...form, imagen_url: e.target.value })} placeholder="https://..." className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="destacado" checked={form.destacado} onChange={e => setForm({ ...form, destacado: e.target.checked })} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-[#DC2626] focus:ring-[#DC2626]" />
                  <Label htmlFor="destacado" className="text-gray-400 text-sm cursor-pointer">Destacado en homepage</Label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
                  <Save className="h-4 w-4" /> {editing ? 'Actualizar' : 'Publicar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="border-gray-700 text-gray-400 hover:text-white">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Comunicados List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-[#DC2626] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-4">Cargando comunicados...</p>
            </CardContent>
          </Card>
        ) : comunicados.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Megaphone className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No hay comunicados creados</p>
              <p className="text-xs text-gray-600 mt-1">Creá el primer comunicado con el botón de arriba</p>
            </CardContent>
          </Card>
        ) : (
          comunicados.map(c => {
            const tipo = tipoInfo(c.tipo);
            const estado = estadoInfo(c.estado);
            return (
              <Card key={c.id} className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-all ${c.destacado ? 'border-l-2 border-l-[#DC2626]' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${tipo.color} text-white`}>
                          {tipo.label}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${estado.color} text-white`}>
                          {estado.label}
                        </span>
                        {c.destacado && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-[#DC2626]/20 text-[#DC2626]">
                            ★ Destacado
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-lg mb-1">{c.titulo}</h3>
                      {c.resumen && <p className="text-sm text-gray-400 mb-2">{c.resumen}</p>}
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(c.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => toggleDestacado(c)} className={`h-8 w-8 p-0 ${c.destacado ? 'text-[#DC2626]' : 'text-gray-500 hover:text-[#DC2626]'}`} title="Destacado">
                        <Star className="h-4 w-4" fill={c.destacado ? 'currentColor' : 'none'} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleEstado(c)} className="h-8 w-8 p-0 text-gray-500 hover:text-emerald-400" title={c.estado === 'publicado' ? 'Ocultar' : 'Publicar'}>
                        {c.estado === 'publicado' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(c)} className="h-8 w-8 p-0 text-gray-500 hover:text-blue-400" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="h-8 w-8 p-0 text-gray-500 hover:text-red-400" title="Eliminar">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {c.contenido && (
                    <div className="mt-3 p-3 bg-gray-800/50 rounded-lg">
                      <p className="text-sm text-gray-400 line-clamp-2">{c.contenido}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
