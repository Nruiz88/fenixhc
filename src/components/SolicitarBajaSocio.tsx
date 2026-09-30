'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Panel, Hint } from '@/components/admin/ui';
import { ROL_LABEL, type Rol } from '@/lib/roles';
import { UserX, Loader2, Info } from 'lucide-react';

// Botón y formulario para que el socio pida la baja de sus datos.
//
// No borra nada por sí solo: deja el pedido en la bandeja de la
// administración. Dos razones. La primera, que el club tiene que verificar la
// identidad de quien pide: si el formulario borrara directamente, cualquiera
// podría mandar el DNI de otro y dejarlo sin sus datos. La segunda, que una
// baja puede tener consecuencias que el socio no ve: si hay cuotas sin pagar,
// disappears de la cobranza y alguien tiene que resolverlo.
//
// El texto lo dice antes de enviar. Un botón de "eliminar mis datos" que no
// aclara qué pasa con los pagos es una promesa que el club no puede cumplir.

interface Candidato {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  rol: Rol;
}

const MOTIVOS = [
  { value: 'renuncia', label: 'Me doy de baja del club' },
  { value: 'baja_social', label: 'Doy de baja la inscripción' },
  { value: 'solicitud_tutor', label: 'Doy de baja a un jugador a mi cargo' },
  { value: 'otro', label: 'Otro motivo' },
] as const;

export function BotonSolicitarBaja() {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [elegido, setElegido] = useState('');
  const [motivo, setMotivo] = useState<string>('renuncia');
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/user/solicitar-baja');
        if (!res.ok) return;
        const json = await res.json();
        const lista: Candidato[] = [];
        if (json.data?.propio) lista.push(json.data.propio);
        for (const h of json.data?.hijos ?? []) lista.push(h);
        setCandidatos(lista);
        if (lista.length === 1) setElegido(lista[0].id);
      } catch {
        // Si no se puede cargar la lista, el botón sigue apareciendo pero al
        // abrirlo avisa. Mejor eso que esconder la opción.
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const elElegido = candidatos.find((c) => c.id === elegido);
  const soyYoMismo = !!elElegido && candidatos[0]?.id === elElegido.id;

  async function enviar() {
    if (!elegido) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/user/solicitar-baja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_id: elegido, motivo, comentario }),
      });
      const json = await res.json();

      if (!res.ok) { toast.error(json.error || 'No pudimos registrar el pedido'); return; }

      toast.success('Pedido registrado', {
        description: json.mensaje,
        duration: 9000,
      });
      setAbierto(false);
      setComentario('');
      setElegido(candidatos[0]?.id ?? '');
    } catch {
      toast.error('No pudimos registrar el pedido. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Panel
        title="Pedir la baja"
        description="Si querés que el club elimine tus datos personales"
        actions={
          <Button variant="outline" onClick={() => setAbierto(true)}>
            <UserX className="h-4 w-4" />
            Solicitar baja
          </Button>
        }
      >
        <p className="text-sm text-muted">
          Podés pedir la baja de tu ficha o de la de un jugador que tengas a tu
          cargo. La administración la revisa y te responde a este correo.
        </p>
      </Panel>

      <Dialog open={abierto} onOpenChange={(o) => { if (!enviando) setAbierto(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar baja de datos</DialogTitle>
            <DialogDescription>
              Elegí de quién es el pedido y contanos por qué. Esto no borra nada
              en el momento: la administración lo revisa primero.
            </DialogDescription>
          </DialogHeader>

          {cargando ? (
            <div className="h-32 animate-pulse rounded-lg bg-surface-2" />
          ) : candidatos.length === 0 ? (
            <Hint tone="warn">
              No encontramos fichas a tu nombre. Si querés borrar tus datos y
              no aparecés acá,{' '}
              <a href="/solicitar-baja" className="underline">
                pedilo desde el formulario abierto
              </a>{' '}
              o escribinos a la administración.
            </Hint>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="quien">Pedido para *</Label>
                <select
                  id="quien"
                  value={elegido}
                  onChange={(e) => setElegido(e.target.value)}
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
                >
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id === candidatos[0].id ? 'Yo mismo: ' : 'Jugador: '}
                      {c.nombre} {c.apellido} — {ROL_LABEL[c.rol] ?? c.rol}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label>Motivo *</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MOTIVOS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMotivo(m.value)}
                      className={
                        motivo === m.value
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
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  rows={3}
                  placeholder="Si querés que se borren fotos o comprobantes en particular, decilo acá."
                />
              </div>

              <Hint>
                <strong>Qué pasa cuando se aprueba.</strong> Se borran el nombre,
                el DNI, el CUIL, el teléfono, la dirección y las fotos del
                documento, y tu cuenta queda desactivada. Los pagos ya
                registrados se conservan porque son parte de la contabilidad del
                club, pero quedan sin tu nombre. Tu acceso al portal deja de
                funcionar: esta sesión es la última.
              </Hint>

              {soyYoMismo && (
                <Hint tone="warn">
                  <span className="inline-flex items-start gap-1.5">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Vas a pedir la baja de tu propia ficha. Vas a perder el
                    acceso al portal y no vas a poder entrar a reclamar nada
                    después.
                  </span>
                </Hint>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setAbierto(false)} disabled={enviando}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={enviar} disabled={!elegido || enviando}>
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                  {enviando ? 'Enviando…' : 'Enviar el pedido'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
