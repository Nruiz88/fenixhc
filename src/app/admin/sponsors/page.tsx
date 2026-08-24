'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/adminQuery';
import { Star, Plus, Pencil, Trash2, Eye, EyeOff, Save, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

const TIERS = [
  { value: 'gold', label: 'Gold', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { value: 'silver', label: 'Silver', color: 'text-gray-300', bg: 'bg-gray-500/10', border: 'border-gray-500/20' },
  { value: 'bronze', label: 'Bronze', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
];

interface Sponsor {
  id: string;
  nombre: string;
  logo_url: string | null;
  sitio_web: string | null;
  tier: string;
  descripcion: string | null;
  activo: boolean;
  orden: number;
}

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    logo_url: '',
    sitio_web: '',
    tier: 'bronze',
    descripcion: '',
    activo: true,
    orden: 0,
  });

  const loadSponsors = async () => {
    setLoading(true);
    const { data } = await db.select<Sponsor[]>('sponsors', '*', undefined, { order: { column: 'orden', ascending: true } });
    setSponsors(data || []);
    setLoading(false);
  };

  useEffect(() => { loadSponsors(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const maxOrden = Math.max(0, ...sponsors.map(s => s.orden));
    const payload = {
      ...form,
      logo_url: form.logo_url || null,
      sitio_web: form.sitio_web || null,
      descripcion: form.descripcion || null,
      orden: editing ? form.orden : maxOrden + 1,
    };

    if (editing) {
      const { error } = await db.update('sponsors', payload, { id: editing.id });
      if (!error) {
        toast.success('Sponsor actualizado');
        setShowForm(false);
        setEditing(null);
        resetForm();
        loadSponsors();
      } else {
        toast.error('Error al actualizar');
      }
    } else {
      const { error } = await db.insert('sponsors', payload);
      if (!error) {
        toast.success('Sponsor creado');
        setShowForm(false);
        resetForm();
        loadSponsors();
      } else {
        toast.error('Error al crear');
      }
    }
  };

  const handleEdit = (s: Sponsor) => {
    setEditing(s);
    setForm({
      nombre: s.nombre,
      logo_url: s.logo_url || '',
      sitio_web: s.sitio_web || '',
      tier: s.tier,
      descripcion: s.descripcion || '',
      activo: s.activo,
      orden: s.orden,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este sponsor?')) return;
    const { error } = await db.delete('sponsors', { id });
    if (!error) {
      toast.success('Sponsor eliminado');
      loadSponsors();
    } else {
      toast.error('Error al eliminar');
    }
  };

  const toggleActivo = async (s: Sponsor) => {
    await db.update('sponsors', { activo: !s.activo }, { id: s.id });
    loadSponsors();
  };

  const resetForm = () => {
    setForm({ nombre: '', logo_url: '', sitio_web: '', tier: 'bronze', descripcion: '', activo: true, orden: 0 });
    setEditing(null);
  };

  const getTierInfo = (tier: string) => TIERS.find(t => t.value === tier) || TIERS[2];

  const stats = {
    total: sponsors.length,
    activos: sponsors.filter(s => s.activo).length,
    gold: sponsors.filter(s => s.tier === 'gold').length,
    silver: sponsors.filter(s => s.tier === 'silver').length,
    bronze: sponsors.filter(s => s.tier === 'bronze').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sponsors</h1>
          <p className="text-sm text-gray-400 mt-1">Gestioná los sponsors que se muestran en la homepage</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
          <Plus className="h-4 w-4" /> Nuevo Sponsor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-400' },
          { label: 'Activos', value: stats.activos, color: 'text-emerald-400' },
          { label: 'Gold', value: stats.gold, color: 'text-amber-400' },
          { label: 'Silver', value: stats.silver, color: 'text-gray-300' },
          { label: 'Bronze', value: stats.bronze, color: 'text-orange-400' },
        ].map((s, i) => (
          <Card key={i} className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 flex items-center gap-3">
              <Star className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-gray-900 border-gray-800 border-[#DC2626]/30">
          <CardHeader className="border-b border-gray-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-lg">
              {editing ? 'Editar Sponsor' : 'Nuevo Sponsor'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Nombre *</Label>
                  <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre del sponsor" className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Tier</Label>
                  <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">URL del Logo</Label>
                  <Input value={form.logo_url} onChange={e => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Sitio Web</Label>
                  <Input value={form.sitio_web} onChange={e => setForm({ ...form, sitio_web: e.target.value })} placeholder="https://..." className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-gray-400 text-sm">Descripción (opcional)</Label>
                  <Input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Breve descripción del sponsor" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-[#DC2626] focus:ring-[#DC2626]" />
                  <Label htmlFor="activo" className="text-gray-400 text-sm cursor-pointer">Activo (visible en homepage)</Label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
                  <Save className="h-4 w-4" /> {editing ? 'Actualizar' : 'Crear'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="border-gray-700 text-gray-400 hover:text-white">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sponsors List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-[#DC2626] border-t-transparent rounded-full mx-auto" />
              <p className="text-gray-500 mt-4">Cargando sponsors...</p>
            </CardContent>
          </Card>
        ) : sponsors.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Star className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No hay sponsors creados</p>
            </CardContent>
          </Card>
        ) : (
          sponsors.map(s => {
            const tier = getTierInfo(s.tier);
            return (
              <Card key={s.id} className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-all ${!s.activo ? 'opacity-50' : ''}`}>
                <CardContent className="p-5 flex items-center gap-4">
                  {/* Logo/Icon */}
                  <div className={`h-14 w-14 rounded-xl ${tier.bg} flex items-center justify-center shrink-0 ${tier.border} border`}>
                    {s.logo_url ? (
                      <img src={s.logo_url} alt={s.nombre} className="h-10 w-10 object-contain" />
                    ) : (
                      <Star className={`h-6 w-6 ${tier.color}`} />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{s.nombre}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${tier.bg} ${tier.color}`}>
                        {tier.label}
                      </span>
                      {!s.activo && <span className="px-2 py-0.5 rounded-full text-[10px] bg-yellow-900/30 text-yellow-500 uppercase">Inactivo</span>}
                    </div>
                    {s.descripcion && <p className="text-sm text-gray-400 mt-1">{s.descripcion}</p>}
                    {s.sitio_web && (
                      <a href={s.sitio_web} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                        <ExternalLink className="h-3 w-3" /> {s.sitio_web}
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleActivo(s)} className={`h-8 w-8 p-0 ${s.activo ? 'text-emerald-400 hover:text-yellow-400' : 'text-yellow-400 hover:text-emerald-400'}`}>
                      {s.activo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(s)} className="h-8 w-8 p-0 text-gray-500 hover:text-blue-400">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="h-8 w-8 p-0 text-gray-500 hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
