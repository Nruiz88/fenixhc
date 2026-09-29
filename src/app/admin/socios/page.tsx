'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/lib/adminQuery';
import { iniciales } from '@/lib/format';
import { Input } from '@/components/ui/input';
import { PageHeader, Panel, EmptyState, Toolbar, DataPoint } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { Users, Search, X, Phone, Mail, MapPin } from 'lucide-react';

export default function AdminSocios() {
  const [socios, setSocios] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      setCargando(true);
      const { data } = await db.select<any>('perfiles', '*', { rol: 'socio_benefactor' }, { limit: 1000 });
      setSocios(data ?? []);
      setCargando(false);
    })();
  }, []);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return socios;
    return socios.filter((s) =>
      `${s.nombre} ${s.apellido} ${s.dni ?? ''} ${s.correo ?? ''}`.toLowerCase().includes(q)
    );
  }, [socios, busqueda]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Socios benefactores"
        description="Las personas responsables de cuotas. Acá están sus datos de contacto para Cobrar o avisar."
      />

      <Panel
        title={`${socios.length} ${socios.length === 1 ? 'socio' : 'socios'}`}
        bodyClassName="p-3"
      >
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, DNI o email"
                className="pl-8"
                aria-label="Buscar socios"
              />
            </div>
            {busqueda && (
              <Button variant="ghost" size="sm" onClick={() => setBusqueda('')}>
                <X className="h-4 w-4" />Limpiar
              </Button>
            )}
          </div>
          <Button size="sm" variant="ghost" render={<Link href="/admin/legajos" />}>
            Ver legajos
          </Button>
        </Toolbar>
      </Panel>

      {cargando ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={socios.length === 0 ? 'No hay socios cargados' : 'Ningún socio coincide'}
            description={
              socios.length === 0
                ? 'Los socios se crean desde la pantalla Usuarios, eligiendo el rol "Socio Benefactor".'
                : 'Probá con otro nombre o DNI.'
            }
            action={
              socios.length === 0 ? (
                <Button size="sm" render={<Link href="/admin/usuarios" />}>Ir a Usuarios</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setBusqueda('')}>Ver todos</Button>
              )
            }
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibles.map((s) => (
            <article key={s.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/15 text-xs font-bold text-brand">
                  {iniciales(s.nombre, s.apellido)}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-main" title={`${s.nombre} ${s.apellido}`}>
                    {s.nombre} {s.apellido}
                  </h2>
                  <p className="truncate text-xs text-dim">DNI {s.dni}</p>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DataPoint
                  label="Email"
                  value={
                    s.correo ? (
                      <a href={`mailto:${s.correo}`} className="flex min-w-0 items-center gap-1.5 text-brand hover:underline">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.correo}</span>
                      </a>
                    ) : '—'
                  }
                />
                <DataPoint
                  label="Teléfono"
                  value={
                    s.telefono ? (
                      <a href={`tel:${s.telefono}`} className="flex min-w-0 items-center gap-1.5 text-brand hover:underline">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{s.telefono}</span>
                      </a>
                    ) : '—'
                  }
                />
                <DataPoint
                  label="Dirección"
                  value={
                    s.direccion ? (
                      <span className="flex min-w-0 items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="break-words">{s.direccion}</span>
                      </span>
                    ) : '—'
                  }
                />
                <DataPoint label="Alta" value={new Date(s.created_at).toLocaleDateString('es-AR')} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
