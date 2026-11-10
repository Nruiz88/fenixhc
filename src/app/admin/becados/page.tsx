'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/adminQuery';
import { getCurrentUser } from '@/lib/auth-client';
import { rolesDeUsuario } from '@/lib/roles';
import { iniciales } from '@/lib/format';
import { toast } from 'sonner';
import {
  PageHeader, Panel, EmptyState, Toolbar, StatCard, StatusPill, Hint,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BadgePercent, Search, X, Loader2, Users } from 'lucide-react';

// Becados: quién paga la cuota con descuento.
//
// La beca es del JUGADOR, no del socio: un padre puede tener dos hijos y solo
// uno estar becado. El descuento se aplica al emitir la cuota y las cuotas
// pendientes se recalculan al cambiarlo. Las pagadas no se tocan.

interface Fila {
  perfil_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  club_activo: boolean;
  beca_porcentaje: number;
  padre: string | null;
  familiaId: string | null;
}

interface DeportistaView {
  perfil_id: string;
  club_activo: number | boolean;
  beca_porcentaje: number | string | null;
  perfiles: {
    nombre?: string | null;
    apellido?: string | null;
    dni?: string | null;
  } | null;
}

interface FamiliaView {
  id: string;
  deportista_perfil_id: string;
  padre: { nombre?: string | null; apellido?: string | null } | null;
}

const OPCIONES = [
  { value: '0', label: 'Sin beca' },
  { value: '25', label: 'Beca 25%' },
  { value: '50', label: 'Beca 50%' },
  { value: '100', label: 'Beca 100%' },
];

const PUEDEN_EDITAR = ['admin', 'presidente', 'secretario', 'tesorero'];

export default function AdminBecados() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloBecados, setSoloBecados] = useState(false);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [puedeEditar, setPuedeEditar] = useState(false);

  const cargar = useCallback(async () => {
    const [{ data: deportistas, error: errorDep }, { data: familias, error: errorFam }] =
      await Promise.all([
        db.view<DeportistaView[]>('admin_deportistas'),
        db.view<FamiliaView[]>('admin_familias'),
      ]);

    if (errorDep || errorFam) {
      setError(errorDep || errorFam);
      setCargando(false);
      return;
    }

    // Se toma la primera familia de cada jugador. Un jugador con dos vínculos
    // (padre y madre) igual comparte la beca: es del jugador, no del vínculo.
    const familiaPorJugador = new Map<string, FamiliaView>();
    for (const f of familias ?? []) {
      if (!familiaPorJugador.has(f.deportista_perfil_id)) {
        familiaPorJugador.set(f.deportista_perfil_id, f);
      }
    }

    const lista: Fila[] = (deportistas ?? [])
      .map((d) => {
        const p = d.perfiles ?? {};
        const f = familiaPorJugador.get(d.perfil_id);
        return {
          perfil_id: d.perfil_id,
          nombre: p.nombre ?? '',
          apellido: p.apellido ?? '',
          dni: p.dni ?? null,
          club_activo: Boolean(Number(d.club_activo)),
          beca_porcentaje: Number(d.beca_porcentaje) || 0,
          padre: f ? [f.padre?.nombre, f.padre?.apellido].filter(Boolean).join(' ') : null,
          familiaId: f?.id ?? null,
        };
      })
      .sort((a, b) =>
        a.apellido.localeCompare(b.apellido, 'es') || a.nombre.localeCompare(b.nombre, 'es')
      );

    setError(null);
    setFilas(lista);
    setCargando(false);
  }, []);

  useEffect(() => {
    // Se difiere un microtask para no encadenar renders sincrónicos desde el
    // efecto: la carga toca varios estados (lista, error, spinner).
    void Promise.resolve().then(cargar);
  }, [cargar]);

  useEffect(() => {
    getCurrentUser().then((user) => {
      const roles = user ? rolesDeUsuario(user) : [];
      setPuedeEditar(roles.some((r) => PUEDEN_EDITAR.includes(r)));
    });
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (soloBecados && f.beca_porcentaje === 0) return false;
      if (!q) return true;
      return `${f.nombre} ${f.apellido} ${f.dni ?? ''} ${f.padre ?? ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [filas, busqueda, soloBecados]);

  const resumen = useMemo(() => {
    const becados = filas.filter((f) => f.beca_porcentaje > 0);
    return {
      becados: becados.length,
      cien: becados.filter((f) => f.beca_porcentaje === 100).length,
      cincuenta: becados.filter((f) => f.beca_porcentaje === 50).length,
      veinticinco: becados.filter((f) => f.beca_porcentaje === 25).length,
    };
  }, [filas]);

  async function cambiar(fila: Fila, valor: string) {
    const porcentaje = Number(valor);
    if (porcentaje === fila.beca_porcentaje) return;

    setGuardando(fila.perfil_id);
    try {
      const res = await fetch('/api/admin/becados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perfil_id: fila.perfil_id, porcentaje }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'No se pudo asignar la beca');

      const partes: string[] = [];
      if (json.cuotasActualizadas > 0) {
        partes.push(
          `${json.cuotasActualizadas} ${json.cuotasActualizadas === 1 ? 'cuota pendiente recalculada' : 'cuotas pendientes recalculadas'}`
        );
      }
      if (json.cuotasPagadas > 0) {
        partes.push(
          `${json.cuotasPagadas} ${json.cuotasPagadas === 1 ? 'cuota dada por pagada al 100%' : 'cuotas dadas por pagadas al 100%'}`
        );
      }

      toast.success(
        porcentaje === 0 ? 'Beca quitada' : `Beca del ${porcentaje}% asignada`,
        {
          description: partes.length
            ? partes.join(' · ')
            : 'No había cuotas pendientes para recalcular.',
        }
      );
      await cargar();
    } catch (err) {
      toast.error('No se pudo asignar la beca', {
        description: err instanceof Error ? err.message : 'Error de conexión',
      });
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Becados"
        description="Jugadores con descuento en la cuota. La beca también elimina el recargo por pago tardío."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Jugadores becados"
          value={resumen.becados}
          hint={`${filas.length} jugadores en total`}
          icon={<BadgePercent className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard label="Beca 100%" value={resumen.cien} hint="Cuota sin cargo" tone="info" />
        <StatCard label="Beca 50%" value={resumen.cincuenta} hint="Pagan la mitad" tone="info" />
        <StatCard label="Beca 25%" value={resumen.veinticinco} hint="Pagan el 75%" tone="info" />
      </div>

      <Panel
        title={`${visibles.length} ${visibles.length === 1 ? 'jugador' : 'jugadores'}`}
        description="Elegí el porcentaje en la fila del jugador. Se guarda al instante."
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
                  placeholder="Buscar por jugador, DNI o socio"
                  className="pl-8"
                  aria-label="Buscar becados"
                />
              </div>
              {busqueda && (
                <Button variant="ghost" size="sm" onClick={() => setBusqueda('')}>
                  <X className="h-4 w-4" />Limpiar
                </Button>
              )}
              <Button
                size="sm"
                variant={soloBecados ? 'default' : 'outline'}
                onClick={() => setSoloBecados((v) => !v)}
              >
                <BadgePercent className="h-4 w-4" />
                Solo becados
              </Button>
            </div>
          </Toolbar>
        </div>

        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : error ? (
          <p className="px-4 py-8 text-center text-sm text-danger">{error}</p>
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={filas.length === 0 ? 'No hay jugadores cargados' : 'Ningún jugador coincide'}
            description={
              filas.length === 0
                ? 'Los jugadores se cargan desde Jugadores o desde el registro de un socio.'
                : 'Probá con otro nombre o quitá el filtro de becados.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visibles.map((f) => (
              <li key={f.perfil_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {iniciales(f.nombre, f.apellido)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-main">
                      {f.apellido}, {f.nombre}
                    </p>
                    {f.beca_porcentaje > 0 && (
                      <StatusPill tone="info">Beca {f.beca_porcentaje}%</StatusPill>
                    )}
                    {!f.club_activo && <StatusPill tone="danger">Inactivo</StatusPill>}
                  </div>
                  <p className="truncate text-xs text-dim">
                    DNI {f.dni ?? '—'}
                    {f.padre ? ` · Socio: ${f.padre}` : ' · Sin familia vinculada'}
                  </p>
                </div>

                {puedeEditar ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {guardando === f.perfil_id && (
                      <Loader2 className="h-4 w-4 animate-spin text-dim" />
                    )}
                    <Select
                      value={String(f.beca_porcentaje)}
                      onValueChange={(v) => v !== null && cambiar(f, v)}
                      items={OPCIONES}
                      disabled={guardando === f.perfil_id}
                    >
                      <SelectTrigger className="w-36" aria-label={`Beca de ${f.nombre} ${f.apellido}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPCIONES.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <StatusPill tone={f.beca_porcentaje > 0 ? 'info' : 'neutral'}>
                    {f.beca_porcentaje > 0 ? `Beca ${f.beca_porcentaje}%` : 'Sin beca'}
                  </StatusPill>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Hint>
        La beca descuenta el valor de la cuota y quita el recargo. Al cambiarla se
        recalculan las cuotas <strong>pendientes</strong> de ese jugador; las ya
        pagadas no se modifican. Una beca del 100% deja la cuota del mes en $0 y
        la marca como pagada.
      </Hint>
    </div>
  );
}
