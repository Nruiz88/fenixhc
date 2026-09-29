'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/adminQuery';
import { toast } from 'sonner';
import { fecha } from '@/lib/format';
import { todayISO } from '@/lib/dates';
import { PageHeader, Panel, EmptyState, Toolbar, StatusPill, tonoReserva } from '@/components/admin/ui';
import { Confirmar } from '@/components/admin/confirmar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDays, MapPin, Clock, XCircle, X } from 'lucide-react';

const hora = (v: string) => String(v ?? '').slice(0, 5);

export default function AdminReservas() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [soloFuturas, setSoloFuturas] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [aCancelar, setACancelar] = useState<any | null>(null);

  async function cargar() {
    setCargando(true);
    const { data } = await db.view<any>('admin_reservas');
    setReservas(data ?? []);
    setCargando(false);
  }

  useEffect(() => { cargar(); }, []);

  const visibles = useMemo(() => {
    const hoy = todayISO();
    const q = busqueda.trim().toLowerCase();
    return reservas
      .filter((r) => (soloFuturas ? String(r.fecha) >= hoy : true))
      .filter((r) => {
        if (!q) return true;
        return `${r.canchas?.nombre ?? ''} ${r.perfiles?.nombre ?? ''} ${r.perfiles?.apellido ?? ''}`
          .toLowerCase()
          .includes(q);
      });
  }, [reservas, soloFuturas, busqueda]);

  async function cancelar() {
    if (!aCancelar) return;
    const { error } = await db.update('reservas', { estado: 'cancelada' }, { id: aCancelar.id });
    if (error) { toast.error(error); return; }
    toast.success('Reserva cancelada. La cancha queda liberada para ese horario.');
    setACancelar(null);
    await cargar();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservas de cancha"
        description="Turnos que tomaron los socios. Cancelar libera el horario para que otro lo pueda usar."
      />

      <Panel bodyClassName="p-3">
        <Toolbar>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por cancha o socio"
                className="pl-8"
                aria-label="Buscar reservas"
              />
            </div>
            <Button size="sm" variant={soloFuturas ? 'default' : 'outline'} onClick={() => setSoloFuturas((v) => !v)}>
              Solo próximas
            </Button>
            {(busqueda || !soloFuturas) && (
              <Button variant="ghost" size="sm" onClick={() => { setBusqueda(''); setSoloFuturas(true); }}>
                <X className="h-4 w-4" />Limpiar
              </Button>
            )}
          </div>
          <p className="shrink-0 text-xs text-dim">
            {visibles.length} de {reservas.length} reservas
          </p>
        </Toolbar>
      </Panel>

      {cargando ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : visibles.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title={
              reservas.length === 0
                ? 'Todavía no hay reservas'
                : 'No hay reservas con este filtro'
            }
            description={
              reservas.length === 0
                ? 'Cuando un socio reserve una cancha desde su portal, el turno aparece acá.'
                : 'Desactivá "Solo próximas" para ver también las reservas viejas.'
            }
            action={
              reservas.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => { setBusqueda(''); setSoloFuturas(false); }}>
                  Ver todas
                </Button>
              ) : undefined
            }
          />
        </Panel>
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {visibles.map((r) => {
              const tono = tonoReserva(r.estado);
              const cancelada = r.estado === 'cancelada';
              return (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                    <CalendarDays className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${cancelada ? 'text-dim line-through' : 'text-main'}`}>
                      {r.canchas?.nombre || 'Cancha'}
                    </p>
                    {/* flex-wrap: fecha, hora y persona no entran en una línea
                        en pantallas angostas y se cortaban a la mitad. */}
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dim">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />{fecha(r.fecha)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />{hora(r.hora_inicio)} a {hora(r.hora_fin)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.perfiles?.nombre} {r.perfiles?.apellido}</span>
                      </span>
                    </div>
                  </div>

                  <StatusPill tone={tono.tone}>{tono.label}</StatusPill>

                  {r.estado === 'confirmada' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-dim hover:text-danger"
                      onClick={() => setACancelar(r)}
                      aria-label={`Cancelar reserva de ${r.canchas?.nombre}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <Confirmar
        abierto={!!aCancelar}
        onCerrar={() => setACancelar(null)}
        onConfirmar={cancelar}
        titulo="Cancelar la reserva"
        descripcion={`Se cancela el turno de ${aCancelar?.canchas?.nombre} del ${fecha(aCancelar?.fecha)}, de ${hora(aCancelar?.hora_inicio)} a ${hora(aCancelar?.hora_fin)}. La persona queda avisada al ver su portal.`}
        textoConfirmar="Cancelar reserva"
      />
    </div>
  );
}
