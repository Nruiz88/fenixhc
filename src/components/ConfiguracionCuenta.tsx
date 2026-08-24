'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Save, Lock, User, Shield, Eye, EyeOff } from 'lucide-react';

interface ConfiguracionCuentaProps {
  rol: 'admin' | 'padre' | 'deportista';
  accentColor?: string;
}

export function ConfiguracionCuenta({ rol, accentColor = '#DC2626' }: ConfiguracionCuentaProps) {
  const [perfil, setPerfil] = useState<any>(null);
  const [formPerfil, setFormPerfil] = useState({ nombre: '', apellido: '', telefono: '', direccion: '' });
  const [formPass, setFormPass] = useState({ nueva: '', confirmar: '' });
  const [showPass, setShowPass] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
      if (data) {
        setPerfil(data);
        setFormPerfil({ nombre: data.nombre || '', apellido: data.apellido || '', telefono: data.telefono || '', direccion: data.direccion || '' });
      }
    })();
  }, []);

  const handleGuardarPerfil = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPerfil(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingPerfil(false); return; }
    const { error } = await supabase.from('perfiles').update(formPerfil).eq('id', user.id);
    if (error) {
      toast.error('Error', { description: error.message });
    } else {
      toast.success('Perfil actualizado');
      setPerfil({ ...perfil, ...formPerfil });
    }
    setLoadingPerfil(false);
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formPass.nueva !== formPass.confirmar) {
      toast.error('Las contraseñas no coinciden');
      return;
    }
    if (formPass.nueva.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoadingPass(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: formPass.nueva });
    if (error) {
      toast.error('Error', { description: error.message });
    } else {
      toast.success('Contraseña actualizada');
      setFormPass({ nueva: '', confirmar: '' });
    }
    setLoadingPass(false);
  };

  return (
    <div className="space-y-6">
      {/* Personal Info */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden">
        <div className="h-1.5" style={{ background: `linear-gradient(to right, ${accentColor}, transparent)` }} />
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <User className="h-5 w-5" style={{ color: accentColor }} /> Información Personal
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleGuardarPerfil} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Nombre</Label>
                <Input value={formPerfil.nombre} onChange={e => setFormPerfil({ ...formPerfil, nombre: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Apellido</Label>
                <Input value={formPerfil.apellido} onChange={e => setFormPerfil({ ...formPerfil, apellido: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Teléfono</Label>
                <Input value={formPerfil.telefono} onChange={e => setFormPerfil({ ...formPerfil, telefono: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Dirección</Label>
                <Input value={formPerfil.direccion} onChange={e => setFormPerfil({ ...formPerfil, direccion: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
            {perfil && (
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 pt-2">
                <span>DNI: <span className="text-gray-400">{perfil.dni}</span></span>
                {perfil.cuil && <span>CUIL: <span className="text-gray-400">{perfil.cuil}</span></span>}
                <span>Correo: <span className="text-gray-400">{perfil.correo}</span></span>
                <span>Rol: <span className="text-gray-400 capitalize">{perfil.rol}</span></span>
              </div>
            )}
            <Button type="submit" disabled={loadingPerfil} className="text-white font-semibold" style={{ backgroundColor: accentColor }}>
              <Save className="h-4 w-4 mr-2" />
              {loadingPerfil ? 'Guardando...' : 'Guardar Información'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card className="bg-gray-900 border-gray-800 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-gray-600 to-transparent" />
        <CardHeader className="border-b border-gray-800">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-gray-400" /> Cambiar Contraseña
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleCambiarPassword} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Nueva Contraseña</Label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={formPass.nueva}
                    onChange={e => setFormPass({ ...formPass, nueva: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
                    className="bg-gray-800 border-gray-700 text-white pr-10"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Confirmar Contraseña</Label>
                <Input
                  type="password"
                  value={formPass.confirmar}
                  onChange={e => setFormPass({ ...formPass, confirmar: e.target.value })}
                  placeholder="Repetí la contraseña"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loadingPass || !formPass.nueva || !formPass.confirmar}
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold"
            >
              <Lock className="h-4 w-4 mr-2" />
              {loadingPass ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>
            <p className="text-xs text-gray-600">Tu cuenta está protegida. Los cambios de contraseña se aplican inmediatamente.</p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
