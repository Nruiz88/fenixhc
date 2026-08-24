'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // Success - determine redirect
      const rol = data.user.user_metadata?.rol;
      let destination = '/';
      if (redirectTo) destination = redirectTo;
      else if (rol === 'admin') destination = '/admin/dashboard';
      else if (rol === 'padre') destination = '/padre/dashboard';
      else if (rol === 'deportista') destination = '/deportista/dashboard';

      window.location.href = destination;
    } catch (err: any) {
      setError(err.message || 'Error al conectar');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Fenix" className="h-16 w-16 object-contain mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white">Fenix Roller Hockey</h1>
          <p className="text-gray-400 mt-2">Ingresá a tu cuenta</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@club.com"
                required
                autoComplete="email"
                className="w-full h-12 px-4 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full h-12 px-4 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 focus:ring-1 focus:ring-red-600 outline-none"
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            ¿No tenés cuenta?{' '}
            <a href="/registro" className="text-red-500 hover:text-red-400">Registrate</a>
          </div>

          <div className="mt-4 text-center">
            <a href="/" className="text-gray-600 hover:text-gray-400 text-sm">← Volver al sitio</a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Simple mount check - if not mounted, show nothing to avoid hydration issues
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="Fenix" className="h-16 w-16 object-contain mx-auto mb-4" />
          <div className="h-6 w-6 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="Fenix" className="h-16 w-16 object-contain mx-auto mb-4" />
          <div className="h-6 w-6 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}


