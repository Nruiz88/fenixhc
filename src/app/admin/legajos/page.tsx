'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { money, fecha, iniciales, mesNombre } from '@/lib/format';
import { Input } from '@/components/ui/input';
import {
  PageHeader, Panel, EmptyState, StatusPill, DataPoint,
  tonoEstadoCuota, Toolbar,
} from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Search, FileText, Users, Wallet, ArrowLeft, X } from 'lucide-react';

const ETIQUETA_VINCULO: Record<string, string> = {
  padre: 'Padre', madre: 'Madre', tutor: 'Tutor',
};

export default function AdminLegajos() {
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [seleccionado, setSeleccionado] = useState<any | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await db.view<any>('admin_deportistas');
      setJugadores(data ?? []);
    })();
  }, []);

  async function abrir(j: any) {
    setCargandoDetalle(true);
    setSeleccionado(j);

    // Las familias y las cuotas se piden al abrir el legajo, no al cargar
    // la lista: son 1000 filas de cuotas para ver una sola ficha.
    const { data: familias } = await db.view<any>('admin_familias');
    const suyas = (familias ?? []).filter((f: any) => f.deportista_perfil_id === j.perfil_id);
    const ids = suyas.map((f: any) => f.id);
    const { data: cuotas } = ids.length
      ? await db.select<any>('cuotas', '*', { familia_id: { op: 'in', val: ids } }, { limit: 500 })
      : { data: [] };

    setSeleccionado({ ...j, familias: suyas, cuotas: cuotas ?? [] });
    setCargandoDetalle(false);
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return jugadores;
    return jugadores.filter((j) => {
      const p = j.perfiles;
      return `${p?.nombre ?? ''} ${p?.apellido ?? ''} ${p?.dni ?? ''}`.toLowerCase().includes(q);
    });
  }, [jugadores, busqueda]);

  // Vista de detalle
  if (seleccionado) {
    const p = seleccionado.perfiles;
    const cuotas = seleccionado.cuotas ?? [];
    const total = cuotas.reduce((s: number, c: any) => s + Number(c.monto), 0);
    const pagado = cuotas
      .filter((c: any) => c.estado === 'pagada')
      .reduce((s: number, c: any) => s + Number(c.monto), 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {/* El botón de volver solo aparece en móvil, donde la lista y el
              detalle se apilan y sin él no hay forma de salir del detalle. */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSeleccionado(null)}
            aria-label="Volver a la lista"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-info/15 text-sm font-bold text-info">
            {iniciales(p?.nombre, p?.apellido)}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-main">
              {p?.nombre} {p?.apellido}
            </h1>
            <p className="truncate text-sm text-dim">DNI {p?.dni} · Legajo del jugador</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dim">Cuotas emitidas</p>
            <p className="mt-1 text-2xl font-bold tabular text-main">{cuotas.length}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dim">Cobrado</p>
            <p className="mt-1 text-2xl font-bold tabular text-ok">{money(pagado)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dim">Pendiente</p>
            <p className="mt-1 text-2xl font-bold tabular text-warn">{money(total - pagado)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-dim">Total</p>
            <p className="mt-1 text-2xl font-bold tabular text-main">{money(total)}</p>
          </div>
        </div>

        <Panel title="Datos personales">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[
              { label: 'DNI', valor: p?.dni },
              { label: 'CUIL', valor: p?.cuil },
              { label: 'Correo', valor: p?.correo },
              { label: 'Teléfono', valor: p?.telefono },
              { label: 'Dirección', valor: p?.direccion },
              { label: 'Inscripción', valor: fecha(seleccionado.fecha_inscripcion) },
            ].map((d) => (
              <DataPoint key={d.label} label={d.label} value={d.valor || '—'} />
            ))}
          </dl>
        </Panel>

        <Panel
          title="Familia"
          description="Personas responsables de las cuotas"
        >
          {seleccionado.familias.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Sin familia vinculada"
              description="Este jugador no tiene un socio benefactor asociado, así que no se le pueden imputar cuotas."
            />
          ) : (
            <ul className="space-y-2">
              {seleccionado.familias.map((f: any) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-main">
                      {f.padre?.nombre} {f.padre?.apellido}
                    </p>
                    <p className="truncate text-xs text-dim">
                      {ETIQUETA_VINCULO[f.tipo_vinculo] ?? f.tipo_vinculo} · DNI {f.padre?.dni ?? '—'}
                    </p>
                  </div>
                  {f.padre?.telefono && (
                    <a href={`tel:${f.padre.telefono}`} className="shrink-0 text-xs text-brand hover:underline">
                      {f.padre.telefono}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Historial de cuotas" description={`${cuotas.length} períodos`}>
          {cargandoDetalle ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
              ))}
            </div>
          ) : cuotas.length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-6 w-6" />}
              title="Sin cuotas emitidas"
              description="Cuando se emita una cuota para esta familia, va a aparecer acá."
            />
          ) : (
            <ul className="divide-y divide-line">
              {[...cuotas]
                .sort((a: any, b: any) => b.anio - a.anio || b.mes - a.mes)
                .map((c: any) => {
                  const tono = tonoEstadoCuota(c.estado);
                  return (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-main">
                          {mesNombre(c.mes)} {c.anio}
                        </p>
                        {c.fecha_pago && (
                          <p className="text-xs text-dim">Pagada el {fecha(c.fecha_pago)}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium tabular text-main">{money(c.monto)}</span>
                        <StatusPill tone={tono.tone}>{tono.label}</StatusPill>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </Panel>
      </div>
    );
  }

  // Vista de lista
  return (
    <div className="space-y-6">
      <PageHeader
        title="Legajos"
        description="Todo el historial de un jugador: datos, familia y cuotas."
      />

      <Panel bodyClassName="p-3">
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o DNI"
                className="pl-8"
                aria-label="Buscar jugadores"
              />
            </div>
            {busqueda && (
              <Button variant="ghost" size="sm" onClick={() => setBusqueda('')}>
                <X className="h-4 w-4" />Limpiar
              </Button>
            )}
          </div>
          <p className="shrink-0 text-xs text-dim">
            {filtrados.length} de {jugadores.length} jugadores
          </p>
        </Toolbar>
      </Panel>

      {jugadores.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No hay jugadores para mostrar"
            description="Los legajos se crean a partir de las fichas de jugadores."
          />
        </Panel>
      ) : filtrados.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Ningún jugador coincide"
            description="Probá con otro nombre o DNI."
            action={<Button variant="outline" size="sm" onClick={() => setBusqueda('')}>Ver todos</Button>}
          />
        </Panel>
      ) : (
        <>
          {/* Lista. En móvil ocupa el ancho completo; en lg se convierte en
              la columna izquierda del detalle. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ul className="space-y-2 lg:col-span-1">
              {filtrados.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => abrir(j)}
                    className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-info/15 text-xs font-bold text-info">
                      {iniciales(j.perfiles?.nombre, j.perfiles?.apellido)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-main">
                        {j.perfiles?.nombre} {j.perfiles?.apellido}
                      </span>
                      <span className="block truncate text-xs text-dim">DNI {j.perfiles?.dni}</span>
                    </span>
                    <StatusPill tone={j.club_activo ? 'ok' : 'neutral'}>
                      {j.club_activo ? 'Activo' : 'Inactivo'}
                    </StatusPill>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Vista previa: solo en pantallas grandes, donde hay lugar para la
              columna del detalle al lado. */}
          <Panel className="hidden lg:block">
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Elegí un jugador de la lista"
              description="A la izquierda vas a ver el legajo completo: datos personales, familia y estado de cada cuota."
            />
          </Panel>
        </>
      )}
    </div>
  );
}
