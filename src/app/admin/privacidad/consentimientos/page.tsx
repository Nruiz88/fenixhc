'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageHeader, Panel, Hint, StatusPill, EmptyState, Toolbar } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { FINALIDADES, type Finalidad } from '@/lib/consentimientos';
import { fecha, fechaHora } from '@/lib/format';
import { AlertTriangle, Loader2, ShieldCheck, ShieldAlert, Baby, Users } from 'lucide-react';

// Bandeja de consentimientos.
//
// La pantalla no es un listado de "sí" marcados: es el lugar donde se ve qué
// falta. Un club que solo muestra lo que tiene consentido se assure a sí
// mismo, y lo que hay que revisar justamente es lo que falta y lo que venció.

interface Alerta {
  tipo: string;
  perfil_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  detalle: string;
  accion: string;
  urgente: boolean;
}

interface Persona {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  rol: string;
  correo: string;
  fecha_nacimiento: string | null;
  categoria: string | null;
  tiene_doc: number;
  mayoria_al: string | null;
}

interface EstadoItem {
  finalidad: Finalidad;
  otorgada: boolean;
  consentimiento: {
    id: string;
    otorgante_tipo: string;
    vinculo_tipo: string | null;
    edad_al_otorgar: number | null;
    version_aviso: string;
    canal: string;
    otorgado_en: string;
    revocado_en: string | null;
  } | null;
  motivo: 'otorgada' | 'nunca_otorgada' | 'revocada' | 'obligacion_legal';
}

const ETIQUETA_MOTIVO: Record<EstadoItem['motivo'], string> = {
  otorgada: 'Otorgado',
  nunca_otorgada: 'Nunca otorgado',
  revocada: 'Revocado',
  obligacion_legal: 'Obligación legal',
};

const ETIQUETA_ALERTA: Record<string, string> = {
  mayor_ahora: 'Cumplió 18',
  documento_sin_consentimiento: 'Documento sin consentimiento',
  opinion_en_contra: 'Se opuso y se hizo igual',
  sin_vinculo_verificado: 'Menor sin responsable',
};

export default function ConsentimientosPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');

  const [detalle, setDetalle] = useState<{ persona: Persona; estado: EstadoItem[]; opiniones: any[] } | null>(null);
  const [aRevocar, setARevocar] = useState<{ item: EstadoItem; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/admin/consentimientos');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPersonas(json.data.personas ?? []);
      setAlertas(json.data.alertas ?? []);
    } catch (err: any) {
      toast.error('No se pudieron cargar los consentimientos', { description: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function abrirDetalle(p: Persona) {
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/consentimientos?perfil=${p.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setDetalle({ persona: json.data.persona, estado: json.data.estado, opiniones: json.data.opiniones ?? [] });
    } catch (err: any) {
      toast.error('No se pudo cargar el detalle', { description: err.message });
    } finally {
      setOcupado(false);
    }
  }

  async function accion(payload: Record<string, unknown>, mensajeOk: string) {
    setOcupado(true);
    try {
      const res = await fetch('/api/admin/consentimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'No se pudo completar'); return false; }
      toast.success(mensajeOk, { description: json.mensaje, duration: 7000 });
      return true;
    } catch {
      toast.error('No se pudo completar la operación');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function revocar() {
    if (!aRevocar) return;
    const ok = await accion(
      {
        accion: 'revocar',
        perfil_id: detalle?.persona.id,
        consentimiento_id: aRevocar.item.consentimiento?.id,
        motivo,
      },
      'Consentimiento revocado'
    );
    if (ok) {
      setARevocar(null);
      setMotivo('');
      await cargar();
      if (detalle) await abrirDetalle({ ...detalle.persona } as Persona);
    }
  }

  async function otorgar(f: Finalidad) {
    const ok = await accion(
      { accion: 'otorgar', perfil_id: detalle?.persona.id, finalidad: f },
      'Consentimiento registrado'
    );
    if (ok) {
      await cargar();
      await abrirDetalle({ ...detalle!.persona } as Persona);
    }
  }

  async function registrarOpinion(consulta: Finalidad, opinion: string) {
    const ok = await accion(
      { accion: 'opinion', perfil_id: detalle?.persona.id, finalidad: consulta, opinion },
      'Opinión registrada'
    );
    if (ok) {
      await cargar();
      await abrirDetalle({ ...detalle!.persona } as Persona);
    }
  }

  /** El menor habló por sí mismo: su palabra ya no se edita desde acá. */
  const habloEl = (consulta: Finalidad) =>
    detalle?.opiniones?.some((o: any) => o.consulta === consulta && o.origen === 'propia');

  const filtradas = personas.filter((p) => {
    if (!busqueda.trim()) return true;
    const t = busqueda.toLowerCase();
    return [p.nombre, p.apellido, p.dni].some((v) => String(v).toLowerCase().includes(t));
  });

  const urgentes = alertas.filter((a) => a.urgente);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consentimientos y menores"
        description="Quién autorizó qué, y qué falta. Acá se prueba lo que el club dice."
      />

      <Hint>
        Un consentimiento es la prueba de que alguien dijo que sí. Por eso{' '}
        <strong>nada se edita ni se borra</strong>: si alguien se arrepiente,
        se registra la revocación y queda la secuencia completa.
      </Hint>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Panel
          title="Pendientes de resolver"
          description={`${urgentes.length} urgentes de ${alertas.length}`}
          bodyClassName="p-0"
        >
          <ul className="divide-y divide-line">
            {alertas.map((a, i) => (
              <li key={i} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={a.urgente ? 'danger' : 'warn'}>
                      {ETIQUETA_ALERTA[a.tipo] ?? a.tipo}
                    </StatusPill>
                    <p className="text-sm font-medium text-main">
                      {a.nombre} {a.apellido}
                    </p>
                    <span className="font-mono text-xs text-dim">{a.dni}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">{a.detalle}</p>
                  <p className="mt-0.5 text-xs text-dim">
                    <strong>Qué hacer:</strong> {a.accion}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const p = personas.find((x) => x.id === a.perfil_id);
                    if (p) abrirDetalle(p);
                  }}
                >
                  Ver ficha
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Listado */}
      <Panel
        title="Todas las personas"
        description={`${filtradas.length} fichas`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o DNI…"
              className="h-9 w-full max-w-xs rounded-lg border border-line bg-surface-2 px-3 text-sm text-main placeholder:text-dim"
            />
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No hay fichas"
            description="Cuando se inscriban jugadores, aparecen acá con su estado de consentimiento."
          />
        ) : (
          <ul className="divide-y divide-line">
            {filtradas.map((p) => {
              const esMenor = !!p.mayoria_al && new Date(p.mayoria_al) > new Date();
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-main">
                      <span className="font-medium">{p.nombre} {p.apellido}</span>
                      <span className="ml-2 font-mono text-xs text-dim">{p.dni}</span>
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {esMenor ? (
                        <StatusPill tone="warn"><Baby className="h-3 w-3" /> Menor de edad</StatusPill>
                      ) : p.fecha_nacimiento ? (
                        <StatusPill tone="neutral">Mayor de edad</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">Sin fecha de nacimiento</StatusPill>
                      )}
                      {p.tiene_doc ? (
                        <StatusPill tone="info">Documentación cargada</StatusPill>
                      ) : null}
                      {p.categoria && <StatusPill tone="neutral">{p.categoria}</StatusPill>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => abrirDetalle(p)}>
                    Consentimientos
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Detalle */}
      <Dialog open={!!detalle} onOpenChange={(o) => { if (!o) setDetalle(null); }}>
        <DialogContent className="max-w-2xl">
          {detalle && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {detalle.persona.nombre} {detalle.persona.apellido}
                </DialogTitle>
                <DialogDescription>
                  DNI {detalle.persona.dni}
                  {detalle.persona.fecha_nacimiento
                    ? ` · nacido el ${fecha(detalle.persona.fecha_nacimiento)}`
                    : ' · sin fecha de nacimiento registrada'}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-[60vh] space-y-2.5 overflow-y-auto pr-1">
                {detalle.estado.map((e) => {
                  const def = FINALIDADES[e.finalidad];
                  const opuesta = detalle.opiniones?.find((o) => o.consulta === e.finalidad && o.opinion === 'en_contra');
                  const masReciente = detalle.opiniones?.find((o) => o.consulta === e.finalidad);

                  return (
                    <div key={e.finalidad} className="rounded-lg border border-line bg-surface-2 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-main">{def.etiqueta}</p>
                        <StatusPill
                          tone={
                            e.motivo === 'otorgada' ? 'ok'
                            : e.motivo === 'revocada' ? 'danger'
                            : e.motivo === 'obligacion_legal' ? 'neutral'
                            : 'warn'
                          }
                        >
                          {ETIQUETA_MOTIVO[e.motivo]}
                        </StatusPill>
                      </div>

                      <p className="mt-1 text-[11px] leading-relaxed text-dim">{def.datos}</p>

                      {e.consentimiento && (
                        <p className="mt-1.5 text-[11px] text-dim">
                          {e.consentimiento.otorgado_en && fechaHora(e.consentimiento.otorgado_en)}
                          {e.consentimiento.vinculo_tipo ? ` · como ${e.consentimiento.vinculo_tipo}` : ' · como titular'}
                          {e.consentimiento.edad_al_otorgar != null ? ` · tenía ${e.consentimiento.edad_al_otorgar} años` : ''}
                          {` · aviso ${e.consentimiento.version_aviso} · ${e.consentimiento.canal}`}
                          {e.consentimiento.revocado_en ? ` · revocado el ${fecha(e.consentimiento.revocado_en)}` : ''}
                        </p>
                      )}

                      {/* La opinión del menor, cuando la finalidad la exige. */}
                      {def.requiereOpinionMenor && (
                        <div className="mt-2 rounded border border-amber-700/40 bg-amber-950/20 p-2">
                          <p className="text-[11px] font-medium text-amber-200">
                            Opinión del jugador
                          </p>
                          <p className="mt-0.5 text-[11px] text-amber-100/70">
                            {masReciente
                              ? masReciente.opinion === 'a_favor' ? 'Está de acuerdo.'
                              : masReciente.opinion === 'en_contra' ? 'NO está de acuerdo.'
                              : 'No se le preguntó.'
                              : 'Todavía no se registró su opinión.'}
                          </p>
                          {opuesta && (
                            <p className="mt-1 text-[11px] text-amber-300">
                              Mientras diga que no, esta finalidad no se puede autorizar aunque la familia firme.
                            </p>
                          )}

                          {/* Si el menor ya habló por sí mismo, los botones
                              desaparecen. Mostrarlos era el agujero: el veto
                              del menor se desactivaba desde esta misma
                              pantalla, anotando "no preguntado" encima de su
                              "no". */}
                          {habloEl(e.finalidad) ? (
                            <p className="mt-2 text-[11px] text-dim">
                              La opinión la expresó el jugador por su cuenta.
                              Solo él puede cambiarla, desde su portal.
                            </p>
                          ) : (
                            <div className="mt-2 flex gap-1.5">
                              {(['a_favor', 'en_contra', 'no_consultado'] as const).map((o) => (
                                <button
                                  key={o}
                                  type="button"
                                  disabled={ocupado}
                                  onClick={() => registrarOpinion(e.finalidad, o)}
                                  className="rounded border border-amber-900/70 px-2 py-1 text-[10px] text-amber-100/70 transition-colors hover:border-amber-600 disabled:opacity-40"
                                >
                                  {o === 'a_favor' ? 'Sí acepta' : o === 'en_contra' ? 'No acepta' : 'No preguntado'}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex gap-1.5">
                        {e.motivo === 'obligacion_legal' ? (
                          <span className="flex items-center gap-1 text-[11px] text-dim">
                            <ShieldCheck className="h-3 w-3" />
                            El club lo guarda porque tiene obligación, no porque alguien autorice.
                          </span>
                        ) : e.otorgada ? (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => setARevocar({ item: e, nombre: `${detalle.persona.nombre} ${detalle.persona.apellido}` })}
                            className="rounded border border-danger/40 px-2 py-1 text-[10px] text-danger transition-colors hover:bg-danger/10 disabled:opacity-40"
                          >
                            Revocar
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => otorgar(e.finalidad)}
                            className="rounded border border-ok/40 px-2 py-1 text-[10px] text-ok transition-colors hover:bg-ok/10 disabled:opacity-40"
                          >
                            Registrar consentimiento
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revocar */}
      <Dialog open={!!aRevocar} onOpenChange={(o) => { if (!o) setARevocar(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revocar consentimiento</DialogTitle>
            <DialogDescription>
              Se le informa a {aRevocar?.nombre}. El registro original no se borra:
              queda la revocación, para poder demostrar cuándo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-rev">Motivo *</Label>
            <Textarea
              id="motivo-rev"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: la familia lo pidió por teléfono. Se elimina la documentación del DNI."
            />
          </div>
          <Hint tone="warn">
            <span className="inline-flex items-start gap-1.5">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Revocar no borra nada por sí solo. Si la finalidad era la
              documentación, hay que eliminar las fotos aparte: el sistema te
              avisa con la alerta correspondiente.
            </span>
          </Hint>
          <DialogFooter>
            <Button variant="outline" onClick={() => setARevocar(null)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!motivo.trim() || ocupado} onClick={revocar}>
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
              Revocar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
