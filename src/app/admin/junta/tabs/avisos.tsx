'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Panel, EmptyState, Hint, Toolbar, StatusPill, DataPoint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { money } from '@/lib/format';
import {
  BellRing, Search, Mail, Check, TriangleAlert, History, Send, X,
} from 'lucide-react';

interface Cuota {
  id: string; usuarioId: string; mes: number; anio: number; monto: number;
  recargo: { total: number; porcentaje: number; diasVencida: number };
}
interface Jugador { id: string; nombre: string; apellido: string }
interface Familiar {
  usuarioId: string; perfilId: string; nombre: string; apellido: string;
  telefono: string | null; correo: string | null;
  jugadores: Jugador[]; cuotas: Cuota[]; montoTotal: number; diasVencida: number;
  motivo: 'cuota' | 'seguro' | 'mixto';
  seguroPendiente: boolean;
  seguroJugador: Jugador | null;
}
interface Resumen {
  familia: Familiar;
  mensaje: string;
  ultimo: { enviadoEn: string; motivo: string; detalle: string } | null;
}
interface Historial {
  id: string; nombre: string; apellido: string; motivo: string; detalle: string;
  monto_total: string | null; dias_vencida: number | null;
  canal: string; resultado: string; enviado_en: string;
}

const MOTIVO: Record<string, { label: string; tone: 'warn' | 'info' | 'danger' }> = {
  cuota: { label: 'Cuota', tone: 'warn' },
  seguro: { label: 'Seguro', tone: 'info' },
  mixto: { label: 'Cuota y seguro', tone: 'danger' },
};

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function TabAvisos() {
  const [lista, setLista] = useState<Resumen[]>([]);
  const [historial, setHistorial] = useState<Historial[]>([]);
  const [correoHabilitado, setCorreoHabilitado] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<Resumen | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [porCorreo, setPorCorreo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/avisos');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setLista(json.data.lista ?? []);
      setHistorial(json.data.historial ?? []);
      setCorreoHabilitado(Boolean(json.data.correoHabilitado));
    } catch (err: any) {
      toast.error('No se pudo cargar la lista', { description: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return lista;
    return lista.filter(({ familia }) => {
      const jugadores = familia.jugadores.map((j) => `${j.nombre} ${j.apellido}`).join(' ');
      return `${familia.nombre} ${familia.apellido} ${familia.telefono ?? ''} ${jugadores}`
        .toLowerCase()
        .includes(t);
    });
  }, [lista, busqueda]);

  const total = lista.reduce((s, l) => s + l.familia.montoTotal, 0);

  function abrir(item: Resumen) {
    setElegido(item);
    setMensaje(item.mensaje);
    // El correo solo se ofrece si hay Resend. Ofrecer una casilla que no hace
    // nada es peor que no ofrecerla.
    setPorCorreo(correoHabilitado && Boolean(item.familia.correo));
  }

  async function enviar() {
    if (!elegido) return;
    if (!mensaje.trim()) { toast.error('El mensaje no puede estar vacío'); return; }

    setEnviando(true);
    try {
      const res = await fetch('/api/avisos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: elegido.familia.usuarioId,
          mensaje,
          porCorreo,
          // Se mandan los datos para que el servidor recalcule la deuda. La cifra
          // que va en el mensaje es la que el servidor vuelva a calcular.
          responsable: elegido.familia,
          cuotas: elegido.familia.cuotas,
          seguros: elegido.familia.seguroPendiente && elegido.familia.seguroJugador
            ? [{ usuarioId: elegido.familia.usuarioId, jugadorId: elegido.familia.seguroJugador.id, adherido: false }]
            : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (json.email === 'error') {
        toast.warning('El aviso llegó al portal pero el correo no salió', {
          description: json.detalleError ?? 'Revisá el correo del socio.',
        });
      } else {
        toast.success('Aviso enviado', {
          description: porCorreo ? 'Va al portal y al correo.' : 'Va al portal del socio.',
        });
      }

      setElegido(null);
      await cargar();
    } catch (err: any) {
      toast.error('No se pudo enviar', { description: err.message });
    } finally {
      setEnviando(false);
    }
  }

  // ── Editor del aviso ─────────────────────────────────────────────────
  if (elegido) {
    const f = elegido.familia;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-main">
              Aviso a {f.nombre} {f.apellido}
            </h2>
            <p className="text-xs text-dim">
              {f.jugadores.map((j) => `${j.nombre} ${j.apellido}`).join(' · ') || 'Sin jugadores'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setElegido(null)}>
            <X className="h-4 w-4" />Cerrar
          </Button>
        </div>

        <Panel title="Lo que debe" bodyClassName="p-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <DataPoint label="Motivo" value={MOTIVO[f.motivo].label} />
            <DataPoint label="Total" value={money(f.montoTotal)} />
            <DataPoint
              label="Días de atraso"
              value={f.diasVencida > 0 ? `${f.diasVencida}` : '—'}
            />
            <DataPoint
              label="Contacto"
              value={f.telefono || f.correo || 'Sin datos'}
            />
          </dl>

          {f.cuotas.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-3">
              {f.cuotas.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span className="text-muted">
                    Cuota {MESES[c.mes - 1]} {c.anio}
                    {c.recargo.porcentaje > 0 && (
                      <span className="ml-2 text-xs text-warn">
                        +{c.recargo.porcentaje}%
                      </span>
                    )}
                  </span>
                  <span className="tabular text-main">{money(c.recargo.total)}</span>
                </li>
              ))}
            </ul>
          )}

          {f.seguroPendiente && f.seguroJugador && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-info">
              Seguro pendiente de {f.seguroJugador.nombre} {f.seguroJugador.apellido}
            </p>
          )}
        </Panel>

        <Panel
          title="Mensaje"
          description="Podés editarlo antes de mandarlo. Se guarda una copia de lo que salió."
        >
          <Textarea
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            rows={12}
            className="font-mono text-xs leading-relaxed"
            aria-label="Texto del aviso"
          />

          {correoHabilitado && f.correo ? (
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={porCorreo}
                onChange={(e) => setPorCorreo(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-line"
              />
              <span className="text-muted">
                Mandar también por correo a <span className="text-main">{f.correo}</span>
              </span>
            </label>
          ) : (
            <Hint tone="warn">
              {correoHabilitado
                ? 'Este socio no tiene correo cargado, así que el aviso va solo al portal.'
                : 'El aviso va solo al portal. Falta configurar el correo del club para poder mandar también por email.'}
            </Hint>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button onClick={enviar} disabled={enviando || !mensaje.trim()}>
              <Send className="h-4 w-4" />
              {enviando ? 'Enviando…' : 'Enviar aviso'}
            </Button>
            <Button variant="ghost" onClick={() => setMensaje(elegido.mensaje)}>
              Volver al texto original
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  // ── Lista ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Panel
        title="Avisos a familias"
        description="Quién tiene cuotas vencidas con recargo o seguro sin adherir."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVerHistorial((v) => !v)}
            aria-pressed={verHistorial}
          >
            <History className="h-4 w-4" />
            {verHistorial ? 'Ver pendientes' : 'Ver historial'}
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Una cuota aparece acá cuando ya tiene recargo aplicado, o sea desde el
          primer hito. Antes de eso el club todavía no puede reclamar nada.
        </p>
      </Panel>

      {!correoHabilitado && (
        <Hint tone="warn">
          El aviso llega al <strong className="text-main">portal del socio</strong>, a la
          campana. El correo no está configurado en el club, así que no se manda
          email.
        </Hint>
      )}

      {verHistorial ? (
        <Panel title="Avisos enviados" bodyClassName="p-0">
          {historial.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="Todavía no se mandó ningún aviso"
              description="Acá queda registrado a quién se le avisó, cuándo y qué se le dijo."
            />
          ) : (
            <ul className="divide-y divide-line">
              {historial.map((h) => (
                <li key={h.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-main">
                      {h.nombre} {h.apellido}
                    </span>
                    <StatusPill tone={MOTIVO[h.motivo]?.tone ?? 'neutral'}>
                      {MOTIVO[h.motivo]?.label ?? h.motivo}
                    </StatusPill>
                    {h.canal === 'ambos' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-dim">
                        <Mail className="h-3 w-3" />portal y correo
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-dim">
                      {new Date(h.enviado_en).toLocaleString('es-AR')}
                    </span>
                  </div>
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs text-dim hover:text-muted">
                      Ver lo que se le mandó
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted">
                      {h.detalle}
                    </pre>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : lista.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Check className="h-6 w-6" />}
            title="Nadie tiene nada pendiente"
            description="No hay cuotas vencidas con recargo ni seguros sin adherir."
          />
        </Panel>
      ) : (
        <>
          <Panel bodyClassName="p-3">
            <Toolbar>
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o teléfono…"
                  aria-label="Buscar familia"
                  className="h-9 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-main placeholder:text-dim"
                />
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs text-dim">
                <span>
                  <span className="tabular text-main">{filtrados.length}</span> familias
                </span>
                <span>
                  <span className="tabular text-main">{money(total)}</span> en total
                </span>
              </div>
            </Toolbar>
          </Panel>

          {filtrados.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<Search className="h-6 w-6" />}
                title="Ninguna familia coincide"
                description="Probá con otro nombre o teléfono."
              />
            </Panel>
          ) : (
            <ul className="space-y-2">
              {filtrados.map((item) => {
                const f = item.familia;
                const avisado = item.ultimo;
                return (
                  <li
                    key={f.usuarioId}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-main">
                          {f.nombre} {f.apellido}
                        </span>
                        <StatusPill tone={MOTIVO[f.motivo].tone}>
                          {MOTIVO[f.motivo].label}
                        </StatusPill>
                        {f.diasVencida > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-warn">
                            <TriangleAlert className="h-3 w-3" />
                            {f.diasVencida} días
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 truncate text-xs text-dim">
                        {f.jugadores.map((j) => `${j.nombre} ${j.apellido}`).join(' · ') || 'Sin jugadores'}
                        {f.telefono && ` · ${f.telefono}`}
                      </p>

                      {avisado && (
                        <p className="mt-1 text-[11px] text-dim">
                          Avisado el{' '}
                          {new Date(avisado.enviadoEn).toLocaleDateString('es-AR')}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      {f.montoTotal > 0 && (
                        <p className="text-sm font-semibold tabular text-warn">
                          {money(f.montoTotal)}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        onClick={() => abrir({ familia: f, mensaje: '', ultimo: avisado })}
                      >
                        <BellRing className="h-3.5 w-3.5" />Avisar
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}