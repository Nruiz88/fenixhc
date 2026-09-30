'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { fecha, fechaHora } from '@/lib/format';
import { ROL_LABEL, type Rol } from '@/lib/roles';
import { PageHeader, Panel, StatCard, EmptyState, StatusPill, Toolbar, Hint, DataPoint } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Eye, UserX, Search, X, FileText, AlertTriangle, Loader2 } from 'lucide-react';

interface Acceso {
  id: string;
  tipo_documento: string;
  proposito: string | null;
  ip: string | null;
  created_at: string;
  destino_nombre: string | null;
  destino_apellido: string | null;
  destino_dni: string | null;
  autor_nombre: string | null;
  autor_apellido: string | null;
  autor_rol: string | null;
  autor_email: string | null;
}

interface Baja {
  id: string;
  solicitante_nombre: string;
  solicitante_email: string;
  motivo: string | null;
  estado: string;
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
  es_jugador: number;
}

const ETIQUETA_TIPO: Record<string, string> = {
  dni: 'Documento de identidad',
  comprobante: 'Comprobante de pago',
};

export default function AdminPrivacidad() {
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [bajas, setBajas] = useState<Baja[]>([]);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [aDarDeBaja, setADarDeBaja] = useState<Candidato | null>(null);
  const [motivo, setMotivo] = useState('');
  const [bajaAbierta, setBajaAbierta] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch('/api/admin/privacidad');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAccesos(json.data.accesos ?? []);
      setBajas(json.data.bajas ?? []);
      setCandidatos(json.data.candidatos ?? []);
    } catch (err: any) {
      toast.error('No se pudo cargar la información de privacidad', { description: err.message });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  const accesosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return accesos;
    return accesos.filter((a) =>
      [a.autor_nombre, a.autor_apellido, a.autor_email, a.destino_nombre, a.destino_apellido, a.destino_dni, a.tipo_documento]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [accesos, busqueda]);

  async function ejecutarBaja() {
    if (!aDarDeBaja) return;
    setEjecutando(true);
    try {
      const res = await fetch('/api/admin/privacidad/baja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_id: aDarDeBaja.id, motivo, confirmar: true }),
      });
      const json = await res.json();

      if (!res.ok) { toast.error(json.error || 'No se pudo completar la baja'); return; }

      toast.success('Baja completada', { description: json.mensaje, duration: 9000 });
      setBajaAbierta(false);
      setADarDeBaja(null);
      setMotivo('');
      await cargar();
    } catch (err: any) {
      toast.error('No se pudo completar la baja', { description: err?.message });
    } finally {
      setEjecutando(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Datos personales"
        description="Accesos a documentación de socios y bajas pedidas. La ley 25.326 obliga a poder responder quién consultó qué."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Accesos registrados"
          value={accesos.length}
          hint="Consultas de documentos ajenos"
          icon={<Eye className="h-4 w-4" />}
        />
        <StatCard
          label="Bajas ejecutadas"
          value={bajas.length}
          hint="Personas anonimizadas"
          tone={bajas.length > 0 ? 'warn' : 'neutral'}
          icon={<UserX className="h-4 w-4" />}
        />
        <StatCard
          label="Personas inscriptas"
          value={candidatos.length}
          hint="Con datos personales cargados"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </div>

      <Hint>
        El registro se escribe cuando alguien de la directiva abre el DNI o el
        comprobante de un socio que no es suyo. Guardar quién, cuándo y sobre
        qué ficha es lo que permite responderle a un padre que pregunte quién
        abrió los datos de su hijo.
      </Hint>

      {/* Bitácora */}
      <Panel
        title="Accesos a documentación"
        description={`${accesosFiltrados.length} de ${accesos.length} registros`}
        bodyClassName="p-0"
      >
        <div className="border-b border-line p-3">
          <Toolbar>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por persona o documento"
                  className="pl-8"
                  aria-label="Buscar accesos"
                />
              </div>
              {busqueda && (
                <Button variant="ghost" size="sm" onClick={() => setBusqueda('')}>
                  <X className="h-4 w-4" />Limpiar
                </Button>
              )}
            </div>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : accesosFiltrados.length === 0 ? (
          <EmptyState
            icon={<Eye className="h-6 w-6" />}
            title={accesos.length === 0 ? 'Todavía no hay accesos registrados' : 'Ningún acceso coincide'}
            description={
              accesos.length === 0
                ? 'Acá queda constancia cuando la directiva abre el DNI o un comprobante de un socio.'
                : 'Probá con otro nombre o DNI.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {accesosFiltrados.map((a) => (
              <li key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-main">
                      <span className="font-medium">{a.autor_nombre} {a.autor_apellido}</span>
                      <span className="text-dim"> consultó </span>
                      <span className="font-medium">
                        {a.destino_nombre} {a.destino_apellido}
                      </span>
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusPill tone={a.tipo_documento === 'dni' ? 'danger' : 'info'}>
                        <FileText className="h-3 w-3" />
                        {ETIQUETA_TIPO[a.tipo_documento] ?? a.tipo_documento}
                      </StatusPill>
                      {a.autor_rol && (
                        <StatusPill tone="neutral">{ROL_LABEL[a.autor_rol as Rol] ?? a.autor_rol}</StatusPill>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-dim">
                    <p>{fechaHora(a.created_at)}</p>
                    {a.ip && <p className="tabular">{a.ip}</p>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Baja */}
      <Panel
        title="Dar de baja a una persona"
        description="Anonimiza sus datos. Los registros de pago y la contabilidad se conservan."
      >
        <Hint tone="warn">
          La baja <strong>no borra</strong> el historial de pagos: se perdería la
          contabilidad del club. Lo que se elimina es la identidad: nombre,
          DNI, CUIL, teléfono, dirección, documentación y el acceso a la cuenta.
        </Hint>

        {candidatos.length === 0 ? (
          <p className="py-6 text-center text-sm text-dim">No hay personas inscriptas.</p>
        ) : (
          <ul className="divide-y divide-line">
            {candidatos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-main">
                    {c.nombre} {c.apellido}
                  </p>
                  <p className="truncate text-xs text-dim">
                    DNI {c.dni} · {ROL_LABEL[c.rol] ?? c.rol}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-danger hover:bg-danger/10"
                  onClick={() => { setADarDeBaja(c); setBajaAbierta(true); }}
                >
                  <UserX className="h-4 w-4" />Dar de baja
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Historial de bajas */}
      {bajas.length > 0 && (
        <Panel title="Bajas registradas" description={`${bajas.length} solicitudes`} bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {bajas.map((b) => (
              <li key={b.id} className="px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-main">
                      <span className="font-medium">{b.solicitante_nombre}</span>
                      <span className="text-dim"> · </span>
                      <span className="text-muted">{b.solicitante_email}</span>
                    </p>
                    {b.motivo && <p className="mt-0.5 text-xs text-muted">{b.motivo}</p>}
                    {b.notas && <p className="mt-1 text-[11px] text-dim">{b.notas}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusPill tone={b.estado === 'resuelta' ? 'ok' : 'warn'}>{b.estado}</StatusPill>
                    <p className="mt-1 text-xs text-dim">{fecha(b.resuelta_at ?? b.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {/* Confirmación. Diálogo propio y no el Confirmar genérico porque acá
          hace falta escribir el motivo antes de confirmar, y meter un campo
          dentro de un diálogo de confirmación de tres botones termina siendo
          un diálogo con dos fuentes de verdad. */}
      <Dialog open={bajaAbierta} onOpenChange={(o) => { if (!o && !ejecutando) setBajaAbierta(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dar de baja a esta persona</DialogTitle>
            <DialogDescription>
              {aDarDeBaja?.nombre} {aDarDeBaja?.apellido} va a quedar sin
              nombre, DNI, CUIL, teléfono, dirección ni documentación, y la
              cuenta se va a desactivar. Los pagos ya registrados se conservan,
              pero sin persona identificable detrás.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-xs text-danger">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Esta acción no se puede deshacer.</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo de la baja</Label>
            <Textarea
              id="motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: lo pidió el padre, verificado contra el DNI"
            />
            <p className="text-[11px] text-dim">
              Queda en el historial. Sirve para poder justificar la decisión si
              la familia la pregunta.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBajaAbierta(false)} disabled={ejecutando}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={ejecutarBaja} disabled={ejecutando}>
              {ejecutando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
              {ejecutando ? 'Procesando…' : 'Dar de baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
