'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { login, resendVerification } from '@/lib/auth-client';
import { PORTAL_POR_ROL } from '@/lib/roles';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [noVerificado, setNoVerificado] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendUrl, setResendUrl] = useState('');
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect');

  const handleResend = async () => {
    setResendMsg('Enviando...');
    const r = await resendVerification(email, password);
    if (r.error) setResendMsg(r.error);
    else {
      setResendMsg(r.message || 'Si la cuenta existe, te enviamos un nuevo enlace.');
      setResendUrl(r.devVerificationUrl || '');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setNoVerificado(false);
    setResendMsg('');

    try {
      const result = await login(email, password);

      if (result.error) {
        setError(result.error);
        if (result.code === 'EMAIL_NO_VERIFICADO') setNoVerificado(true);
        setLoading(false);
        return;
      }

      const rol = result.user?.rol;
      let destination = '/';
      if (redirectTo) destination = redirectTo;
      else if (rol && PORTAL_POR_ROL[rol]) destination = PORTAL_POR_ROL[rol];

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
          <img src="/logo.png" alt="Fenix Roller Hockey" className="h-16 w-16 object-contain mx-auto mb-4" />
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

            {noVerificado && (
              <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3 text-sm text-amber-300 space-y-2">
                <p>Revisá tu casilla de correo y seguí el enlace de confirmación.</p>
                <button
                  type="button"
                  onClick={handleResend}
                  className="underline hover:text-amber-200"
                >
                  Reenviar email de verificación
                </button>
                {resendMsg && <p className="text-xs text-amber-400">{resendMsg}</p>}
                {resendUrl && (
                  <a href={resendUrl} className="block text-xs underline text-amber-200 break-all">
                    {resendUrl}
                  </a>
                )}
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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="Fenix Roller Hockey" className="h-16 w-16 object-contain mx-auto mb-4" />
          <div className="h-6 w-6 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="Fenix Roller Hockey" className="h-16 w-16 object-contain mx-auto mb-4" />
          <div className="h-6 w-6 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
