'use client';

import { useState } from 'react';
import { ConfiguracionCuenta } from '@/components/ConfiguracionCuenta';
import AdminConfiguracionCuotas from './cuotas/page';
import SolicitudesBaja from '@/app/admin/privacidad/solicitudes/page';
import { PageHeader } from '@/components/admin/ui';
import { User, Coins, Inbox } from 'lucide-react';

// Configuración del panel con pestañas en vez de una sola pantalla larga.
//
// Con varias secciones, unos botones que cambian la vista usan menos espacio
// que todo apilado, y no hay que scrollear para llegar a lo último.
//
// "Solicitudes de baja" es la primera porque es lo urgente: la ley obliga a
// responder en 10 días hábiles y la bandeja se llena sola, sin que nadie
// tenga que acordarse de mirarla.

const PESTANAS = [
  { clave: 'solicitudes', etiqueta: 'Solicitudes de baja', icono: Inbox },
  { clave: 'cuotas', etiqueta: 'Cuotas y vencimientos', icono: Coins },
  { clave: 'cuenta', etiqueta: 'Mi cuenta', icono: User },
] as const;

type Clave = (typeof PESTANAS)[number]['clave'];

export default function AdminConfiguracion() {
  const [pestana, setPestana] = useState<Clave>('solicitudes');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Pedidos de baja, precios de la cuota y tus datos de acceso."
      />

      <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setPestana(p.clave)}
            className={
              pestana === p.clave
                ? 'flex items-center gap-1.5 rounded-md bg-surface-3 px-3 py-1.5 text-sm font-medium text-main transition-colors'
                : 'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-main'
            }
          >
            <p.icono className="h-4 w-4" />
            {p.etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'cuotas' && <AdminConfiguracionCuotas />}
      {pestana === 'cuenta' && <ConfiguracionCuenta />}
      {pestana === 'solicitudes' && (
        <SolicitudesBaja />
      )}
    </div>
  );
}
