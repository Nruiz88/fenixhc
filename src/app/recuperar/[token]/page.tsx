'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';

// Escribir la clave nueva.
//
// Esta pantalla es la que corta el ataque de suplantación: pide escribir la
// clave NUEVA, no mandar la que ya se tiene. Un correo que dice "entrá y poné tu
// clave" no se puede usar para robar nada.
//
// El token entra por la URL y va en el cuerpo del POST, nunca en la query de
// una request a la API: si fuera por querystring quedaría en el log del proxy y
// en el historial del navegador, y es un secreto de un solo uso.

type Estado =
  | { fase: 'revisando' }
  | { fase: 'escribiendo'; nombre?: string }
  | { fase: 'expirado'; motivo: 'invalido' | 'expirado' }
  | { fase: 'listo' };

export default function RecuperarTokenPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = String(params?.token ?? '');

  const [estado, setEstado] = useState<Estado>({ fase: 'revisando' });
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Se valida el token al abrir. Sirve para avisar "este link venció" en vez de
  // dejar que la persona escriba una clave nueva y recién se entere de que no
  // iba a servir.
  useEffect(() => {
    (async () => {
      if (!token) {
        setEstado({ fase: 'expirado', motivo: 'invalido' });
        return;
      }

      try {
        const res = await fetch(`/api/auth/reset-clave?token=${encodeURIComponent(token)}`);
        const json = await res.json();

        if (res.ok && json.ok) {
          setEstado({ fase: 'escribiendo', nombre: json.nombre });
          return;
        }

        setEstado({
          fase: 'expirado',
          motivo: res.status === 410 ? 'expirado' : 'invalido',
        });
      } catch {
        setEstado({ fase: 'expirado', motivo: 'invalido' });
      }
    })();
  }, [token]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmar) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/auth/reset-clave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmar }),
      });
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 410 || res.status === 404) {
          setEstado({ fase: 'expirado', motivo: res.status === 410 ? 'expirado' : 'invalido' });
          return;
        }
        setError(json.error || 'No pudimos cambiar la clave.');
        return;
      }

      setEstado({ fase: 'listo' });
      setTimeout(() => router.push('/login'), 4000);
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-950">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="Fenix" className="h-10 w-10 object-contain" />
          <span className="font-extrabold text-2xl text-white">FENIX</span>
        </Link>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            {estado.fase === 'revisando' ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                <p className="text-sm text-gray-400">Revisando el link…</p>
              </div>
            ) : estado.fase === 'listo' ? (
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <h1 className="text-xl font-bold text-white">Cambiamos tu clave</h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">
                  Ya podés entrar con la clave nueva. Te llevamos al ingreso.
                </p>
              </div>
            ) : estado.fase === 'expirado' ? (
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-500/10">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
                <h1 className="text-xl font-bold text-white">
                  {estado.motivo === 'expirado' ? 'Ese link venció' : 'Ese link no sirve'}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">
                  {estado.motivo === 'expirado'
                    ? 'Los links duran una hora y se pueden usar una sola vez. Pedí uno nuevo y te lo mandamos al mismo correo.'
                    : 'Puede que ya lo hayas usado, o que el link esté incompleto. Pedí uno nuevo.'}
                </p>
                <Button
                  className="mt-6 w-full bg-[#DC2626] hover:bg-[#B91C1C] h-12 font-semibold"
                  onClick={() => router.push('/recuperar')}
                >
                  Pedir un link nuevo
                </Button>
              </div>
            ) : (
              <form onSubmit={enviar} className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-white">Elegí una clave nueva</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    Mínimo 6 caracteres. Después de esto, entrás con esta.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nueva" className="text-gray-400 text-sm">
                    Clave nueva
                  </Label>
                  <div className="relative">
                    <Input
                      id="nueva"
                      type={ver ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white pr-10"
                      minLength={6}
                      autoComplete="new-password"
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setVer((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      aria-label={ver ? 'Ocultar claves' : 'Mostrar claves'}
                    >
                      {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="repetir" className="text-gray-400 text-sm">
                    Repetí la clave
                  </Label>
                  <Input
                    id="repetir"
                    type={ver ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white"
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                  {/* El error va junto al campo, no arriba: si la pantalla es
                      larga, arriba queda fuera de la vista. */}
                  {error && <p className="text-xs text-red-400">{error}</p>}
                </div>

                <p className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-xs leading-relaxed text-gray-500">
                  Si tenías la sesión abierta en el celu o en la computadora,
                  cerrá esa sesión y entrá de nuevo con la clave nueva.
                </p>

                <Button
                  type="submit"
                  className="w-full bg-[#DC2626] hover:bg-[#B91C1C] h-12 font-semibold"
                  disabled={enviando}
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {enviando ? 'Guardando…' : 'Guardar la clave nueva'}
                </Button>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al ingreso
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
