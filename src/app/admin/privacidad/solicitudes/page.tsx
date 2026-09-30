'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { fechaHora, fecha } from '@/lib/format';
import { ROL_LABEL, type Rol } from '@/lib/roles';
import { PageHeader, Panel, EmptyState, StatusPill, Hint, DataPoint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Inbox, Check, X, Loader2, AlertTriangle, FileText, User } from 'lucide-react';

interface Solicitud {
  id: string;
  solicitante_nombre: string;
  solicitante_email: string;
  documento_verificacion: string | null;
  motivo: string | null;
  resultado: string | null;
  estado: string;
  canal: string | null;
  notas: string | null;
  created_at: string;
  resuelta_at: string | null;
}

interface Candidato {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  rol: Rol;
  correo: string;
}

const ETIQUETA_MOTIVO: Record<string, string> = {
  renuncia: 'Renuncia al club',
  baja_social: 'Baja de la inscripción',
  solicitud_tutor: 'Baja de jugador (tutor)',
  otro: 'Otro motivo',
};

const ETIQUETA_CANAL: Record<string, string> = {
  formulario: 'Formulario web',
  portal: 'Portal del socio',
  panel: 'Alta desde el panel',
  solicitud: 'Resuelta desde un pedido',
};

export default function SolicitudesBaja() {
  const [pendientes, setPendientes] = useState<Solicitud[]>([]);
  const [resueltas, setResueltas] = useState<Solicitud[]>([]);
  const [candidatos, setCandidatos] = useState<Record<string, Candidato[]>>({});
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  const [aAprobar, setAAprobar] = useState<Solicitud | null>(null);
  const [perfilElegido, setPerfilElegido] = useState<string>('');
  const [aRechazar, setARechazar] = useState<Solicitud | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState('');

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/admin/privacidad/solicitudes');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPendientes(json.data.pendientes ?? []);
      setResueltas(json.data.resueltas ?? []);
      setCandidatos(json.data.candidatos ?? {});
    } catch (err: any) {
      toast.error('No se pudieron cargar las solicitudes', { description: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function resolver(
    solicitud: Solicitud,
    accion: 'aprobar' | 'rechazar',
    extra: Record<string, string> = {}
  ) {
    setProcesando(solicitud.id);
    try {
      const res = await fetch('/api/admin/privacidad/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solicitud_id: solicitud.id, accion, ...extra }),
      });
      const json = await res.json();

      if (!res.ok) { toast.error(json.error || 'No se pudo resolver'); return; }

      toast.success(accion === 'aprobar' ? 'Baja ejecutada' : 'Solicitud rechazada', {
        description: json.mensaje,
        duration: 8000,
      });
      setAAprobar(null);
      setARechazar(null);
      setPerfilElegido('');
      setMotivoRechazo('');
      await cargar();
    } catch (err: any) {
      toast.error('No se pudo resolver', { description: err?.message });
    } finally {
      setProcesando(null);
    }
  }

  function abrirAprobar(s: Solicitud) {
    setAAprobar(s);
    setPerfilElegido(candidatos[s.id]?.[0]?.id ?? '');
  }

  const candidatosDe = (s: Solicitud) => candidatos[s.id] ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitudes de baja"
        description="Pedidos de eliminación de datos que hay que resolver. La ley obliga a responder en 10 días hábiles."
      />

      <Hint>
        Aprobar <strong>no es cambiar un estado</strong>: ejecuta la baja de
        verdad. Los datos quedan anonimizados y la documentación se borra. Los
        pagos ya registrados se conservan, sin nombre.
      </Hint>

      {/* Pendientes */}
      <Panel
        title="Pendientes"
        description={`${pendientes.length} ${pendientes.length === 1 ? 'pedido' : 'pedidos'}`}
        bodyClassName="p-0"
      >
        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : pendientes.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No hay pedidos pendientes"
            description="Cuando alguien pida la eliminación de sus datos, por formulario web o desde su portal, aparece acá."
          />
        ) : (
          <ul className="divide-y divide-line">
            {pendientes.map((s) => {
              const cands = candidatosDe(s);
              return (
                <li key={s.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-main">
                        {s.solicitante_nombre}
                      </p>
                      <p className="truncate text-xs text-dim">{s.solicitante_email}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusPill tone={s.estado === 'pendiente' ? 'warn' : 'info'}>
                          {s.estado === 'pendiente' ? 'Pendiente' : 'En revisión'}
                        </StatusPill>
                        <StatusPill tone="neutral">
                          {ETIQUETA_CANAL[s.canal ?? ''] ?? s.canal}
                        </StatusPill>
                        {s.motivo && (
                          <StatusPill tone="brand">
                            {ETIQUETA_MOTIVO[s.motivo] ?? s.motivo}
                          </StatusPill>
                        )}
                      </div>
                    </div>
                    <p className="shrink-0 text-xs text-dim">{fechaHora(s.created_at)}</p>
                  </div>

                  {s.notas && (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
                      {s.notas}
                    </p>
                  )}

                  {/* Verificación de identidad: el DNI que trae el pedido tiene
                      que coincidir con una ficha. Si no coincide, el admin
                      tiene que buscar a mano, y eso es la parte donde un error
                      anonimiza a la persona equivocada. */}
                  <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
                    <p className="mb-1.5 text-[11px] uppercase tracking-wide text-dim">
                      DNI informado para verificar
                    </p>
                    {s.documento_verificacion ? (
                      <>
                        <p className="font-mono text-sm text-main">{s.documento_verificacion}</p>
                        {cands.length === 1 ? (
                          <p className="mt-1.5 text-xs text-ok">
                            Coincide con una sola ficha:{' '}
                            <strong>
                              {cands[0].nombre} {cands[0].apellido}
                            </strong>{' '}
                            ({ROL_LABEL[cands[0].rol] ?? cands[0].rol})
                          </p>
                        ) : cands.length === 0 ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Ningún ficha tiene ese DNI. Revisá el pedido antes de aprobar.
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs text-warn">
                            El DNI aparece en {cands.length} fichas. Verificá cuál es.
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-warn">
                        El pedido no trae DNI: no se puede verificar automáticamente.
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={procesando === s.id || cands.length === 0}
                      onClick={() => abrirAprobar(s)}
                    >
                      <Check className="h-4 w-4" />
                      {cands.length === 0 ? 'No se puede verificar' : 'Aprobar y dar de baja'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setARechazar(s)}>
                      <X className="h-4 w-4" />Rechazar
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Resueltas */}
      <Panel
        title="Resueltas"
        description={`${resueltas.length} últimas`}
        bodyClassName="p-0"
      >
        {resueltas.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-dim">
            Todavía no se resolvió ningún pedido.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {resueltas.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-main">
                      <span className="font-medium">{s.solicitante_nombre}</span>
                      <span className="text-dim"> pidió la baja de </span>
                      {s.documento_verificacion && (
                        <span className="font-mono text-xs">{s.documento_verificacion}</span>
                      )}
                    </p>
                    {s.resultado && (
                      <p className="mt-0.5 text-xs text-dim">{s.resultado}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill tone={s.estado === 'resuelta' ? 'ok' : 'danger'}>
                      {s.estado === 'resuelta' ? 'Aprobada' : 'Rechazada'}
                    </StatusPill>
                    <p className="mt-1 text-xs text-dim">{fecha(s.resuelta_at ?? s.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Aprobar: elegir ficha */}
      <Dialog
        open={!!aAprobar}
        onOpenChange={(o) => { if (!o) { setAAprobar(null); setPerfilElegido(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar la solicitud</DialogTitle>
            <DialogDescription>
              Se va a dar de baja a la persona elegida. Sus datos personales y
              su documentación se eliminan, y la cuenta queda desactivada.
            </DialogDescription>
          </DialogHeader>

          {aAprobar && candidatosDe(aAprobar).length === 1 && (
            <div className="flex items-start gap-2 rounded-lg border border-ok/25 bg-ok/10 px-3 py-2 text-xs text-ok">
              <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                El DNI del pedido coincide con una sola ficha:{' '}
                <strong>
                  {candidatosDe(aAprobar)[0].nombre} {candidatosDe(aAprobar)[0].apellido}
                </strong>
                . Si no es la persona correcta, cerrá esto.
              </span>
            </div>
          )}

          {aAprobar && candidatosDe(aAprobar).length > 1 && (
            <div className="flex items-start gap-2 rounded-lg border border-warn/25 bg-warn/10 px-3 py-2 text-xs text-warn">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>El DNI aparece en varias fichas. Elegí con cuidado cuál es.</span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="perfil">Persona a dar de baja</Label>
            <select
              id="perfil"
              value={perfilElegido}
              onChange={(e) => setPerfilElegido(e.target.value)}
              className="h-9 w-full rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-main"
            >
              <option value="">Elegí una ficha…</option>
              {aAprobar &&
                candidatosDe(aAprobar).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.apellido} — DNI {c.dni} — {ROL_LABEL[c.rol] ?? c.rol}
                  </option>
                ))}
            </select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAAprobar(null)} disabled={!!procesando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!perfilElegido || !!procesando}
              onClick={() => aAprobar && resolver(aAprobar, 'aprobar', { perfil_id: perfilElegido })}
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {procesando ? 'Procesando…' : 'Aprobar y ejecutar la baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rechazar */}
      <Dialog open={!!aRechazar} onOpenChange={(o) => { if (!o) setARechazar(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar la solicitud</DialogTitle>
            <DialogDescription>
              Hay que explicar por qué: se le comunica a quien hizo el pedido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-rechazo">Motivo del rechazo *</Label>
            <Textarea
              id="motivo-rechazo"
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
              placeholder="Ej: no pudimos verificar la identidad con el DNI informado. Pasá por la sede con el documento."
            />
          </div>
          <Hint tone="warn">
            Rechazar un pedido de eliminación de datos es una decisión delicada.
            Si el motivo real es que falta documentación, conviene decirlo así
            y dar una chance, no cerrarlo.
          </Hint>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARechazar(null)} disabled={!!procesando}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!motivoRechazo.trim() || !!procesando}
              onClick={() => aRechazar && resolver(aRechazar, 'rechazar', { motivo: motivoRechazo })}
            >
              {procesando ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Rechazar el pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
