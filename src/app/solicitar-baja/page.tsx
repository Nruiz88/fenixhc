'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Panel, Hint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';

// Formulario público de solicitud de baja de datos.
//
// Existe porque el derecho de supresión lo tiene la persona, no el club. Si
// el único canal fuera "entrar al panel y que un administrador lo haga", el
// que ya se dio de baja —y por lo tanto ya no tiene cuenta— no podría
// pedir nada.

const MOTIVOS = [
  { value: 'renuncia', label: 'Me doy de baja del club' },
  { value: 'baja_social', label: 'Doy de baja mi inscripción' },
  { value: 'solicitud_tutor', label: 'Soy madre, padre o tutor y doy de baja al jugador' },
  { value: 'otro', label: 'Otro motivo' },
];

export default function SolicitarBaja() {
  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    documento: '',
    relacion: '',
    motivo: 'renuncia',
    comentario: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [referencia, setReferencia] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await fetch('/api/public/solicitar-baja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (!res.ok) { toast.error(json.error || 'No pudimos registrar el pedido'); return; }

      setListo(true);
      setReferencia(json.referencia ?? '');
      toast.success('Pedido registrado');
    } catch {
      toast.error('No pudimos registrar el pedido. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Panel>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-ok/10 text-ok">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-semibold text-main">Recibimos tu pedido</h2>
            <p className="max-w-md text-sm text-muted">
              La administración del club lo revisa y te responde al correo que
              dejaste. La Ley 25.326 obliga a responder dentro de los 10 días
              hábiles.
            </p>
            <p className="max-w-md text-xs text-dim">
              Guardá este número. Es con lo que se reclama si el club se demora:
              <br />
              <span className="font-mono text-base text-main">{referencia}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
              <Button variant="outline" onClick={() => setListo(false)}>
                Cargar otro pedido
              </Button>
              <a href="/" className="text-xs text-dim underline transition-colors hover:text-muted">
                Volver al sitio
              </a>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <PageHeader
        title="Pedir la eliminación de tus datos"
        description="Si querés que el club borre tus datos personales, dejanos el pedido. No hace falta que tengas cuenta."
      />

      <Hint>
        Antes de eliminar, el club verifica tu identidad con el DNI que
        informás. Por eso puede tomarte unos días: sin esa comprobación,
        cualquiera podría pedir la baja de otra persona.
      </Hint>

      <Panel title="Datos del pedido">
        <form onSubmit={enviar} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nombre">Nombre y apellido de la persona *</Label>
              <Input
                id="nombre"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Cómo figura en el club"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="documento">DNI de esa persona *</Label>
              <Input
                id="documento"
                inputMode="numeric"
                value={form.documento}
                onChange={(e) => setForm({ ...form, documento: e.target.value.replace(/[^\d]/g, '') })}
                placeholder="12345678"
                required
              />
              <p className="text-[11px] text-dim">Solo números. Es lo que permite verificar el pedido.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Tu email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="donde@queremos.responderte"
                required
              />
              <p className="text-[11px] text-dim">Te respondemos acá, no al de la persona.</p>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="relacion">¿Qué relación tenés con esa persona?</Label>
              <Input
                id="relacion"
                value={form.relacion}
                onChange={(e) => setForm({ ...form, relacion: e.target.value })}
                placeholder="Soy la madre del jugador, o fui socia hasta marzo"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Motivo del pedido *</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {MOTIVOS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm({ ...form, motivo: m.value })}
                  className={
                    form.motivo === m.value
                      ? 'rounded-lg border border-brand bg-brand/10 p-2.5 text-left text-sm text-main transition-colors'
                      : 'rounded-lg border border-line bg-surface-2 p-2.5 text-left text-sm text-muted transition-colors hover:border-line-strong'
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comentario">Contanos un poco más (opcional)</Label>
            <Textarea
              id="comentario"
              value={form.comentario}
              onChange={(e) => setForm({ ...form, comentario: e.target.value })}
              rows={4}
              placeholder="Si querés que se borren fotos, comprobantes u otra cosa en particular, decilo acá."
            />
          </div>

          <Hint>
            <strong>Qué se elimina y qué no.</strong> Se borran tu nombre, DNI,
            CUIL, teléfono, dirección, las fotos de tu documento y el acceso a
            tu cuenta. Los registros de las cuotas que pagaste se conservan,
            porque son parte de la contabilidad del club, pero quedan sin tu
            nombre.
          </Hint>

          <Button type="submit" disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {enviando ? 'Enviando…' : 'Enviar el pedido'}
          </Button>
        </form>
      </Panel>

      <p className="text-center text-xs text-dim">
        {/* Esta pantalla no tiene barra de navegación — se entra desde un
            enlace en un correo o desde el pie del sitio. Sin una salida, quien
            se equivoca queda atrapado en una pantalla de 404 sin ayuda. */}
        <a href="/" className="hover:text-muted">
          Volver al sitio
        </a>
        {' · '}
        <a href="/privacidad" className="hover:text-muted">
          Leé el aviso de privacidad
        </a>
      </p>
    </div>
  );
}
