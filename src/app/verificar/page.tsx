'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyContent() {
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'error'>('verificando');
  const [mensaje, setMensaje] = useState('');
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
            <a
              href="/login"
              className="inline-block mt-6 px-6 py-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
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
