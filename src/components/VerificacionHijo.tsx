'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, MailWarning, Send } from 'lucide-react';

/**
 * Estado del email del jugador y reenvío desde el portal del padre.
 *
 * La verificación la sigue haciendo el jugador desde su propia casilla: acá
 * solo se corrige la dirección (mientras la cuenta no esté verificada) y se
 * pide un enlace nuevo. El padre nunca puede marcar la cuenta como verificada
 * por su hijo.
 */
export function VerificacionHijo({
  perfilId,
  email,
  verificado,
}: {
  perfilId: string;
  email: string;
  verificado: boolean;
}) {
  const [correo, setCorreo] = useState(email);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [devUrl, setDevUrl] = useState('');
  const [verificadoLocal, setVerificadoLocal] = useState(verificado);

  async function reenviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setExito('');
    setDevUrl('');
    setEnviando(true);

    try {
      const res = await fetch('/api/user/verificacion-hijo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfilId, email: correo.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'No se pudo reenviar la verificación.');
        return;
      }

      setExito(json.message || 'Listo.');
      setDevUrl(json.devVerificationUrl || '');
      if (json.email) setCorreo(json.email);
      if (json.enviado === false && /ya está verificada/i.test(String(json.message ?? ''))) {
        setVerificadoLocal(true);
      }
    } catch {
      setError('No pudimos conectarnos. Probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  if (verificadoLocal) {
    return (
      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-ok">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        Email verificado: la cuenta ya puede entrar.
      </div>
    );
  }

  return (
    <form onSubmit={reenviar} className="mt-3 space-y-2 rounded-lg border border-line bg-surface-2 p-3">
      <div className="flex items-start gap-1.5">
        <MailWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-main">Falta verificar el email del jugador</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-dim">
            Si el correo está mal escrito o el enlace venció, corregilo y reenviá
            la verificación. El jugador tiene que abrir el enlace desde esa casilla.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          placeholder="email@ejemplo.com"
          aria-label="Email del jugador"
          required
          className="h-8 text-xs"
        />
        <Button type="submit" size="sm" disabled={enviando} className="shrink-0">
          <Send className="h-3.5 w-3.5" />
          {enviando ? 'Enviando…' : 'Reenviar verificación'}
        </Button>
      </div>

      {error && <p className="text-[11px] text-danger">{error}</p>}
      {exito && <p className="text-[11px] text-ok">{exito}</p>}
      {devUrl && (
        <a href={devUrl} className="block break-all text-[11px] text-warn underline">
          {devUrl}
        </a>
      )}
    </form>
  );
}
