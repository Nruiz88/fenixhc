'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/adminQuery';
import { UserPlus, Users, UserCheck, Save, X, Check, AlertCircle, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsuariosPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    tipo: 'padre',
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    dni: '',
    cuil: '',
    telefono: '',
    direccion: '',
  });
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [search, setSearch] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    const { data } = await db.select('perfiles', 'id, correo, nombre, apellido, dni, rol, created_at');
    setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.nombre || !form.apellido) {
      toast.error('Completá email, contraseña, nombre y apellido');
      return;
    }

    setLoadingCreate(true);
    try {
      // Create auth user via API
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nombre: form.nombre,
          apellido: form.apellido,
          dni: form.dni,
          cuil: form.cuil,
          telefono: form.telefono,
          direccion: form.direccion,
          rol: form.tipo,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error('Error al crear usuario', { description: result.error });
      } else {
        toast.success('Usuario creado', { description: `${form.nombre} ${form.apellido} (${form.tipo})` });
        setForm({ tipo: 'padre', email: '', password: '', nombre: '', apellido: '', dni: '', cuil: '', telefono: '', direccion: '' });
        setShowForm(false);
        loadUsers();
      }
    } catch (err: any) {
      toast.error('Error de conexión', { description: err.message });
    }
    setLoadingCreate(false);
  };

  const padres = users.filter(u => u.rol === 'padre');
  const deportistas = users.filter(u => u.rol === 'deportista');
  const filtered = search
    ? users.filter(u => `${u.nombre} ${u.apellido} ${u.correo}`.toLowerCase().includes(search.toLowerCase()))
    : users;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Gestionar Usuarios</h1>
          <p className="text-sm text-gray-400 mt-1">Crear y administrar padres y jugadores</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
          <UserPlus className="h-4 w-4" /> Crear Usuario
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total', value: users.length, icon: Users, color: 'text-gray-400' },
          { label: 'Padres', value: padres.length, icon: Users, color: 'text-blue-400' },
          { label: 'Deportistas', value: deportistas.length, icon: UserCheck, color: 'text-emerald-400' },
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

      {/* Form */}
      {showForm && (
        <Card className="bg-gray-900 border-gray-800 border-[#DC2626]/30">
          <CardHeader className="border-b border-gray-800 flex flex-row items-center justify-between">
            <CardTitle className="text-white text-lg">Crear Nuevo Usuario</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleCreate} className="space-y-4">
              {/* Tipo */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Tipo de usuario *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setForm({ ...form, tipo: 'padre' })} className={`p-4 rounded-xl border text-left transition-all ${form.tipo === 'padre' ? 'border-[#DC2626] bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <p className="text-lg mb-1">👨‍👦</p>
                    <p className="text-sm font-semibold text-white">Padre / Benefactor</p>
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, tipo: 'deportista' })} className={`p-4 rounded-xl border text-left transition-all ${form.tipo === 'deportista' ? 'border-[#DC2626] bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <p className="text-lg mb-1">🏃</p>
                    <p className="text-sm font-semibold text-white">Deportista / Jugador</p>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Nombre *</Label>
                  <Input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Apellido *</Label>
                  <Input value={form.apellido} onChange={e => setForm({ ...form, apellido: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">DNI</Label>
                  <Input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">CUIL</Label>
                  <Input value={form.cuil} onChange={e => setForm({ ...form, cuil: e.target.value })} placeholder="XX-XXXXXXXX-X" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Teléfono</Label>
                  <Input value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Dirección</Label>
                  <Input value={form.direccion} onChange={e => setForm({ ...form, direccion: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Email *</Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Contraseña *</Label>
                  <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="bg-gray-800 border-gray-700 text-white" required minLength={6} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loadingCreate} className="bg-[#DC2626] hover:bg-[#B91C1C] gap-2 font-semibold">
                  <Save className="h-4 w-4" /> {loadingCreate ? 'Creando...' : 'Crear Usuario'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-gray-700 text-gray-400 hover:text-white">
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, apellido o email..."
          className="pl-10 bg-gray-900 border-gray-800 text-white"
        />
      </div>

      {/* Users List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-[#DC2626] border-t-transparent rounded-full mx-auto" />
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">{search ? 'Sin resultados' : 'No hay usuarios creados'}</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(u => (
            <Card key={u.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${u.rol === 'admin' ? 'bg-[#DC2626]/10' : u.rol === 'padre' ? 'bg-blue-500/10' : 'bg-emerald-500/10'}`}>
                  <span className={`font-bold text-sm ${u.rol === 'admin' ? 'text-[#DC2626]' : u.rol === 'padre' ? 'text-blue-400' : 'text-emerald-400'}`}>
                    {u.nombre?.[0]}{u.apellido?.[0]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-white">{u.nombre} {u.apellido}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      u.rol === 'admin' ? 'bg-[#DC2626]/20 text-[#DC2626]' :
                      u.rol === 'padre' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {u.rol}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">{u.correo}</p>
                  {u.dni && <p className="text-xs text-gray-500">DNI: {u.dni}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-gray-500">
                    {new Date(u.created_at).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
