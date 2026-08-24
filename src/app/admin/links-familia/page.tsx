'use client';
import { useState, useEffect } from 'react';
import { db } from '@/lib/adminQuery';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Link2, Trash2, Plus, ArrowRight, Users, UserCheck, DollarSign, AlertCircle } from 'lucide-react';

export default function AdminLinksFamilia() {
  const [padres, setPadres] = useState<any[]>([]);
  const [deportistas, setDeportistas] = useState<any[]>([]);
  const [familias, setFamilias] = useState<any[]>([]);
  const [form, setForm] = useState({ padre_id: '', deportista_id: '', tipo_vinculo: 'padre' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: p } = await db.select('perfiles', 'id, nombre, apellido, dni, correo', { rol: 'padre' });
    setPadres(p || []);
    const { data: d } = await db.select('deportistas', 'id, perfil_id, perfiles(nombre, apellido, dni)');
    setDeportistas(d || []);
    const { data: f } = await db.select('familias', '*, perfiles!padre_perfil_id(nombre, apellido, correo), perfiles!deportista_perfil_id(nombre, apellido, correo)');
    setFamilias(f || []);
  }

  // Padres que ya tienen vínculo
  const padresVinculados = new Set(familias.map((f: any) => f.padre_perfil_id));
  // Deportistas que ya tienen vínculo
  const deportistasVinculados = new Set(familias.map((f: any) => f.deportista_perfil_id));

  const padresDisponibles = padres.filter(p => !padresVinculados.has(p.id));
  const deportistasDisponibles = deportistas.filter(d => !deportistasVinculados.has(d.perfil_id));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.padre_id || !form.deportista_id) { toast.error('Seleccioná padre y jugador'); return; }

    setLoading(true);
    const { error } = await db.insert('familias', {
      padre_perfil_id: form.padre_id,
      deportista_perfil_id: form.deportista_id,
      tipo_vinculo: form.tipo_vinculo,
    });

    if (error) {
      toast.error('Error al crear vinculación');
    } else {
      // Generar cuotas unificadas
      const padre = padres.find(p => p.id === form.padre_id);
      const deportista = deportistas.find(d => d.perfil_id === form.deportista_id);
      toast.success(`Vinculación creada: ${padre?.nombre} → ${deportista?.perfiles?.nombre}`, {
        description: 'Cuota unificada de $75.000 generada automáticamente'
      });
      setForm({ padre_id: '', deportista_id: '', tipo_vinculo: 'padre' });
      load();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta vinculación? Se cancelarán las cuotas pendientes.')) return;
    await db.delete('familias', { id });
    toast.success('Vinculación eliminada');
    load();
  };

  const stats = {
    total: familias.length,
    cuotaTotal: familias.length * 75000,
    padresDisponibles: padresDisponibles.length,
    deportistasDisponibles: deportistasDisponibles.length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Vincular Padre - Hijo</h1>
        <p className="text-gray-400 text-sm mt-1">Asociá padres con sus hijos deportistas. Se genera automáticamente la cuota unificada.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Vínculos', value: stats.total, icon: Link2, color: 'text-[#DC2626]' },
          { label: 'Cuota Mensual', value: `$${(stats.cuotaTotal / 1000).toFixed(0)}K`, icon: DollarSign, color: 'text-emerald-400' },
          { label: 'Padres sin hijo', value: stats.padresDisponibles, icon: Users, color: 'text-blue-400' },
          { label: 'Jugadores libres', value: stats.deportistasDisponibles, icon: UserCheck, color: 'text-violet-400' },
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

      {/* Create Form */}
      <Card className="bg-gray-900 border-gray-800 border-[#DC2626]/20">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#DC2626]" /> Nueva Vinculación
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {padresDisponibles.length === 0 && deportistasDisponibles.length === 0 ? (
            <div className="text-center py-6">
              <AlertCircle className="h-10 w-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Todos los padres y jugadores ya están vinculados</p>
              <p className="text-xs text-gray-600 mt-1">Creá nuevos padres o jugadores para poder vincularlos</p>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Padre/Madre *</Label>
                  <select value={form.padre_id} onChange={e => setForm({ ...form, padre_id: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    <option value="">Seleccionar padre</option>
                    {padresDisponibles.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Jugador *</Label>
                  <select value={form.deportista_id} onChange={e => setForm({ ...form, deportista_id: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    <option value="">Seleccionar jugador</option>
                    {deportistasDisponibles.map(d => <option key={d.id} value={d.perfil_id}>{d.perfiles?.nombre} {d.perfiles?.apellido}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Vínculo</Label>
                  <select value={form.tipo_vinculo} onChange={e => setForm({ ...form, tipo_vinculo: e.target.value })} className="w-full h-10 px-3 rounded-md bg-gray-800 border border-gray-700 text-white text-sm">
                    <option value="padre">Padre</option>
                    <option value="madre">Madre</option>
                    <option value="tutor">Tutor</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500">Se generará una cuota unificada de <span className="text-[#DC2626] font-semibold">$75.000/mes</span> (benefactor + cadete)</p>
                <Button type="submit" disabled={loading} className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
                  <Link2 className="h-4 w-4" />
                  {loading ? 'Creando...' : 'Vincular'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Family Links */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="border-b border-gray-800 pb-3">
          <CardTitle className="text-white text-base">Vinculaciones Activas ({familias.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {familias.length > 0 ? (
            <div className="divide-y divide-gray-800">
              {familias.map((f: any) => (
                <div key={f.id} className="px-6 py-5 flex items-center justify-between hover:bg-gray-800/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    {/* Padre avatar */}
                    <div className="h-11 w-11 rounded-xl bg-[#DC2626]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#DC2626] font-bold text-sm">{f.perfiles?.nombre?.[0]}{f.perfiles?.apellido?.[0]}</span>
                    </div>

                    {/* Padre info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{f.perfiles?.nombre} {f.perfiles?.apellido}</p>
                      <p className="text-xs text-gray-500">{f.perfiles?.correo}</p>
                    </div>

                    {/* Arrow + vínculo */}
                    <div className="flex flex-col items-center mx-4">
                      <ArrowRight className="h-5 w-5 text-[#DC2626]" />
                      <span className="text-[10px] text-gray-500 mt-0.5 capitalize">{f.tipo_vinculo}</span>
                    </div>

                    {/* Deportista avatar */}
                    <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <span className="text-blue-400 font-bold text-sm">{f.perfiles?.nombre?.[0]}{f.perfiles?.apellido?.[0]}</span>
                    </div>

                    {/* Deportista info */}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{f.perfiles?.nombre} {f.perfiles?.apellido}</p>
                      <p className="text-xs text-gray-500">{f.perfiles?.correo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="px-3 py-1 rounded-lg bg-[#DC2626]/10 text-[#DC2626] text-xs font-semibold">$75.000/mes</span>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(f.id)} className="h-8 w-8 p-0 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Desvincular">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center">
              <Link2 className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No hay vinculaciones creadas</p>
              <p className="text-xs text-gray-600 mt-1">Usá el formulario de arriba para vincular un padre con su hijo</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
