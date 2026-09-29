'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/lib/adminQuery';
import { iniciales, fecha } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { PageHeader, StatCard, Panel, EmptyState, Toolbar, StatusPill } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { UserCheck, Search, X, FileText } from 'lucide-react';

export default function AdminJugadores() {
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const { data } = await db.view<any>('admin_deportistas');
      setJugadores(data ?? []);
      setCargando(false);
    })();
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return jugadores
      .filter((j) => (soloActivos ? j.club_activo : true))
      .filter((j) => {
        const p = j.perfiles;
        if (!q) return true;
        return `${p?.nombre ?? ''} ${p?.apellido ?? ''} ${p?.dni ?? ''}`.toLowerCase().includes(q);
      });
  }, [jugadores, busqueda, soloActivos]);

  const activos = jugadores.filter((j) => j.club_activo).length;
  const conDocumento = jugadores.filter(
    (j) => j.dni_frente_url && j.dni_fondo_url
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jugadores"
        description="Fichas de los atletas del club, con su documentación e inscripción."
        actions={
          <Button variant="outline" size="sm" render={<Link href="/admin/legajos" />}>
            <FileText className="h-4 w-4" />Legajos
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Jugadores inscriptos" value={jugadores.length} icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Activos" value={activos} hint={`${jugadores.length - activos} inactivos`} tone="ok" />
        <StatCard
          label="Con DNI completo"
          value={conDocumento}
          hint={`${jugadores.length - conDocumento} sin documentación`}
          tone={conDocumento === jugadores.length ? 'ok' : 'warn'}
        />
      </div>

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
            <Button
              size="sm"
              variant={soloActivos ? 'default' : 'outline'}
              onClick={() => setSoloActivos((v) => !v)}
            >
              Solo activos
            </Button>
            {(busqueda || soloActivos) && (
              <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setSoloActivos(false); }}>
                <X className="h-4 w-4" />Limpiar
              </Button>
            )}
          </div>
          <p className="shrink-0 text-xs text-dim">
            {visibles.length} de {jugadores.length}
          </p>
        </Toolbar>
      </Panel>

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<UserCheck className="h-6 w-6" />}
            title={
              jugadores.length === 0
                ? 'No hay jugadores inscriptos'
                : 'Ningún jugador coincide con el filtro'
            }
            description={
              jugadores.length === 0
                ? 'Las fichas se crean al vincular un socio benefactor con su hijo desde Vínculos familiares.'
                : 'Probá con otro nombre o desactivá el filtro de activos.'
            }
            action={
              jugadores.length === 0 ? (
                <Button size="sm" render={<Link href="/admin/links-familia" />}>Ir a Vínculos familiares</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setSoloActivos(false); }}>
                  Ver todos
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((j) => {
            const p = j.perfiles;
            const completo = j.dni_frente_url && j.dni_fondo_url;
            return (
              <article key={j.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-info/15 text-xs font-bold text-info">
                    {iniciales(p?.nombre, p?.apellido)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold text-main" title={`${p?.nombre} ${p?.apellido}`}>
                      {p?.nombre} {p?.apellido}
                    </h2>
                    <p className="truncate text-xs text-dim">DNI {p?.dni || '—'}</p>
                  </div>
                  <StatusPill tone={j.club_activo ? 'ok' : 'neutral'}>
                    {j.club_activo ? 'Activo' : 'Inactivo'}
                  </StatusPill>
                </div>

                <dl className="mt-4 space-y-2 border-t border-line pt-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-dim">Inscripción</dt>
                    <dd className="text-muted">{fecha(j.fecha_inscripcion)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-dim">Documentación</dt>
                    <dd>
                      <StatusPill tone={completo ? 'ok' : 'warn'}>
                        {completo ? 'Completa' : 'Falta'}
                      </StatusPill>
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
