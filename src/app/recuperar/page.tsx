'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react';

// Pedir el link de recuperación.
//
// LA PANTALLA NO DICE SI EL EMAIL EXISTE, Y NO ES UNA OMISIÓN
//
// Después de enviar, dice exactamente lo mismo que si ese correo no tuviera
// cuenta. Si dijera "no encontramos esa cuenta", esta pantalla serviría para
// averiguar qué familias están inscriptas en el club, y para mandarles correo a
// gente ajena con tu remitente.
//
// El mensaje real va al log del servidor, no a la boca de la persona.

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [devLink, setDevLink] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setEnviando(true);
    setDevLink('');

    try {
      const res = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (json.error) {
        setMensaje('');
        // Los errores de formato se muestran; el de rate limit también, porque
        // no confirman nada sobre la cuenta.
        setMensaje(json.error);
      } else {
        setMensaje(json.mensaje);
        setDevLink(json.devLink ?? '');
      }
    } catch {
      setMensaje('No pudimos conectarnos. Probá de nuevo en un rato.');
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
            {mensaje ? (
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-green-500/10">
                  <MailCheck className="h-6 w-6 text-green-500" />
                </div>
                <h1 className="text-xl font-bold text-white">Revisá tu correo</h1>
                <p className="mt-3 text-sm leading-relaxed text-gray-400">{mensaje}</p>

                <p className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-3 text-left text-xs leading-relaxed text-gray-500">
                  El link <strong className="text-gray-300">vence en una hora</strong> y
                  funciona <strong className="text-gray-300">una sola vez</strong>. Si
                  no lo pediste vos, no hagas nada: no tenés que responder nada.
                </p>

                {/* Aparece solo cuando el correo no salió, es decir cuando falta
                    configurar el envío. Es una salida para no dejar a nadie
                    trabado, no una puerta trasera. */}
                {devLink && (
                  <div className="mt-4 rounded-lg border border-amber-600/50 bg-amber-950/30 p-3 text-left">
                    <p className="text-xs font-medium text-amber-300">
                      El envío de correo no está configurado, así que te mostramos
                      el link acá:
                    </p>
                    <a
                      href={devLink}
                      className="mt-2 block break-all text-xs text-amber-200 underline"
                    >
                      {devLink}
                    </a>
                  </div>
                )}

                <Link
                  href="/login"
                  className="mt-6 inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver al ingreso
                </Link>
              </div>
            ) : (
              <form onSubmit={enviar} className="space-y-5">
                <div>
                  <h1 className="text-xl font-bold text-white">Recuperar tu clave</h1>
                  <p className="mt-1 text-sm text-gray-400">
                    Escribí el email con el que te registraste y te mandamos un
                    link para poner una clave nueva.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-400 text-sm">
                    Correo electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="bg-gray-800 border-gray-700 text-white"
                    required
                    autoFocus
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#DC2626] hover:bg-[#B91C1C] h-12 font-semibold"
                  disabled={enviando}
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {enviando ? 'Enviando…' : 'Enviarme el link'}
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