'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { resendVerification } from '@/lib/auth-client';

function VerifyContent() {
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'error'>('verificando');
  const [mensaje, setMensaje] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resendUrl, setResendUrl] = useState('');
  const [reenviando, setReenviando] = useState(false);
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  useEffect(() => {
    (async () => {
      if (!token) {
        setEstado('error');
        setMensaje('Falta el token de verificación.');
        return;
      }
      try {
        const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (res.ok) {
          setEstado('ok');
        } else {
          setEstado('error');
          setMensaje(json.error || 'No se pudo verificar el email.');
        }
      } catch {
        setEstado('error');
        setMensaje('Error de conexión. Intentá de nuevo.');
      }
    })();
  }, [token]);

  // El enlace pudo vencer días después. En vez de mandar a la persona a otra
  // pantalla, se le ofrece pedir uno nuevo acá mismo. Se pide email + clave
  // (no solo email) para que nadie pueda generar correos a direcciones ajenas.
  async function reenviar(e: React.FormEvent) {
    e.preventDefault();
    setResendMsg('Enviando…');
    setResendUrl('');
    setReenviando(true);
    const r = await resendVerification(email, password);
    setReenviando(false);
    if (r.error) {
      setResendMsg(r.error);
      return;
    }
    setResendMsg(r.message || 'Si la cuenta existe, te enviamos un nuevo enlace.');
    setResendUrl(r.devVerificationUrl || '');
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <img src="/logo.png" alt="Fenix Roller Hockey" className="h-16 w-16 object-contain mx-auto mb-4" />

        {estado === 'verificando' && (
          <>
            <div className="h-8 w-8 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin mx-auto" />
            <p className="text-gray-400 mt-4">Verificando tu email...</p>
          </>
        )}

        {estado === 'ok' && (
          <>
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <span className="text-emerald-400 text-2xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-4">¡Email verificado!</h1>
            <p className="text-gray-400 mt-2">Ya podés entrar al portal con tu cuenta.</p>
            <a
              href="/login"
              className="inline-block mt-6 px-6 py-3 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
            >
              Iniciar sesión
            </a>
          </>
        )}

        {estado === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
              <span className="text-red-400 text-2xl">✕</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-4">No se pudo verificar</h1>
            <p className="text-gray-400 mt-2">{mensaje}</p>

            <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-4 text-left">
              <p className="text-sm font-semibold text-white">Pedir un enlace nuevo</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                El enlace vence a los 7 días. Si lo abriste después, pedí uno nuevo
                con el email y la contraseña de la cuenta. Si no sabés la clave,
                tu madre, padre o tutor puede reenviarlo desde <strong>Mis Hijos</strong>.
              </p>
              <form onSubmit={reenviar} className="mt-3 space-y-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email de la cuenta"
                  autoComplete="email"
                  required
                  className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 outline-none text-sm"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  required
                  className="w-full h-10 px-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder:text-gray-600 focus:border-red-600 outline-none text-sm"
                />
                <button
                  type="submit"
                  disabled={reenviando}
                  className="w-full h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {reenviando ? 'Enviando…' : 'Reenviar verificación'}
                </button>
              </form>
              {resendMsg && <p className="mt-2 text-xs text-amber-300">{resendMsg}</p>}
              {resendUrl && (
                <a href={resendUrl} className="mt-1 block break-all text-xs text-amber-200 underline">
                  {resendUrl}
                </a>
              )}
            </div>

            <a
              href="/login"
              className="inline-block mt-4 px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
            >
              Volver al login
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerificarPage() {
  return (
    <Suspense fallback={null}>
      <VerifyContent />
    </Suspense>
  );
}
