'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error('Error al ingresar', { description: error.message });
        setLoading(false);
        return;
      }

      toast.success('¡Bienvenido!', { description: `Hola, ${data.user.user_metadata?.nombre || data.user.email}` });

      // Determine redirect based on role
      const rol = data.user.user_metadata?.rol;
      let destination = '/';

      if (redirectTo) {
        destination = redirectTo;
      } else if (rol === 'admin') {
        destination = '/admin/dashboard';
      } else if (rol === 'padre') {
        destination = '/padre/dashboard';
      } else if (rol === 'deportista') {
        destination = '/deportista/dashboard';
      }

      // Force a full page navigation to ensure cookies are set
      window.location.href = destination;
    } catch (err: any) {
      toast.error('Error', { description: err.message });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#DC2626] via-[#7f1d1d] to-[#0A0A0A] items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 text-center text-white max-w-md">
          <img src="/logo.png" alt="Fenix" className="h-20 w-20 object-contain mx-auto mb-6" />
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">Fenix Roller<br/>Hockey</h1>
          <p className="text-xl text-gray-300 mb-8">Formando campeones dentro y fuera de la cancha desde 1995</p>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-3xl font-bold">15+</p>
              <p className="text-sm text-gray-300">Jugadores</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-3xl font-bold">10+</p>
              <p className="text-sm text-gray-300">Familias</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <p className="text-3xl font-bold">2</p>
              <p className="text-sm text-gray-300">Canchas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-950">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <img src="/logo.png" alt="Fenix" className="h-14 w-14 object-contain mx-auto" />
            <h1 className="text-2xl font-bold text-white mt-2">Fenix Roller Hockey</h1>
          </div>
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white">Bienvenido</h2>
            <p className="text-gray-400 mt-2">Ingresá a tu cuenta para continuar</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm font-medium">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="pl-10 bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-[#DC2626] focus:ring-[#DC2626]/20 h-12"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm font-medium">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="pl-10 bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus:border-[#DC2626] focus:ring-[#DC2626]/20 h-12"
                />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 bg-[#DC2626] hover:bg-[#B91C1C] text-white font-semibold text-base transition-all duration-200" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Ingresando...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Iniciar Sesión
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-sm">¿No tenés cuenta?{' '}
              <Link href="/registro" className="text-[#DC2626] hover:text-[#B91C1C] font-medium transition-colors">Registrate acá</Link>
            </p>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-800/50 text-center">
            <Link href="/" className="text-gray-600 hover:text-gray-400 text-sm transition-colors">← Volver al sitio</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-[#DC2626]/30 border-t-[#DC2626] rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
