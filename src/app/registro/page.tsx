'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { register } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, User, ChevronDown } from 'lucide-react';

export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    dni: '',
    cuil: '',
    telefono: '',
    direccion: '',
    rol: 'padre',
    // Para padres: datos del hijo
    hijo_nombre: '',
    hijo_apellido: '',
    hijo_dni: '',
    hijo_email: '',
    hijo_password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload: Record<string, any> = {
      rol: form.rol,
      nombre: form.nombre,
      apellido: form.apellido,
      dni: form.dni,
      cuil: form.cuil,
      email: form.email,
      password: form.password,
      telefono: form.telefono,
      direccion: form.direccion,
    };

    // Si es padre y quiso crear hijo, lo enviamos junto con el registro
    if (form.rol === 'padre' && form.hijo_nombre && form.hijo_apellido && form.hijo_dni) {
      payload.hijo_nombre = form.hijo_nombre;
      payload.hijo_apellido = form.hijo_apellido;
      payload.hijo_dni = form.hijo_dni;
      payload.hijo_email = form.hijo_email || `${form.hijo_dni}@fenix.local`;
      payload.hijo_password = form.hijo_password || 'fenix2026';
    }

    const result = await register(payload);

    if (result.error) {
      toast.error('Error', { description: result.error });
      setLoading(false);
      return;
    }

    if (payload.hijo_nombre) {
      toast.success('Cuenta creada', {
        description: `Se creó la cuenta de ${form.hijo_nombre} y se vinculó automáticamente. Cuota unificada: $75.000/mes`,
      });
    } else {
      toast.success('Cuenta creada', { description: 'Ya podés iniciar sesión' });
    }

    router.push('/login');
    setLoading(false);
  };

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <img src="/logo.png" alt="Fenix" className="h-10 w-10 object-contain" />
            <span className="font-extrabold text-2xl text-white">FENIX</span>
          </Link>
          <h2 className="text-2xl font-bold text-white">Crear Cuenta</h2>
          <p className="text-gray-400 mt-1">Registrate en el club</p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Tipo de cuenta */}
              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Tipo de cuenta</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => update('rol', 'padre')} className={`p-4 rounded-xl border text-left transition-all ${form.rol === 'padre' ? 'border-[#DC2626] bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <p className="text-lg mb-1">👨‍👦</p>
                    <p className="text-sm font-semibold text-white">Padre / Benefactor</p>
                    <p className="text-xs text-gray-500 mt-1">Padre o madre de un deportista</p>
                  </button>
                  <button type="button" onClick={() => update('rol', 'deportista')} className={`p-4 rounded-xl border text-left transition-all ${form.rol === 'deportista' ? 'border-[#DC2626] bg-[#DC2626]/10' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'}`}>
                    <p className="text-lg mb-1">🏃</p>
                    <p className="text-sm font-semibold text-white">Deportista / Jugador</p>
                    <p className="text-xs text-gray-500 mt-1">Jugador activo del club</p>
                  </button>
                </div>
              </div>

              {/* Datos personales */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Nombre *</Label>
                  <Input value={form.nombre} onChange={e => update('nombre', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Apellido *</Label>
                  <Input value={form.apellido} onChange={e => update('apellido', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">DNI *</Label>
                  <Input value={form.dni} onChange={e => update('dni', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">CUIL</Label>
                  <Input value={form.cuil} onChange={e => update('cuil', e.target.value)} placeholder="XX-XXXXXXXX-X" className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Teléfono</Label>
                  <Input value={form.telefono} onChange={e => update('telefono', e.target.value)} placeholder="+54 11 5555 0000" className="bg-gray-800 border-gray-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400 text-sm">Dirección</Label>
                  <Input value={form.direccion} onChange={e => update('direccion', e.target.value)} className="bg-gray-800 border-gray-700 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Correo electrónico *</Label>
                <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required />
              </div>

              <div className="space-y-2">
                <Label className="text-gray-400 text-sm">Contraseña *</Label>
                <Input type="password" value={form.password} onChange={e => update('password', e.target.value)} className="bg-gray-800 border-gray-700 text-white" required minLength={6} />
              </div>

              {/* Si es padre, opcionalmente crear hijo */}
              {form.rol === 'padre' && (
                <div className="border-t border-gray-800 pt-4 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-6 w-6 rounded-full bg-[#DC2626]/20 flex items-center justify-center">
                      <span className="text-xs text-[#DC2626] font-bold">+</span>
                    </div>
                    <Label className="text-white text-sm font-semibold">Registrar a tu hijo (opcional)</Label>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">Si tu hijo ya tiene cuenta, el admin lo vinculará desde el panel. Si no, crealo ahora.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Nombre del hijo</Label>
                      <Input value={form.hijo_nombre} onChange={e => update('hijo_nombre', e.target.value)} placeholder="Nombre" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Apellido del hijo</Label>
                      <Input value={form.hijo_apellido} onChange={e => update('hijo_apellido', e.target.value)} placeholder="Apellido" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">DNI del hijo</Label>
                      <Input value={form.hijo_dni} onChange={e => update('hijo_dni', e.target.value)} placeholder="DNI" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-gray-400 text-xs">Email del hijo (opcional)</Label>
                      <Input value={form.hijo_email} onChange={e => update('hijo_email', e.target.value)} placeholder="Se genera automáticamente si se deja vacío" className="bg-gray-800 border-gray-700 text-white text-sm" />
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full bg-[#DC2626] hover:bg-[#B91C1C] h-12 font-semibold" disabled={loading}>
                {loading ? 'Creando...' : <><span>Crear Cuenta</span><ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>

              {form.rol === 'padre' && form.hijo_nombre && (
                <p className="text-center text-xs text-gray-500">
                  Se creará la cuenta de {form.hijo_nombre} y se vinculará automáticamente. Cuota: <span className="text-[#DC2626] font-semibold">$75.000/mes</span>
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-gray-500 mt-6">
          ¿Ya tenés cuenta? <Link href="/login" className="text-[#DC2626] hover:text-[#B91C1C] font-semibold">Iniciar Sesión</Link>
        </p>
      </div>
    </div>
  );
}
